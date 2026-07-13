import { useEffect, useRef } from 'react'
import { useChat } from './useChat'

// pertanyaan starter — samain sama repo RAG biar konsisten
const SUGGESTIONS = [
  'Apa pengalaman kerja Nehemiah?',
  'Project AI/ML apa yang udah Nemi bikin?',
  'Nemi orangnya gimana sih?',
  'Nemi suka makanan apa?',
]

// ECHO = pintu masuk chatbot RAG. Tombol sonar ping kanan-bawah (selalu keliatan
// pas idle) + drawer chat dari kanan. Backend-nya /api/chat (di-proxy ke project RAG).
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
      {/* tombol ECHO floating — titik cyan denyut ala sonar ping */}
      <button
        className={`echo-btn ${hidden || open ? 'is-hidden' : ''}`}
        onClick={onOpen}
        aria-label="Buka chat, tanya apa aja tentang Nehemiah"
      >
        <span className="echo-ping" aria-hidden="true" />
        <span className="echo-label">[ TANYA AKU ]</span>
      </button>

      {/* drawer chat dari kanan — scene 3D masih keliatan separo */}
      <div className={`echo-drawer ${open ? 'is-open' : ''}`} aria-hidden={!open}>
        <div className="echo-head">
          <div className="echo-head-txt">
            <div className="echo-code">////// ICEBERG_LINK / ECHO</div>
            <div className="echo-sub">90% gunung es ada di bawah permukaan. Tanya apa aja soal Nehemiah.</div>
          </div>
          <button className="echo-close" onClick={onClose}>
            <span className="rock-close-br">⌐</span> CLOSE <span className="rock-close-br">¬</span>
          </button>
        </div>

        <div className="echo-body" ref={bodyRef}>
          {messages.length === 0 && (
            <div className="echo-empty">
              <div className="echo-avatar">
                <span className="echo-ping" aria-hidden="true" />
              </div>
              <p>Aku ECHO, AI-nya Nehemiah. Aku tau hampir segalanya soal dia. Mau nanya apa?</p>
              <div className="echo-chips">
                {SUGGESTIONS.map((q) => (
                  <button key={q} className="echo-chip" onClick={() => send(q)} disabled={streaming}>
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`echo-msg echo-msg--${m.role}`}>
              {m.content}
              {streaming && i === messages.length - 1 && m.role === 'assistant' && (
                <span className="echo-caret" aria-hidden="true">
                  ▍
                </span>
              )}
            </div>
          ))}
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
