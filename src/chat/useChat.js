import { useCallback, useRef, useState } from 'react'
import { chatState } from '../scrollState'

// Batas biar payload gak nembus guard server (route.ts: 2000/pesan, 40 pesan,
// 16000 total char). Kita main aman di bawah itu.
const MAX_MESSAGE_CHARS = 2000
const MAX_MESSAGES = 30
const MAX_TOTAL_CHARS = 15000

// buang pesan paling lama kalau history kepanjangan, sisain minimal 2 turn
function trimHistory(messages) {
  let msgs = messages.slice(-MAX_MESSAGES)
  let total = msgs.reduce((s, m) => s + m.content.length, 0)
  while (msgs.length > 2 && total > MAX_TOTAL_CHARS) {
    total -= msgs[0].content.length
    msgs = msgs.slice(1)
  }
  return msgs
}

// Hook chat: state + koneksi SSE ke /api/chat (di-proxy ke backend RAG).
// Kontrak stream: `data: {"text": "..."}` per token, `data: [DONE]` penutup,
// `data: {"error": "..."}` kalau gagal di tengah. Error HTTP 4xx/5xx balik JSON biasa.
export function useChat() {
  const [messages, setMessages] = useState([]) // {role:'user'|'assistant', content}
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState(null)
  const abortRef = useRef(null)

  const send = useCallback(
    async (raw) => {
      const text = (raw || '').trim()
      if (!text || streaming) return
      if (text.length > MAX_MESSAGE_CHARS) {
        setError('Pesannya kepanjangan, ringkas dikit ya.')
        return
      }
      setError(null)

      const userMsg = { role: 'user', content: text }
      const outbound = trimHistory([...messages, userMsg])
      // tampilin pesan user + slot assistant kosong yang bakal keisi token demi token
      setMessages((m) => [...m, userMsg, { role: 'assistant', content: '' }])
      setStreaming(true)
      chatState.streaming = true

      const ctrl = new AbortController()
      abortRef.current = ctrl

      const appendToLast = (chunk) =>
        setMessages((m) => {
          const copy = m.slice()
          const last = copy[copy.length - 1]
          copy[copy.length - 1] = { ...last, content: last.content + chunk }
          return copy
        })

      let streamErr = null
      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: outbound }),
          signal: ctrl.signal,
        })

        if (!res.ok || !res.body) {
          // error JSON dari server (rate limit / guard) — pesannya udah Bahasa
          // Indonesia santai, tampilin apa adanya
          let msg = 'Ada error di server, coba lagi bentar ya.'
          try {
            const j = await res.json()
            if (j?.error) msg = j.error
          } catch {}
          throw new Error(msg)
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buf = ''
        let finished = false
        while (!finished) {
          const { done, value } = await reader.read()
          if (done) break
          buf += decoder.decode(value, { stream: true })
          const events = buf.split('\n\n')
          buf = events.pop() || '' // simpen sisa partial
          for (const ev of events) {
            const line = ev.split('\n').find((l) => l.startsWith('data:'))
            if (!line) continue
            const payload = line.slice(5).trim()
            if (payload === '[DONE]') {
              finished = true
              break
            }
            try {
              const obj = JSON.parse(payload)
              if (obj.text) appendToLast(obj.text)
              else if (obj.error) {
                streamErr = obj.error
                finished = true
                break
              }
            } catch {
              // ignore baris data yang belum utuh
            }
          }
        }
        if (streamErr) throw new Error(streamErr)
      } catch (err) {
        if (err?.name === 'AbortError') return
        setError(err instanceof Error ? err.message : String(err))
        // buang slot assistant kalau belum keisi apa-apa
        setMessages((m) => {
          const last = m[m.length - 1]
          if (last && last.role === 'assistant' && last.content === '') return m.slice(0, -1)
          return m
        })
      } finally {
        setStreaming(false)
        chatState.streaming = false
        abortRef.current = null
      }
    },
    [messages, streaming],
  )

  const reset = useCallback(() => {
    abortRef.current?.abort()
    setMessages([])
    setError(null)
    setStreaming(false)
    chatState.streaming = false
  }, [])

  return { messages, streaming, error, send, reset }
}
