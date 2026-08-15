import { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { chatState } from '../scrollState'

// Serpihan es WebGL di kepala drawer chat. Ini BUKAN hiasan: dia indikator status,
// gantiin dot ijo "online" + kursor kedip. Diem = muter pelan, bot lagi ngetik =
// muter kenceng + facet-nya nyala. Sekali lihat udah tau botnya lagi mikir apa nggak.
//
// PENTING PERF: canvas ini cuma di-mount pas drawer KEBUKA (lihat ChatDock), jadi
// pas chat ketutup jumlah konteks WebGL balik ke 2 kayak semula. Dan di HP scene
// utama sengaja dibekuin pas chat kebuka (App.jsx), jadi total bebannya justru
// turun, bukan naik.

// Bipiramida 7 sisi = 14 facet segitiga. Sengaja gak simetris (radius belt
// digoyang deterministik) biar putarannya kebaca, bukan cuma "bulet muter".
// Non-indexed + computeVertexNormals = tiap segitiga dapet normal sendiri, jadi
// flat shading beneran. Motifnya nyambung sama kristal 4 facet di favicon & tombol.
function buildShard() {
  const N = 7
  const belt = []
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2
    const r = 0.6 + 0.16 * Math.sin(i * 2.7 + 0.6)
    belt.push(new THREE.Vector3(Math.cos(a) * r, 0.07 * Math.sin(i * 1.9), Math.sin(a) * r))
  }
  const top = new THREE.Vector3(0.05, 1.34, -0.06)
  const bot = new THREE.Vector3(-0.07, -0.96, 0.05)

  const p = []
  const push = (v) => p.push(v.x, v.y, v.z)
  for (let i = 0; i < N; i++) {
    const a = belt[i]
    const b = belt[(i + 1) % N]
    push(top), push(b), push(a) // facet atas (urutan dibalik biar normalnya keluar)
    push(bot), push(a), push(b) // facet bawah
  }

  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3))
  g.computeVertexNormals()
  return g
}

function Shard() {
  const geo = useMemo(buildShard, [])
  // rusuk facet digambar terpisah: garis putih tipis di tiap patahan, persis
  // rusuk yang ada di ikon SVG. Ambang 1 derajat = semua rusuk asli kepake.
  const edges = useMemo(() => new THREE.EdgesGeometry(geo, 1), [geo])
  const mesh = useRef()
  const mat = useRef()
  const spin = useRef(0)
  const busy = useRef(0)

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05) // jaga-jaga kalau tab-nya abis di-background
    // chatState ditulis useChat, dibaca di sini per frame. Sengaja lewat module
    // state, bukan prop React: nol re-render selama bot ngetik token demi token.
    const target = chatState.streaming ? 1 : 0
    busy.current += (target - busy.current) * Math.min(1, dt * 3)
    const b = busy.current

    const t = state.clock.elapsedTime
    // diem 1 putaran ~20 detik, naik sampai ~4x pas lagi mikir
    spin.current += dt * (0.31 + b * 1.05)

    const m = mesh.current
    m.rotation.y = spin.current
    m.rotation.x = Math.sin(t * 0.45) * 0.13 + Math.sin(t * 0.21) * 0.05
    m.rotation.z = Math.sin(t * 0.33) * 0.07
    m.scale.setScalar(1 + b * 0.05 * (1 + Math.sin(t * 5.2)))

    mat.current.emissiveIntensity = 0.14 + b * (0.42 + 0.3 * Math.sin(t * 5.2))

    // handle debug, nyambung sama window.__ice di App.jsx. Isi WebGL gak bisa
    // dibaca dari luar (canvas-nya di-clear tiap habis composite), jadi ini
    // satu-satunya cara verifikasi headless bahwa serpihannya beneran muter.
    if (window.__ice) window.__ice.shard = { spin: spin.current, busy: b }
  })

  return (
    // digeser turun 0.19: pusat massa bipiramidanya di y=+0.19 (puncak atas lebih
    // panjang dari bawah), kalau gak digeser dia duduk agak ke atas di kotaknya
    <mesh ref={mesh} geometry={geo} position={[0, -0.19, 0]}>
      <meshPhysicalMaterial
        ref={mat}
        flatShading
        color="#bfe0f7"
        emissive="#5aa8dd"
        emissiveIntensity={0.14}
        roughness={0.14}
        metalness={0}
        clearcoat={1}
        clearcoatRoughness={0.12}
        ior={1.31}
        transparent
        opacity={0.95}
      />
      <lineSegments geometry={edges} raycast={() => null}>
        <lineBasicMaterial color="#eaf6ff" transparent opacity={0.45} />
      </lineSegments>
    </mesh>
  )
}

export default function ShardCanvas() {
  return (
    <Canvas
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      camera={{ fov: 30, position: [0, 0, 4.05] }}
      style={{ pointerEvents: 'none' }}
    >
      {/* 3 lampu: isi lembut, key dari kiri-atas (samain sama arah cahaya di ikon
          SVG), rim biru dari belakang biar siluetnya kebaca di header navy */}
      <ambientLight intensity={0.75} color="#9ec8e8" />
      <directionalLight position={[2.4, 3, 2.6]} intensity={2.6} />
      <directionalLight position={[-2.6, -1.4, -1.8]} intensity={1.3} color="#4d8fc4" />
      <Shard />
    </Canvas>
  )
}
