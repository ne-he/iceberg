import * as THREE from 'three'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { faceState, scrollState } from './scrollState'

// jumlah partikel — padat biar siluet solid (gak bolong), masih enteng buat loop per frame
const COUNT = 9000
// radius & kekuatan efek buyar pas pointer nyentuh partikel
const REPEL_R = 0.9
const REPEL_F = 3
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
// warna logo: slate gelap, nyambung sama tema monokrom
const LOGO_TINT = [0.16, 0.19, 0.22]

// path resmi GitHub mark (viewBox 24x24) — dirender ke canvas lalu di-sampling jadi titik
const GITHUB_PATH =
  'M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12'

// ambil semua pixel solid dari canvas → koordinat ternormalisasi + warna aslinya
function samplePixels(ctx, w, h) {
  const data = ctx.getImageData(0, 0, w, h).data
  const pts = []
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i4 = (y * w + x) * 4
      if (data[i4 + 3] > 60) {
        pts.push([(x - w / 2) / h, (h / 2 - y) / h, data[i4] / 255, data[i4 + 1] / 255, data[i4 + 2] / 255])
      }
    }
  }
  return pts
}

// pilih COUNT titik acak → posisi 3D (slab tipis) + warna per partikel
function pickPoints(pts, scale, tint = null, jitter = 0.03) {
  const pos = new Float32Array(COUNT * 3)
  const col = new Float32Array(COUNT * 3)
  for (let i = 0; i < COUNT; i++) {
    const p = pts[Math.floor(Math.random() * pts.length)]
    const i3 = i * 3
    pos[i3] = p[0] * scale + (Math.random() - 0.5) * jitter
    pos[i3 + 1] = p[1] * scale + (Math.random() - 0.5) * jitter
    pos[i3 + 2] = (Math.random() - 0.5) * 0.35
    if (tint) {
      col[i3] = tint[0]
      col[i3 + 1] = tint[1]
      col[i3 + 2] = tint[2]
    } else {
      // warna asli foto, diangkat dikit biar kebaca di background terang
      col[i3] = Math.min(1, p[2] * 0.9 + 0.07)
      col[i3 + 1] = Math.min(1, p[3] * 0.9 + 0.07)
      col[i3 + 2] = Math.min(1, p[4] * 0.9 + 0.07)
    }
  }
  return { pos, col }
}

export function ParticleFace({ position = [0, -36.55, 1.5] }) {
  const group = useRef()
  const points = useRef()
  const mat = useRef()
  const [targets, setTargets] = useState(null)

  // posisi awal: awan acak — pas visitor nyampe bawah, partikel "merakit diri" jadi wajah
  const positions = useRef(null)
  const colors = useRef(null)
  const speeds = useRef(null)
  const offsets = useRef(null) // dorongan dari pointer, meluruh pelan = delay balik ala igloo
  const pv = useMemo(() => new THREE.Vector3(), [])
  // repel cuma aktif kalau mouse beneran gerak — pointer diem (0,0) jangan bolongin badan
  const lastP = useRef({ x: 0, y: 0, t: -1e9 })
  if (!positions.current) {
    positions.current = new Float32Array(COUNT * 3)
    colors.current = new Float32Array(COUNT * 3)
    speeds.current = new Float32Array(COUNT)
    offsets.current = new Float32Array(COUNT * 3)
    for (let i = 0; i < COUNT; i++) {
      positions.current[i * 3] = (Math.random() - 0.5) * 10
      positions.current[i * 3 + 1] = (Math.random() - 0.5) * 10
      positions.current[i * 3 + 2] = (Math.random() - 0.5) * 6
      colors.current[i * 3] = colors.current[i * 3 + 1] = colors.current[i * 3 + 2] = 0.4
      speeds.current[i] = 1.6 + Math.random() * 2.6
    }
  }

  useEffect(() => {
    let alive = true
    const t = {}

    const c = document.createElement('canvas')
    c.width = c.height = 220
    const ctx = c.getContext('2d', { willReadFrequently: true })

    // --- GitHub mark ---
    ctx.clearRect(0, 0, 220, 220)
    ctx.save()
    ctx.translate(14, 14)
    ctx.scale(8, 8)
    ctx.fillStyle = '#fff'
    ctx.fill(new Path2D(GITHUB_PATH))
    ctx.restore()
    t.github = pickPoints(samplePixels(ctx, 220, 220), 3.4, LOGO_TINT)

    // --- LinkedIn: rounded square dengan "in" dilubangi ---
    ctx.clearRect(0, 0, 220, 220)
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    if (ctx.roundRect) ctx.roundRect(22, 22, 176, 176, 34)
    else ctx.rect(22, 22, 176, 176)
    ctx.fill()
    ctx.globalCompositeOperation = 'destination-out'
    ctx.font = '900 118px Arial, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('in', 110, 118)
    ctx.globalCompositeOperation = 'source-over'
    t.linkedin = pickPoints(samplePixels(ctx, 220, 220), 3.4, LOGO_TINT)

    // --- foto Nehemiah (async, warna asli kebawa) ---
    const img = new Image()
    img.src = '/face.png'
    img.onload = () => {
      if (!alive) return
      const fw = 150
      const fh = Math.max(1, Math.round((fw * img.height) / img.width))
      const fc = document.createElement('canvas')
      fc.width = fw
      fc.height = fh
      const fx = fc.getContext('2d', { willReadFrequently: true })
      fx.drawImage(img, 0, 0, fw, fh)
      t.face = pickPoints(samplePixels(fx, fw, fh), 5.1)
      setTargets({ ...t })
    }
    img.onerror = () => alive && setTargets({ ...t, face: t.github })
    return () => {
      alive = false
    }
  }, [])

  useFrame((state, delta) => {
    if (!targets || !points.current || !group.current) return
    const target = targets[faceState.target] || targets.face
    const posAttr = points.current.geometry.attributes.position
    const colAttr = points.current.geometry.attributes.color
    const arr = posAttr.array
    const arrC = colAttr.array
    const offs = offsets.current
    const tp = target.pos
    const tc = target.col
    const time = state.clock.elapsedTime

    // cuma muncul di bagian akhir scroll (Get in Touch)
    const o = clamp((scrollState.damped - 0.84) / 0.08, 0, 1)

    // proyeksikan pointer ke bidang partikel → titik repel (koordinat lokal grup)
    const [gx, gy, gz] = [group.current.position.x, group.current.position.y, group.current.position.z]
    if (lastP.current.x !== state.pointer.x || lastP.current.y !== state.pointer.y) {
      lastP.current.x = state.pointer.x
      lastP.current.y = state.pointer.y
      lastP.current.t = time
    }
    let px = 1e9
    let py = 1e9
    if (o > 0.2 && time - lastP.current.t < 2) {
      pv.set(state.pointer.x, state.pointer.y, 0.5).unproject(state.camera)
      pv.sub(state.camera.position).normalize()
      const dz = (gz - state.camera.position.z) / (pv.z || -1e-6)
      if (dz > 0 && dz < 60) {
        px = state.camera.position.x + pv.x * dz - gx
        py = state.camera.position.y + pv.y * dz - gy
      }
    }

    // decay pelan = partikel baliknya "males-malesan" dulu, ala igloo
    const dec = Math.exp(-delta * 1.1)
    const R2 = REPEL_R * REPEL_R

    for (let i = 0; i < COUNT; i++) {
      const k = 1 - Math.exp(-speeds.current[i] * delta)
      const i3 = i * 3
      let ox = offs[i3] * dec
      let oy = offs[i3 + 1] * dec
      let oz = offs[i3 + 2] * dec
      const ddx = arr[i3] - px
      const ddy = arr[i3 + 1] - py
      const d2 = ddx * ddx + ddy * ddy
      if (d2 < R2 && d2 > 1e-6) {
        const d = Math.sqrt(d2)
        const f = ((REPEL_R - d) / REPEL_R) * REPEL_F * delta
        ox = clamp(ox + (ddx / d) * f, -0.9, 0.9)
        oy = clamp(oy + (ddy / d) * f, -0.9, 0.9)
        oz = clamp(oz + 0.4 * f, -0.7, 0.7)
      }
      offs[i3] = ox
      offs[i3 + 1] = oy
      offs[i3 + 2] = oz
      const wx = Math.sin(time * 1.3 + i * 0.37) * 0.014
      const wy = Math.cos(time * 1.1 + i * 0.71) * 0.014
      arr[i3] += (tp[i3] + wx + ox - arr[i3]) * k
      arr[i3 + 1] += (tp[i3 + 1] + wy + oy - arr[i3 + 1]) * k
      arr[i3 + 2] += (tp[i3 + 2] + oz - arr[i3 + 2]) * k
      arrC[i3] += (tc[i3] - arrC[i3]) * k
      arrC[i3 + 1] += (tc[i3 + 1] - arrC[i3 + 1]) * k
      arrC[i3 + 2] += (tc[i3 + 2] - arrC[i3 + 2]) * k
    }
    posAttr.needsUpdate = true
    colAttr.needsUpdate = true

    if (mat.current) mat.current.opacity = o * 0.95
    group.current.visible = o > 0.01
    group.current.rotation.y = Math.sin(time * 0.25) * 0.07
  })

  return (
    <group ref={group} position={position} visible={false}>
      <points ref={points}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={COUNT} array={positions.current} itemSize={3} />
          <bufferAttribute attach="attributes-color" count={COUNT} array={colors.current} itemSize={3} />
        </bufferGeometry>
        <pointsMaterial ref={mat} vertexColors size={0.055} sizeAttenuation transparent opacity={0} depthWrite={false} />
      </points>
    </group>
  )
}
