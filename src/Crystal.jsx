import * as THREE from 'three'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Float, Html, MeshTransmissionMaterial, useCursor, useGLTF } from '@react-three/drei'
import { easing } from 'maath'
import { dragState, scrollState } from './scrollState'

const MODEL = '/models/iceberg.glb'

export function Crystal({ data, onOpen, interactive = true }) {
  const { nodes } = useGLTF(data.model ?? MODEL)
  const group = useRef()
  const spinner = useRef()
  const shineMat = useRef()
  const dragging = useRef(null)
  const [hovered, setHovered] = useState(false)
  const [near, setNear] = useState(!interactive)
  const wp = useMemo(() => new THREE.Vector3(), [])
  const draggable = !!data.draggable
  useCursor(hovered && (interactive || draggable))

  const geometry = useMemo(() => Object.values(nodes).find((n) => n.isMesh)?.geometry, [nodes])

  useFrame((state, delta) => {
    if (!group.current || !spinner.current) return
    // hanya mesh-nya yang muter — label anotasi tetap diam ala igloo.
    // pas lagi di-drag, auto-spin berhenti biar gak rebutan kendali.
    if (!dragging.current) spinner.current.rotation.y += delta * (data.spin ?? 0.06)
    const s = (data.scale ?? 1) * (interactive && hovered ? 1.07 : 1)
    easing.damp3(group.current.scale, [s, s, s], 0.25, delta)
    // kilau wireframe pas hover — glint facet ala igloo
    if (shineMat.current) easing.damp(shineMat.current, 'opacity', hovered ? 0.3 : 0, 0.18, delta)
    if (interactive) {
      group.current.getWorldPosition(wp)
      const n = state.camera.position.distanceTo(wp) < 14
      if (n !== near) setNear(n)
    }
  })

  const events = {
    onPointerOver: (e) => {
      e.stopPropagation()
      setHovered(true)
    },
    onPointerOut: () => setHovered(false),
  }
  if (interactive) {
    events.onClick = (e) => {
      e.stopPropagation()
      onOpen?.(data.id)
    }
  }
  useEffect(() => {
    if (!draggable) return
    // ala igloo: selama masih di hero, drag DI MANA AJA muterin batunya —
    // gak tergantung raycast kena mesh (yang sering ketutup overlay/kabut)
    const down = (e) => {
      if (scrollState.damped > 0.06) return
      if (e.target.closest?.('a, button, .panel')) return
      dragging.current = { x: e.clientX, y: e.clientY }
      dragState.active = true
      document.body.style.cursor = 'grabbing'
    }
    const move = (e) => {
      if (!dragging.current || !spinner.current) return
      const dx = e.clientX - dragging.current.x
      const dy = e.clientY - dragging.current.y
      spinner.current.rotation.y += dx * 0.01
      spinner.current.rotation.x = THREE.MathUtils.clamp(spinner.current.rotation.x + dy * 0.006, -0.6, 0.6)
      dragging.current = { x: e.clientX, y: e.clientY }
    }
    const up = () => {
      if (!dragging.current) return
      dragging.current = null
      dragState.active = false
      document.body.style.cursor = ''
    }
    window.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      window.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [draggable])

  return (
    <Float speed={1.1} rotationIntensity={draggable ? 0 : 0.1} floatIntensity={0.4}>
      <group ref={group} position={data.position} scale={0.001} {...events}>
        <group ref={spinner} rotation={[0, data.yaw ?? 0, 0]}>
          <mesh geometry={geometry}>
            <MeshTransmissionMaterial
              transmissionSampler
              samples={4}
              resolution={256}
              transmission={1}
              thickness={1.8}
              roughness={0.1}
              ior={1.31}
              chromaticAberration={0.05}
              anisotropy={0.15}
              distortion={0.08}
              distortionScale={0.2}
              temporalDistortion={0.03}
              color="#eaf2f7"
              attenuationColor="#d6e8f1"
              attenuationDistance={6}
              clearcoat={1}
              clearcoatRoughness={0.12}
              envMapIntensity={1.1}
            />
          </mesh>
          {/* overlay kilau: wireframe putih yang nyala pas hover */}
          <mesh geometry={geometry} scale={1.002}>
            <meshBasicMaterial ref={shineMat} wireframe transparent opacity={0} color="#ffffff" toneMapped={false} depthWrite={false} />
          </mesh>
          <Artifact type={data.artifact} />
        </group>
        {interactive && (
          <Html position={data.labelOffset ?? [1.5, 0.8, 0]} zIndexRange={[8, 0]}>
            <div
              className={`anno ${near ? 'is-visible' : ''} ${hovered ? 'is-hot' : ''}`}
              style={{ pointerEvents: near ? 'auto' : 'none' }}
              onClick={() => onOpen?.(data.id)}
              onPointerOver={() => setHovered(true)}
              onPointerOut={() => setHovered(false)}
            >
              <div className="anno-code">{data.code}</div>
              <div className="anno-name">{data.name}</div>
              <div className="anno-cta">CLICK TO EXPLORE</div>
            </div>
          </Html>
        )}
      </group>
    </Float>
  )
}

// artefak gelap di dalam es — ala penguin dalam bongkahan igloo
function Artifact({ type }) {
  if (!type) return null
  return (
    <mesh scale={0.8}>
      {type === 'octahedron' && <octahedronGeometry args={[0.34, 0]} />}
      {type === 'torusknot' && <torusKnotGeometry args={[0.26, 0.085, 110, 14]} />}
      {type === 'icosahedron' && <icosahedronGeometry args={[0.32, 0]} />}
      <meshStandardMaterial color="#46505a" roughness={0.4} metalness={0.3} />
    </mesh>
  )
}

useGLTF.preload(MODEL)
useGLTF.preload('/models/iceberg_hero.glb')
