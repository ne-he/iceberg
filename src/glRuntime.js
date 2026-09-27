import { startQuality } from './quality'

// ===== semua yang nempel ke canvas utama begitu dia jadi (Canvas onCreated) =====
//  1. gubernur kualitas (quality.js)
//  2. jaring pengaman kalau konteks WebGL dicabut browser
//  3. overlay ukur ?debug, dimuat LAZY: tanpa ?debug modulnya gak pernah didownload
export function onCanvasCreated(state) {
  startQuality(state)
  watchContextLoss(state.gl.domElement)
  if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug')) {
    import('./debug/overlay')
      .then((m) => m.mountDebug(state))
      .catch(() => {})
  }
}

// HP suka nyabut konteks WebGL pas memori mepet, pas shader lagi dikompilasi
// barengan di awal, atau pas tab lama di background. Isi GPU (peta lingkungan,
// buffer partikel) ikut ilang, jadi cara pulih paling bersih = muat ulang.
// Kejadian 27 Sep: di HP Nehemiah kotak peringatan langsung nongol pas pertama
// buka, padahal refresh sekali udah beres (shader & file udah ke-cache).
// Jadi sekarang: kejadian PERTAMA = reload diam-diam (loader nutup layar),
// peringatan baru muncul kalau kejadian lagi dalam 2 menit
const RELOAD_KEY = 'iceberg-gl-reload'

function reloadWhenVisible() {
  const go = () => window.location.reload()
  if (document.visibilityState === 'visible') {
    setTimeout(go, 300)
    return
  }
  const onVis = () => {
    if (document.visibilityState !== 'visible') return
    document.removeEventListener('visibilitychange', onVis)
    go()
  }
  document.addEventListener('visibilitychange', onVis)
}

function watchContextLoss(canvas) {
  let box = null
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault()
    let last = 0
    try {
      last = Number(sessionStorage.getItem(RELOAD_KEY)) || 0
    } catch {
      last = Date.now() // storage diblok: jangan sampai reload berulang
    }
    if (Date.now() - last > 120000) {
      try {
        sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
      } catch {}
      reloadWhenVisible()
      return
    }
    if (box) return
    box = document.createElement('div')
    box.className = 'gl-lost'
    box.setAttribute('role', 'alert')
    const p = document.createElement('p')
    p.textContent = 'Your browser paused the 3D view. One reload brings it back.'
    const b = document.createElement('button')
    b.type = 'button'
    b.textContent = 'Reload'
    b.addEventListener('click', () => window.location.reload())
    box.append(p, b)
    document.body.appendChild(box)
  })
}
