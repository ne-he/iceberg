import * as THREE from 'three'
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Sparkles, useGLTF } from '@react-three/drei'
import { scrollState } from './scrollState'

// portal es ala igloo.inc — dimodel di Blender (ring luar bergelombang +
// 8 segmen dalam), di-load dari GLB. Sekarang dipasang HORIZONTAL ngambang di
// atas cluster kristal: kamera nyorot lurus dari atas nembus lubangnya (ring
// ngebingkai kristal di bawahnya), lalu nyelam turun natap wajah partikel
// (permintaan Nehemiah: "kamera dr atas nyorot, trus masuk portal angle ke depan")
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
        grad.addColorStop(0.52, 'rgba(230,244,255,0)')
        grad.addColorStop(0.68, 'rgba(235,247,255,0.9)')
        grad.addColorStop(0.8, 'rgba(220,240,255,0.35)')
        grad.addColorStop(1, 'rgba(255,255,255,0)')
        g.fillStyle = grad
        g.fillRect(0, 0, 256, 256)
      }),
    []
  )
  const coreGlowTex = useMemo(
    () =>
      makeGlowTexture((g) => {
        const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128)
        grad.addColorStop(0, 'rgba(255,255,255,0.95)')
        grad.addColorStop(0.35, 'rgba(235,246,255,0.4)')
        grad.addColorStop(1, 'rgba(255,255,255,0)')
        g.fillStyle = grad
        g.fillRect(0, 0, 256, 256)
      }),
    []
  )

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime
    const d = scrollState.damped
    const clamp01 = (v) => Math.max(0, Math.min(1, v))

    // animasi KEBANGUN (sinkron kamera naik ke atas cluster): portal naik
    // dari bawah sambil ngembang, segmen dalamnya muter kenceng terus settle —
    // kesannya gerbang lagi dirakit pas visitor dateng. Kelar sebelum top-down.
    let up = clamp01((d - 0.78) / 0.09)
    up = up * up * (3 - 2 * up)
    if (build.current) {
      build.current.position.y = -10 * (1 - up)
      build.current.scale.setScalar(0.5 + 0.5 * up)
    }

    // segmen dalam muter — kenceng selama kebangun, kalem pas udah jadi
    if (segs.current) segs.current.rotation.z -= delta * (0.14 + (1 - up) * 2.2)
    if (group.current) group.current.rotation.z = Math.sin(t * 0.18) * 0.05
    const pulse = 0.85 + Math.sin(t * 1.4) * 0.15
    // glow mulut portal: nyala penuh pas kamera nyorot dari atas (top-down),
    // di-fade habis pas kamera mulai nyelam turun nembus ring — kalau nggak,
    // inti glow-nya ditatap dari jarak deket dan seisi layar kebakar putih
    const pass = (1 - clamp01((d - 0.92) / 0.045)) * up
    // core diredam kuat: dari atas kita natap lurus ke intinya, kalau full-blast
    // tengahnya kebakar putih & kristalnya ketutup (permintaan: keliatan si tajem2)
    if (glowRing.current) glowRing.current.material.opacity = 0.6 * pulse * pass
    if (glowCore.current) glowCore.current.material.opacity = 0.2 * pulse * pass
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
            <meshStandardMaterial color="#dfe9f2" roughness={0.32} emissive="#bfe0ff" emissiveIntensity={0.5} />
          </mesh>
        )}
        {segGeo && (
          <mesh ref={segs} geometry={segGeo}>
            <meshStandardMaterial color="#8b97a3" roughness={0.45} emissive="#7c93a8" emissiveIntensity={0.25} />
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
      {/* cahaya beneran nyorot ke bawah — kristal & wajah di bawah ring ikut kesorot.
          Ditahan (16) biar nyorot lembut, gak bikin tengahnya kebakar putih */}
      <pointLight color="#eaf6ff" intensity={16} distance={16} decay={2} />
    </group>
    </group>
    </group>
  )
}

useGLTF.preload('/models/portal.glb')
