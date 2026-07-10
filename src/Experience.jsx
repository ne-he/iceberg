import * as THREE from 'three'
import { Suspense, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Environment, Sparkles, useGLTF } from '@react-three/drei'
import { easing } from 'maath'
import { Crystal } from './Crystal'
import { ParticleFace } from './ParticleFace'
import { CRYSTALS, HERO_CRYSTAL } from './content'
import { dragState, scrollState } from './scrollState'

export const FOG_COLOR = '#b9c0c7'

export default function Experience({ onOpen, hasVideo }) {
  return (
    <>
      {/* kalau ada video langit (bg.mp4), canvas dibiarin transparan biar videonya
          keliatan di belakang — pas video fade out, body #b9c0c7 yang jadi kabut */}
      {!hasVideo && <color attach="background" args={[FOG_COLOR]} />}
      {/* nilai awal aja — FogRig yang ngatur tebal-tipisnya ngikutin kedalaman scroll */}
      <fog attach="fog" args={[FOG_COLOR, 16, 50]} />
      <FogRig />

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

      {/* kristal es kecil melayang naik pelan, looping — pengganti video daratan */}
      <DriftingIce />

      {/* outro: partikel wajah Nehemiah di atas panggung podium ala igloo */}
      <ParticleFace position={[0, -36.55, 1.5]} />
      <OutroStage />

      {/* debu es yang melayang di sepanjang jalur turun */}
      <Sparkles count={260} scale={[18, 48, 12]} position={[0, -17, 0]} size={2} speed={0.3} opacity={0.5} color="#ffffff" />
      <Sparkles count={80} scale={[10, 7, 8]} position={[0, 0, 2]} size={2.6} speed={0.2} opacity={0.4} color="#ffffff" />
      <Sparkles count={90} scale={[14, 46, 6]} position={[0, -18, -6]} size={4} speed={0.15} opacity={0.25} color="#ffffff" />

      {/* kolom-kolom cahaya samar menembus kabut */}
      <LightShafts />
    </>
  )
}

// kabut bertingkat: di hero (atas) JELAS BANGET, makin turun makin berkabut —
// menandakan makin dalam makin tenggelam di kabut es
function FogRig() {
  const scene = useThree((s) => s.scene)
  useFrame(() => {
    const k = THREE.MathUtils.clamp(scrollState.damped, 0, 1)
    if (scene.fog) {
      scene.fog.near = 16 - k * 10 // 16 → 6
      scene.fog.far = 50 - k * 27 // 50 → 23
    }
  })
  return null
}

// pecahan es kecil yang melayang naik pelan sepanjang jalur turun, looping terus —
// ngasih rasa "dunia hidup" tanpa perlu video background
function DriftingIce() {
  const { nodes } = useGLTF('/models/iceberg.glb')
  const geometry = useMemo(() => Object.values(nodes).find((n) => n.isMesh)?.geometry, [nodes])
  const material = useMemo(
    () => new THREE.MeshBasicMaterial({ color: '#d3e2ec', transparent: true, opacity: 0.35, depthWrite: false }),
    []
  )
  const shards = useMemo(() => {
    const rand = (i, n) => {
      const x = Math.sin(i * 91.7 + n * 269.5) * 43758.5453
      return x - Math.floor(x)
    }
    return Array.from({ length: 18 }, (_, i) => ({
      x: (rand(i, 1) - 0.5) * 22,
      y0: 8 - rand(i, 2) * 54,
      z: -4 - rand(i, 3) * 9,
      scale: 0.12 + rand(i, 4) * 0.3,
      rise: 0.25 + rand(i, 5) * 0.5,
      spin: 0.15 + rand(i, 6) * 0.4,
    }))
  }, [])
  const refs = useRef([])
  useFrame((state, delta) => {
    const t = state.clock.elapsedTime
    for (let i = 0; i < shards.length; i++) {
      const m = refs.current[i]
      if (!m) continue
      const s = shards[i]
      // naik pelan, wrap balik ke bawah pas lewat atas (rentang y: -46 .. 8)
      let y = s.y0 + t * s.rise
      y = ((y + 46) % 54) - 46
      m.position.set(s.x + Math.sin(t * 0.3 + i) * 0.6, y, s.z)
      m.rotation.x += delta * s.spin
      m.rotation.y += delta * s.spin * 0.7
    }
  })
  return shards.map((s, i) => (
    <mesh key={i} ref={(el) => (refs.current[i] = el)} geometry={geometry} material={material} scale={s.scale} />
  ))
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
    </group>
  )
}

function BackgroundField() {
  const { nodes } = useGLTF('/models/iceberg.glb')
  const geometry = useMemo(() => Object.values(nodes).find((n) => n.isMesh)?.geometry, [nodes])
  // SATU material dishare 28 bongkahan, TANPA transmission (bikin scene
  // dirender ulang tiap frame = lag). Warna es biru nyambung sama kristal utama,
  // roughness tinggi + shading halus = kesan out-of-focus
  const material = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#7ca6c4',
        roughness: 0.5,
        metalness: 0,
        transparent: true,
        opacity: 0.8,
        clearcoat: 0.5,
        clearcoatRoughness: 0.6,
        envMapIntensity: 0.55,
      }),
    []
  )
  // shell transparan sedikit lebih gede di tiap bongkahan = pinggiran lembut,
  // niru depth-of-field blur tanpa post-processing
  const shellMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#a9c8dc',
        transparent: true,
        opacity: 0.16,
        depthWrite: false,
      }),
    []
  )
  const chunks = useMemo(() => {
    // hash deterministik biar layout-nya konsisten tiap load
    const rand = (i, n) => {
      const x = Math.sin(i * 127.1 + n * 311.7) * 43758.5453
      return x - Math.floor(x)
    }
    return Array.from({ length: 28 }, (_, i) => {
      const side = i % 2 === 0 ? 1 : -1
      return {
        position: [side * (7 + rand(i, 1) * 10), 5 - i * 1.75 - rand(i, 2) * 2, -7 - rand(i, 3) * 11],
        rotation: [rand(i, 4) * Math.PI, rand(i, 5) * Math.PI * 2, rand(i, 6) * Math.PI],
        scale: 1.1 + rand(i, 7) * 2.8,
        speed: 0.02 + rand(i, 8) * 0.05,
      }
    })
  }, [])
  return chunks.map((c, i) => <BgChunk key={i} geometry={geometry} material={material} shellMaterial={shellMaterial} {...c} />)
}

function BgChunk({ geometry, material, shellMaterial, speed, ...props }) {
  const ref = useRef()
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * speed
  })
  return (
    <group ref={ref} {...props}>
      <mesh geometry={geometry} material={material} />
      <mesh geometry={geometry} material={shellMaterial} scale={1.05} />
    </group>
  )
}

// kolom cahaya vertikal samar (fake god-rays) — ngisi kekosongan kabut
function LightShafts() {
  const tex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 64
    c.height = 256
    const g = c.getContext('2d')
    let grad = g.createLinearGradient(0, 0, 64, 0)
    grad.addColorStop(0, 'rgba(255,255,255,0)')
    grad.addColorStop(0.5, 'rgba(255,255,255,0.6)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, 64, 256)
    // fade juga di ujung atas/bawah biar gak keliatan potongan plane
    g.globalCompositeOperation = 'destination-in'
    grad = g.createLinearGradient(0, 0, 0, 256)
    grad.addColorStop(0, 'rgba(0,0,0,0)')
    grad.addColorStop(0.25, 'rgba(0,0,0,1)')
    grad.addColorStop(0.75, 'rgba(0,0,0,1)')
    grad.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, 64, 256)
    return new THREE.CanvasTexture(c)
  }, [])
  const shafts = [
    { pos: [-6.5, -5, -7], rot: 0.16, w: 2.6 },
    { pos: [5.5, -15, -9], rot: -0.12, w: 3.6 },
    { pos: [-4.5, -26, -8], rot: 0.1, w: 2.2 },
    { pos: [2.5, -33.5, -6], rot: -0.08, w: 3.2 },
  ]
  return shafts.map((s, i) => (
    <mesh key={i} position={s.pos} rotation={[0, 0, s.rot]}>
      <planeGeometry args={[s.w, 36]} />
      <meshBasicMaterial map={tex} transparent opacity={0.14} blending={THREE.AdditiveBlending} depthWrite={false} />
    </mesh>
  ))
}

// selama rentang ini di sekitar tiap kristal, kamera berhenti SEBENTAR aja —
// dulunya 0.07 tapi plateau segitu bikin scroll kerasa "patah/ngelag",
// sekarang tipis: hampir tiap gerakan scroll langsung keliatan jalan
const HOLD = 0.03

function CameraRig() {
  const camera = useThree((s) => s.camera)
  const parallax = useMemo(() => ({ v: 1 }), [])
  const [p, t, anchors] = useMemo(() => {
    const v = (x, y, z) => new THREE.Vector3(x, y, z)
    // posisi kamera per anchor = tepat di depan kristalnya (offset +z)
    const front = (c, dz) => v(c[0], c[1] + 0.4, c[2] + dz)
    return [
      new THREE.Vector3(),
      new THREE.Vector3(),
      [
        { t: 0, pos: v(0, 1.8, 11), look: v(0, 0.5, 0) },
        // anchor ngikut daftar CRYSTALS — nambah batu tinggal nambah di content.js
        ...CRYSTALS.map((c, i) => ({
          t: (i + 1) / (CRYSTALS.length + 1),
          pos: front(c.position, 7.5),
          look: v(...c.position),
        })),
        { t: 1, pos: v(0, -36.4, 12), look: v(0, -37, 0) },
      ],
    ]
  }, [])

  useFrame((state, delta) => {
    easing.damp(scrollState, 'damped', scrollState.progress, 0.16, delta)
    const k = THREE.MathUtils.clamp(scrollState.damped, 0, 1)

    // cari segmen anchor aktif, lalu interpolasi dengan plateau di tiap kristal
    let i = 0
    while (i < anchors.length - 2 && k > anchors[i + 1].t) i++
    const a = anchors[i]
    const b = anchors[i + 1]
    const start = a.t + (i === 0 ? 0 : HOLD)
    const end = b.t - (i === anchors.length - 2 ? 0 : HOLD)
    let u = THREE.MathUtils.clamp((k - start) / Math.max(1e-4, end - start), 0, 1)
    u = u * u * (3 - 2 * u)
    p.lerpVectors(a.pos, b.pos, u)
    t.lerpVectors(a.look, b.look, u)

    // parallax pointer dimatiin halus selama hero di-drag
    easing.damp(parallax, 'v', dragState.active ? 0 : 1, 0.2, delta)
    camera.position.set(p.x + state.pointer.x * 0.5 * parallax.v, p.y + state.pointer.y * 0.3 * parallax.v, p.z)
    camera.lookAt(t)
  })
  return null
}
