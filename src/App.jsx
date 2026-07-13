import { Suspense, useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import Experience from './Experience'
import { UI, Loader } from './UI'
import ChatDock from './chat/ChatDock'
import { beginFocus, chatState, dragState, endFocus, focusState, introState, scrollState } from './scrollState'

const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

const FALL_MS = 2100 // durasi animasi emerge intro pertama
const smooth = (x) => x * x * (3 - 2 * x)

// salju yg jatuh nutupin biru transisi loop — canvas ringan, cuma gambar pas
// bridge aktif. Ngasih gerak & isi biar 109→120 gak kerasa "biru kosong doang"
// (permintaan Nehemiah). Alpha ngikut envelope bridge yg sama kayak wash.
function SnowVeil() {
  const ref = useRef()
  useEffect(() => {
    const cv = ref.current
    const ctx = cv.getContext('2d')
    let raf
    let W = 0
    let H = 0
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const resize = () => {
      W = window.innerWidth
      H = window.innerHeight
      cv.width = W * dpr
      cv.height = H * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)
    const rnd = (s) => {
      const x = Math.sin(s * 12.9898) * 43758.5453
      return x - Math.floor(x)
    }
    // 3 lapis kedalaman: jauh (kecil,lambat,samar) → deket (gede,cepat,jelas)
    const flakes = Array.from({ length: 150 }, (_, i) => {
      const layer = i % 3
      return {
        x: rnd(i + 1),
        y: rnd(i + 7),
        r: (0.7 + rnd(i + 3) * 1.6) * (0.6 + layer * 0.45),
        spd: (0.06 + rnd(i + 5) * 0.16) * (0.5 + layer * 0.5),
        drift: (rnd(i + 9) - 0.5) * 0.4,
        ph: rnd(i + 11) * 6.28,
        a: 0.25 + layer * 0.28,
      }
    })
    let last = performance.now()
    const tick = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const br = scrollState.bridge
      const env = clamp((br - 0.28) / 0.14, 0, 1) * (1 - clamp((br - 0.66) / 0.16, 0, 1))
      ctx.clearRect(0, 0, W, H)
      if (env > 0.02) {
        for (const f of flakes) {
          f.y += f.spd * dt
          if (f.y > 1.06) f.y -= 1.12
          f.ph += dt * 0.8
          const px = (f.x + Math.sin(f.ph) * f.drift * 0.04) * W
          const py = ((f.y % 1) + 1) % 1 * H
          ctx.beginPath()
          ctx.fillStyle = `rgba(234,244,252,${f.a * env * (0.6 + 0.4 * Math.sin(f.ph * 1.6))})`
          ctx.arc(px, py, f.r, 0, 6.283)
          ctx.fill()
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])
  return <canvas ref={ref} className="snow-veil" aria-hidden="true" />
}

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
  const [hasGlacier, setHasGlacier] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [ready, setReady] = useState(false) // true pas intro emerge kelar (buat munculin tombol ECHO)
  const diveTimer = useRef(null)
  const videoRef = useRef()

  const openChat = () => {
    setChatOpen(true)
    chatState.open = true
  }
  const closeChat = () => {
    setChatOpen(false)
    chatState.open = false
  }

  // klik batu: mulai animasi menyelam, panel konten muncul pas kamera udah nembus
  const openRock = (id, pos) => {
    if (focusState.phase !== 'idle') return // lagi nyelam/kebuka — abaikan klik dobel
    beginFocus(id, pos ?? [0, 0, 0])
    clearTimeout(diveTimer.current)
    diveTimer.current = setTimeout(() => setPanel(id), 1150) // sinkron sama durasi nembus
  }
  const closeRock = () => {
    clearTimeout(diveTimer.current)
    setPanel(null)
    endFocus()
  }
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
        // intro PERTAMA (permintaan Nehemiah): BUKAN layar putih — reuse animasi
        // emerge biru+salju yang sama kayak ujung loop (112→120). Bridge digerakin
        // WAKTU dari 0.6→1.0: biru+salju nyingkap, batu hero mendarat, nama muncul
        const k = clamp((now - S.t0) / FALL_MS, 0, 1)
        const br = 0.6 + 0.4 * smooth(k) // bridge 0.6 → 1.0 (fase emerge)
        const ld = DESCEND + br * (1 - DESCEND)
        loopDamped = ld
        S.reveal = 1 // dunia udah ada di balik biru — biru yg nyingkap, bukan fog putih
        scrollState.progress = 1
        scrollState.damped = 1
        scrollState.bridge = br
        scrollState.loopDamped = ld
        scrollState.depthK = 1 - br // retrace ke 0 (hero) pas emerge kelar
        if (window.scrollY !== 0) window.scrollTo(0, 0)
        if (k >= 1) {
          // mendarat di hero → mulai loop normal dari posisi 0
          S.phase = 'idle'
          S.reveal = 1
          setReady(true) // dunia udah kebentuk → tombol ECHO boleh nongol
          scrollState.progress = scrollState.damped = scrollState.bridge = 0
          scrollState.depthK = scrollState.loopDamped = 0
          loopDamped = 0
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

      // ---- tirai biru jembatan: bukan full-cover kosong lagi. Biru dibikin
      //      TEMBUS (env*0.72) biar batu es echo yg membesar keliatan nembusnya
      //      = ada isi, gak biru polos (permintaan Nehemiah). Cuma di detik
      //      teleport (seam br≈0.55) opacity dinaikin ke ~penuh buat nyamarin
      //      lompatan kamera dive→hero ----
      const br = scrollState.bridge
      const env = clamp((br - 0.28) / 0.14, 0, 1) * (1 - clamp((br - 0.66) / 0.16, 0, 1))
      const seam = Math.exp(-Math.pow((br - 0.55) / 0.035, 2))
      const wash = clamp(env * 0.72 + seam * 0.3, 0, 1)
      if (washRef.current) {
        washRef.current.style.opacity = wash
        washRef.current.style.visibility = env > 0.004 ? 'visible' : 'hidden'
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

  // kunci scroll halaman selama panel batu ATAU chat ECHO kebuka — biar pas ditutup
  // scene balik ke posisi yg sama (bukan loncat ke posisi scroll yg berubah di belakang)
  useEffect(() => {
    if (!panel && !chatOpen) return
    const prev = document.documentElement.style.overflow
    document.documentElement.style.overflow = 'hidden'
    return () => {
      document.documentElement.style.overflow = prev
    }
  }, [panel, chatOpen])

  useEffect(() => {
    // handle debug buat verifikasi otomatis (Playwright) — gak dipakai runtime
    window.__ice = {
      introState,
      scrollState,
      focusState,
      chatState,
      open: openRock,
      close: closeRock,
      openChat,
      closeChat,
    }
    // cek beneran video — dev server Vite ngebales 200 text/html buat file yang gak ada
    fetch('/scene/scene.mp4', { method: 'HEAD' })
      .then((r) => {
        const type = r.headers.get('content-type') || ''
        if (r.ok && type.includes('video')) setHasVideo(true)
      })
      .catch(() => {})
    // video loop "dalam glacier" buat background panel batu — kalau Nehemiah udah
    // taruh filenya, dipakai; kalau belum, panel fallback ke gradient es procedural
    fetch('/content/glacier.mp4', { method: 'HEAD' })
      .then((r) => {
        const type = r.headers.get('content-type') || ''
        if (r.ok && type.includes('video')) setHasGlacier(true)
      })
      .catch(() => {})
  }, [])

  return (
    <>
      {hasVideo && <video ref={videoRef} className="bg-video" src="/scene/scene.mp4" autoPlay muted loop playsInline />}
      {hasVideo && <div ref={veilRef} className="fog-veil" aria-hidden="true" />}
      {/* tint biru gletser di backdrop, makin dalam makin pekat */}
      <div ref={depthTintRef} className="depth-tint" aria-hidden="true" />
      {/* tirai biru penutup layar buat transisi loop 100/100 → 0/100 */}
      <div ref={washRef} className="loop-wash" aria-hidden="true" />
      {/* salju jatuh di atas biru pas transisi — biar gak kerasa biru kosong */}
      <SnowVeil />
      <div className="canvas-wrap">
        <Canvas
          dpr={[1, 1.5]}
          gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
          camera={{ fov: 32, position: [0, 1.8, 11], near: 0.1, far: 100 }}
          style={{ touchAction: 'pan-y' }}
        >
          <Suspense fallback={null}>
            <Experience onOpen={openRock} hasVideo={hasVideo} />
          </Suspense>
        </Canvas>
      </div>
      <div ref={scrollSpaceRef} className="scroll-space" aria-hidden="true" />
      <UI panel={panel} onClose={closeRock} hasGlacier={hasGlacier} onOpenChat={openChat} />
      <ChatDock open={chatOpen} onOpen={openChat} onClose={closeChat} hidden={!ready || !!panel} />
      <Loader />
    </>
  )
}
