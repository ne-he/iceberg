// markdown.jsx — renderer mini buat jawaban chatbot. Backend RAG balikin teks
// markdown (bold **, italic *, list, link). Sebelumnya ke-render mentah jadi
// keliatan bintang2 (**...**). Ini ngubah subset markdown itu jadi elemen React
// beneran. Aman: gak ada dangerouslySetInnerHTML, semua jadi node React.

let seq = 0
const key = () => `m${seq++}`

// em dash / en dash gak boleh nongol di teks (aturan tegas). Ganti jadi koma
// biar kalimatnya tetep kebaca natural.
const normalizeDashes = (s) => s.replace(/\s*[—–]\s*/g, ', ')

// pola inline. ▌ = kursor ketik streaming (disisipin dari ChatDock).
// urutan penting: bold (**) dicek sebelum italic (*) biar gak rebutan.
const INLINE_SRC =
  '(\\u258c)|(\\*\\*([\\s\\S]+?)\\*\\*)|(`([^`]+?)`)|(\\[([^\\]]+?)\\]\\((https?:\\/\\/[^\\s)]+)\\))|(\\*([^*\\n]+?)\\*)|(_([^_\\n]+?)_)'

function inline(text) {
  const re = new RegExp(INLINE_SRC, 'g') // fresh tiap call biar aman buat rekursi
  const out = []
  let last = 0
  let m
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    if (m[1])
      out.push(
        <span key={key()} className="echo-caret" aria-hidden="true">
          &#9612;
        </span>,
      )
    else if (m[2]) out.push(<strong key={key()}>{inline(m[3])}</strong>)
    else if (m[4]) out.push(<code key={key()}>{m[5]}</code>)
    else if (m[6])
      out.push(
        <a key={key()} href={m[8]} target="_blank" rel="noreferrer noopener">
          {m[7]}
        </a>,
      )
    else if (m[9]) out.push(<em key={key()}>{inline(m[10])}</em>)
    else if (m[11]) out.push(<em key={key()}>{inline(m[12])}</em>)
    last = re.lastIndex
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

const isUl = (l) => /^\s*[-*+]\s+/.test(l)
const isOl = (l) => /^\s*\d+\.\s+/.test(l)
const isH = (l) => /^#{1,3}\s+/.test(l)

export function renderMarkdown(src) {
  seq = 0 // reset key biar deterministik tiap render (reconcile mulus pas streaming)
  const lines = normalizeDashes(src || '').split('\n')
  const blocks = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) {
      i++
      continue
    }
    const h = /^#{1,3}\s+(.*)$/.exec(line)
    if (h) {
      blocks.push(
        <p key={key()} className="echo-md-h">
          {inline(h[1])}
        </p>,
      )
      i++
      continue
    }
    if (isUl(line)) {
      const items = []
      while (i < lines.length && isUl(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*+]\s+/, ''))
        i++
      }
      blocks.push(
        <ul key={key()}>
          {items.map((it) => (
            <li key={key()}>{inline(it)}</li>
          ))}
        </ul>,
      )
      continue
    }
    if (isOl(line)) {
      const items = []
      while (i < lines.length && isOl(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ''))
        i++
      }
      blocks.push(
        <ol key={key()}>
          {items.map((it) => (
            <li key={key()}>{inline(it)}</li>
          ))}
        </ol>,
      )
      continue
    }
    // paragraf: kumpulin baris berturut yang bukan list/heading, gabung pakai <br>
    const para = []
    while (
      i < lines.length &&
      lines[i].trim() &&
      !isUl(lines[i]) &&
      !isOl(lines[i]) &&
      !isH(lines[i])
    ) {
      para.push(lines[i])
      i++
    }
    const inner = []
    para.forEach((p, idx) => {
      if (idx) inner.push(<br key={key()} />)
      inner.push(...inline(p))
    })
    blocks.push(<p key={key()}>{inner}</p>)
  }
  return blocks
}
