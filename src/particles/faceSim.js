import * as THREE from 'three'
import { GPUComputationRenderer } from 'three/examples/jsm/misc/GPUComputationRenderer.js'

// ===== simulasi partikel wajah di GPU (GPGPU) =====
// Loop CPU di ParticleFace.jsx ngitung 120.000 partikel di JS tiap frame
// (exp/sin/cos/sqrt per partikel) lalu upload ulang ~2.9 MB buffer posisi +
// warna. Di laptop Iris Xe itu makan ~890 ms JS per detik pas outro, fps jatuh
// ke 23..44. Di sini rumus yang SAMA persis pindah ke fragment shader: state
// (posisi, dorongan pointer, warna) tinggal di tekstur float yang di-ping-pong,
// CPU cuma ngirim segelintir uniform per frame.
//
// Satu texel = satu partikel. Ukuran teksturnya dipilih W x H == COUNT pas,
// biar array Float32 yang udah ada (posisi sebar, target wajah/logo, warna)
// bisa langsung jadi tekstur RGB32F tanpa disalin ke array baru.

const TAU = Math.PI * 2

// dorongan pointer: rumusnya sama kayak loop CPU (meluruh pelan, saturasi di
// dalam REPEL_R). Fungsi ini dipanggil di pass offset DAN pass posisi dari
// input yang sama (state frame sebelumnya). Hasilnya: posisi langsung pakai
// offset baru di frame yang sama, persis urutan loop CPU, gak telat sefrem
const REPEL_GLSL = /* glsl */ `
uniform vec2 uPointer;
uniform float uDec;
uniform float uBlend;

vec3 repelOffset( vec2 uv ) {
  vec3 off = texture2D( textureOffset, uv ).xyz * uDec;
  vec2 dd = texture2D( texturePosition, uv ).xy - uPointer;
  float d2 = dot( dd, dd );
  if ( d2 < REPEL_R * REPEL_R && d2 > 1e-6 ) {
    float d = sqrt( d2 );
    float push = ( 1.0 - d / REPEL_R ) * REPEL_MAX;
    off.xy += ( dd / d * push - off.xy ) * uBlend;
    off.z += ( push * 0.5 - off.z ) * uBlend;
  }
  return off;
}
`

const OFFSET_FRAG = /* glsl */ `
${REPEL_GLSL}
void main() {
  gl_FragColor = vec4( repelOffset( gl_FragCoord.xy / resolution.xy ), 1.0 );
}
`

const POSITION_FRAG = /* glsl */ `
uniform sampler2D tScatter;
uniform sampler2D tSpeed;
uniform sampler2D tTargetPos;
uniform float uDelta;
uniform float uA;
uniform float uWob;
uniform vec2 uWobT;
${REPEL_GLSL}
void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  float k = 1.0 - exp( -texture2D( tSpeed, uv ).r * uDelta );
  vec3 pos = texture2D( texturePosition, uv ).xyz;
  vec3 off = repelOffset( uv );
  // goyang idle logo. Index partikel dari posisi texel, fasenya di-mod 2pi
  // dulu (waktunya udah di-mod di CPU): sin() float32 di GPU ngaco kalau
  // argumennya puluhan ribu, i * 0.37 buat partikel ke-120.000 itu ~44.000
  float i = floor( gl_FragCoord.y ) * resolution.x + floor( gl_FragCoord.x );
  vec2 w = vec2(
    sin( uWobT.x + mod( i * 0.37, 6.283185307 ) ),
    cos( uWobT.y + mod( i * 0.71, 6.283185307 ) )
  ) * ( 0.011 * uWob );
  vec3 sc = texture2D( tScatter, uv ).xyz;
  vec3 goal = sc + ( texture2D( tTargetPos, uv ).xyz - sc ) * uA + vec3( w, 0.0 ) + off;
  gl_FragColor = vec4( pos + ( goal - pos ) * k, 1.0 );
}
`

const COLOR_FRAG = /* glsl */ `
uniform sampler2D tSpeed;
uniform sampler2D tTargetCol;
uniform float uDelta;
void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  float k = 1.0 - exp( -texture2D( tSpeed, uv ).r * uDelta );
  vec3 c = texture2D( textureColor, uv ).rgb;
  gl_FragColor = vec4( c + ( texture2D( tTargetCol, uv ).rgb - c ) * k, 1.0 );
}
`

// Float32Array (3 atau 1 komponen per partikel) → tekstur float W x H tanpa salin.
// internalFormat WAJIB ditulis: three 0.166 nerjemahin RGBFormat + FloatType jadi
// format RGB tanpa ukuran, dan WebGL2 nolak itu buat data float
const SIZED = { [THREE.RGBFormat]: 'RGB32F', [THREE.RedFormat]: 'R32F', [THREE.RGBAFormat]: 'RGBA32F' }
function floatTex(data, w, h, format) {
  const t = new THREE.DataTexture(data, w, h, format, THREE.FloatType)
  t.internalFormat = SIZED[format]
  t.needsUpdate = true
  return t
}

// syarat minimal jalur GPU. Kalau satu aja gak ada, ParticleFace pakai loop CPU
export function gpuSimSupported(gl) {
  return (
    typeof WebGL2RenderingContext !== 'undefined' &&
    gl.getContext() instanceof WebGL2RenderingContext &&
    gl.extensions.has('EXT_color_buffer_float') &&
    gl.capabilities.maxVertexTextures > 0
  )
}

// bikin simulasi, balikin null kalau device-nya gak sanggup (→ jalur CPU).
// pos/col = state awal (array CPU yang sama), scatter/speeds = data statis
export function createFaceSim(gl, { count, pos, col, scatter, speeds, repelR, repelMax }) {
  if (!gpuSimSupported(gl)) return null
  let W = Math.ceil(Math.sqrt(count))
  while (count % W) W++
  const H = count / W
  if (W > gl.capabilities.maxTextureSize) return null

  const gpu = new GPUComputationRenderer(W, H, gl)
  const scatTex = floatTex(scatter, W, H, THREE.RGBFormat)
  const speedTex = floatTex(speeds, W, H, THREE.RedFormat)
  const pos0 = floatTex(pos, W, H, THREE.RGBFormat)
  const col0 = floatTex(col, W, H, THREE.RGBFormat)
  // offset awal nol semua: cukup tekstur 1x1, pass init nyamplingnya ke semua texel
  const off0 = floatTex(new Float32Array(4), 1, 1, THREE.RGBAFormat)

  const posVar = gpu.addVariable('texturePosition', POSITION_FRAG, pos0)
  const offVar = gpu.addVariable('textureOffset', OFFSET_FRAG, off0)
  const colVar = gpu.addVariable('textureColor', COLOR_FRAG, col0)
  gpu.setVariableDependencies(posVar, [posVar, offVar])
  gpu.setVariableDependencies(offVar, [posVar, offVar])
  gpu.setVariableDependencies(colVar, [colVar])

  // satu set uniform dipakai bareng semua pass. Target default = posisi sebar,
  // biar sebelum target wajah siap gak ada sampler yang nunjuk ke tekstur kosong
  const U = {
    tScatter: { value: scatTex },
    tSpeed: { value: speedTex },
    tTargetPos: { value: scatTex },
    tTargetCol: { value: scatTex },
    uDelta: { value: 0 },
    uA: { value: 0 },
    uDec: { value: 1 },
    uBlend: { value: 0 },
    uPointer: { value: new THREE.Vector2(1e9, 1e9) },
    uWob: { value: 0 },
    uWobT: { value: new THREE.Vector2() },
  }
  for (const v of [posVar, offVar, colVar]) {
    Object.assign(v.material.uniforms, U)
    v.material.defines.REPEL_R = repelR.toFixed(6)
    v.material.defines.REPEL_MAX = repelMax.toFixed(6)
  }

  const fail = () => {
    for (const v of [posVar, offVar, colVar]) v.material.dispose()
    gpu.dispose()
    scatTex.dispose()
    speedTex.dispose()
    return null
  }
  if (gpu.init() !== null) return fail()

  // tekstur state awal udah kesalin ke render target, VRAM-nya dilepas
  pos0.dispose()
  col0.dispose()
  off0.dispose()

  // tekstur hasil simulasi yang dibaca vertex shader PointsMaterial
  const view = { uSimPos: { value: null }, uSimCol: { value: null } }
  const refreshView = () => {
    view.uSimPos.value = gpu.getCurrentRenderTarget(posVar).texture
    view.uSimCol.value = gpu.getCurrentRenderTarget(colVar).texture
  }

  // langkah delta 0: k = 0, decay = 1, blend = 0 → state gak geser sedikit pun,
  // tapi shader tiap pass kepaksa kompilasi. Dipakai buat warm-up & cek awal
  const computeFrozen = () => {
    U.uDelta.value = 0
    U.uDec.value = 1
    U.uBlend.value = 0
    gpu.compute()
    refreshView()
  }

  // cek beneran, bukan cuma percaya flag ekstensi: ada driver HP yang ngaku
  // punya EXT_color_buffer_float tapi render target float-nya gak jalan.
  // Baca balik partikel pertama, harus sama persis sama posisi awalnya
  computeFrozen()
  const px = new Float32Array(4).fill(NaN)
  gl.readRenderTargetPixels(gpu.getCurrentRenderTarget(posVar), 0, 0, 1, 1, px)
  if (!(Math.abs(px[0] - pos[0]) < 1e-5 && Math.abs(px[1] - pos[1]) < 1e-5 && Math.abs(px[2] - pos[2]) < 1e-5)) {
    return fail()
  }

  // tekstur target per bentuk (wajah/logo), dibikin sekali lalu cuma ganti
  // uniform pas faceState.target pindah. Key-nya objek target, jadi kalau
  // face == github (foto gagal load) teksturnya kepakai bareng
  const targetTex = new Map()
  const texFor = (t) => {
    let e = targetTex.get(t)
    if (!e) {
      e = { pos: floatTex(t.pos, W, H, THREE.RGBFormat), col: floatTex(t.col, W, H, THREE.RGBFormat) }
      targetTex.set(t, e)
    }
    return e
  }

  // posisi atribut = koordinat texel partikel, bukan posisi dunia (lihat onBeforeCompile)
  const uvs = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    uvs[i * 3] = ((i % W) + 0.5) / W
    uvs[i * 3 + 1] = (Math.floor(i / W) + 0.5) / H
  }
  // bounding sphere dari awan sebar, sama kayak yang dihitung three dari buffer
  // CPU. Culling-nya dimatiin, tapi sphere ini tetep dipakai buat urutan sort
  const bounds = new THREE.Box3().setFromArray(scatter).getBoundingSphere(new THREE.Sphere())

  return {
    uvs,
    bounds,
    // dipasang ke <pointsMaterial>: material bawaan tetep utuh (sprite, tone
    // mapping, color space, fog off), cuma sumber posisi & warnanya diganti
    materialProps: {
      onBeforeCompile(shader) {
        shader.uniforms.uSimPos = view.uSimPos
        shader.uniforms.uSimCol = view.uSimCol
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\nuniform sampler2D uSimPos;\nuniform sampler2D uSimCol;')
          .replace('#include <color_vertex>', '#include <color_vertex>\n\tvColor = texture2D( uSimCol, position.xy ).rgb;')
          .replace('#include <begin_vertex>', 'vec3 transformed = texture2D( uSimPos, position.xy ).xyz;')
      },
      customProgramCacheKey: () => 'particleface-gpgpu',
    },
    // upload semua target sekarang (masih di balik loader), bukan pas pertama
    // kali tombol sosial diklik
    setTargets(targets) {
      for (const t of Object.values(targets)) {
        const e = texFor(t)
        gl.initTexture(e.pos)
        gl.initTexture(e.col)
      }
    },
    // satu frame simulasi. Semua angka sama kayak yang dipakai loop CPU
    step({ delta, target, a, px, py, dec, blend, wob, time }) {
      const e = texFor(target)
      U.tTargetPos.value = e.pos
      U.tTargetCol.value = e.col
      U.uDelta.value = delta
      U.uA.value = a
      U.uDec.value = dec
      U.uBlend.value = blend
      U.uPointer.value.set(px, py)
      U.uWob.value = wob
      // di-mod 2pi di sini (float64), di shader tinggal ditambah fase partikel
      U.uWobT.value.set((time * 1.3) % TAU, (time * 1.1) % TAU)
      gpu.compute()
      refreshView()
    },
    warm: computeFrozen,
    dispose() {
      for (const v of [posVar, offVar, colVar]) v.material.dispose()
      gpu.dispose()
      scatTex.dispose()
      speedTex.dispose()
      for (const e of targetTex.values()) {
        e.pos.dispose()
        e.col.dispose()
      }
    },
  }
}
