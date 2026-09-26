import * as THREE from 'three'
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { easing } from 'maath'
import { focusState } from './scrollState'
import { GLACIER_VIDEO } from './perf'

// ===== koreografi nyelam ke batu (klik batu / tombol OPEN / keyboard) =====
// Permintaan Nehemiah: pas batu diklik kamera mundur dikit dulu (ancang-ancang),
// baru nyelam lurus ke batu. Sambil masuk, batunya udah mulai tembus dan video
// dalam-glacier keliatan DI DALAM batu, makin gede sampai menuhin layar, baru
// panel teks muncul di atas frame video yang sama persis (gak ada potongan).
//
// Semua angka dalam ms dari klik. Kamera TIDAK PERNAH nembus permukaan batu:
// berhentinya di luar bola pembatas batu (lihat stepDive), dan sebelum itu layar
// udah ketutup video full. Dulu kamera masuk ke dalam mesh dan ~0.2 detik layar
// isinya pecahan abu + gumpalan gelap (bagian dalam geometri).
export const DIVE = {
  ANTIC: 250, // ancang-ancang: kamera mundur ~15% + naik dikit, batu "napas"
  IN: 1100, // kamera nyampe titik akhir
  PANEL: 1150, // panel DOM dipasang (App.jsx, setTimeout)
  FADE: 400, // prefers-reduced-motion: cuma crossfade ke video, kamera diem
  MODAL_OUT: 320, // lama panel DOM mudar pas ditutup (samain sama styles.css)
  OUT: 1000, // kamera balik ke posisi scroll
}

// nilai per frame, ditulis stepDive (CameraRig), dibaca batu + DiveFill
//   k     : 0..1 batu berubah tembus jadi jendela video
//   fill  : 0..1 video nutup layar penuh
//   zoom  : 0..1 video "tumbuh" (0 = kecil di dalam batu, 1 = pas kayak panel)
//   breath: 0..1..0 denyut kecil batu pas ancang-ancang
export const diveFx = { k: 0, fill: 0, zoom: 0, breath: 0 }

// radius dunia tiap batu (didaftarin Crystal), buat nentuin kamera berhenti di mana
export const rockRadius = new Map()

// elemen <video> panel (UI.jsx). SATU elemen yang sama dipakai panel DOM dan
// tekstur di batu: decode sekali, waktunya nyambung, frame pas serah terima identik
export const panelVideo = { el: null }
const PANEL_SRC = GLACIER_VIDEO // HP dapet versi 540p

// pasang src video panel sekali (dipanggil 2.5 detik abis intro, atau pas klik batu).
// Sengaja imperatif, bukan prop React: kalau React nyetel ulang atribut src
// (walau nilainya sama) elemen media ke-reload dan videonya balik ke detik 0
export function armPanelVideo() {
  const v = panelVideo.el
  if (v && !v.getAttribute('src')) v.src = PANEL_SRC
}

// dipanggil DI DALAM handler klik (gesture user): mulai muter tanpa suara biar
// video udah jalan pas kelihatan di dalam batu. Suaranya dinyalain belakangan
// pas panel kebuka (UI.jsx), itu boleh karena halaman udah dapet gesture
export function startPanelVideo() {
  const v = panelVideo.el
  if (!v) return
  armPanelVideo()
  v.muted = true
  if (v.paused) v.play().catch(() => {})
}

export const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true

const clamp01 = (x) => Math.min(1, Math.max(0, x))
const sstep = (a, b, x) => {
  const t = clamp01((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}

// foto kondisi awal tiap fase (in / out), dipicu pas focusState.t0 berubah
const from = new THREE.Vector3()
const fromLook = new THREE.Vector3()
const C = new THREE.Vector3()
const n = new THREE.Vector3()
const tmp = new THREE.Vector3()
let snapT0 = -1
const out0 = { k: 0, fill: 0, zoom: 0, hold: 0 }

function resetFx() {
  diveFx.k = diveFx.fill = diveFx.zoom = diveFx.breath = 0
}

// Dipanggil CameraRig tiap frame selama focusState.phase != 'idle'.
// cam/look = posisi kamera & target pandang frame lalu (buat foto awal),
// p/t masuk = posisi kamera scroll (tujuan pas balik), keluar = posisi kamera
// yang harus dipakai. Balikin true = kamera dikunci ke p/t, tanpa parallax.
export function stepDive(now, cam, look, p, t) {
  const F = focusState
  if (F.t0 !== snapT0) {
    snapT0 = F.t0
    from.copy(cam)
    fromLook.copy(look)
    if (F.phase === 'out') {
      out0.k = diveFx.k
      out0.fill = diveFx.fill
      out0.zoom = diveFx.zoom
      // dari panel yang kebuka: tahan dulu selama panel DOM mudar, layarnya
      // ketutup video panel yang identik sama isi canvas
      out0.hold = diveFx.fill > 0.99 ? DIVE.MODAL_OUT : 0
    }
  }
  const tau = now - F.t0
  const fade = F.mode === 'fade'

  if (F.phase === 'in' || F.phase === 'open') {
    const T = F.phase === 'open' ? 1e9 : tau
    diveFx.breath = 0
    if (fade) {
      p.copy(from)
      t.copy(fromLook)
      diveFx.k = 0
      diveFx.zoom = 1
      diveFx.fill = sstep(0, DIVE.FADE, T)
    } else {
      C.set(F.pos[0], F.pos[1], F.pos[2])
      n.subVectors(from, C)
      const d0 = n.length() || 1
      n.divideScalar(d0)
      // ancang-ancang: mundur 15% + naik dikit, pelan di awal & di ujung
      // (kecepatan 0 pas mulai nyelam, jadi nyelamnya kerasa "dilepas")
      const a = sstep(0, DIVE.ANTIC, T)
      // nyelam: makin lama makin kenceng (ease-in)
      const u = clamp01((T - DIVE.ANTIC) / (DIVE.IN - DIVE.ANTIC))
      const e = Math.pow(u, 2.3)
      // berhenti di LUAR bola pembatas batu (radius x skala hover 1.07 + jarak aman)
      const dEnd = Math.min(d0, (rockRadius.get(F.id) ?? 1.6) * 1.07 + 0.3)
      const dist = THREE.MathUtils.lerp(d0 * (1 + 0.15 * a), dEnd, e)
      p.copy(C).addScaledVector(n, dist)
      p.y += 0.32 * a * (1 - e)
      t.copy(fromLook).lerp(C, sstep(0, 450, T))
      diveFx.breath = T < 340 ? Math.sin((Math.PI * T) / 340) : 0
      diveFx.k = sstep(600, 1000, T)
      diveFx.zoom = sstep(600, 1100, T)
      diveFx.fill = sstep(820, 1100, T)
    }
    if (F.phase === 'in' && tau >= (fade ? DIVE.FADE : DIVE.IN)) F.phase = 'open'
    return true
  }

  if (F.phase === 'out') {
    const T = tau - out0.hold
    diveFx.breath = 0
    if (T < 0) {
      // panel DOM masih mudar di atas, canvas nahan frame video penuh
      p.copy(from)
      t.copy(fromLook)
      diveFx.k = out0.k
      diveFx.fill = out0.fill
      diveFx.zoom = out0.zoom
      return true
    }
    const dur = fade ? DIVE.FADE : DIVE.OUT
    // dari panel: langsung ngebut keluar lalu melambat (ease-out). Dari tengah
    // nyelam (Escape sebelum panel): balik halus, kamera lagi gerak ke arah batu
    const q = clamp01(T / dur)
    const m = fade ? 1 : out0.hold ? 1 - Math.pow(1 - q, 3) : q * q * (3 - 2 * q)
    tmp.copy(from).lerp(p, m)
    p.copy(tmp)
    tmp.copy(fromLook).lerp(t, m)
    t.copy(tmp)
    diveFx.fill = out0.fill * (1 - sstep(0, fade ? DIVE.FADE : 320, T))
    diveFx.k = out0.k * (1 - sstep(120, 700, T))
    diveFx.zoom = out0.zoom * (1 - sstep(0, 650, T))
    if (T >= dur) {
      F.phase = 'idle'
      resetFx()
      return false
    }
    return true
  }
  return false
}

// ===== shader video panel, dipakai bareng jendela batu & penutup layar =====
// Video disampling di RUANG LAYAR dengan pemetaan yang sama persis kayak CSS
// .rock-bg (object-fit: cover + scale 1.06). Jadi pas penutup layar penuh,
// isi canvas = isi <video> panel piksel per piksel, serah terimanya gak kelihatan
const videoUniforms = {
  uVideo: { value: null },
  uHasVid: { value: 0 }, // 0 = gradient cadangan (video belum ada frame)
  uCover: { value: new THREE.Vector2(1, 1) }, // rasio cover per sumbu
  uAspect: { value: 16 / 9 }, // aspek layar
  uZoom: { value: 0 },
  uCenter: { value: new THREE.Vector2(0.5, 0.5) }, // tengah batu di layar
}

const panelChunk = /* glsl */ `
  uniform sampler2D uVideo;
  uniform float uHasVid;
  uniform vec2 uCover;
  uniform float uAspect;
  uniform float uZoom;
  uniform vec2 uCenter;
  vec3 toLin(vec3 c) {
    return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
  }
  // tiruan kasar latar CSS .rock-modal (dipakai kalau videonya belum siap)
  vec3 panelGrad(vec2 q) {
    vec2 dir = vec2(0.375, -0.927);
    vec2 pp = (q - 0.5) * vec2(uAspect, 1.0);
    float len = 0.5 * (uAspect * 0.375 + 0.927);
    float g = clamp(dot(pp, dir) / len * 0.5 + 0.5, 0.0, 1.0);
    vec3 c = mix(vec3(0.0467, 0.0865, 0.1255), vec3(0.0902, 0.1412, 0.1843), smoothstep(0.0, 0.44, g));
    c = mix(c, vec3(0.0392, 0.0706, 0.098), smoothstep(0.44, 1.0, g));
    float r = length((q - vec2(0.5, 0.74)) * vec2(1.0, 1.25)) / 0.75;
    c = mix(c, vec3(0.588, 0.745, 0.878), 0.4 * (1.0 - smoothstep(0.0, 0.58, r)));
    return toLin(c);
  }
  // s = posisi layar 0..1. zoom < 1: video masih kecil, nempel di tengah batu,
  // tumbuh bareng batunya sampai pas layar penuh
  vec3 panelColor(vec2 s) {
    float z = mix(0.8, 1.0, uZoom);
    vec2 c = mix(uCenter, vec2(0.5), uZoom);
    vec2 q = (s - c) / z + 0.5;
    vec2 uv = 0.5 + (q - 0.5) * uCover / 1.06;
    vec3 v = toLin(texture2D(uVideo, clamp(uv, 0.0, 1.0)).rgb);
    return mix(panelGrad(q), v, uHasVid);
  }
`

// jendela video di permukaan batu. Muka-muka batu ngebiasin gambar di dalamnya
// ke arah beda-beda (kayak ngintip lewat permata), tepi siluet tetep putih es.
// Makin k naik, efek kristalnya ilang dan tinggal video polos = siap serah terima
const windowVert = /* glsl */ `
  varying vec4 vClip;
  varying vec3 vView;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vView = mv.xyz;
    gl_Position = projectionMatrix * mv;
    vClip = gl_Position;
  }
`
const windowFrag = /* glsl */ `
  ${panelChunk}
  uniform float uK;
  varying vec4 vClip;
  varying vec3 vView;
  void main() {
    vec2 s = vClip.xy / vClip.w * 0.5 + 0.5;
    // normal per facet dari turunan posisi = sisi datar kristal kebaca jelas
    vec3 nf = normalize(cross(dFdx(vView), dFdy(vView)));
    vec3 V = normalize(-vView);
    if (dot(nf, V) < 0.0) nf = -nf;
    float facing = clamp(dot(nf, V), 0.0, 1.0);
    float inv = 1.0 - uK;
    vec3 col = panelColor(s + nf.xy * 0.05 * inv);
    col *= 1.0 + (facing - 0.72) * 0.45 * inv;
    float fres = pow(1.0 - facing, 2.5);
    col = mix(col, vec3(0.62, 0.74, 0.84), fres * 0.6 * inv);
    float a = clamp(uK * 1.4 - fres * 0.4 * inv, 0.0, 1.0);
    gl_FragColor = vec4(col, a);
    #include <colorspace_fragment>
  }
`
const fillVert = /* glsl */ `
  varying vec2 vS;
  void main() {
    vS = position.xy * 0.5 + 0.5;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`
// penutup layar: video-nya MELEBAR keluar dari siluet batu sampai nutup layar
// (bukan crossfade rata, yang bikin scene & video numpuk kayak hantu).
// uRadial 0 = crossfade biasa, dipakai mode prefers-reduced-motion
const fillFrag = /* glsl */ `
  ${panelChunk}
  uniform float uFill;
  uniform float uRadial;
  varying vec2 vS;
  void main() {
    vec2 c = mix(uCenter, vec2(0.5), uFill);
    float d = length((vS - c) * vec2(uAspect, 1.0)) / length(vec2(uAspect, 1.0));
    float r = mix(0.12, 1.25, uFill);
    float grow = 1.0 - smoothstep(r - 0.28, r, d);
    float a = mix(uFill, grow * smoothstep(0.0, 0.08, uFill), uRadial);
    gl_FragColor = vec4(panelColor(vS), uFill > 0.999 ? 1.0 : a);
    #include <colorspace_fragment>
  }
`

// satu material jendela buat semua batu (cuma satu batu yang bisa diselami)
export const windowMat = new THREE.ShaderMaterial({
  uniforms: { ...videoUniforms, uK: { value: 0 } },
  vertexShader: windowVert,
  fragmentShader: windowFrag,
  transparent: true,
  depthWrite: false,
})
const fillMat = new THREE.ShaderMaterial({
  uniforms: { ...videoUniforms, uFill: { value: 0 }, uRadial: { value: 1 } },
  vertexShader: fillVert,
  fragmentShader: fillFrag,
  transparent: true,
  depthTest: false,
  depthWrite: false,
})

const noRaycast = () => null
const _c = new THREE.Vector3()

// penutup layar penuh + ngurus tekstur video. Dipasang dari awal (dikompilasi
// di Warmup), cuma digambar pas nyelam. Harus di-mount SETELAH batu-batu biar
// uniform-nya ditulis sesudah CameraRig ngitung diveFx di frame yang sama
export function DiveFill() {
  const mesh = useRef()
  const size = useThree((s) => s.size)
  const gl = useThree((s) => s.gl)
  const st = useMemo(() => ({ tex: null, el: null, warm: false }), [])
  useEffect(
    () => () => {
      st.tex?.dispose()
    },
    [st]
  )
  useFrame((state, delta) => {
    const el = panelVideo.el
    // tekstur dibikin begitu elemen <video>-nya ada. Programnya gak berubah
    // (sampler biasa), jadi ganti tekstur gak bikin kompilasi ulang
    if (el && el !== st.el) {
      st.tex?.dispose()
      st.el = el
      st.warm = false
      st.tex = new THREE.VideoTexture(el)
      st.tex.generateMipmaps = false
      videoUniforms.uVideo.value = st.tex
    }
    const ready = !!el && el.readyState >= 2
    // upload frame pertama sekali pas lagi santai (bukan pas klik), biar frame
    // pertama nyelam gak nanggung alokasi tekstur 1280x720
    if (ready && st.tex && !st.warm) {
      st.warm = true
      st.tex.needsUpdate = true
      gl.initTexture(st.tex)
    }
    easing.damp(videoUniforms.uHasVid, 'value', ready ? 1 : 0, 0.12, delta)
    const vw = el?.videoWidth || 16
    const vh = el?.videoHeight || 9
    const va = vw / vh
    const A = size.width / Math.max(1, size.height)
    videoUniforms.uAspect.value = A
    if (A > va) videoUniforms.uCover.value.set(1, va / A)
    else videoUniforms.uCover.value.set(A / va, 1)
    videoUniforms.uZoom.value = diveFx.zoom
    if (focusState.phase !== 'idle') {
      _c.set(focusState.pos[0], focusState.pos[1], focusState.pos[2]).project(state.camera)
      videoUniforms.uCenter.value.set(_c.x * 0.5 + 0.5, _c.y * 0.5 + 0.5)
    }
    windowMat.uniforms.uK.value = diveFx.k
    fillMat.uniforms.uFill.value = diveFx.fill
    fillMat.uniforms.uRadial.value = focusState.mode === 'fade' ? 0 : 1
    if (mesh.current) mesh.current.visible = diveFx.fill > 0.001
  })
  return (
    <mesh ref={mesh} material={fillMat} frustumCulled={false} renderOrder={10000} visible={false} raycast={noRaycast}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  )
}
