import { Suspense, useEffect, useState } from 'react'
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

  return (
    <>
      {bgVideo && <video className="bg-video" src="/bg.mp4" autoPlay muted loop playsInline />}
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
