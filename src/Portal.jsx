import * as THREE from 'three'
import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Sparkles, useGLTF } from '@react-three/drei'
import { scrollState } from './scrollState'

// portal es ala igloo.inc, dimodel di Blender (ring luar bergelombang +
// 8 segmen dalam), di-load dari GLB. Dipasang HORIZONTAL ngambang TINGGI di atas
// cluster kristal (jaraknya jauh): kamera nyorot lurus dari atas nembus lubangnya
// (kristal keliatan kecil jauh di bawah), lalu NYELAM NEMBUS ring, pas nembus,
// layar kesorot cahaya es sekejap = sensasi masuk dunia lain, baru turun ke
// kristal & wajah (permintaan Nehemiah: "masuk lewatin portal yg nyala, kerasa
// different world")
export const PORTAL_POS = [0, -32.8, 1.5]

// prefers-reduced-motion: kilatan layar dimatiin total
const CALM = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
const clamp01 = (v) => Math.max(0, Math.min(1, v))
const sstep = (a, b, x) => {
  const t = clamp01((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}

// tekstur glow dibikin di canvas: ring cahaya + blob inti, pengganti bloom
// post-processing yang berat. Additive + fog:false biar nembus kabut.
function makeGlowTexture(draw) {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  draw(c.getContext('2d'))
  const t = new THREE.CanvasTexture(c)
  return t
}

export function Portal() {
  const { nodes } = useGLTF('/models/portal.glb')
  const group = useRef()
  const segs = useRef()
  const ringMat = useRef()
  const segMat = useRef()
  const glowRing = useRef()
  const glowCore = useRef()
  const light = useRef()

  const [ringGeo, segGeo] = useMemo(() => {
    const meshes = Object.values(nodes).filter((n) => n.isMesh)
    // ring luar = geometry dengan bounding paling gede
    meshes.forEach((m) => m.geometry.computeBoundingSphere())
    meshes.sort((a, b) => b.geometry.boundingSphere.radius - a.geometry.boundingSphere.radius)
    return [meshes[0]?.geometry, meshes[1]?.geometry]
  }, [nodes])

  const ringGlowTex = useMemo(
    () =>
      makeGlowTexture((g) => {
        const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128)
        grad.addColorStop(0, 'rgba(255,255,255,0)')
        grad.addColorStop(0.46, 'rgba(230,244,255,0)')
        grad.addColorStop(0.62, 'rgba(244,251,255,1)')
        grad.addColorStop(0.72, 'rgba(232,246,255,0.85)')
        grad.addColorStop(0.86, 'rgba(214,238,255,0.28)')
        grad.addColorStop(1, 'rgba(255,255,255,0)')
        g.fillStyle = grad
        g.fillRect(0, 0, 256, 256)
      }),
    []
  )
  const coreGlowTex = useMemo(
    () =>
      makeGlowTexture((g) => {
        // inti di-tint cyan es (bukan putih polos): additive putih murni di atas
        // kabut pucat cuma "nyuci" jadi kelabu, cyan bikin kebaca sebagai ENERGI
        const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128)
        grad.addColorStop(0, 'rgba(206,240,255,0.95)')
        grad.addColorStop(0.35, 'rgba(176,222,255,0.42)')
        grad.addColorStop(1, 'rgba(200,236,255,0)')
        g.fillStyle = grad
        g.fillRect(0, 0, 256, 256)
      }),
    []
  )

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime
    const d = scrollState.damped

    // portal udah JADI dari awal (dulu dirakit naik dari bawah sambil muter
    // kenceng di 0.78..0.86, pas banget di depan kamera, yang keliatan malah
    // kapsul putih berserakan). Sekarang dia cuma "nyala" pelan pas kamera
    // mundur dari SKILLS dan pertama kali ngeliat dia jauh di bawah
    const ign = sstep(0.8, 0.885, d)
    // muter di bidang ring (sumbu Y lokal). Dulu muternya di sumbu Z, jadi
    // ring segmen yang harusnya datar malah jungkir balik tegak di depan kamera
    if (segs.current) segs.current.rotation.y -= delta * 0.16
    if (group.current) group.current.rotation.z = Math.sin(t * 0.18) * 0.05
    const pulse = 0.88 + Math.sin(t * 1.4) * 0.12
    // jendela hidup glow: nyala pas didatengin, padam setelah kamera lewat.
    // Kilatan pas nembus pindah ke PortalFlash (overlay layar yang takarannya
    // dijaga), bukan lampu 42 yang bikin segmen & kristal putih polos
    const win = ign * (1 - clamp01((d - 0.955) / 0.03))
    if (ringMat.current) ringMat.current.emissiveIntensity = 0.06 + 0.2 * win
    if (segMat.current) segMat.current.emissiveIntensity = 0.06 + 0.2 * win
    if (glowRing.current) glowRing.current.material.opacity = win * 0.14 * pulse
    if (glowCore.current) glowCore.current.material.opacity = win * 0.12 * pulse
    if (light.current) light.current.intensity = win * 6
  })

  return (
    // GLB torus dari Blender ngadep +Y (atas) → dipasang HORIZONTAL (tanpa tilt)
    // biar ring-nya ngebingkai kristal pas kamera natap lurus dari atas
    <group position={PORTAL_POS}>
      <group ref={group}>
        {ringGeo && (
          <mesh geometry={ringGeo}>
            {/* es padat, bukan putih mati: emissive dulu 1.5 (desktop gak pakai
                tone mapping, jadi apa pun di atas 1 kepotong putih rata). Sekarang
                emissive kecil, bentuk ring kebaca dari cahaya & pantulan env */}
            <meshStandardMaterial ref={ringMat} color="#7d9bb3" roughness={0.24} metalness={0.16} envMapIntensity={0.55} emissive="#9fd6f7" emissiveIntensity={0.06} />
          </mesh>
        )}
        {segGeo && (
          <mesh ref={segs} geometry={segGeo}>
            <meshStandardMaterial ref={segMat} color="#7f9db4" roughness={0.3} metalness={0.12} envMapIntensity={0.6} emissive="#86c4ec" emissiveIntensity={0.08} />
          </mesh>
        )}
        {/* LIGHT-LIGHTNYA: ring cahaya + inti terang, dua-duanya additive.
            Sumbu torus GLB = +Y lokal, jadi plane glow diputar biar sebidang
            sama ringnya (tanpa ini keliatan cuma sebagai garis dari samping) */}
        <mesh ref={glowRing} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[9.2, 9.2]} />
          <meshBasicMaterial
            map={ringGlowTex}
            transparent
            opacity={0}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            fog={false}
            toneMapped={false}
            side={THREE.DoubleSide}
          />
        </mesh>
        <mesh ref={glowCore} position={[0, -0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[4.6, 4.6]} />
          <meshBasicMaterial
            map={coreGlowTex}
            transparent
            opacity={0}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            fog={false}
            toneMapped={false}
            side={THREE.DoubleSide}
          />
        </mesh>
        {/* debu es kecil berkilau di sekitar mulut portal (pipih ngikut bidang ring) */}
        <Sparkles count={70} scale={[6.5, 1.6, 6.5]} size={2.4} speed={0.25} opacity={0.6} color="#ffffff" />
      </group>
      {/* cahaya beneran nyorot ke bawah, lembut. Diturunin 2.2 di bawah bidang
          ring: kalau pas di tengah ring dia nempel ke 8 segmen dalam sampai
          segmennya putih polos tanpa bentuk */}
      <pointLight ref={light} color="#eaf6ff" intensity={0} distance={22} decay={2} position={[0, -2.2, 0]} />
      <PortalFlash />
    </group>
  )
}

// ===== kilatan pas nembus ring =====
// Quad layar penuh digambar PALING AKHIR, warnanya dicampur (bukan additive)
// ke biru-es terang dengan takaran maksimal PEAK: layar jadi terang tapi bentuk
// di baliknya tetep keintip, jadi gak pernah jadi putih mati. Pemicunya posisi
// kamera beneran terhadap bidang ring (bukan angka scroll tebakan), naik cepet
// pas kamera nyamperin bidangnya, terus meluruh ngikut waktu biar kerasa
// walau snap-nya ngebut lewat ring cuma dalam beberapa frame.
const PEAK = 0.6
const flashVert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4( position.xy, 0.0, 1.0 );
  }
`
const flashFrag = /* glsl */ `
  varying vec2 vUv;
  uniform float uAmt;
  uniform float uAspect;
  uniform vec3 uCore;
  uniform vec3 uEdge;
  void main() {
    vec2 p = ( vUv - 0.5 ) * vec2( uAspect, 1.0 );
    // inti paling terang di tengah (cahaya dari lubang ring), pinggir lebih
    // dingin & tipis, kesannya cahaya nyembur dari depan, bukan layar dicat
    float core = exp( -dot( p, p ) * 2.6 );
    gl_FragColor = vec4( mix( uEdge, uCore, core ), uAmt * ( 0.5 + 0.5 * core ) );
    #include <colorspace_fragment>
  }
`
function PortalFlash() {
  const mesh = useRef()
  const size = useThree((s) => s.size)
  const amt = useRef(0)
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uAmt: { value: 0 },
          uAspect: { value: 1 },
          uCore: { value: new THREE.Color('#f2faff') },
          uEdge: { value: new THREE.Color('#b8daf2') },
        },
        vertexShader: flashVert,
        fragmentShader: flashFrag,
        transparent: true,
        depthTest: false,
        depthWrite: false,
      }),
    []
  )
  useFrame((state, delta) => {
    const cam = state.camera.position
    const d = scrollState.damped
    let f = 0
    if (!CALM && scrollState.bridge === 0 && d > 0.88 && d < 0.99) {
      // cuma kalau kamera beneran lewat LUBANG ring (bukan pinggirnya)
      const off = Math.hypot(cam.x - PORTAL_POS[0], cam.z - PORTAL_POS[2])
      const dy = cam.y - PORTAL_POS[1]
      const w = dy > 0 ? 1.4 : 1.7
      f = Math.exp(-(dy / w) * (dy / w)) * (1 - sstep(1.2, 2.6, off))
    }
    amt.current = Math.max(f, amt.current * Math.exp(-delta / 0.22))
    if (amt.current < 0.003) amt.current = 0
    mat.uniforms.uAmt.value = amt.current * PEAK
    mat.uniforms.uAspect.value = size.width / Math.max(1, size.height)
    if (mesh.current) mesh.current.visible = amt.current > 0
  })
  return (
    <mesh ref={mesh} material={mat} frustumCulled={false} renderOrder={5000} visible={false}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  )
}

useGLTF.preload('/models/portal.glb')
