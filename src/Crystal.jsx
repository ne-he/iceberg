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
const veilVert = /* glsl */ `
  attribute vec3 aBary;
  varying vec3 vBary;
  varying vec3 vPos;
  uniform vec3 uPoint;
  uniform float uTime;
  uniform float uRadius;
  uniform float uReach;
  void main() {
    vBary = aBary;
    vPos = position;
    float d = distance(position, uPoint) / uRadius;
    float mask = 1.0 - smoothstep(0.0, 1.0, d);
    // "napas" lapisan: permukaan veil ngangkat tipis ngikutin gelombang yang
    // nyapu keluar dari titik hover — kerasa ada selubung yang gerak, bukan tempelan
    float wave = 0.5 + 0.5 * sin(d * 16.0 - uTime * 4.5);
    vec3 p = position + normal * (0.004 + 0.03 * mask * wave) * uReach;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`
const veilFrag = /* glsl */ `
  varying vec3 vBary;
  varying vec3 vPos;
  uniform vec3 uPoint;
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uRadius;
  uniform float uReach;
  void main() {
    float d = distance(vPos, uPoint) / uRadius;
    float mask = 1.0 - smoothstep(0.3, 1.0, d);
    float k = mask * uReach;
    if (k < 0.004) discard;
    // jarak fragment ke tepi segitiga terdekat → garis wireframe anti-alias
    float w = min(vBary.x, min(vBary.y, vBary.z));
    float line = 1.0 - smoothstep(0.0, fwidth(w) * 1.7, w);
    // cincin cahaya nyapu keluar: garis di jalur cincin nyala lebih terang
    float ring = pow(0.5 + 0.5 * sin(d * 16.0 - uTime * 4.5), 3.0);
    // titik kontak dikasih glow lembut biar ada "sentuhan"
    float glow = (1.0 - smoothstep(0.0, 0.38, d)) * 0.14;
    gl_FragColor = vec4(uColor, (line * (0.4 + 0.6 * ring) + glow) * k);
  }
`

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

  // geometri veil: non-indexed + attribute barycentric (tiap segitiga dapet
  // (1,0,0)(0,1,0)(0,0,1)) — syarat wireframe shader di atas
  const veilGeo = useMemo(() => {
    if (!geometry) return null
    const g = geometry.index ? geometry.toNonIndexed() : geometry.clone()
    const n = g.attributes.position.count
    const bary = new Float32Array(n * 3)
    for (let i = 0; i < n; i += 3) {
      bary[i * 3] = 1
      bary[(i + 1) * 3 + 1] = 1
      bary[(i + 2) * 3 + 2] = 1
    }
    g.setAttribute('aBary', new THREE.BufferAttribute(bary, 3))
    g.computeBoundingSphere()
    return g
  }, [geometry])

  const veilMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uPoint: { value: new THREE.Vector3(0, 999, 0) },
          uColor: { value: new THREE.Color('#dff1ff') },
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
