import * as THREE from 'three'
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Sparkles, useGLTF } from '@react-three/drei'
import { scrollState } from './scrollState'

// portal es ala igloo.inc — dimodel di Blender (ring luar bergelombang +
// 8 segmen dalam), di-load dari GLB. Dipasang HORIZONTAL ngambang TINGGI di atas
// cluster kristal (jaraknya jauh): kamera nyorot lurus dari atas nembus lubangnya
// (kristal keliatan kecil jauh di bawah), lalu NYELAM NEMBUS ring — pas nembus,
// portal MELEDAK nyala = sensasi masuk dunia lain — baru turun ke kristal & wajah
// (permintaan Nehemiah: "masuk lewatin portal yg nyala, kerasa different world")
export const PORTAL_POS = [0, -32.8, 1.5]

// tekstur glow dibikin di canvas: ring cahaya + blob inti — pengganti bloom
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
  const build = useRef() // grup world-space buat animasi "kebangun": naik dari bawah + ngembang
  const segs = useRef()
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
        // kabut pucat cuma "nyuci" jadi kelabu — cyan bikin kebaca sebagai ENERGI
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
    const clamp01 = (v) => Math.max(0, Math.min(1, v))

    // animasi KEBANGUN (sinkron kamera mendekat dari atas): portal naik dari
    // bawah sambil ngembang, segmen dalamnya muter kenceng terus settle —
    // kesannya gerbang lagi dirakit pas visitor dateng. Kelar sebelum top-down.
    let up = clamp01((d - 0.78) / 0.08)
    up = up * up * (3 - 2 * up)
    if (build.current) {
      build.current.position.y = -10 * (1 - up)
      build.current.scale.setScalar(0.5 + 0.5 * up)
    }

    // segmen dalam muter — kenceng selama kebangun, kalem pas udah jadi
    if (segs.current) segs.current.rotation.z -= delta * (0.14 + (1 - up) * 2.2)
    if (group.current) group.current.rotation.z = Math.sin(t * 0.18) * 0.05
    const pulse = 0.85 + Math.sin(t * 1.4) * 0.15
    // GERBANG NYALA + KILATAN NEMBUS:
    //  - win  : jendela hidup glow — nyala pas top-down, padam pas udah lewat
    //  - cross: puncak tajam pas kamera nembus BIDANG ring (d~0.935). Di sinilah
    //    portal MELEDAK terang = "masuk dunia lain" (permintaan Nehemiah)
    // Pas top-down inti sengaja lembut (kristal jauh di bawah tetep kebaca),
    // baru full-blast pas nembus — layar kesorot putih-cyan sekejap, terus padam.
    const win = up * (1 - clamp01((d - 0.965) / 0.035))
    const cross = Math.exp(-Math.pow((d - 0.935) / 0.02, 2))
    // RING RIM nyala TERANG sepanjang top-down (kayak referensi igloo ss#2), plus
    // flare ekstra pas nembus. Core (lubang tengah) setengah kebuka: tetep glow
    // tapi kristal jauh di bawah masih keintip, full-blaze cuma pas crossing.
    if (glowRing.current) glowRing.current.material.opacity = win * (0.92 * pulse + 0.5 * cross)
    if (glowCore.current) glowCore.current.material.opacity = win * (0.28 * pulse + 0.7 * cross)
    // cahaya beneran: nyorot lumayan pas top-down, meledak pas nembus
    if (light.current) light.current.intensity = win * (16 + 26 * cross)
  })

  return (
    // GLB torus dari Blender ngadep +Y (atas) → dipasang HORIZONTAL (tanpa tilt)
    // biar ring-nya ngebingkai kristal pas kamera natap lurus dari atas. Grup
    // build naik-turun di sumbu Y dunia (muncul dari bawah pas visitor dateng)
    <group position={PORTAL_POS}>
    <group ref={build}>
    <group rotation={[0, 0, 0]}>
      <group ref={group}>
        {ringGeo && (
          <mesh geometry={ringGeo}>
            {/* ring GLOW dari es sendiri (bukan cuma additive plane): emissive
                kuat + toneMapped off biar ring-nya kebaca sebagai gerbang nyala
                terang kayak referensi igloo, bukan putih mati */}
            <meshStandardMaterial color="#eef7ff" roughness={0.22} emissive="#bfe6ff" emissiveIntensity={1.5} toneMapped={false} />
          </mesh>
        )}
        {segGeo && (
          <mesh ref={segs} geometry={segGeo}>
            <meshStandardMaterial color="#b7ccdb" roughness={0.4} emissive="#86c4ec" emissiveIntensity={0.6} />
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
            opacity={0.75}
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
            opacity={0.55}
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
      {/* cahaya beneran nyorot ke bawah — intensity digerakin di useFrame:
          lembut pas top-down, MELEDAK pas kamera nembus ring (nyorot kristal &
          wajah di bawah), distance digedein biar nyampe landing zone yg jauh */}
      <pointLight ref={light} color="#eaf6ff" intensity={12} distance={22} decay={2} />
    </group>
    </group>
    </group>
  )
}

useGLTF.preload('/models/portal.glb')
