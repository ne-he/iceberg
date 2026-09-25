import { addAfterEffect, addEffect } from '@react-three/fiber'
import { LOW } from './perf'
import { introState } from './scrollState'

// ===== gubernur kualitas: turunin resolusi kalau fps jeblok, tanpa kompilasi ulang =====
// LOW (perf.js) nentuin ISI scene sekali di awal. Di sini yang diatur cuma dpr,
// alias berapa piksel yang dirender. Ganti dpr = canvas & render target di-resize,
// NOL shader dikompilasi ulang (define material, jumlah lampu, isi scene gak disentuh).
//
// Tangga dpr: HP 1 → 0.8 → 0.67 (1 aja udah di bawah dpr asli layarnya), desktop
// 1.5 → 1.25 → 1 (dibatesin dpr asli monitornya, monitor dpr 1 gak punya tangga).
//
// Aturan mainnya:
//  - diukur per jendela 1 detik, cuma pas scene beneran jalan (intro kelar,
//    frameloop 'always', tab keliatan). Jeda > 250 ms (tab pindah, panel kebuka)
//    dianggap putus, bukan lag
//  - TURUN kalau rata-rata < 45 fps dua jendela berturut-turut (~2 detik)
//  - habis turun dicek: kalau fps gak naik minimal 8%, berarti yang nyekek CPU
//    (bukan jumlah piksel), turunnya dibatalin dan lantai dikunci 30 detik
//    (gagal kedua kalinya = dikunci permanen). Jadi gak ngorbanin ketajaman
//    buat hal yang gak bakal nolong
//  - kalau jelas CPU-bound (waktu kerja r3f > 80% durasi frame) gak usah nyoba
//  - NAIK cuma kalau lega (>= 56 fps, frame terburuk < 34 ms) 8 jendela
//    berturut-turut. Kalau abis naik ternyata turun lagi dalam 20 detik, syarat
//    naiknya didobel (8 → 16 → 32 → gak naik lagi). Itu yang bikin gak pingpong
const native = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
const STEPS = (LOW ? [1, 0.8, 0.67] : [1.5, 1.25, 1].map((d) => Math.min(d, Math.max(1, native)))).filter(
  (d, i, a) => a.indexOf(d) === i
)

const SLOW_FPS = 45
const FAST_FPS = 56

// state yang kebaca dari luar (Canvas dpr di App.jsx, overlay ?debug)
export const quality = {
  steps: STEPS,
  level: 0,
  // App.jsx ngasih nilai ini ke prop dpr Canvas. WAJIB: tiap App re-render,
  // r3f nyamain dpr ke prop-nya lagi, jadi prop-nya harus ikut level sekarang
  dpr: STEPS[0],
  fps: 0, // rata-rata jendela terakhir
  worst: 0, // frame terburuk jendela terakhir (ms)
  cpu: 0, // rata-rata waktu kerja r3f per frame (useFrame + render), ms
  frame: 0, // rata-rata durasi frame (ms)
  note: 'waiting for intro',
  lock: null, // level yang dipaksa dari overlay ?debug, null = otomatis
  log: [], // 4 keputusan terakhir, buat overlay
}

let get = null // store r3f canvas utama
function apply(level, why) {
  if (!get || level === quality.level) return
  quality.level = level
  quality.dpr = STEPS[level]
  const s = get()
  s.setDpr(quality.dpr)
  // size baru (nilai sama, objek baru) biar EffectComposer ikut resize buffer-nya:
  // dia cuma dengerin `size`, bukan dpr
  const z = get().size
  s.setSize(z.width, z.height, z.updateStyle, z.top, z.left)
  quality.note = why
  quality.log.unshift(`${Math.round(performance.now() / 1000)}s L${level} ${why}`)
  quality.log.length = Math.min(quality.log.length, 4)
}

// dipanggil overlay ?debug: null = balik otomatis, angka = kunci di level itu
export function setQualityLock(level) {
  quality.lock = level
  if (level !== null) apply(level, 'locked from debug')
  else quality.note = 'auto'
}

export function startQuality(state) {
  if (get) return
  get = state.get
  let t0 = 0 // awal jendela
  let last = 0 // timestamp frame sebelumnya
  let before = 0
  let n = 0
  let cpuSum = 0
  let worst = 0
  // state keputusan
  let slow = 0
  let fast = 0
  let skip = 0 // jendela yang diabaikan abis ganti level (resize bikin hitch)
  let upHold = 8
  let lastUp = -1e9
  let pending = null // { from, fps } nunggu verifikasi abis turun
  let floor = STEPS.length - 1 // level paling bawah yang boleh
  let floorUntil = 0
  let fails = 0

  const reset = () => {
    t0 = 0
    n = 0
    cpuSum = 0
    worst = 0
  }

  const decide = (now) => {
    if (quality.lock !== null || introState.phase !== 'idle') return
    if (skip > 0) {
      skip--
      return
    }
    const fps = quality.fps
    if (floorUntil && now > floorUntil) {
      floor = STEPS.length - 1
      floorUntil = 0
    }
    if (pending) {
      const from = pending.from
      const gain = fps / pending.fps
      pending = null
      if (gain < 1.08) {
        fails++
        floor = from
        floorUntil = fails >= 2 ? 0 : now + 30000
        apply(from, `no gain (x${gain.toFixed(2)}), cpu-bound, hold`)
        skip = 1
        return
      }
      quality.note = `step down helped (x${gain.toFixed(2)})`
    }
    if (fps < SLOW_FPS) {
      slow++
      fast = 0
    } else if (fps >= FAST_FPS && quality.worst < 34) {
      fast++
      slow = 0
    } else {
      slow = 0
      fast = 0
    }
    const lv = quality.level
    if (slow >= 2 && lv < floor) {
      slow = 0
      if (quality.cpu > 0.8 * quality.frame) {
        quality.note = 'slow but cpu-bound, dpr would not help'
        return
      }
      if (now - lastUp < 20000) upHold *= 2 // baru naik udah turun lagi = kecepetan naiknya
      pending = { from: lv, fps }
      apply(lv + 1, `avg ${fps.toFixed(0)} fps`)
      skip = 1
    } else if (fast >= upHold && lv > 0 && upHold <= 32) {
      fast = 0
      lastUp = now
      apply(lv - 1, 'sustained headroom')
      skip = 1
    }
  }

  // before/after = sebelum & sesudah SEMUA root r3f dirender di frame ini
  addEffect(() => {
    before = performance.now()
  })
  addAfterEffect((ts) => {
    const s = get()
    // panel batu kebuka (frameloop 'never') tapi canvas chat masih jalan, atau
    // tab ketutup: bukan frame scene utama, jangan dihitung
    if (s.frameloop !== 'always' || document.hidden) {
      last = 0
      reset()
      return
    }
    const dt = last ? ts - last : 0
    last = ts
    if (!dt || dt > 250) {
      reset()
      return
    }
    if (!t0) t0 = ts - dt
    n++
    cpuSum += performance.now() - before
    if (dt > worst) worst = dt
    const span = ts - t0
    if (span >= 1000) {
      quality.fps = (n * 1000) / span
      quality.frame = span / n
      quality.worst = worst
      quality.cpu = cpuSum / n
      reset()
      t0 = ts
      decide(ts)
    }
  })
}
