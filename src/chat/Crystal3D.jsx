import { Canvas, useFrame } from '@react-three/fiber'
import { useRef } from 'react'

// Kristal es 3D live yang muter pelan, dipakai sebagai ikon tombol chatbot.
// Sengaja pakai material "es murah" (standard + flatShading + emissive + shell rim)
// sesuai playbook, BUKAN MeshTransmissionMaterial: tombol ini persist di layar,
// jadi harus enteng (transmission = render pass ekstra tiap frame).
function CrystalMesh() {
  const g = useRef()
  useFrame((state, delta) => {
    const el = g.current
    if (!el) return
    el.rotation.y += delta * 0.55
    el.rotation.x = Math.sin(state.clock.elapsedTime * 0.5) * 0.14
  })
  return (
    <group ref={g}>
      {/* inti kristal, facet kebaca dari flatShading */}
      <mesh scale={[1, 1.5, 1]}>
        <octahedronGeometry args={[0.8, 0]} />
        <meshStandardMaterial
          color="#c6d8e4"
          roughness={0.16}
          metalness={0.12}
          emissive="#7ba7cc"
          emissiveIntensity={0.6}
          flatShading
          transparent
          opacity={0.96}
        />
      </mesh>
      {/* shell tipis = rim terang, kesan cahaya nembus es (fake subsurface) */}
      <mesh scale={[1.07, 1.6, 1.07]}>
        <octahedronGeometry args={[0.8, 0]} />
        <meshBasicMaterial color="#eaf6ff" transparent opacity={0.12} depthWrite={false} />
      </mesh>
    </group>
  )
}

export default function Crystal3D() {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 0, 4.6], fov: 32 }}
      gl={{ alpha: true, antialias: true }}
      frameloop="always"
    >
      <ambientLight intensity={1.05} />
      <directionalLight position={[3, 4, 5]} intensity={1.9} color="#eaf6ff" />
      <directionalLight position={[-4, -2, -3]} intensity={0.6} color="#bfe6ff" />
      <CrystalMesh />
    </Canvas>
  )
}
