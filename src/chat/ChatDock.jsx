import { useEffect, useRef } from 'react'
import { useChat } from './useChat'
import { renderMarkdown } from './markdown'

// pertanyaan starter — samain sama repo RAG biar konsisten
const SUGGESTIONS = [
  'Apa pengalaman kerja Nehemiah?',
  'Project AI/ML apa yang udah Nemi bikin?',
  'Nemi orangnya gimana sih?',
  'Nemi suka makanan apa?',
]

// ikon kristal es — motif iceberg, dipakai di tombol, header, sama empty state
function Crystal() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 2.4 4.6 9.2 12 21.6 19.4 9.2 12 2.4Z"
        stroke="rgba(224,242,255,.92)"
        strokeWidth="1.1"
        strokeLinejoin="round"
        fill="rgba(150,205,245,.16)"
      />
      <path
        d="M4.6 9.2h14.8M12 2.4V21.6M8.3 9.2 12 21.6M15.7 9.2 12 21.6"
        stroke="rgba(190,225,255,.55)"
        strokeWidth=".7"
      />
    </svg>
  )
}

// Chatbot RAG. Tombol "Tanya soal Nehemiah" kanan-bawah (selalu keliatan pas idle)
// + drawer chat dari kanan. Backend-nya /api/chat (di-proxy ke project RAG).
export default function ChatDock({ open, onOpen, onClose, hidden }) {
  const { messages, streaming, error, send } = useChat()
  const inputRef = useRef()
  const bodyRef = useRef()

  // auto-scroll ke bawah tiap ada token/pesan baru
  useEffect(() => {
    const el = bodyRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  // fokus ke input pas drawer kebuka
  useEffect(() => {
    if (open) {
      const id = setTimeout(() => inputRef.current?.focus(), 340)
      return () => clearTimeout(id)
    }
  }, [open])

  // Esc buat nutup
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const submit = (e) => {
    e?.preventDefault()
    const v = inputRef.current?.value || ''
    if (!v.trim() || streaming) return
    send(v)
    inputRef.current.value = ''
    inputRef.current.style.height = 'auto'
  }

  return (
    <>
      {/* tombol chatbot floating — "nyala" pelan biar jelas bisa diajak ngobrol */}
      <button
        className={`echo-btn ${hidden || open ? 'is-hidden' : ''}`}
        onClick={onOpen}
        aria-label="Buka chatbot AI Nehemiah, tanya apa aja soal dia"
      >
        <span className="echo-btn-orb">
          <Crystal />
        </span>
        <span className="echo-btn-txt">
          <span className="echo-btn-title">Tanya soal Nehemiah</span>
          <span className="echo-btn-kicker">AI Assistant</span>
        </span>
      </button>

      {/* drawer chat dari kanan — scene 3D masih keliatan separo */}
      <div className={`echo-drawer ${open ? 'is-open' : ''}`} aria-hidden={!open}>
        <div className="echo-head">
          <div className="echo-head-id">
            <span className="echo-head-orb">
              <Crystal />
            </span>
            <div className="echo-head-txt">
              <div className="echo-title">
                AI Nehemiah <span className="echo-live">online</span>
              </div>
              <div className="echo-sub">Tanya apa aja, aku tau hampir semua soal Nehemiah.</div>
            </div>
          </div>
          <button className="echo-close" onClick={onClose}>
            <span className="rock-close-br">⌐</span> CLOSE <span className="rock-close-br">¬</span>
          </button>
        </div>

        <div className="echo-body" ref={bodyRef}>
          {messages.length === 0 && (
            <div className="echo-empty">
              <span className="echo-empty-orb">
                <Crystal />
              </span>
              <p className="echo-empty-lead">
                Halo, aku <b>AI-nya Nehemiah</b>
              </p>
              <p className="echo-empty-p">
                Aku tau hampir segalanya soal dia: journey, project, skill, sampai hal random. Mau
                mulai dari mana?
              </p>
              <div className="echo-chips">
                {SUGGESTIONS.map((q) => (
                  <button key={q} className="echo-chip" onClick={() => send(q)} disabled={streaming}>
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => {
            const streamingLast =
              streaming && i === messages.length - 1 && m.role === 'assistant'
            return (
              <div key={i} className={`echo-msg echo-msg--${m.role}`}>
                {m.role === 'assistant' ? (
                  <div className="echo-md">
                    {renderMarkdown(streamingLast ? m.content + '▌' : m.content)}
                  </div>
                ) : (
                  m.content
                )}
              </div>
            )
          })}
          {error && <div className="echo-error">{error}</div>}
        </div>

        <form className="echo-input" onSubmit={submit}>
          <textarea
            ref={inputRef}
            rows={1}
            placeholder="Tanya soal Nehemiah..."
            maxLength={2000}
            onInput={(e) => {
              e.target.style.height = 'auto'
              e.target.style.height = Math.min(120, e.target.scrollHeight) + 'px'
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) submit(e)
            }}
          />
          <button type="submit" className="echo-send" disabled={streaming} aria-label="Kirim">
            →
          </button>
        </form>
      </div>
    </>
  )
}
