import * as THREE from 'three'
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { scrollState } from './scrollState'

// plane dekorasi (arus/caustic/shaft) tingginya nyampe viewport hero dan keliatan
// kayak "dinding jalan" ganggu di belakang nama (komplain Nehemiah). 0 pas di
// hero, baru fade in setelah hero text ilang (dk 0.07), penuh di dk 0.14.
// depthK retrace ke 0 pas bridge, jadi pas balik ke atas mereka ikut ilang lagi.
export function heroFade() {
  const k = Math.min(Math.max((scrollState.depthK - 0.07) / 0.07, 0), 1)
  return k * k * (3 - 2 * k)
}

// ===== suasana "di dalam glacier" (permintaan Nehemiah) =====
// dinding es crevasse kiri-kanan (dimodel di Blender: grid ke-displace jadi
// lekuk es) + caustic cahaya menari + kilau subsurface. Kamera turun di antara
// dua dinding kayak nyelam ke celah gletser.

const WALL = '/models/glacier_wall.glb'

// tekstur caustic: jaring cahaya lembut ala pantulan air di bawah es —
// dibikin di canvas (blob terang tumpang tindih + blur), di-scroll pelan
function makeCausticTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const g = c.getContext('2d')
  g.fillStyle = '#000'
  g.fillRect(0, 0, 256, 256)
  const rand = (i, n) => {
    const x = Math.sin(i * 51.3 + n * 172.1) * 43758.5453
    return x - Math.floor(x)
  }
  g.globalCompositeOperation = 'lighter'
  // garis-garis melengkung terang = tepi caustic
  for (let i = 0; i < 26; i++) {
    g.beginPath()
    const y = rand(i, 1) * 256
    g.moveTo(0, y)
    for (let x = 0; x <= 256; x += 32) {
      g.lineTo(x, y + Math.sin(x * 0.05 + i) * (14 + rand(i, 2) * 22))
    }
    g.strokeStyle = `rgba(220,238,255,${0.05 + rand(i, 3) * 0.09})`
    g.lineWidth = 1 + rand(i, 4) * 2.5
    g.stroke()
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

// satu dinding es — geometri di-load, material biru gletser tembus cahaya.
// fog nyala (default) biar bagian jauh membaur ke warna kabut/biru dalam
function GlacierWall({ side }) {
  const { nodes } = useGLTF(WALL)
  const geo = useMemo(() => Object.values(nodes).find((n) => n.isMesh)?.geometry, [nodes])
  // kiri: normal +Z diputar ke +X (ngadep ke tengah). kanan: kebalikannya
  const rotY = side < 0 ? Math.PI / 2 : -Math.PI / 2
  return (
    <group position={[side * 12, -20, -5]} rotation={[0, rotY, side * 0.07]} scale={[1, 1.12, 1]}>
      <mesh geometry={geo}>
        <meshStandardMaterial
          color="#6f9ec2"
          roughness={0.42}
          metalness={0}
          transparent
          opacity={0.8}
          emissive="#1f4a6b"
          emissiveIntensity={0.5}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* shell tipis lebih terang = rim subsurface, kesan cahaya nembus es */}
      <mesh geometry={geo} scale={1.008}>
        <meshBasicMaterial color="#bfe0f5" transparent opacity={0.06} depthWrite={false} />
      </mesh>
    </group>
  )
}

// tekstur ARUS: garis-garis horizontal lembut memanjang (flow lines) — dipasang
// di plane lebar yang di-drift ke samping = kesan medium yg mengalir, "di dalam sesuatu"
function makeCurrentTexture() {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 256
  const g = c.getContext('2d')
  g.fillStyle = '#000'
  g.fillRect(0, 0, 512, 256)
  const rand = (i, n) => {
    const x = Math.sin(i * 71.9 + n * 219.3) * 43758.5453
    return x - Math.floor(x)
  }
  g.globalCompositeOperation = 'lighter'
  g.lineCap = 'round'
  // garis arus melengkung, panjang, tipis-tipis — sebagian terang sebagian samar
  for (let i = 0; i < 40; i++) {
    const y = rand(i, 1) * 256
    const amp = 6 + rand(i, 2) * 16
    g.beginPath()
    g.moveTo(0, y)
    for (let x = 0; x <= 512; x += 24) g.lineTo(x, y + Math.sin(x * 0.02 + i) * amp)
    g.strokeStyle = `rgba(210,232,252,${0.03 + rand(i, 3) * 0.07})`
    g.lineWidth = 0.6 + rand(i, 4) * 1.8
    g.stroke()
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(2, 1)
  return t
}

// arus menyeret: plane-plane lebar sepanjang jalur turun, tekstur di-drift ke
// samping pelan → suasana "hanyut di dalam gletser" (permintaan Nehemiah)
function Currents() {
  const tex = useMemo(makeCurrentTexture, [])
  const mats = useRef([])
  const planes = [
    { pos: [0, -5, -8.5], rot: [0, 0, 0], s: [42, 15] },
    { pos: [0, -19, -10.5], rot: [0, 0, 0.04], s: [48, 20] },
    { pos: [0, -33, -9.5], rot: [0, 0, -0.03], s: [42, 16] },
  ]
  useFrame((state) => {
    const t = state.clock.elapsedTime
    const vis = heroFade()
    mats.current.forEach((m, i) => {
      if (!m) return
      // drift horizontal beda-beda kecepatan tiap layer = paralaks arus
      m.map.offset.x = (t * (0.008 + i * 0.004)) % 1
      m.map.offset.y = Math.sin(t * 0.05 + i) * 0.02
      m.opacity = (0.09 + Math.sin(t * 0.25 + i * 1.7) * 0.03) * vis
    })
  })
  return planes.map((p, i) => (
    <mesh key={i} position={p.pos} rotation={p.rot}>
      <planeGeometry args={p.s} />
      <meshBasicMaterial
        ref={(el) => (mats.current[i] = el)}
        map={tex}
        transparent
        opacity={0.1}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  ))
}

// caustic drifting di antara dinding — beberapa plane additive naik pelan,
// offset tekstur di-scroll biar cahayanya "menari" bukan diam
function Caustics() {
  const tex = useMemo(makeCausticTexture, [])
  const mats = useRef([])
  const planes = [
    { pos: [-7, -12, -4], rot: [0, 0.5, 0], s: [11, 20] },
    { pos: [7.5, -22, -4], rot: [0, -0.5, 0], s: [12, 22] },
    { pos: [-6, -32, -3], rot: [0, 0.45, 0], s: [10, 18] },
  ]
  useFrame((state) => {
    const t = state.clock.elapsedTime
    const vis = heroFade()
    mats.current.forEach((m, i) => {
      if (!m) return
      m.map.offset.y = (t * 0.02 + i * 0.3) % 1
      m.map.offset.x = Math.sin(t * 0.05 + i) * 0.1
      m.opacity = (0.16 + Math.sin(t * 0.4 + i * 2) * 0.06) * vis
    })
  })
  return planes.map((p, i) => (
    <mesh key={i} position={p.pos} rotation={p.rot}>
      <planeGeometry args={p.s} />
      <meshBasicMaterial
        ref={(el) => (mats.current[i] = el)}
        map={tex}
        transparent
        opacity={0.16}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  ))
}

export function Glacier() {
  return (
    <>
      <GlacierWall side={-1} />
      <GlacierWall side={1} />
      <Caustics />
      <Currents />
    </>
  )
}

useGLTF.preload(WALL)
