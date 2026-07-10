import { useEffect, useRef, useState } from 'react'
import { useProgress } from '@react-three/drei'
import { dragState, faceState, scrollState } from './scrollState'
import { CONTACT, PANELS, SECTION_WORDS } from './content'

const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
// titik scroll tempat kamera pas nge-frame tiap batu — target auto-center
const SNAP_ANCHORS = [0, 0.25, 0.5, 0.75, 1]

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
      if (hero.current) hero.current.style.opacity = clamp(1 - t / 0.07, 0, 1)
      if (outro.current) {
        const o = clamp((t - 0.9) / 0.06, 0, 1)
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
      if (hint.current) hint.current.style.opacity = clamp(1 - (t - 0.82) / 0.06, 0, 1)
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
        {/* hover = partikel wajah morph jadi logo, ala igloo */}
        <div className="socials">
          <a
            href={CONTACT.github || '#'}
            target={CONTACT.github ? '_blank' : undefined}
            rel="noreferrer"
            onMouseEnter={() => (faceState.target = 'github')}
            onMouseLeave={() => (faceState.target = 'face')}
            onClick={(e) => !CONTACT.github && e.preventDefault()}
          >
            GITHUB
          </a>
          <span className="soc-sep">/</span>
          <a
            href={CONTACT.linkedin || '#'}
            target={CONTACT.linkedin ? '_blank' : undefined}
            rel="noreferrer"
            onMouseEnter={() => (faceState.target = 'linkedin')}
            onMouseLeave={() => (faceState.target = 'face')}
            onClick={(e) => !CONTACT.linkedin && e.preventDefault()}
          >
            LINKEDIN
          </a>
        </div>
        <div className="outro-hint">HOVER THE LINKS, WATCH THE PARTICLES</div>
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
  const { progress } = useProgress()
  const [done, setDone] = useState(false)
  useEffect(() => {
    if (progress >= 100) {
      const id = setTimeout(() => setDone(true), 500)
      return () => clearTimeout(id)
    }
  }, [progress])
  // jaring pengaman: apapun yang terjadi, loader hilang setelah 8 detik
  useEffect(() => {
    const id = setTimeout(() => setDone(true), 8000)
    return () => clearTimeout(id)
  }, [])
  return (
    <div className={`loader ${done ? 'is-done' : ''}`}>
      THE ICEBERG<span>{Math.round(progress)}%</span>
    </div>
  )
}
