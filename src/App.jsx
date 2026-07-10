import { Suspense, useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import Experience from './Experience'
import { UI, Loader } from './UI'

export default function App() {
  const [panel, setPanel] = useState(null)
  // drop file video ke public/bg.mp4 → otomatis jadi background di belakang canvas
  const [bgVideo, setBgVideo] = useState(false)
  useEffect(() => {
    fetch('/bg.mp4', { method: 'HEAD' })
      .then((r) => setBgVideo(r.ok && (r.headers.get('content-type') || '').startsWith('video')))
      .catch(() => {})
  }, [])

  // parallax video: ikut geser halus ngikutin mouse (di-scale dikit biar tetap full frame)
  const vid = useRef()
  useEffect(() => {
    if (!bgVideo) return
    let tx = 0
    let ty = 0
    let cx = 0
    let cy = 0
    let raf
    const onMove = (e) => {
      tx = (e.clientX / window.innerWidth) * 2 - 1
      ty = (e.clientY / window.innerHeight) * 2 - 1
    }
    let last = performance.now()
    const tick = (now) => {
      // lerp berbasis waktu, bukan per-frame: kecepatan sama di fps berapapun
      const k = 1 - Math.exp(-(now - last) * 0.004)
      last = now
      cx += (tx - cx) * k
      cy += (ty - cy) * k
      if (vid.current) vid.current.style.transform = `scale(1.07) translate(${cx * -12}px, ${cy * -8}px)`
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => {
      window.removeEventListener('pointermove', onMove)
      cancelAnimationFrame(raf)
    }
  }, [bgVideo])

  return (
    <>
      {bgVideo && <video ref={vid} className="bg-video" src="/bg.mp4" autoPlay muted loop playsInline />}
      <div className="canvas-wrap">
        <Canvas
          dpr={[1, 1.5]}
          gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
          camera={{ fov: 32, position: [0, 1.8, 11], near: 0.1, far: 100 }}
          style={{ touchAction: 'pan-y' }}
        >
          <Suspense fallback={null}>
            <Experience onOpen={setPanel} hasVideo={bgVideo} />
          </Suspense>
        </Canvas>
      </div>
      <div className="scroll-space" aria-hidden="true" />
      <UI panel={panel} onClose={() => setPanel(null)} />
      <Loader />
    </>
  )
}
