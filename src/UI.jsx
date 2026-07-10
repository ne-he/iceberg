import { useEffect, useRef, useState } from 'react'
import { useProgress } from '@react-three/drei'
import { faceState, scrollState } from './scrollState'
import { CONTACT, PANELS, SECTION_WORDS } from './content'

const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

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

  // simpan konten panel terakhir biar teks gak hilang pas animasi nutup
  const lastRef = useRef(null)
  if (panel) lastRef.current = panel
  const data = PANELS[lastRef.current]

  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight
      scrollState.progress = max > 0 ? window.scrollY / max : 0
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })

    let raf
    const tick = () => {
      const t = scrollState.damped
      if (hero.current) hero.current.style.opacity = clamp(1 - t / 0.07, 0, 1)
      if (outro.current) {
        const o = clamp((t - 0.9) / 0.06, 0, 1)
        outro.current.style.opacity = o
        outro.current.style.pointerEvents = o > 0.5 ? 'auto' : 'none'
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
        <div className="logo">ICEBERG</div>
        <div className="meta">
          NEHEMIAH — DATA SCIENCE
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
        <p>DATA SCIENCE PORTFOLIO — DESCEND TO EXPLORE</p>
      </div>

      <div className="outro" ref={outro}>
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
        <div className="outro-hint">HOVER THE LINKS — WATCH THE PARTICLES</div>
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
      ICEBERG<span>{Math.round(progress)}%</span>
    </div>
  )
}
