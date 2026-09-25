import { addAfterEffect, addEffect } from '@react-three/fiber'
import { TIER } from '../perf'
import { quality, setQualityLock } from '../quality'
import { faceSimInfo } from '../particles/faceSim'
import { scrollState } from '../scrollState'

// ===== overlay ukur buat HP asli, cuma nyala pakai ?debug =====
// Modul ini di-import dinamis dari glRuntime.js, jadi tanpa ?debug dia gak
// pernah didownload. Isinya sengaja teks polos: Nehemiah buka di HP, screenshot,
// kirim. Tap kotaknya buat ganti kunci kualitas (auto → L0 → L1 → L2 → auto)
// biar bisa bandingin fps per dpr di device yang sama.
export function mountDebug(state) {
  const gl = state.gl
  const ctx = gl.getContext()
  let gpu = '?'
  try {
    const ext = ctx.getExtension('WEBGL_debug_renderer_info')
    gpu = String(ctx.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : ctx.RENDERER))
  } catch (e) {
    gpu = 'n/a'
  }

  // draw call PER FRAME: info bawaan di-reset tiap gl.render, padahal satu frame
  // di sini ada 2+ render (buffer es, scene, composer). Dikumpulin manual
  gl.info.autoReset = false
  let calls = 0
  let tris = 0
  addEffect(() => gl.info.reset())
  addAfterEffect(() => {
    if (state.get().frameloop !== 'always') return
    calls = gl.info.render.calls
    tris = gl.info.render.triangles
  })

  const box = document.createElement('pre')
  box.setAttribute('aria-hidden', 'true')
  Object.assign(box.style, {
    position: 'fixed',
    left: 'calc(8px + env(safe-area-inset-left))',
    top: 'calc(96px + env(safe-area-inset-top))',
    zIndex: 70,
    margin: 0,
    padding: '8px 10px',
    maxWidth: 'calc(100vw - 16px)',
    whiteSpace: 'pre-wrap',
    font: '10px/1.45 "IBM Plex Mono", ui-monospace, monospace',
    color: '#e8f4ff',
    background: 'rgba(6, 12, 18, 0.82)',
    border: '1px solid rgba(214, 234, 248, 0.35)',
    pointerEvents: 'auto',
    cursor: 'pointer',
    userSelect: 'none',
  })
  const order = [null, ...quality.steps.map((_, i) => i)]
  box.addEventListener('click', () => {
    const i = order.indexOf(quality.lock)
    setQualityLock(order[(i + 1) % order.length])
  })
  document.body.appendChild(box)

  const draw = () => {
    const c = gl.domElement
    const lock = quality.lock === null ? 'auto' : 'lock L' + quality.lock
    box.textContent = [
      `FPS ${quality.fps.toFixed(1)}  worst ${quality.worst.toFixed(1)}ms`,
      `cpu ${quality.cpu.toFixed(1)}ms / frame ${quality.frame.toFixed(1)}ms`,
      `GPU ${gpu}`,
      `tier ${TIER.low ? 'LOW' : 'HIGH'} (${TIER.reason})`,
      `dpr ${gl.getPixelRatio()} (native ${window.devicePixelRatio}) L${quality.level} ${lock}`,
      `canvas ${c.width}x${c.height}  css ${window.innerWidth}x${window.innerHeight}`,
      `particles ${faceSimInfo.path}`,
      `programs ${gl.info.programs?.length ?? '?'}  calls ${calls}  tris ${(tris / 1000).toFixed(1)}k`,
      `tex ${gl.info.memory.textures}  geo ${gl.info.memory.geometries}  depth ${scrollState.damped.toFixed(2)}`,
      `${quality.note}`,
      ...quality.log,
      'tap: auto > L0 > L1 > L2',
    ].join('\n')
  }
  draw()
  setInterval(draw, 500)
}
