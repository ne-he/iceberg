import { TOUCH } from './perf'

// ===== udah diem belum scroll-nya? (buat recenter loop di App.jsx) =====
// Recenter = window.scrollTo lompat ±1 periode. Di HP, lompatan itu di tengah
// luncuran inersia jari MOTONG luncurannya (kerasa patah). Jadi di device
// sentuh, recenter nunggu sampai halamannya beneran diem: event `scrollend`
// (Chrome/Firefox) atau 150 ms tanpa event scroll (Safari belum punya scrollend).
// Di desktop langsung boleh, gak ada inersia yang bisa kepotong.
let lastScroll = 0
let ended = true
if (TOUCH && typeof window !== 'undefined') {
  window.addEventListener(
    'scroll',
    () => {
      lastScroll = performance.now()
      ended = false
    },
    { passive: true }
  )
  window.addEventListener('scrollend', () => {
    ended = true
  })
}

export function scrollSettled(now) {
  return !TOUCH || ended || now - lastScroll > 150
}
