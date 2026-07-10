import * as THREE from 'three'
import { Suspense, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Environment, Sparkles, useGLTF } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'
import { easing } from 'maath'
import { Crystal } from './Crystal'
import { ParticleFace } from './ParticleFace'
import { CRYSTALS, HERO_CRYSTAL } from './content'
import { scrollState } from './scrollState'

export const FOG_COLOR = '#b9c0c7'

export default function Experience({ onOpen, hasVideo = false }) {
  return (
    <>
      {/* kalau ada video background (public/bg.mp4), canvas dibikin transparan */}
      {!hasVideo && <color attach="background" args={[FOG_COLOR]} />}
      <fog attach="fog" args={[FOG_COLOR, 8, 30]} />

      <ambientLight intensity={1.1} />
      <directionalLight position={[6, 10, 4]} intensity={1.6} />
      <directionalLight position={[-6, -4, -6]} intensity={0.5} color="#dfe8ff" />
      <Suspense fallback={null}>
        <Environment preset="city" />
      </Suspense>

      <CameraRig />

      <Crystal data={HERO_CRYSTAL} interactive={false} />
      {CRYSTALS.map((c) => (
        <Crystal key={c.id} data={c} onOpen={onOpen} />
      ))}

      {/* dunia latar: bongkahan-bongkahan jauh yang jadi siluet di kabut (trik igloo) */}
      <BackgroundField />

      {/* outro: partikel wajah Nehemiah di atas panggung podium ala igloo */}
      <ParticleFace position={[0, -36.55, 1.5]} />
      <OutroStage />

      {/* debu es yang melayang di sepanjang jalur turun */}
      <Sparkles count={160} scale={[18, 48, 12]} position={[0, -17, 0]} size={2} speed={0.3} opacity={0.5} color="#ffffff" />
      <Sparkles count={60} scale={[10, 7, 8]} position={[0, 0, 2]} size={2.6} speed={0.2} opacity={0.4} color="#ffffff" />

      <EffectComposer disableNormalPass multisampling={0}>
        <Bloom mipmapBlur intensity={0.35} luminanceThreshold={0.85} />
        <Vignette eskil={false} offset={0.2} darkness={0.55} />
      </EffectComposer>
    </>
  )
}

// podium bertingkat + ring cahaya, niru panggung outro-nya igloo.inc
function OutroStage() {
  return (
    <group position={[0, -40.35, 1.5]}>
      <mesh position={[0, 0.15, 0]}>
        <cylinderGeometry args={[5.2, 5.7, 0.3, 64]} />
        <meshStandardMaterial color="#99a1a9" roughness={0.92} />
      </mesh>
      <mesh position={[0, 0.42, 0]}>
        <cylinderGeometry args={[3.6, 3.8, 0.26, 64]} />
        <meshStandardMaterial color="#a0a8b0" roughness={0.92} />
      </mesh>
      <mesh position={[0, 0.66, 0]}>
        <cylinderGeometry args={[2.3, 2.42, 0.22, 64]} />
        <meshStandardMaterial color="#a7afb7" roughness={0.92} />
      </mesh>
      {/* ring cahaya tipis di lantai podium */}
      <mesh position={[0, 0.34, 0]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[4.1, 4.26, 96]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} transparent opacity={0.3} side={THREE.DoubleSide} />
      </mesh>
      {/* halo lampu studio — nongol dikit di atas frame, ala igloo */}
      <mesh position={[0, 8.2, -1.2]} rotation-x={0.35}>
        <torusGeometry args={[2.2, 0.06, 12, 80]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} transparent opacity={0.85} />
      </mesh>
    </group>
  )
}

function BackgroundField() {
  const { nodes } = useGLTF('/models/iceberg.glb')
  const geometry = useMemo(() => Object.values(nodes).find((n) => n.isMesh)?.geometry, [nodes])
  const chunks = useMemo(() => {
    // hash deterministik biar layout-nya konsisten tiap load
    const rand = (i, n) => {
      const x = Math.sin(i * 127.1 + n * 311.7) * 43758.5453
      return x - Math.floor(x)
    }
    return Array.from({ length: 18 }, (_, i) => {
      const side = i % 2 === 0 ? 1 : -1
      return {
        position: [side * (7 + rand(i, 1) * 9), 4 - i * 2.6 - rand(i, 2) * 2, -7 - rand(i, 3) * 9],
        rotation: [rand(i, 4) * Math.PI, rand(i, 5) * Math.PI * 2, rand(i, 6) * Math.PI],
        scale: 0.9 + rand(i, 7) * 2.2,
        speed: 0.02 + rand(i, 8) * 0.05,
      }
    })
  }, [])
  return chunks.map((c, i) => <BgChunk key={i} geometry={geometry} {...c} />)
}

function BgChunk({ geometry, speed, ...props }) {
  const ref = useRef()
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * speed
  })
  return (
    <mesh ref={ref} geometry={geometry} {...props}>
      <meshStandardMaterial color="#c6cdd4" roughness={0.95} flatShading />
    </mesh>
  )
}

// selama rentang ini di sekitar tiap kristal, kamera DIKUNCI lihat ke kristalnya
// (auto-center ala igloo) — transisi antar kristal pakai smoothstep
const HOLD = 0.07

function CameraRig() {
  const camera = useThree((s) => s.camera)
  const [posCurve, p, t, anchors] = useMemo(() => {
    const v = (x, y, z) => new THREE.Vector3(x, y, z)
    return [
      // jalur kamera: turun menembus kabut, sedikit zig-zag antar kristal
      new THREE.CatmullRomCurve3([v(0, 1.8, 11), v(-1.2, -7.5, 6.5), v(2.2, -17, 7), v(-1.2, -27.5, 6.5), v(0, -36.4, 12)]),
      new THREE.Vector3(),
      new THREE.Vector3(),
      // target pandangan per tahap scroll — persis di posisi kristal
      [
        { t: 0, p: v(0, 0.5, 0) },
        { t: 0.25, p: v(...CRYSTALS[0].position) },
        { t: 0.5, p: v(...CRYSTALS[1].position) },
        { t: 0.75, p: v(...CRYSTALS[2].position) },
        { t: 1, p: v(0, -37, 0) },
      ],
    ]
  }, [])

  useFrame((state, delta) => {
    easing.damp(scrollState, 'damped', scrollState.progress, 0.22, delta)
    const k = THREE.MathUtils.clamp(scrollState.damped, 0, 1)
    posCurve.getPoint(k, p)

    // cari segmen anchor aktif, lalu interpolasi dengan plateau di tiap kristal
    let i = 0
    while (i < anchors.length - 2 && k > anchors[i + 1].t) i++
    const a = anchors[i]
    const b = anchors[i + 1]
    const start = a.t + (i === 0 ? 0 : HOLD)
    const end = b.t - (i === anchors.length - 2 ? 0 : HOLD)
    let u = THREE.MathUtils.clamp((k - start) / Math.max(1e-4, end - start), 0, 1)
    u = u * u * (3 - 2 * u)
    t.lerpVectors(a.p, b.p, u)

    camera.position.set(p.x + state.pointer.x * 0.5, p.y + state.pointer.y * 0.3, p.z)
    camera.lookAt(t)
  })
  return null
}
