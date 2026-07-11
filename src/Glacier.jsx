import * as THREE from 'three'
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'

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
          opacity={0.72}
          emissive="#1f4a6b"
          emissiveIntensity={0.4}
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
    mats.current.forEach((m, i) => {
      if (!m) return
      m.map.offset.y = (t * 0.02 + i * 0.3) % 1
      m.map.offset.x = Math.sin(t * 0.05 + i) * 0.1
      m.opacity = 0.16 + Math.sin(t * 0.4 + i * 2) * 0.06
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
    </>
  )
}

useGLTF.preload(WALL)
