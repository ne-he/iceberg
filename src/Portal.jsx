import * as THREE from 'three'
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Sparkles, useGLTF } from '@react-three/drei'
import { scrollState } from './scrollState'

// portal es ala igloo.inc — dimodel di Blender (ring luar bergelombang +
// 8 segmen dalam), di-load dari GLB. Kamera nembus lubangnya sebelum outro.
// Posisinya DIJAUHIN dari panggung: di belakang mulut portal ada tunnel ~11 unit
// yang kamera transit penuh — biar bener-bener kerasa nyebrang ke dunia lain
export const PORTAL_POS = [0, -31.4, 21.2]

// panjang tunnel di belakang portal (ke arah panggung outro)
const TUNNEL_LEN = 11

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

    // animasi KEBANGUN (sinkron kamera turun dari batu terakhir): portal naik
    // dari bawah sambil ngembang, segmen dalamnya muter kenceng terus settle —
    // kesannya gerbang lagi dirakit pas visitor dateng
    let up = clamp01((d - 0.81) / 0.09)
    up = up * up * (3 - 2 * up)
    if (build.current) {
      build.current.position.y = -10 * (1 - up)
      build.current.scale.setScalar(0.5 + 0.5 * up)
    }

    // segmen dalam muter — kenceng selama kebangun, kalem pas udah jadi
    if (segs.current) segs.current.rotation.z -= delta * (0.14 + (1 - up) * 2.2)
    if (group.current) group.current.rotation.z = Math.sin(t * 0.18) * 0.05
    const pulse = 0.85 + Math.sin(t * 1.4) * 0.15
    // glow mulut portal: nyala bareng proses kebangun, dan cuma buat dilihat
    // DARI LUAR — pas kamera mulai nyelam masuk, di-fade habis; kalau nggak,
    // inti glow-nya ditatap dari jarak deket dan seisi layar kebakar putih
    const pass = (1 - clamp01((d - 0.905) / 0.042)) * up
    if (glowRing.current) glowRing.current.material.opacity = 0.75 * pulse * pass
    if (glowCore.current) glowCore.current.material.opacity = 0.55 * pulse * pass
  })

  return (
    // GLB torus dari Blender ngadep +Y (atas) — diputar biar ngadep jalur kamera
    // yang nukik turun dari belakang-atas. Grup build di luar rotasi: naik-turunnya
    // di sumbu Y dunia (muncul dari bawah), bukan sumbu miring portal
    <group position={PORTAL_POS}>
    <group ref={build}>
    <group rotation={[Math.PI / 2 - 0.5, 0, 0]}>
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
      {/* lorong es di belakang mulut portal — kamera transit di dalamnya */}
      <Tunnel glowTex={ringGlowTex} />
      {/* cahaya beneran biar batu/kabut sekitar ikut kesorot portal */}
      <pointLight color="#eaf6ff" intensity={38} distance={17} decay={2} />
    </group>
    </group>
    </group>
  )
}

// tekstur dinding tunnel: streak vertikal terang-gelap + fade alpha di kedua
// ujung (mulut tipis biar glow portal yang dominan, ujung exit KEBUKA ke panggung)
function makeTunnelTexture(additive) {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 512
  const g = c.getContext('2d')
  if (!additive) {
    g.fillStyle = 'rgba(214, 228, 240, 0.4)'
    g.fillRect(0, 0, 256, 512)
  }
  // streak garis es memanjang sepanjang lorong (deterministik biar konsisten)
  const rand = (i, n) => {
    const x = Math.sin(i * 137.13 + n * 311.7) * 43758.5453
    return x - Math.floor(x)
  }
  for (let i = 0; i < (additive ? 30 : 46); i++) {
    const x = rand(i, 1) * 256
    const w = additive ? 1 + rand(i, 2) * 2 : 2 + rand(i, 2) * 5
    if (additive) g.fillStyle = `rgba(255,255,255,${0.25 + rand(i, 3) * 0.5})`
    else g.fillStyle = rand(i, 4) > 0.5 ? `rgba(255,255,255,${0.12 + rand(i, 3) * 0.25})` : `rgba(90,110,128,${0.1 + rand(i, 3) * 0.2})`
    g.fillRect(x, 0, w, 512)
  }
  // alpha memudar di kedua ujung — y=0 (mulut portal), y=512 (exit ke panggung)
  g.globalCompositeOperation = 'destination-in'
  const grad = g.createLinearGradient(0, 0, 0, 512)
  grad.addColorStop(0, 'rgba(0,0,0,0.3)')
  grad.addColorStop(0.35, 'rgba(0,0,0,1)')
  grad.addColorStop(0.75, 'rgba(0,0,0,0.9)')
  grad.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 256, 512)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = THREE.RepeatWrapping
  return t
}

// lorong di belakang portal: shell semi-opaque + layer streak additive yang
// muter pelan + ring cahaya "gerbang" berlapis. Muncul cuma pas approach,
// FADE OUT begitu kamera mendarat — kesannya kabutnya kebuka ke dunia baru
function Tunnel({ glowTex }) {
  const shellMat = useRef()
  const streakMat = useRef()
  const streaks = useRef()
  const ringRefs = useRef([])
  const shellTex = useMemo(() => makeTunnelTexture(false), [])
  const streakTex = useMemo(() => makeTunnelTexture(true), [])
  const clamp01 = (v) => Math.max(0, Math.min(1, v))

  useFrame((_, delta) => {
    const d = scrollState.damped
    // baru muncul pas kamera mulai nyelam ke mulut portal (bukan pas masih
    // di view luar — dari luar cukup glow ringnya, biar gak silau kebakar putih),
    // ilang pas udah mendarat di outro
    const fade = clamp01((d - 0.905) / 0.05) * (1 - clamp01((d - 0.962) / 0.028))
    if (shellMat.current) shellMat.current.opacity = 0.8 * fade
    if (streakMat.current) streakMat.current.opacity = 0.5 * fade
    if (streaks.current) streaks.current.rotation.y += delta * 0.35
    ringRefs.current.forEach((r, i) => {
      if (r) r.material.opacity = (0.4 - i * 0.06) * fade
    })
  })

  return (
    <group>
      {/* dinding lorong — melebar dikit ke arah exit, kayak kebuka ke dunia baru */}
      <mesh position={[0, -TUNNEL_LEN / 2, 0]}>
        <cylinderGeometry args={[3.05, 3.8, TUNNEL_LEN, 48, 1, true]} />
        <meshBasicMaterial
          map={shellTex}
          transparent
          opacity={0}
          side={THREE.BackSide}
          depthWrite={false}
          fog={false}
        />
      </mesh>
      <mesh ref={streaks} position={[0, -TUNNEL_LEN / 2, 0]}>
        <cylinderGeometry args={[3.0, 3.72, TUNNEL_LEN, 48, 1, true]} />
        <meshBasicMaterial
          map={streakTex}
          transparent
          opacity={0}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          fog={false}
          toneMapped={false}
        />
      </mesh>
      {/* gerbang-gerbang cahaya sepanjang lorong (+1 buletan ekstra di depan,
          deket exit — permintaan Nehemiah biar lorongnya makin berlapis) */}
      {[-3, -6.2, -9.4, -12.4].map((y, i) => (
        <mesh key={y} ref={(el) => (ringRefs.current[i] = el)} position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[8.6 - i * 0.4, 8.6 - i * 0.4]} />
          <meshBasicMaterial
            map={glowTex}
            transparent
            opacity={0}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            fog={false}
            toneMapped={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
      {/* debu es melayang di dalam lorong */}
      <Sparkles count={110} scale={[5, TUNNEL_LEN - 1, 5]} position={[0, -TUNNEL_LEN / 2, 0]} size={2.2} speed={0.3} opacity={0.5} color="#ffffff" />
    </group>
  )
}

useGLTF.preload('/models/portal.glb')
