import { useEffect, useRef, useState } from 'react'
import { useProgress } from '@react-three/drei'
import { beginIntro, bgVideoState, faceState, introState, scrollState } from './scrollState'
import { CONTACT, PANELS, SECTION_WORDS } from './content'
import DecryptedText from './components/DecryptedText'

// glyph acak buat efek decode judul — huruf kapital + angka + simbol instrumen,
// senada sama kode section '//////' dan readout HUD
const DECRYPT_GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#/<>-'

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
const smooth = (x) => x * x * (3 - 2 * x)

// ikon speaker buat toggle suara video dalam-glacier
function SpeakerIcon({ on }) {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden="true">
      <path d="M4 9v6h4l5 4V5L8 9H4Z" fill="currentColor" opacity="0.9" />
      {on ? (
        <path
          d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      ) : (
        <path
          d="M16 9.5l5 5M21 9.5l-5 5"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      )}
    </svg>
  )
}

export function UI({ panel, onClose, hasGlacier, onOpenChat }) {
  const hero = useRef()
  const outro = useRef()
  const words = useRef([])
  const depth = useRef()
  const temp = useRef()
  const bar = useRef()
  const hint = useRef()
  const ruler = useRef()
  const outroIn = useRef()

  // simpan konten panel terakhir biar teks gak hilang pas animasi nutup
  const lastRef = useRef(null)
  if (panel) lastRef.current = panel
  const data = PANELS[lastRef.current]

  // pemicu efek decode (DecryptedText): counter naik tiap elemen teksnya
  // TRANSISI dari sembunyi ke keliatan. State React di sini aman karena
  // cuma berubah pas ganti section, bukan tiap frame
  const [wordPlay, setWordPlay] = useState(() => SECTION_WORDS.map(() => 0))
  const [heroPlay, setHeroPlay] = useState(0)
  const wordVis = useRef(SECTION_WORDS.map(() => false))
  const heroVis = useRef(false)

  // video dalam-glacier: suara nyala default (permintaan Nehemiah), bisa di-toggle
  const vidRef = useRef(null)
  const [soundOn, setSoundOn] = useState(true)

  useEffect(() => {
    // HUD render only — scrollState di-drive master di App.jsx (infinite loop).
    // Nilai "descend-linked" (kabut/depth/ruler) pakai depthK biar retrace mulus
    // balik ke 0 pas bridge (ujung loop == awal, gak nge-pop)
    let raf
    const tick = () => {
      const t = scrollState.damped // posisi descend (=1 selama bridge)
      const dk = scrollState.depthK // retrace pas bridge
      const br = scrollState.bridge
      const lp = scrollState.loopDamped
      const rv = introState.phase === 'idle' ? 1 : introState.reveal
      // hero text nongol pas dangkal (dk kecil) — otomatis balik muncul di ujung bridge
      if (hero.current) {
        const ho = clamp(1 - dk / 0.07, 0, 1) * rv
        hero.current.style.opacity = ho
        const hv = ho > 0.3
        if (hv !== heroVis.current) {
          heroVis.current = hv
          if (hv) setHeroPlay((v) => v + 1) // baru nongol → judul decode
        }
      }
      if (outro.current) {
        // muncul pas mendarat, FADE OUT pas bridge mulai (mau balik ke atas)
        const o = clamp((t - 0.974) / 0.022, 0, 1) * (1 - smooth(clamp(br / 0.3, 0, 1)))
        outro.current.style.opacity = o
        if (outroIn.current) outroIn.current.style.pointerEvents = o > 0.5 ? 'auto' : 'none'
      }
      SECTION_WORDS.forEach((w, i) => {
        const el = words.current[i]
        if (el) {
          const o = clamp(1 - Math.abs(t - w.center) / 0.12, 0, 1)
          el.style.opacity = o
          const vis = o > 0.15
          if (vis !== wordVis.current[i]) {
            wordVis.current[i] = vis
            if (vis) setWordPlay((p) => p.map((v, j) => (j === i ? v + 1 : v)))
          }
        }
      })
      if (depth.current) depth.current.textContent = `DPT ${String(Math.round(dk * 380)).padStart(3, '0')}M`
      if (temp.current) temp.current.textContent = `TEMP ${(-1.2 - dk * 27.3).toFixed(2)}`
      if (bar.current) bar.current.style.transform = `scaleX(${lp})`
      if (hint.current) hint.current.style.opacity = clamp(1 - (dk - 0.82) / 0.06, 0, 1) * rv
      if (ruler.current) {
        const travel = ruler.current.offsetHeight - window.innerHeight
        if (travel > 0) ruler.current.style.transform = `translateY(${-dk * travel}px)`
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // play + suara pas masuk kristal, pause pas keluar. Autoplay-with-sound diizinin
  // karena dipicu klik user (buka kristal). Kalau browser tetep blok suara, fallback
  // ke muted biar videonya tetep jalan (bukan layar item).
  useEffect(() => {
    const v = vidRef.current
    if (!v) return
    if (panel) {
      v.muted = !soundOn
      const p = v.play()
      if (p && p.catch)
        p.catch(() => {
          v.muted = true
          v.play().catch(() => {})
        })
    } else {
      v.pause()
    }
  }, [panel, soundOn])

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
        <div className="progress-bar" ref={bar} />
      </div>

      {SECTION_WORDS.map((w, i) => (
        <div key={w.word} className="bigword" ref={(el) => (words.current[i] = el)}>
          <DecryptedText
            text={w.word}
            animateOn="manual"
            playKey={wordPlay[i]}
            sequential
            revealDirection="center"
            speed={55}
            characters={DECRYPT_GLYPHS}
            encryptedClassName="dt-enc"
          />
        </div>
      ))}

      <div className="hero" ref={hero}>
        <h1>
          <DecryptedText
            text="NEHEMIAH"
            animateOn="manual"
            playKey={heroPlay}
            sequential
            revealDirection="center"
            speed={70}
            characters={DECRYPT_GLYPHS}
            encryptedClassName="dt-enc"
          />
        </h1>
        <p>DATA SCIENCE PORTFOLIO / DESCEND TO EXPLORE</p>
      </div>

      <div className="outro" ref={outro}>
        <div className="outro-in" ref={outroIn}>
        <h2>LET'S CONNECT</h2>
        <a href={`mailto:${CONTACT.email}`}>{CONTACT.email.toUpperCase()}</a>
        {/* carousel ala igloo: pilih platform → partikel morph jadi logonya */}
        <SocialCarousel />
        {/* pintu masuk chatbot dari klimaks: udah ketemu muka partikel, langsung
            bisa ngajak ngomong — muka partikel = avatar ECHO */}
        <button className="echo-inline" onClick={onOpenChat}>
          &gt; ngobrol langsung sama aku
        </button>
        {/* petunjuk loop: scroll terus di 100/100 = balik ke permukaan */}
        <div className="loop-hint">KEEP SCROLLING TO RESURFACE ↻</div>
        </div>
      </div>

      {/* panel batu = layar penuh "DI DALAM batu": background loop es-glacier
          (video generate Nehemiah kalau ada, else gradient es) + teks memenuhi
          layar. Muncul pas kamera udah nembus masuk batunya (permintaan Nehemiah) */}
      <div className={`rock-modal ${panel ? 'is-open' : ''}`} aria-hidden={!panel}>
        {hasGlacier ? (
          // videonya udah dikompres ke <1MB, jadi aman di-preload penuh:
          // ke-buffer semua sebelum user klik kristal = main tanpa patah
          <video ref={vidRef} className="rock-bg" src="/glacier_inside.mp4" loop playsInline preload="auto" />
        ) : (
          <div className="rock-bg rock-bg--fallback" />
        )}
        <div className="rock-scrim" />
        <div className="rock-logo">THE ICEBERG</div>
        <button className="rock-close" onClick={onClose}>
          <span className="rock-close-br">⌐</span> CLOSE <span className="rock-close-br">¬</span>
        </button>
        {hasGlacier && (
          <button
            className="rock-sound"
            onClick={() => setSoundOn((s) => !s)}
            aria-label={soundOn ? 'Matiin suara' : 'Nyalain suara'}
          >
            <SpeakerIcon on={soundOn} />
            {soundOn ? 'SUARA' : 'BISU'}
          </button>
        )}
        {data && (
          <div className="rock-content" key={lastRef.current}>
            <div className="rock-kicker">{data.kicker}</div>
            <h2>{data.title}</h2>
            {data.rows.map((r) => (
              <div className="rock-row" key={r.h}>
                <h3>
                  {r.h}
                  {r.tag ? <span>{r.tag}</span> : null}
                </h3>
                <p>{r.p}</p>
              </div>
            ))}
            <div className="rock-foot">{data.foot}</div>
          </div>
        )}
      </div>
    </>
  )
}

export function Loader() {
  const { active, progress } = useProgress()
  const [done, setDone] = useState(false)
  useEffect(() => {
    // selesai kalau progress 100 ATAU gak ada loader yang aktif lagi —
    // useProgress kadang mentok di bawah 100 padahal asset udah kelar semua.
    // Delay minimal 600ms: kalau ternyata masih ada asset nyusul (active balik
    // true), interval ke-cancel duluan, jadi gak kecolongan mulai intro kepagian.
    // useProgress cuma ngitung asset three.js — video langit (scene.mp4) di luar
    // itu, jadi ditunggu juga (bgVideoState) biar pas tirai kebuka videonya udah
    // nongol, bukan putih dulu sedetik. Batas nunggu video 3 detik.
    if (progress >= 100 || !active) {
      const t0 = performance.now()
      const id = setInterval(() => {
        const el = performance.now() - t0
        if (el >= 600 && (bgVideoState.ready || el > 3000)) {
          clearInterval(id)
          setDone(true)
          beginIntro() // loader kelar → batu hero mulai jatuh
        }
      }, 80)
      return () => clearInterval(id)
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
