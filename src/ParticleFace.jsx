import * as THREE from 'three'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { faceState, scrollState } from './scrollState'

// jumlah partikel: bener-bener padat biar fotonya kebentuk jelas ala igloo —
// 90k + slab tipis = antar partikel makin rapat, celah ketutup, muka solid
const COUNT = 90000
// radius & displacement maksimal efek buyar pas pointer nyentuh partikel —
// push-nya SATURASI (bukan akumulasi) biar pointer diem gak ngebolongin badan
const REPEL_R = 1.05
const REPEL_MAX = 0.5
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
// warna dasar logo: es terang — shading per-partikel yang bikin gelap/terangnya
// (depan hampir putih, belakang gelap = kontrasnya nendang di background kabut)
const LOGO_TINT = [0.72, 0.76, 0.81]

// path resmi GitHub mark (viewBox 24x24) — dirender ke canvas lalu di-sampling jadi titik
const GITHUB_PATH =
  'M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12'

// path resmi WhatsApp (simple-icons, viewBox 24x24) — gelembung chat + gagang telepon
const WHATSAPP_PATH =
  'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z'

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

// pilih COUNT titik acak → posisi 3D + warna per partikel.
// depth: tebal slab (foto = tipis biar tajem, logo = tebel biar bervolume 3D)
// shade: partikel depan terang, belakang gelap + grain acak = kesan volume beneran
function pickPoints(pts, scale, { tint = null, jitter = 0.02, depth = 0.16, shade = false } = {}) {
  const pos = new Float32Array(COUNT * 3)
  const col = new Float32Array(COUNT * 3)
  for (let i = 0; i < COUNT; i++) {
    const p = pts[Math.floor(Math.random() * pts.length)]
    const i3 = i * 3
    pos[i3] = p[0] * scale + (Math.random() - 0.5) * jitter
    pos[i3 + 1] = p[1] * scale + (Math.random() - 0.5) * jitter
    const z = (Math.random() - 0.5) * depth
    pos[i3 + 2] = z
    if (tint) {
      if (shade) {
        // fake ambient occlusion: makin ke belakang makin gelap, plus noise
        // halus biar permukaannya kerasa granular kayak es beku, bukan flat
        const fr = z / depth + 0.5
        const f = 0.22 + fr * 0.95 + (Math.random() - 0.5) * 0.28
        col[i3] = clamp(tint[0] * f, 0, 1)
        col[i3 + 1] = clamp(tint[1] * f, 0, 1)
        col[i3 + 2] = clamp(tint[2] * f, 0, 1)
      } else {
        col[i3] = tint[0]
        col[i3 + 1] = tint[1]
        col[i3 + 2] = tint[2]
      }
    } else {
      // biar muka KEBACA JELAS di background terang, kontrasnya diangkat:
      // rumus lama (makin terang makin digelapin) malah ngerata-ratain semua
      // jadi coklat lumpur — fitur wajah ilang. Sekarang: kontras di-expand
      // dulu (highlight hidung/dahi tetep terang, shadow mata makin gelap),
      // baru diturunin dikit + pow() kompensasi encoding linear→sRGB renderer
      const cc = (v) => clamp((v - 0.5) * 1.5 + 0.5, 0, 1)
      col[i3] = Math.pow(cc(p[2]) * 0.62, 1.9)
      col[i3 + 1] = Math.pow(cc(p[3]) * 0.62, 1.9)
      col[i3 + 2] = Math.pow(cc(p[4]) * 0.62, 1.9)
    }
  }
  return { pos, col }
}

export function ParticleFace({ position = [0, -36.55, 1.5] }) {
  const group = useRef()
  const points = useRef()
  const mat = useRef()
  const [targets, setTargets] = useState(null)

  // posisi awal: awan acak lebar — pas visitor mendarat di panggung, partikel
  // kelihatan TERSEBAR dulu, baru ngumpul membentuk wajah (transisi diminta Nehemiah)
  const positions = useRef(null)
  const colors = useRef(null)
  const speeds = useRef(null)
  const scatter = useRef(null) // posisi sebar per partikel — titik awal sebelum ngumpul
  const offsets = useRef(null) // dorongan dari pointer, meluruh pelan = delay balik ala igloo
  const wobAmp = useRef(0) // amplitudo goyang idle — 0 pas nampilin foto biar mukanya tajem
  const pv = useMemo(() => new THREE.Vector3(), [])
  // pointer dilacak di WINDOW, bukan lewat R3F — overlay outro (pointer-events: auto)
  // nyerap event canvas, itu yang bikin hover mati setelah outro muncul
  const ndc = useRef({ x: 0, y: 0, has: false })
  // sprite bulat lembut — biar partikel gak keliatan kotak/patah-patah
  const sprite = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 64
    const g = c.getContext('2d')
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
    grad.addColorStop(0, 'rgba(255,255,255,1)')
    grad.addColorStop(0.6, 'rgba(255,255,255,0.85)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, 64, 64)
    return new THREE.CanvasTexture(c)
  }, [])
  if (!positions.current) {
    positions.current = new Float32Array(COUNT * 3)
    colors.current = new Float32Array(COUNT * 3)
    speeds.current = new Float32Array(COUNT)
    scatter.current = new Float32Array(COUNT * 3)
    offsets.current = new Float32Array(COUNT * 3)
    for (let i = 0; i < COUNT; i++) {
      scatter.current[i * 3] = (Math.random() - 0.5) * 16
      scatter.current[i * 3 + 1] = (Math.random() - 0.5) * 11
      scatter.current[i * 3 + 2] = (Math.random() - 0.5) * 8
      positions.current[i * 3] = scatter.current[i * 3]
      positions.current[i * 3 + 1] = scatter.current[i * 3 + 1]
      positions.current[i * 3 + 2] = scatter.current[i * 3 + 2]
      colors.current[i * 3] = colors.current[i * 3 + 1] = colors.current[i * 3 + 2] = 0.4
      speeds.current[i] = 1.6 + Math.random() * 2.6
    }
  }

  useEffect(() => {
    const onMove = (e) => {
      ndc.current.x = (e.clientX / window.innerWidth) * 2 - 1
      ndc.current.y = -(e.clientY / window.innerHeight) * 2 + 1
      ndc.current.has = true
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => window.removeEventListener('pointermove', onMove)
  }, [])

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
    t.github = pickPoints(samplePixels(ctx, 220, 220), 3.4, { tint: LOGO_TINT, depth: 0.85, shade: true })

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
    t.linkedin = pickPoints(samplePixels(ctx, 220, 220), 3.4, { tint: LOGO_TINT, depth: 0.85, shade: true })

    // --- WhatsApp ---
    ctx.clearRect(0, 0, 220, 220)
    ctx.globalCompositeOperation = 'source-over'
    ctx.save()
    ctx.translate(14, 14)
    ctx.scale(8, 8)
    ctx.fillStyle = '#fff'
    // evenodd WAJIB: tanpa ini ring gelembungnya kefill jadi lingkaran penuh
    ctx.fill(new Path2D(WHATSAPP_PATH), 'evenodd')
    ctx.restore()
    t.whatsapp = pickPoints(samplePixels(ctx, 220, 220), 3.4, { tint: LOGO_TINT, depth: 0.85, shade: true })

    // --- foto Nehemiah (async, warna asli kebawa) ---
    const img = new Image()
    img.src = '/face.png'
    img.onload = () => {
      if (!alive) return
      // sampling lebih tinggi = titik sumber lebih banyak, partikel gak numpuk
      // di koordinat sama → point cloud makin rapet
      const fw = 250
      const fh = Math.max(1, Math.round((fw * img.height) / img.width))
      const fc = document.createElement('canvas')
      fc.width = fw
      fc.height = fh
      const fx = fc.getContext('2d', { willReadFrequently: true })
      fx.drawImage(img, 0, 0, fw, fh)
      // jitter & slab dipangkas buat foto: partikel duduk lebih ketat di silhouette,
      // celah antar titik ketutup, muka kebaca lebih tajem
      t.face = pickPoints(samplePixels(fx, fw, fh), 5.1, { jitter: 0.013, depth: 0.12 })
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

    // urutan kemunculan (permintaan Nehemiah): panggung keliatan dulu → partikel
    // muncul TERSEBAR di atas panggung → baru ngumpul membentuk wajah.
    // o = opacity (muncul setelah tunnel mulai kebuka), a = progres perakitan
    const o = clamp((scrollState.damped - 0.968) / 0.014, 0, 1)
    let a = clamp((scrollState.damped - 0.978) / 0.022, 0, 1)
    a = a * a * (3 - 2 * a)

    // proyeksikan pointer ke bidang partikel → titik repel (koordinat lokal grup)
    const [gx, gy, gz] = [group.current.position.x, group.current.position.y, group.current.position.z]
    let px = 1e9
    let py = 1e9
    if (o > 0.2 && ndc.current.has) {
      pv.set(ndc.current.x, ndc.current.y, 0.5).unproject(state.camera)
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

    // goyang idle CUMA buat logo — foto Nehemiah harus diem total biar tajem.
    // amplitudonya di-damp biar transisi logo<->foto gak kaget
    const wobTarget = faceState.target === 'face' ? 0 : 1
    wobAmp.current += (wobTarget - wobAmp.current) * (1 - Math.exp(-3 * delta))
    const wob = wobAmp.current
    const scat = scatter.current

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
        // displacement target berbatas — makin deket pointer makin kedorong,
        // tapi gak pernah lebih dari REPEL_MAX walau pointer nangkring lama
        const push = (1 - d / REPEL_R) * REPEL_MAX
        const blend = 1 - Math.exp(-7 * delta)
        ox += ((ddx / d) * push - ox) * blend
        oy += ((ddy / d) * push - oy) * blend
        oz += (push * 0.5 - oz) * blend
      }
      offs[i3] = ox
      offs[i3 + 1] = oy
      offs[i3 + 2] = oz
      const wx = Math.sin(time * 1.3 + i * 0.37) * 0.011 * wob
      const wy = Math.cos(time * 1.1 + i * 0.71) * 0.011 * wob
      // target per partikel = interpolasi posisi sebar → posisi wajah/logo,
      // dikontrol progres perakitan a (scatter pas baru mendarat, ngumpul pas a→1)
      const txp = scat[i3] + (tp[i3] - scat[i3]) * a
      const typ = scat[i3 + 1] + (tp[i3 + 1] - scat[i3 + 1]) * a
      const tzp = scat[i3 + 2] + (tp[i3 + 2] - scat[i3 + 2]) * a
      arr[i3] += (txp + wx + ox - arr[i3]) * k
      arr[i3 + 1] += (typ + wy + oy - arr[i3 + 1]) * k
      arr[i3 + 2] += (tzp + oz - arr[i3 + 2]) * k
      arrC[i3] += (tc[i3] - arrC[i3]) * k
      arrC[i3 + 1] += (tc[i3 + 1] - arrC[i3 + 1]) * k
      arrC[i3 + 2] += (tc[i3 + 2] - arrC[i3 + 2]) * k
    }
    posAttr.needsUpdate = true
    colAttr.needsUpdate = true

    if (mat.current) mat.current.opacity = o
    group.current.visible = o > 0.01
    // sway grup juga cuma pas nampilin logo — foto harus bener-bener diam
    group.current.rotation.y = Math.sin(time * 0.25) * 0.07 * wob
  })

  return (
    <group ref={group} position={position} visible={false}>
      {/* renderOrder tinggi + fog & depthTest mati: partikel SELALU gambar di atas
          background, gak pernah ketelen kabut — muka harus keliatan jelas maksimal */}
      <points ref={points} renderOrder={10}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={COUNT} array={positions.current} itemSize={3} />
          <bufferAttribute attach="attributes-color" count={COUNT} array={colors.current} itemSize={3} />
        </bufferGeometry>
        <pointsMaterial
          ref={mat}
          map={sprite}
          vertexColors
          size={0.07}
          sizeAttenuation
          transparent
          opacity={0}
          depthWrite={false}
          depthTest={false}
          fog={false}
        />
      </points>
    </group>
  )
}
