import { Suspense, useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import Experience from './Experience'
import { UI, Loader } from './UI'
import { dragState, introState, scrollState } from './scrollState'

const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

// easing jatuhnya batu: ngebut di awal (gravitasi), mendarat dengan dip kecil
// ke bawah lalu ngangkat balik — kayak bongkahan es nyemplung terus ngambang
const easeDrop = (x) => {
  const c = 0.9
  return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2)
}

const FALL_MS = 1900 // durasi batu jatuh (intro pertama)
const smooth = (x) => x * x * (3 - 2 * x)

// loop di-bagi: 0..DESCEND = perjalanan turun (hero→partikel), DESCEND..1 =
// "jembatan" balik ke start (batu jatuh lagi). Counter jalan sampai 120.
const DESCEND = 100 / 120
// anchor auto-center (dalam satuan descend 0..1) → dikonversi ke satuan loop
const DESCEND_ANCHORS = [0, 0.2, 0.4, 0.6, 0.8, 0.915, 1]
const LOOP_ANCHORS = DESCEND_ANCHORS.map((a) => a * DESCEND)
// tinggi 1 periode loop dalam layar (≈ sama feel-nya kayak 480vh descend lama)
const periodPx = () => window.innerHeight * 5.8

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
  const depthTintRef = useRef()
  const scrollSpaceRef = useRef()

  // ===== master: intro batu jatuh (sekali) + infinite loop scroll dua arah =====
  useEffect(() => {
    const S = introState
    let raf
    let P = periodPx() // tinggi 1 periode loop (px)
    let loopDamped = 0 // posisi loop ter-smoothing (0..1), damping SIRKULAR
    let lastNow = performance.now()
    let lastUser = performance.now()
    let snapAnim = null
    let snapping = false

    const sizeSpace = () => {
      P = periodPx()
      // 3 salinan periode + 1 layar: user selalu di salinan tengah, pas mepet
      // tepi di-"recenter" ±P (gak keliatan karena konten periodik: 0 ≡ 120)
      if (scrollSpaceRef.current) scrollSpaceRef.current.style.height = `${3 * P + window.innerHeight}px`
    }
    const bump = () => {
      lastUser = performance.now()
      snapping = false
      snapAnim = null
    }
    window.addEventListener('resize', sizeSpace)
    window.addEventListener('wheel', bump, { passive: true })
    window.addEventListener('touchmove', bump, { passive: true })
    window.addEventListener('pointerdown', bump)
    window.addEventListener('keydown', bump)

    const frac = (v) => ((v % 1) + 1) % 1

    const tick = (now) => {
      const dt = Math.min(0.05, (now - lastNow) / 1000)
      lastNow = now

      if (S.phase === 'wait') {
        // loader masih nutup — diem
      } else if (S.phase === 'fall') {
        // intro pertama: batu jatuh (waktu), scroll dikunci di puncak
        const k = clamp((now - S.t0) / FALL_MS, 0, 1)
        S.eased = easeDrop(k)
        S.reveal = clamp((k - 0.55) / 0.45, 0, 1)
        if (window.scrollY !== 0) window.scrollTo(0, 0)
        scrollState.progress = scrollState.damped = scrollState.bridge = 0
        scrollState.depthK = scrollState.loopDamped = 0
        loopDamped = 0
        if (k >= 1) {
          S.phase = 'idle'
          S.eased = 1
          S.reveal = 1
          sizeSpace()
          window.scrollTo(0, P) // masuk salinan tengah, posisi loop = 0 (hero)
          lastUser = now
        }
      } else {
        // ---- idle: infinite loop ----
        let y = window.scrollY
        // recenter tak-kasat-mata biar gak pernah mentok tepi (dua arah)
        if (y < 0.5 * P) {
          y += P
          window.scrollTo(0, y)
        } else if (y > 2.5 * P) {
          y -= P
          window.scrollTo(0, y)
        }
        const loopRaw = frac(y / P)

        // auto-center ala igloo — cuma di zona descend, ke anchor terdekat
        if (!snapAnim && now - lastUser > 1000 && !dragState.active && loopRaw <= DESCEND + 1e-3) {
          let A = LOOP_ANCHORS[0]
          for (const a of LOOP_ANCHORS) if (Math.abs(a - loopRaw) < Math.abs(A - loopRaw)) A = a
          if (Math.abs(A - loopRaw) < 0.08) {
            const targetY = (Math.round(y / P - A) + A) * P
            if (Math.abs(targetY - y) > 2) snapAnim = { from: y, to: targetY, start: now, dur: Math.min(2200, 700 + Math.abs(targetY - y) * 1.1) }
          }
        }
        if (snapAnim) {
          const u = Math.min(1, (now - snapAnim.start) / snapAnim.dur)
          const e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2
          snapping = true
          window.scrollTo(0, snapAnim.from + (snapAnim.to - snapAnim.from) * e)
          y = window.scrollY
          if (u >= 1) {
            snapAnim = null
            snapping = false
          }
        }

        // damping SIRKULAR (jalur terdekat) — biar seam 0.99→0.00 gak nge-scrub mundur
        let d = frac(y / P) - loopDamped
        if (d > 0.5) d -= 1
        if (d < -0.5) d += 1
        loopDamped = frac(loopDamped + d * (1 - Math.exp(-dt / 0.16)))

        const dprog = clamp(loopDamped / DESCEND, 0, 1)
        const br = clamp((loopDamped - DESCEND) / (1 - DESCEND), 0, 1)
        scrollState.progress = clamp(loopRaw / DESCEND, 0, 1)
        scrollState.damped = dprog
        scrollState.bridge = br
        scrollState.loopDamped = loopDamped
        // depthK: retrace balik ke 0 pas bridge → ujung bridge == awal descend
        scrollState.depthK = br > 0 ? 1 - br : dprog
      }

      // ---- tirai kabut jembatan: nutup TENGAH bridge buat nyamarin kamera
      //      pindah dari podium (bawah) balik ke hero (atas) ----
      const br = scrollState.bridge
      // full-cover 0.45..0.62 — nyamarin lompatan kamera dive→hero di br 0.55
      const wash = clamp((br - 0.3) / 0.15, 0, 1) * (1 - clamp((br - 0.62) / 0.18, 0, 1))
      if (washRef.current) {
        washRef.current.style.opacity = wash
        washRef.current.style.visibility = wash > 0.004 ? 'visible' : 'hidden'
      }

      const rv = S.phase === 'idle' ? 1 : S.reveal
      const dk = scrollState.depthK
      if (depthTintRef.current) {
        depthTintRef.current.style.opacity = clamp((dk - 0.2) / 0.5, 0, 1) * 0.68 * rv
      }
      const veil = veilRef.current
      if (veil) {
        const k = clamp((dk - 0.02) / 0.13, 0, 1)
        veil.style.transform = `translateY(${100 - 200 * k}vh)`
      }
      const el = videoRef.current
      if (el) {
        const fade = clamp(1 - (dk - 0.12) / 0.24, 0, 1)
        el.style.opacity = (0.3 + 0.7 * fade) * rv
        if (el.paused) el.play().catch(() => {})
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', sizeSpace)
      window.removeEventListener('wheel', bump)
      window.removeEventListener('touchmove', bump)
      window.removeEventListener('pointerdown', bump)
      window.removeEventListener('keydown', bump)
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

  return (
    <>
      {hasVideo && <video ref={videoRef} className="bg-video" src="/scene/scene.mp4" autoPlay muted loop playsInline />}
      {hasVideo && <div ref={veilRef} className="fog-veil" aria-hidden="true" />}
      {/* tint biru gletser di backdrop, makin dalam makin pekat */}
      <div ref={depthTintRef} className="depth-tint" aria-hidden="true" />
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
      <div ref={scrollSpaceRef} className="scroll-space" aria-hidden="true" />
      <UI panel={panel} onClose={() => setPanel(null)} />
      <Loader />
    </>
  )
}
