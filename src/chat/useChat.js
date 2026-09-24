import { useCallback, useRef, useState } from 'react'
import { chatState } from '../scrollState'

// Batas biar payload gak nembus guard server (route.ts: 2000/pesan, 40 pesan,
// 16000 total char). Kita main aman di bawah itu.
const MAX_MESSAGE_CHARS = 2000
const MAX_MESSAGES = 30
const MAX_TOTAL_CHARS = 15000

// pesan error yang keliatan pengunjung, Inggris biar satu bahasa sama situsnya
const SERVER_ERROR = 'Something went wrong on the server. Try again in a moment.'
const STREAM_ERROR = 'The answer stopped halfway. Please ask again.'
const NETWORK_ERROR = 'Could not reach the chat. Check your connection and try again.'
const HTTP_ERRORS = {
  400: 'That message could not be read. Reload the page to start a new chat.',
  413: 'This chat got too long. Reload the page to start a new one.',
  429: 'Lots of messages in a short time. Take a short break, then try again.',
}
class ChatError extends Error {}

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
        setError('That message is too long. Please shorten it a little.')
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
          // pesan error dari backend RAG ditulis Bahasa Indonesia, sementara situs
          // ini full Inggris. Jadi teks server gak ditampilin mentah, dipetakan
          // dari status HTTP-nya aja (kodenya ada di route.ts repo RAG)
          throw new ChatError(HTTP_ERRORS[res.status] || SERVER_ERROR)
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
        // streamErr isinya juga teks Indonesia dari server, diganti versi Inggris
        if (streamErr) throw new ChatError(STREAM_ERROR)
      } catch (err) {
        if (err?.name === 'AbortError') return
        // selain error yang kita bikin sendiri, sisanya error jaringan mentah
        // ("Failed to fetch" dkk), gak berguna buat pengunjung
        setError(err instanceof ChatError ? err.message : NETWORK_ERROR)
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
