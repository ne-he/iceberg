// Shared mutable scroll state — ditulis master scroll di App.jsx, dibaca
// R3F frame loop (Experience) & HUD (UI).
//   progress/damped  : posisi DESCEND 0..1 (hero → partikel). =1 selama bridge.
//   bridge           : 0 selama descend, 0..1 selama "jembatan" balik ke start.
//   depthK           : kedalaman efektif buat fog/tint/video — SAMA kayak damped
//                      pas descend, tapi RETRACE balik ke 0 pas bridge, biar
//                      ujung bridge == awal descend (loop mulus, gak nge-pop).
//   loopDamped       : posisi loop penuh 0..1 (descend + bridge) buat counter /120.
export const scrollState = { progress: 0, damped: 0, bridge: 0, depthK: 0, loopDamped: 0 }

// target morph particle di outro: 'face' | 'github' | 'linkedin'
// ditulis oleh tombol sosial di UI.jsx, dibaca ParticleFace.jsx tiap frame
export const faceState = { target: 'face' }

// true selama hero lagi di-drag — CameraRig matiin parallax pointer biar puterannya solid
export const dragState = { active: false }

// ===== fokus/menyelam ke dalam batu pas diklik (permintaan Nehemiah) =====
// pas batu (about/journey/projects/skills) diklik: kamera pelan geser batunya ke
// tengah, lalu NEMBUS masuk ke dalamnya, baru panel konten full-screen (background
// dalam-glacier + teks) muncul. phase: 'idle' | 'in' (nyelam masuk) | 'open'
// (nembus, panel kebuka) | 'out' (mundur balik). pos = posisi batu dunia.
export const focusState = { id: null, pos: [0, 0, 0], phase: 'idle', t0: 0 }

// dipanggil pas batu diklik — mulai animasi menyelam
export function beginFocus(id, pos) {
  focusState.id = id
  focusState.pos = pos
  focusState.phase = 'in'
  focusState.t0 = performance.now()
}
export function endFocus() {
  if (focusState.phase === 'idle') return
  focusState.phase = 'out'
  focusState.t0 = performance.now()
}

// ===== intro emerge + infinite loop scroll (permintaan Nehemiah) =====
// phase: 'wait' (loader masih nutup) → 'fall' (intro EMERGE: biru+salju nyingkap,
// batu hero mendarat + nama muncul — digerakin waktu di App, bukan layar putih) →
// 'idle' (normal, infinite loop dua arah). Loop-nya nyambung: dari partikel outro,
// scroll terus = balik ke hero lewat emerge yang sama.
export const introState = {
  phase: 'wait',
  t0: 0, // timestamp mulai phase (performance.now)
  reveal: 0, // 0..1 kemunculan background/video/UI — 0 pas wait, 1 pas emerge/idle
}

// dipanggil Loader pas selesai — mulai animasi emerge pertama kali
export function beginIntro() {
  if (introState.phase !== 'wait') return
  introState.phase = 'fall'
  introState.t0 = performance.now()
}
