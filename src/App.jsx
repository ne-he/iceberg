import { Suspense, useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { gsap } from 'gsap'
import { ShaderGradientCanvas, ShaderGradient } from '@shadergradient/react'
import Experience from './Experience'
import { UI, Loader } from './UI'
import ChatDock from './chat/ChatDock'
import TargetCursor from './components/TargetCursor/TargetCursor'
import { beginFocus, bgVideoState, chatState, dragState, endFocus, focusState, introState, scrollState } from './scrollState'

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
  const gradRef = useRef()
  const scrollSpaceRef = useRef()

  // ===== master: intro batu jatuh (sekali) + infinite loop scroll dua arah =====
  useEffect(() => {
    const S = introState
    let raf
    let P = periodPx() // tinggi 1 periode loop (px)
    let loopDamped = 0 // posisi loop ter-smoothing (0..1), damping SIRKULAR
    let lastNow = performance.now()
    let lastUser = performance.now()
    let snapTween = null // tween GSAP yg lagi jalan (null = gak ada)
    let prevLoopRaw = 0 // buat ngedeteksi arah scroll terakhir
    let dir = 0 // -1 naik, +1 turun, 0 belum gerak

    const sizeSpace = () => {
      P = periodPx()
      // 3 salinan periode + 1 layar: user selalu di salinan tengah, pas mepet
      // tepi di-"recenter" ±P (gak keliatan karena konten periodik: 0 ≡ 120)
      if (scrollSpaceRef.current) scrollSpaceRef.current.style.height = `${3 * P + window.innerHeight}px`
    }
    const bump = () => {
      lastUser = performance.now()
      // user nyentuh input apa pun = snap batal seketika (jangan lawan tangan user)
      if (snapTween) {
        snapTween.kill()
        snapTween = null
      }
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

        // arah scroll terakhir (jalur sirkular terdekat) — cuma dicatat dari
        // gerakan user, bukan dari tween snap yg lagi jalan
        if (!snapTween) {
          let dm = loopRaw - prevLoopRaw
          if (dm > 0.5) dm -= 1
          if (dm < -0.5) dm += 1
          if (Math.abs(dm) > 0.00005) dir = Math.sign(dm)
        }
        prevLoopRaw = loopRaw

        // snap antar section (teknik dari video snap-on-scroll Nicolai Palmkvist:
        // fullPage scrollingSpeed 1000ms + transisi GSAP power2.out). Diadaptasi
        // ke infinite loop kita: idle 450ms → SELALU dikunci ke anchor (gak ada
        // posisi nyangkut di tengah section), dan DIRECTIONAL — lewat 22% gap
        // searah gerakan terakhir udah dianggap "niat pindah section"
        if (!snapTween && now - lastUser > 450 && !dragState.active && focusState.phase === 'idle' && loopRaw <= DESCEND + 1e-3) {
          // dua anchor pengapit posisi sekarang
          let lo = LOOP_ANCHORS[0]
          let hi = LOOP_ANCHORS[LOOP_ANCHORS.length - 1]
          for (let i = 0; i < LOOP_ANCHORS.length - 1; i++) {
            if (loopRaw >= LOOP_ANCHORS[i] - 1e-6 && loopRaw <= LOOP_ANCHORS[i + 1] + 1e-6) {
              lo = LOOP_ANCHORS[i]
              hi = LOOP_ANCHORS[i + 1]
              break
            }
          }
          const g = hi > lo ? (loopRaw - lo) / (hi - lo) : 0
          let A
          if (dir > 0) A = g > 0.22 ? hi : lo
          else if (dir < 0) A = g < 0.78 ? lo : hi
          else A = g < 0.5 ? lo : hi
          const targetY = (Math.round(y / P - A) + A) * P
          if (Math.abs(targetY - y) > 2) {
            const proxy = { y }
            snapTween = gsap.to(proxy, {
              y: targetY,
              // ~1 detik ala scrollingSpeed fullPage, dikit lebih lama kalau jauh
              duration: Math.min(1.5, 0.85 + (Math.abs(targetY - y) / P) * 1.2),
              ease: 'power2.out', // tarikan tegas di awal, mendarat lembut
              onUpdate: () => window.scrollTo(0, proxy.y),
              onComplete: () => {
                snapTween = null
              },
            })
          }
        }
        if (snapTween) y = window.scrollY

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
      // gradient shader "arus dalam" (ShaderGradient): idup cuma pas dalem,
      // gantiin rasa tint biru datar jadi air yang gerak. Di hero opacity 0
      if (gradRef.current) {
        gradRef.current.style.opacity = clamp((dk - 0.24) / 0.4, 0, 1) * 0.5 * rv
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
      if (snapTween) snapTween.kill()
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
        else bgVideoState.ready = true // gak ada video langit = gak usah ditunggu
      })
      .catch(() => {
        bgVideoState.ready = true
      })
    // video loop "dalam glacier" buat background panel batu. File-nya di
    // public/glacier_inside.mp4; kalau ga ketemu, panel fallback ke gradient es.
    fetch('/glacier_inside.mp4', { method: 'HEAD' })
      .then((r) => {
        const type = r.headers.get('content-type') || ''
        if (r.ok && type.includes('video')) setHasGlacier(true)
      })
      .catch(() => {})
  }, [])

  return (
    <>
      {hasVideo && (
        <video
          ref={videoRef}
          className="bg-video"
          src="/scene/scene.mp4"
          autoPlay
          muted
          loop
          playsInline
          // loadeddata = frame pertama udah kelar decode → loader boleh buka tirai
          onLoadedData={() => (bgVideoState.ready = true)}
          onError={() => (bgVideoState.ready = true)}
        />
      )}
      {hasVideo && <div ref={veilRef} className="fog-veil" aria-hidden="true" />}
      {/* tint biru gletser di backdrop, makin dalam makin pekat */}
      <div ref={depthTintRef} className="depth-tint" aria-hidden="true" />
      {/* gradient shader air-dalam (eksperimen ShaderGradient): waterPlane biru
          es yang mengalir pelan di balik scene, muncul cuma di zona dalam */}
      <div ref={gradRef} className="grad-depth" aria-hidden="true">
        <ShaderGradientCanvas pixelDensity={1} fov={45} pointerEvents="none" lazyLoad={false}>
          <ShaderGradient
            type="waterPlane"
            animate="on"
            uSpeed={0.12}
            uStrength={1.6}
            uDensity={1.4}
            uFrequency={5.5}
            color1="#0c2436"
            color2="#1d4a6a"
            color3="#7fb4d8"
            brightness={1.1}
            grain="off"
            lightType="3d"
            cDistance={2.8}
            cPolarAngle={95}
            cameraZoom={1}
            positionX={0}
            positionY={0}
            positionZ={0}
            rotationX={0}
            rotationY={0}
            rotationZ={0}
            reflection={0.1}
          />
        </ShaderGradientCanvas>
      </div>
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
          // pas panel batu kebuka, scene ketutup penuh sama modal + video glacier.
          // stop render WebGL biar GPU fokus decode video (video gak patah lagi) &
          // hemat baterai. Balik jalan lagi begitu panel ditutup.
          frameloop={panel ? 'never' : 'always'}
        >
          <Suspense fallback={null}>
            <Experience onOpen={openRock} hasVideo={hasVideo} />
          </Suspense>
        </Canvas>
      </div>
      <div ref={scrollSpaceRef} className="scroll-space" aria-hidden="true" />
      <UI panel={panel} onClose={closeRock} hasGlacier={hasGlacier} onOpenChat={openChat} />
      <ChatDock open={chatOpen} onOpen={openChat} onClose={closeChat} hidden={!ready || !!panel} />
      {/* kursor bracket 4 sudut (React Bits TargetCursor): ngunci ke elemen
          interaktif DOM, membesar pas hover batu 3D. Desktop doang, di mobile
          komponennya balikin null sendiri */}
      <TargetCursor
        spinDuration={6}
        cursorColor="#e8f4ff"
        targetSelector=".cursor-target, .soc-side, .soc-current, .echo-inline, .rock-close, .rock-sound, .echo-btn, .echo-close, .echo-chip, .echo-send, .outro a"
      />
      <Loader />
    </>
  )
}
