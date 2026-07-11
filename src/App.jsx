import { Suspense, useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import Experience from './Experience'
import { UI, Loader } from './UI'
import { introState, scrollState } from './scrollState'

const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

// easing jatuhnya batu: ngebut di awal (gravitasi), mendarat dengan dip kecil
// ke bawah lalu ngangkat balik — kayak bongkahan es nyemplung terus ngambang
const easeDrop = (x) => {
  const c = 0.9
  return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2)
}

const FALL_MS = 1900 // durasi batu jatuh
const WASH_MS = 480 // durasi tirai kabut nutup pas loop 100 → 0

// background = video langit hasil generate (public/scene/scene.mp4): kabut idle "breathing",
// angin, kristal es lewat — dunia yang masuk akal buat batu-batu melayang.
// Pas scroll nyampe batu pertama, videonya fade out ketutup kabut putih polos.
// Kalau file-nya belum ada, fallback ke background procedural (kabut + drifting ice).
export default function App() {
  const [panel, setPanel] = useState(null)
  const [hasVideo, setHasVideo] = useState(false)
  const videoRef = useRef()
  const veilRef = useRef()
  const washRef = useRef()

  // ===== state machine intro batu jatuh + infinite loop scroll =====
  useEffect(() => {
    const S = introState
    let raf
    let charge = 0 // akumulasi niat scroll pas udah mentok 100/100

    const startWash = () => {
      S.phase = 'wash'
      S.t0 = performance.now()
      charge = 0
    }
    // scroll ekstra di ujung = "isi tenaga" buat nyebur balik ke atas.
    // Threshold-nya beberapa notch wheel biar gak ke-trigger momentum doang
    const tryCharge = (dy) => {
      if (S.phase !== 'idle' || dy <= 0) return
      if (scrollState.progress < 0.985) return
      charge += dy
      if (charge > 240) startWash()
    }
    const onWheel = (e) => tryCharge(e.deltaY)
    const onKey = (e) => {
      if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') tryCharge(140)
    }
    let touchY = null
    const onTouchStart = (e) => (touchY = e.touches[0].clientY)
    const onTouchMove = (e) => {
      if (touchY == null) return
      const y = e.touches[0].clientY
      tryCharge((touchY - y) * 1.6) // jari geser ke atas = scroll ke bawah
      touchY = y
    }
    window.addEventListener('wheel', onWheel, { passive: true })
    window.addEventListener('keydown', onKey)
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: true })

    const tick = (now) => {
      if (S.phase === 'fall') {
        const k = clamp((now - S.t0) / FALL_MS, 0, 1)
        S.eased = easeDrop(k)
        // background/video baru muncul pas batunya udah deket posisi mendarat
        S.reveal = clamp((k - 0.55) / 0.45, 0, 1)
        // sisa tirai loop (kalau ada) kebuka cepet di awal jatuh
        S.wash = S.washPeak * clamp(1 - k * 2.4, 0, 1)
        // scroll dikunci di puncak selama batu masih jatuh
        if (window.scrollY !== 0) window.scrollTo(0, 0)
        scrollState.progress = 0
        scrollState.damped = 0
        if (k >= 1) {
          S.phase = 'idle'
          S.eased = 1
          S.reveal = 1
          S.wash = 0
        }
      } else if (S.phase === 'wash') {
        const w = clamp((now - S.t0) / WASH_MS, 0, 1)
        S.wash = w
        if (w >= 1) {
          // layar udah ketutup penuh — aman lompat 100 → 0 tanpa keliatan.
          // batu hero balik ke atas & langsung jatuh lagi: loopnya nyambung
          window.scrollTo(0, 0)
          scrollState.progress = 0
          scrollState.damped = 0
          S.phase = 'fall'
          S.t0 = now
          S.washPeak = 1
          S.reveal = 0
          S.eased = 0
        }
      } else if (S.phase === 'idle' && scrollState.progress < 0.97) {
        charge = 0 // reset tenaga kalau user naik lagi dari ujung
      }
      if (washRef.current) {
        washRef.current.style.opacity = S.wash
        washRef.current.style.visibility = S.wash > 0.005 ? 'visible' : 'hidden'
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
    }
  }, [])

  useEffect(() => {
    // handle debug buat verifikasi otomatis (Playwright) — gak dipakai runtime
    window.__ice = { introState, scrollState }
    // cek beneran video — dev server Vite ngebales 200 text/html buat file yang gak ada
    fetch('/scene/scene.mp4', { method: 'HEAD' })
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
        // kabut GAK nutup total: video fade PELAN ke sisa tipis (0.3), jadi langit
        // background tetep keintip samar pas nyelam ke bawah (permintaan Nehemiah).
        // Dikali introState.reveal: pas intro/loop, batu jatuh DULUAN di kabut
        // kosong, baru backgroundnya nyusul muncul
        const fade = clamp(1 - (scrollState.damped - 0.12) / 0.24, 0, 1)
        el.style.opacity = (0.3 + 0.7 * fade) * introState.reveal
        if (el.paused) el.play().catch(() => {})
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [hasVideo])

  return (
    <>
      {hasVideo && <video ref={videoRef} className="bg-video" src="/scene/scene.mp4" autoPlay muted loop playsInline />}
      {hasVideo && <div ref={veilRef} className="fog-veil" aria-hidden="true" />}
      {/* tirai kabut penutup layar buat transisi loop 100/100 → 0/100 */}
      <div ref={washRef} className="loop-wash" aria-hidden="true" />
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
