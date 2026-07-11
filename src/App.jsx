import { Suspense, useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import Experience from './Experience'
import { UI, Loader } from './UI'
import { scrollState } from './scrollState'

const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

// background = video langit hasil generate (public/bg.mp4): kabut idle "breathing",
// angin, kristal es lewat — dunia yang masuk akal buat batu-batu melayang.
// Pas scroll nyampe batu pertama, videonya fade out ketutup kabut putih polos.
// Kalau file-nya belum ada, fallback ke background procedural (kabut + drifting ice).
export default function App() {
  const [panel, setPanel] = useState(null)
  const [hasVideo, setHasVideo] = useState(false)
  const videoRef = useRef()
  const veilRef = useRef()

  useEffect(() => {
    // cek beneran video — dev server Vite ngebales 200 text/html buat file yang gak ada
    fetch('/bg.mp4', { method: 'HEAD' })
      .then((r) => {
        const type = r.headers.get('content-type') || ''
        if (r.ok && type.includes('video')) setHasVideo(true)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!hasVideo) return
    let raf
    const tick = () => {
      const el = videoRef.current
      const veil = veilRef.current
      // transisi video → kabut GAK langsung "plek": tirai kabut NAIK DARI BAWAH
      // layar nutupin videonya pelan-pelan ngikutin scroll
      if (veil) {
        const k = clamp((scrollState.damped - 0.02) / 0.13, 0, 1)
        veil.style.transform = `translateY(${100 - 200 * k}vh)`
      }
      if (el) {
        // backup fade: video ilang total dikit setelah tirai kabutnya nutup penuh
        const o = clamp(1 - (scrollState.damped - 0.12) / 0.08, 0, 1)
        el.style.opacity = o
        // video di-pause pas udah gak keliatan — hemat GPU di kedalaman
        if (o === 0 && !el.paused) el.pause()
        else if (o > 0 && el.paused) el.play().catch(() => {})
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [hasVideo])

  return (
    <>
      {hasVideo && <video ref={videoRef} className="bg-video" src="/bg.mp4" autoPlay muted loop playsInline />}
      {hasVideo && <div ref={veilRef} className="fog-veil" aria-hidden="true" />}
      <div className="canvas-wrap">
        <Canvas
          dpr={[1, 1.5]}
          gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
          camera={{ fov: 32, position: [0, 1.8, 11], near: 0.1, far: 100 }}
          style={{ touchAction: 'pan-y' }}
        >
          <Suspense fallback={null}>
            <Experience onOpen={setPanel} hasVideo={hasVideo} />
          </Suspense>
        </Canvas>
      </div>
      <div className="scroll-space" aria-hidden="true" />
      <UI panel={panel} onClose={() => setPanel(null)} />
      <Loader />
    </>
  )
}
