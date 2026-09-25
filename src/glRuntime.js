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

// HP suka nyabut konteks WebGL pas memori mepet atau tab lama di background.
// Tanpa ini layarnya diem beku tanpa penjelasan. preventDefault = izin ke browser
// buat balikin konteksnya, tapi isi GPU (peta lingkungan, buffer partikel) udah
// ilang, jadi yang paling jujur: kasih tau & kasih tombol reload
function watchContextLoss(canvas) {
  let box = null
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault()
    if (box) return
    box = document.createElement('div')
    box.className = 'gl-lost'
    box.setAttribute('role', 'alert')
    const p = document.createElement('p')
    p.textContent = 'The 3D view was paused by your browser.'
    const b = document.createElement('button')
    b.type = 'button'
    b.textContent = 'Reload'
    b.addEventListener('click', () => window.location.reload())
    box.append(p, b)
    document.body.appendChild(box)
  })
}
