import * as THREE from 'three'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Float, Html, MeshTransmissionMaterial, useCursor, useGLTF } from '@react-three/drei'
import { easing } from 'maath'
import { dragState, focusState, scrollState } from './scrollState'

const MODEL = '/models/iceberg.glb'

// ===== selubung wireframe LOKAL pas hover (permintaan Nehemiah) =====
// dulu: hover = wireframe nyala di SELURUH batu (keliatan kayak model 3D telanjang).
// sekarang: garis geometri cuma "kebuka" di sekitar titik kursor, disapu
// gelombang cincin keluar = lapisan-lapisan yang bergerak melapisi batunya.
// Teknik: barycentric wireframe (tiap vertex dikasih koordinat sudut segitiga,
// fragment deket tepi segitiga = garis) di-mask jarak ke titik hover.
//
// Yang bikin versi pertama masih kerasa "kerangka Blender": SEMUA edge segitiga
// kegambar, termasuk diagonal hasil triangulasi yang bukan bentuk asli objek.
// Sekarang tiap edge dikasih flag (aEdge): cuma crease & siluet yang digambar
// (lihat buildVeilGeometry), plus garisnya dikasih fresnel, simpul di sudut,
// dan cincin scan bertepi tajam — jadi kebaca kayak struktur/HUD, bukan mesh mentah.
const veilVert = /* glsl */ `
  attribute vec3 aBary;
  attribute vec3 aEdge;
  varying vec3 vBary;
  varying vec3 vEdge;
  varying vec3 vPos;
  varying vec3 vN;
  varying vec3 vView;
  uniform vec3 uPoint;
  uniform float uTime;
  uniform float uRadius;
  uniform float uReach;
  void main() {
    vBary = aBary;
    vEdge = aEdge;
    vPos = position;
    vN = normalize(normalMatrix * normal);
    float d = distance(position, uPoint) / uRadius;
    float mask = 1.0 - smoothstep(0.0, 1.0, d);
    // "napas" lapisan: permukaan veil ngangkat tipis ngikutin gelombang yang
    // nyapu keluar dari titik hover — kerasa ada selubung yang gerak, bukan tempelan
    float wave = 0.5 + 0.5 * sin(d * 13.0 - uTime * 3.2);
    vec3 p = position + normal * (0.004 + 0.022 * mask * wave) * uReach;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`
const veilFrag = /* glsl */ `
  varying vec3 vBary;
  varying vec3 vEdge;
  varying vec3 vPos;
  varying vec3 vN;
  varying vec3 vView;
  uniform vec3 uPoint;
  uniform vec3 uColor;
  uniform vec3 uHot;
  uniform float uTime;
  uniform float uRadius;
  uniform float uReach;
  void main() {
    float d = distance(vPos, uPoint) / uRadius;
    float mask = 1.0 - smoothstep(0.26, 1.0, d);
    float k = mask * uReach;
    if (k < 0.004) discard;

    // edge yang dimatiin (diagonal triangulasi) jaraknya dipaksa jauh, jadi
    // gak pernah kegambar. Sisanya: jarak fragment ke edge terdekat → garis AA
    vec3 b = mix(vec3(4.0), vBary, step(0.5, vEdge));
    float w = min(b.x, min(b.y, b.z));
    float aa = max(fwidth(w), 1e-5);
    float line = 1.0 - smoothstep(0.0, aa * 2.0, w);
    float halo = 1.0 - smoothstep(0.0, aa * 9.0, w); // pendar tipis di sekitar garis

    // simpul kecil di titik sudut mesh (cuma sudut yang punya edge aktif)
    float c = max(vBary.x, max(vBary.y, vBary.z));
    float node = smoothstep(0.978, 0.999, c) * max(vEdge.x, max(vEdge.y, vEdge.z));

    // fresnel: garis yang miring ngadep tepi siluet lebih nyala — kesan selubung
    // beneran MEMBUNGKUS permukaan, bukan tekstur garis yang ditempel datar
    float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vView))), 2.0);

    // cincin scan nyapu keluar dari titik sentuh: tepi depan tajam, ekor meredup
    float ph = fract(d * 2.4 - uTime * 0.5);
    float scan = pow(1.0 - ph, 9.0);

    // garis kontur konsentris yang ngikutin lekuk permukaan (kayak garis
    // topografi) — ini yang bikin kebaca "lagi dipindai berlapis", bukan
    // kerangka mesh. Tebalnya dihitung dari turunan biar tetep tipis rata
    float cd = d * 7.5 - uTime * 0.42;
    float cw = fwidth(cd) * 1.3;
    float contour = smoothstep(0.5 - cw, 0.5, abs(fract(cd) - 0.5));
    contour *= 1.0 - smoothstep(0.55, 0.95, d); // ngilang mulus di tepi selubung
    // tepi selubungnya sendiri ikut bergaris = "lapisan" punya batas yang kebaca
    float rim = smoothstep(0.82, 0.96, d) * (1.0 - smoothstep(0.96, 1.04, d));

    float energy = 0.5 + 0.65 * fres + 1.5 * scan;
    // warna dinaikin di puncak cincin sampai lewat ambang bloom (0.88) —
    // jadi garisnya dapet pendar GPU beneran, bukan cuma putih datar
    vec3 col = mix(uColor, uHot, clamp(scan * 1.15 + fres * 0.3, 0.0, 1.0)) * (1.0 + 1.5 * scan);
    float a = line * energy + halo * 0.1 * (0.35 + fres) + node * 0.9 + rim * 0.3 + fres * 0.06
            + contour * 0.32 * (0.45 + 0.55 * fres);
    gl_FragColor = vec4(col, a * k);
  }
`

// geometri veil dipakai bareng antar batu yang modelnya sama → cache biar
// analisis crease-nya cuma sekali per model
const veilCache = new WeakMap()

// Bangun geometri selubung: non-indexed + koordinat barycentric + flag edge.
// Flag-nya nentuin edge mana yang layak digambar: edge batas (cuma dipunya 1
// segitiga) selalu ikut, sisanya dinilai dari sudut dihedral antar dua muka.
// Ambangnya diambil dari persentil (bukan angka mati) biar densitas garisnya
// konsisten dipakai di model manapun: rapat atau jarang triangulasinya.
function buildVeilGeometry(src) {
  const cached = veilCache.get(src)
  if (cached) return cached

  const g = src.index ? src.toNonIndexed() : src.clone()
  const pos = g.attributes.position.array
  const n = g.attributes.position.count
  const tri = n / 3

  // vertex dikuantisasi biar duplikat hasil non-index nyatu jadi satu simpul
  const keys = new Array(n)
  for (let i = 0; i < n; i++) {
    keys[i] =
      `${Math.round(pos[i * 3] * 1e4)},${Math.round(pos[i * 3 + 1] * 1e4)},${Math.round(pos[i * 3 + 2] * 1e4)}`
  }
  const ek = (i, j) => (keys[i] < keys[j] ? `${keys[i]}|${keys[j]}` : `${keys[j]}|${keys[i]}`)

  // normal per muka
  const fn = new Float32Array(tri * 3)
  const va = new THREE.Vector3()
  const vb = new THREE.Vector3()
  const vc = new THREE.Vector3()
  const e1 = new THREE.Vector3()
  const e2 = new THREE.Vector3()
  const nr = new THREE.Vector3()
  for (let t = 0; t < tri; t++) {
    va.fromArray(pos, t * 9)
    vb.fromArray(pos, t * 9 + 3)
    vc.fromArray(pos, t * 9 + 6)
    nr.crossVectors(e1.subVectors(vb, va), e2.subVectors(vc, va)).normalize()
    fn[t * 3] = nr.x
    fn[t * 3 + 1] = nr.y
    fn[t * 3 + 2] = nr.z
  }

  // muka-muka yang berbagi tiap edge. Barycentric x=0 di edge SEBERANG vertex 0,
  // makanya urutannya (v1,v2), (v2,v0), (v0,v1)
  const share = new Map()
  for (let t = 0; t < tri; t++) {
    const i0 = t * 3
    const pairs = [
      [i0 + 1, i0 + 2],
      [i0 + 2, i0],
      [i0, i0 + 1],
    ]
    for (let e = 0; e < 3; e++) {
      const k = ek(pairs[e][0], pairs[e][1])
      const rec = share.get(k)
      if (rec) rec.push(t)
      else share.set(k, [t])
    }
  }

  // sudut dihedral per edge (edge batas = tak hingga, selalu digambar)
  const angle = new Map()
  const inner = []
  share.forEach((ts, k) => {
    if (ts.length < 2) {
      angle.set(k, Infinity)
      return
    }
    const a = ts[0] * 3
    const b = ts[1] * 3
    const dot = Math.min(1, Math.max(-1, fn[a] * fn[b] + fn[a + 1] * fn[b + 1] + fn[a + 2] * fn[b + 2]))
    const ang = Math.acos(dot)
    angle.set(k, ang)
    inner.push(ang)
  })
  // ambang = persentil 52 (kira-kira separuh edge kebuang), dikurung 3.5°..20°
  // biar mesh halus gak jadi kosong melompong dan mesh faceted gak ramai lagi
  inner.sort((a, b) => a - b)
  const p52 = inner.length ? inner[Math.floor(inner.length * 0.52)] : 0.2
  const limit = Math.min(0.35, Math.max(0.06, p52))

  const bary = new Float32Array(n * 3)
  const emask = new Float32Array(n * 3)
  for (let t = 0; t < tri; t++) {
    const i0 = t * 3
    const on = [
      angle.get(ek(i0 + 1, i0 + 2)) >= limit ? 1 : 0,
      angle.get(ek(i0 + 2, i0)) >= limit ? 1 : 0,
      angle.get(ek(i0, i0 + 1)) >= limit ? 1 : 0,
    ]
    for (let v = 0; v < 3; v++) {
      const o = (i0 + v) * 3
      bary[o + v] = 1
      // flag edge konstan sepanjang muka (tiga vertex isinya sama)
      emask[o] = on[0]
      emask[o + 1] = on[1]
      emask[o + 2] = on[2]
    }
  }

  g.setAttribute('aBary', new THREE.BufferAttribute(bary, 3))
  g.setAttribute('aEdge', new THREE.BufferAttribute(emask, 3))
  g.computeBoundingSphere()
  veilCache.set(src, g)
  return g
}

export function Crystal({ data, onOpen, interactive = true, snapT = 0 }) {
  const { nodes } = useGLTF(data.model ?? MODEL)
  const group = useRef()
  const spinner = useRef()
  const veil = useRef()
  const dragging = useRef(null)
  const dragMoved = useRef(false) // true kalau gesture terakhir beneran muter (bukan klik)
  const [hovered, setHovered] = useState(false)
  const [near, setNear] = useState(!interactive)
  const wp = useMemo(() => new THREE.Vector3(), [])
  const hoverPt = useRef(new THREE.Vector3()) // titik hover terakhir (world space)
  const lv = useMemo(() => new THREE.Vector3(), []) // kerja: world → local
  const draggable = !!data.draggable
  useCursor(hovered && (interactive || draggable))

  const geometry = useMemo(() => Object.values(nodes).find((n) => n.isMesh)?.geometry, [nodes])

  // geometri veil (barycentric + flag edge) — di-cache per model
  const veilGeo = useMemo(() => (geometry ? buildVeilGeometry(geometry) : null), [geometry])

  const veilMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uPoint: { value: new THREE.Vector3(0, 999, 0) },
          uColor: { value: new THREE.Color('#bfe2ff') }, // garis: biru es
          uHot: { value: new THREE.Color('#ffffff') }, // puncak cincin scan
          uTime: { value: 0 },
          uRadius: { value: 1 },
          uReach: { value: 0 },
        },
        vertexShader: veilVert,
        fragmentShader: veilFrag,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    []
  )
  useEffect(() => {
    // radius area yang kebuka ~ separuh badan batu — cukup buat kerasa "lokal"
    if (veilGeo) veilMat.uniforms.uRadius.value = (veilGeo.boundingSphere?.radius ?? 1) * 0.55
  }, [veilGeo, veilMat])

  useFrame((state, delta) => {
    if (!group.current || !spinner.current) return
    // hanya mesh-nya yang muter — label anotasi tetap diam ala igloo.
    // pas lagi di-drag, auto-spin berhenti biar gak rebutan kendali.
    if (!dragging.current) spinner.current.rotation.y += delta * (data.spin ?? 0.06)
    const s = (data.scale ?? 1) * (interactive && hovered ? 1.07 : 1)
    easing.damp3(group.current.scale, [s, s, s], 0.25, delta)
    // selubung wireframe lokal: fade in/out + titik hover dikejar pake damping
    // (batunya muter, jadi titik world harus dikonversi ulang ke local tiap frame)
    if (veil.current) {
      const u = veilMat.uniforms
      u.uTime.value += delta
      easing.damp(u.uReach, 'value', hovered ? 1 : 0, 0.22, delta)
      if (u.uReach.value > 0.002) {
        veil.current.worldToLocal(lv.copy(hoverPt.current))
        easing.damp3(u.uPoint.value, lv, 0.1, delta)
      }
    }
    if (interactive) {
      group.current.getWorldPosition(wp)
      const n = state.camera.position.distanceTo(wp) < 14
      if (n !== near) setNear(n)
    }
  })

  const events = {
    onPointerOver: (e) => {
      e.stopPropagation()
      setHovered(true)
      // titik masuk langsung di-snap (tanpa damping) biar veil-nya nongol pas
      // di tempat kursor nyentuh, bukan nyapu dari posisi hover sebelumnya
      hoverPt.current.copy(e.point)
      if (veil.current) veilMat.uniforms.uPoint.value.copy(veil.current.worldToLocal(lv.copy(e.point)))
    },
    onPointerMove: (e) => {
      hoverPt.current.copy(e.point)
    },
    onPointerOut: () => setHovered(false),
  }
  if (interactive) {
    events.onClick = (e) => {
      e.stopPropagation()
      // baru abis muter batunya? jangan buka panel — itu drag, bukan klik
      if (dragMoved.current) {
        dragMoved.current = false
        return
      }
      onOpen?.(data.id, data.position)
    }
  }
  useEffect(() => {
    if (!draggable) return
    // ala igloo: pas batu ini yang lagi di-frame kamera (scroll deket snap-nya),
    // drag DI MANA AJA muterin batunya — gak tergantung raycast kena mesh (sering
    // ketutup overlay/kabut). Gate ke jendela snap-nya biar cuma 1 batu yang aktif,
    // gak semua batu muter barengan pas di-drag
    const down = (e) => {
      if (focusState.phase !== 'idle') return // lagi nyelam ke batu — jangan drag
      if (Math.abs(scrollState.damped - snapT) > 0.09) return
      if (e.target.closest?.('a, button, .panel, .rock-modal')) return
      dragging.current = { x: e.clientX, y: e.clientY }
      dragMoved.current = false
      dragState.active = true
      document.body.style.cursor = 'grabbing'
    }
    const move = (e) => {
      if (!dragging.current || !spinner.current) return
      const dx = e.clientX - dragging.current.x
      const dy = e.clientY - dragging.current.y
      // gerakan berarti = tandain drag (biar klik setelahnya gak buka panel)
      if (Math.abs(dx) + Math.abs(dy) > 3) dragMoved.current = true
      spinner.current.rotation.y += dx * 0.01
      spinner.current.rotation.x = THREE.MathUtils.clamp(spinner.current.rotation.x + dy * 0.006, -0.6, 0.6)
      dragging.current = { x: e.clientX, y: e.clientY }
    }
    const up = () => {
      if (!dragging.current) return
      dragging.current = null
      dragState.active = false
      document.body.style.cursor = ''
    }
    window.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      window.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [draggable, snapT])

  return (
    <Float speed={1.1} rotationIntensity={draggable ? 0 : 0.1} floatIntensity={0.4}>
      <group ref={group} position={data.position} scale={0.001} {...events}>
        <group ref={spinner} rotation={[0, data.yaw ?? 0, 0]}>
          <mesh geometry={geometry}>
            <MeshTransmissionMaterial
              transmissionSampler
              samples={4}
              resolution={256}
              transmission={1}
              thickness={1.8}
              roughness={0.1}
              ior={1.31}
              chromaticAberration={0.05}
              anisotropy={0.15}
              distortion={0.08}
              distortionScale={0.2}
              temporalDistortion={0.03}
              color="#eaf2f7"
              attenuationColor="#d6e8f1"
              attenuationDistance={6}
              clearcoat={1}
              clearcoatRoughness={0.12}
              envMapIntensity={1.1}
            />
          </mesh>
          {/* selubung wireframe lokal: cuma sekitar kursor yang kebuka garis
              geometrinya, disapu gelombang cincin keluar (shader di atas) */}
          <mesh ref={veil} geometry={veilGeo} material={veilMat} scale={1.004} />
          <Artifact type={data.artifact} />
        </group>
        {interactive && (
          <Html position={data.labelOffset ?? [1.5, 0.8, 0]} zIndexRange={[8, 0]}>
            <div
              className={`anno ${near ? 'is-visible' : ''} ${hovered ? 'is-hot' : ''}`}
              style={{ pointerEvents: near ? 'auto' : 'none' }}
              onClick={() => onOpen?.(data.id, data.position)}
              onPointerOver={() => setHovered(true)}
              onPointerOut={() => setHovered(false)}
            >
              <div className="anno-code">{data.tag}</div>
              <div className="anno-name">{data.name}</div>
              <div className="anno-cta">CLICK TO EXPLORE</div>
            </div>
          </Html>
        )}
      </group>
    </Float>
  )
}

// artefak gelap di dalam es — ala penguin dalam bongkahan igloo
function Artifact({ type }) {
  if (!type) return null
  return (
    <mesh scale={0.8}>
      {type === 'tetrahedron' && <tetrahedronGeometry args={[0.4, 0]} />}
      {type === 'octahedron' && <octahedronGeometry args={[0.34, 0]} />}
      {type === 'torusknot' && <torusKnotGeometry args={[0.26, 0.085, 110, 14]} />}
      {type === 'icosahedron' && <icosahedronGeometry args={[0.32, 0]} />}
      <meshStandardMaterial color="#46505a" roughness={0.4} metalness={0.3} />
    </mesh>
  )
}

useGLTF.preload(MODEL)
useGLTF.preload('/models/iceberg_hero.glb')
