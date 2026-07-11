import { useEffect, useRef, useState } from 'react'
import { useProgress } from '@react-three/drei'
import { beginIntro, dragState, faceState, introState, scrollState } from './scrollState'
import { CONTACT, PANELS, SECTION_WORDS } from './content'

const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

// carousel sosial ala igloo.inc: item tengah kekurung bracket, tetangganya
// redup di kiri-kanan. Geser pakai ARROW KEY keyboard (kiri/kanan) atau klik
// langsung label tetangganya — tanpa tombol panah visual (permintaan Nehemiah).
// Item yang dipilih = bentuk partikel di panggung (face | github | linkedin | whatsapp)
const SOCIAL_ITEMS = [
  { id: 'face', label: 'NEHEMIAH', url: null },
  { id: 'github', label: 'GITHUB', url: CONTACT.github },
  { id: 'linkedin', label: 'LINKEDIN', url: CONTACT.linkedin },
  { id: 'whatsapp', label: 'WHATSAPP', url: CONTACT.whatsapp },
]

function SocialCarousel() {
  const [idx, setIdx] = useState(0)
  const n = SOCIAL_ITEMS.length
  const move = (dir) =>
    setIdx((i) => {
      const j = (i + dir + n) % n
      faceState.target = SOCIAL_ITEMS[j].id
      return j
    })

  // arrow key kiri/kanan buat geser — aktif cuma pas udah mendarat di outro,
  // biar gak ganggu navigasi keyboard pas masih di atas
  useEffect(() => {
    const onKey = (e) => {
      if (scrollState.damped < 0.96) return
      if (e.key === 'ArrowRight') move(1)
      else if (e.key === 'ArrowLeft') move(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const prev = SOCIAL_ITEMS[(idx + n - 1) % n]
  const cur = SOCIAL_ITEMS[idx]
  const next = SOCIAL_ITEMS[(idx + 1) % n]
  return (
    <div className="soc-carousel">
      <button className="soc-side" onClick={() => move(-1)}>
        {prev.label}
      </button>
      {/* item aktif: klik = buka linknya (kalau ada) */}
      <a
        className="soc-current"
        href={cur.url || '#'}
        target={cur.url ? '_blank' : undefined}
        rel="noreferrer"
        onClick={(e) => !cur.url && e.preventDefault()}
      >
        {cur.label}
      </a>
      <button className="soc-side" onClick={() => move(1)}>
        {next.label}
      </button>
    </div>
  )
}
// titik scroll tempat kamera pas nge-frame tiap batu — target auto-center
// (0.915 = view portal yang udah kebangun; dari situ scroll berikutnya nyelam
// FULL nembus tunnel sampai mendarat di panggung, biar transitnya kerasa utuh)
const SNAP_ANCHORS = [0, 0.2, 0.4, 0.6, 0.8, 0.915, 1]

export function UI({ panel, onClose }) {
  const hero = useRef()
  const outro = useRef()
  const words = useRef([])
  const depth = useRef()
  const temp = useRef()
  const num = useRef()
  const bar = useRef()
  const hint = useRef()
  const ruler = useRef()
  const outroIn = useRef()

  // simpan konten panel terakhir biar teks gak hilang pas animasi nutup
  const lastRef = useRef(null)
  if (panel) lastRef.current = panel
  const data = PANELS[lastRef.current]

  useEffect(() => {
    // auto-center ala igloo: 1 detik gak ada input, scroll dianimasikan ease-in-out
    // ke anchor terdekat. Ngambang pelan kayak gelembung, bukan langsung "tek"
    let lastUser = performance.now()
    let snapping = false
    let snapAnim = null
    const bump = () => {
      lastUser = performance.now()
      snapping = false
      snapAnim = null
    }
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight
      scrollState.progress = max > 0 ? window.scrollY / max : 0
      // scroll hasil auto-center jangan dihitung sebagai input user —
      // input asli (wheel/touch/key/pointer) udah ke-bump lewat listener sendiri
      if (!snapping) lastUser = performance.now()
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('wheel', bump, { passive: true })
    window.addEventListener('touchmove', bump, { passive: true })
    window.addEventListener('pointerdown', bump)
    window.addEventListener('keydown', bump)

    let raf
    const tick = () => {
      const t = scrollState.damped
      // reveal intro: teks hero & hint baru nongol setelah batunya mendarat
      const rv = introState.phase === 'idle' ? 1 : introState.reveal
      if (hero.current) hero.current.style.opacity = clamp(1 - t / 0.07, 0, 1) * rv
      if (outro.current) {
        // baru muncul SETELAH kamera keluar dari tunnel dan panggung keliatan
        const o = clamp((t - 0.974) / 0.022, 0, 1)
        outro.current.style.opacity = o
        // pointer events cuma di kontennya — kalau container full-screen yang
        // di-set auto, dia nyerap semua mouse & bikin hover partikel mati
        if (outroIn.current) outroIn.current.style.pointerEvents = o > 0.5 ? 'auto' : 'none'
      }
      const now = performance.now()
      if (!snapAnim && now - lastUser > 1000 && !dragState.active) {
        const max = document.documentElement.scrollHeight - window.innerHeight
        if (max > 0) {
          const from = window.scrollY
          const cur = from / max
          let nearest = SNAP_ANCHORS[0]
          for (const a of SNAP_ANCHORS) if (Math.abs(a - cur) < Math.abs(nearest - cur)) nearest = a
          const to = nearest * max
          // durasi ngikut jarak biar kecepatannya konsisten, tapi dibatasi
          if (Math.abs(to - from) > 2) snapAnim = { from, to, start: now, dur: Math.min(2600, 900 + Math.abs(to - from) * 1.2) }
        }
      }
      if (snapAnim) {
        const u = Math.min(1, (now - snapAnim.start) / snapAnim.dur)
        // easeInOutCubic: mulai pelan, ngambang, mendarat pelan
        const e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2
        snapping = true
        window.scrollTo(0, snapAnim.from + (snapAnim.to - snapAnim.from) * e)
        if (u >= 1) {
          snapAnim = null
          snapping = false
        }
      }
      SECTION_WORDS.forEach((w, i) => {
        const el = words.current[i]
        if (el) el.style.opacity = clamp(1 - Math.abs(t - w.center) / 0.12, 0, 1)
      })
      if (depth.current) depth.current.textContent = `DPT ${String(Math.round(t * 380)).padStart(3, '0')}M`
      if (temp.current) temp.current.textContent = `TEMP ${(-1.2 - t * 27.3).toFixed(2)}`
      if (num.current) num.current.textContent = `${String(Math.round(t * 100)).padStart(2, '0')} / 100`
      if (bar.current) bar.current.style.transform = `scaleX(${t})`
      if (hint.current) hint.current.style.opacity = clamp(1 - (t - 0.82) / 0.06, 0, 1) * rv
      if (ruler.current) {
        const travel = ruler.current.offsetHeight - window.innerHeight
        if (travel > 0) ruler.current.style.transform = `translateY(${-t * travel}px)`
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('wheel', bump)
      window.removeEventListener('touchmove', bump)
      window.removeEventListener('pointerdown', bump)
      window.removeEventListener('keydown', bump)
      cancelAnimationFrame(raf)
    }
  }, [])

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <>
      <div className="grain" aria-hidden="true" />
      {/* vignette via CSS — dulunya post-processing GPU, dipindah ke sini biar enteng */}
      <div className="vignette" aria-hidden="true" />
      {/* penggaris kedalaman kiri — ikut gerak scroll, ala instrumen igloo */}
      <div className="ruler" aria-hidden="true">
        <div className="ruler-in" ref={ruler}>
          {Array.from({ length: 39 }, (_, i) => (
            <div className="tick" key={i}>
              <span>{String(i * 10).padStart(3, '0')}M</span>
            </div>
          ))}
        </div>
      </div>
      <div className="hud">
        <div className="logo">THE ICEBERG</div>
        <div className="meta">
          NEHEMIAH WILHELMUS JUNAIDI
          <br />
          JAKARTA / 2026
        </div>
        <div className="readout">
          <div ref={depth}>DPT 000M</div>
          <div ref={temp}>TEMP -1.20</div>
          <div>SIG ▮▮▮▯</div>
        </div>
        <div className="hint" ref={hint}>
          <span className="hint-inner">SCROLL TO DESCEND ▾</span>
        </div>
        <div className="progress-num" ref={num}>
          00 / 100
        </div>
        <div className="progress-bar" ref={bar} />
      </div>

      {SECTION_WORDS.map((w, i) => (
        <div key={w.word} className="bigword" ref={(el) => (words.current[i] = el)}>
          {w.word}
        </div>
      ))}

      <div className="hero" ref={hero}>
        <h1>NEHEMIAH</h1>
        <p>DATA SCIENCE PORTFOLIO / DESCEND TO EXPLORE</p>
      </div>

      <div className="outro" ref={outro}>
        <div className="outro-in" ref={outroIn}>
        <h2>GET IN TOUCH</h2>
        <a href={`mailto:${CONTACT.email}`}>{CONTACT.email.toUpperCase()}</a>
        {/* carousel ala igloo: pilih platform → partikel morph jadi logonya */}
        <SocialCarousel />
        {/* petunjuk loop: scroll terus di 100/100 = balik ke permukaan */}
        <div className="loop-hint">KEEP SCROLLING TO RESURFACE ↻</div>
        </div>
      </div>

      <aside className={`panel ${panel ? 'is-open' : ''}`}>
        {data && (
          <>
            <button className="panel-close" onClick={onClose}>
              CLOSE ✕
            </button>
            <div className="panel-code">{data.code}</div>
            <h2>{data.title}</h2>
            {data.rows.map((r) => (
              <div className="panel-row" key={r.h}>
                <h3>
                  {r.h}
                  {r.tag ? <span>{r.tag}</span> : null}
                </h3>
                <p>{r.p}</p>
              </div>
            ))}
            <div className="panel-foot">{data.foot}</div>
          </>
        )}
      </aside>
    </>
  )
}

export function Loader() {
  const { active, progress } = useProgress()
  const [done, setDone] = useState(false)
  useEffect(() => {
    // selesai kalau progress 100 ATAU gak ada loader yang aktif lagi —
    // useProgress kadang mentok di bawah 100 padahal asset udah kelar semua.
    // Delay 600ms: kalau ternyata masih ada asset nyusul (active balik true),
    // timer-nya ke-cancel duluan, jadi gak kecolongan mulai intro kepagian
    if (progress >= 100 || !active) {
      const id = setTimeout(() => {
        setDone(true)
        beginIntro() // loader kelar → batu hero mulai jatuh
      }, 600)
      return () => clearTimeout(id)
    }
  }, [active, progress])
  // jaring pengaman: apapun yang terjadi, loader hilang setelah 5 detik
  useEffect(() => {
    const id = setTimeout(() => {
      setDone(true)
      beginIntro()
    }, 5000)
    return () => clearTimeout(id)
  }, [])
  return (
    <div className={`loader ${done ? 'is-done' : ''}`}>
      THE ICEBERG<span>{Math.round(progress)}%</span>
    </div>
  )
}
