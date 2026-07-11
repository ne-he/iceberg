// Shared mutable scroll state — written by the DOM scroll listener (UI.jsx),
// damped + consumed inside the R3F frame loop (Experience.jsx).
export const scrollState = { progress: 0, damped: 0 }

// target morph particle di outro: 'face' | 'github' | 'linkedin'
// ditulis oleh tombol sosial di UI.jsx, dibaca ParticleFace.jsx tiap frame
export const faceState = { target: 'face' }

// true selama hero lagi di-drag — CameraRig matiin parallax pointer biar puterannya solid
export const dragState = { active: false }

// ===== intro "batu jatuh" + infinite loop scroll (permintaan Nehemiah) =====
// phase: 'wait' (loader masih nutup) → 'fall' (batu hero jatuh dari atas,
// scroll dikunci) → 'idle' (normal, bisa scroll) → 'wash' (user scroll terus
// di 100/100: layar ketutup kabut, scroll di-reset ke 0) → 'fall' lagi → dst.
// Loop-nya nyambung: dari partikel outro, scroll lagi = batu jatuh lagi.
export const introState = {
  phase: 'wait',
  t0: 0, // timestamp mulai phase (performance.now)
  eased: 0, // progres jatuh ter-easing 0..1 — dibaca HeroDrop di Experience
  reveal: 0, // 0..1 kemunculan background/video/UI — 0 pas jatuh, 1 pas normal
  washPeak: 0, // opacity awal tirai wash pas masuk 'fall' (0 = load pertama, 1 = loop)
  wash: 0, // opacity tirai kabut penutup layar saat transisi loop
}

// dipanggil Loader pas selesai — mulai animasi batu jatuh pertama kali
export function beginIntro() {
  if (introState.phase !== 'wait') return
  introState.phase = 'fall'
  introState.t0 = performance.now()
  introState.washPeak = 0
}
