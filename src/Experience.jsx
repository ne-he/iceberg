import * as THREE from 'three'
import { Suspense, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Environment, Sparkles, useGLTF } from '@react-three/drei'
import { easing } from 'maath'
import { Crystal } from './Crystal'
import { ParticleFace } from './ParticleFace'
import { Portal } from './Portal'
import { Glacier } from './Glacier'
import { CRYSTALS, HERO_CRYSTAL } from './content'
import { dragState, introState, scrollState } from './scrollState'

export const FOG_COLOR = '#b9c0c7'
// warna kabut di kedalaman: biru gletser — makin dalam makin kerasa di dalam es
const FOG_TOP = new THREE.Color('#b9c0c7')
const FOG_DEEP = new THREE.Color('#5c83a4')
const _fogCol = new THREE.Color()

export default function Experience({ onOpen, hasVideo }) {
  return (
    <>
      {/* kalau ada video langit (bg.mp4), canvas dibiarin transparan biar videonya
          keliatan di belakang — pas video fade out, body #b9c0c7 yang jadi kabut */}
      {!hasVideo && <color attach="background" args={[FOG_COLOR]} />}
      {/* nilai awal aja — FogRig yang ngatur tebal-tipisnya ngikutin kedalaman scroll */}
      <fog attach="fog" args={[FOG_COLOR, 16, 50]} />
      <FogRig />

      <ambientLight intensity={1.1} />
      <directionalLight position={[6, 10, 4]} intensity={1.6} />
      <directionalLight position={[-6, -4, -6]} intensity={0.5} color="#dfe8ff" />
      <Suspense fallback={null}>
        <Environment preset="city" />
      </Suspense>

      <CameraRig />

      {/* batu hero dibungkus HeroDrop: pas intro/loop dia JATUH dari atas ke posisinya */}
      <HeroDrop>
        <Crystal data={HERO_CRYSTAL} interactive={false} snapT={0} />
      </HeroDrop>
      {CRYSTALS.map((c, i) => (
        // snapT = titik scroll pas kamera nge-frame batu ini (sinkron sama
        // anchor di CameraRig) — jadi tiap batu bisa diputer pas dia yang keliatan
        <Crystal key={c.id} data={c} onOpen={onOpen} snapT={(i + 1) / (CRYSTALS.length + 1)} />
      ))}

      {/* dinding es crevasse kiri-kanan + caustic — kesan di dalam glacier */}
      <Glacier />

      {/* dunia latar: bongkahan-bongkahan jauh yang jadi siluet di kabut (trik igloo) */}
      <BackgroundField />

      {/* kristal es kecil melayang naik pelan, looping — pengganti video daratan */}
      <DriftingIce />

      {/* portal es ala igloo — kamera nembus lubangnya sebelum nyampe outro */}
      <Suspense fallback={null}>
        <Portal />
      </Suspense>

      {/* outro: partikel wajah Nehemiah di atas panggung podium ala igloo */}
      <ParticleFace position={[0, -36.55, 1.5]} />
      <OutroStage />
      {/* batu asal yang naik dari bawah podium saat transisi loop (100→120) */}
      <HeroEcho />

      {/* debu es yang melayang di sepanjang jalur turun */}
      <Sparkles count={260} scale={[18, 48, 12]} position={[0, -17, 0]} size={2} speed={0.3} opacity={0.5} color="#ffffff" />
      <Sparkles count={80} scale={[10, 7, 8]} position={[0, 0, 2]} size={2.6} speed={0.2} opacity={0.4} color="#ffffff" />
      <Sparkles count={90} scale={[14, 46, 6]} position={[0, -18, -6]} size={4} speed={0.15} opacity={0.25} color="#ffffff" />

      {/* kolom-kolom cahaya samar menembus kabut */}
      <LightShafts />
    </>
  )
}

// kabut bertingkat: di hero (atas) JELAS BANGET, makin turun makin berkabut —
// menandakan makin dalam makin tenggelam di kabut es
function FogRig() {
  const scene = useThree((s) => s.scene)
  useFrame(() => {
    // depthK (bukan damped) → pas bridge, kabut retrace balik ke dangkal biar
    // ujung loop nyambung mulus ke awal (hero) tanpa nge-pop
    const k = THREE.MathUtils.clamp(scrollState.depthK, 0, 1)
    if (scene.fog) {
      // dilonggarin: dulu far turun ke 23 (kabut pekat nutup semua). sekarang
      // far mentok di 34 → bongkahan latar & background tetep keintip tipis
      const near = 16 - k * 8 // 16 → 8
      const far = 50 - k * 16 // 50 → 34
      // pas intro batu jatuh: kabut RAPET dulu (dunia masih kosong), kebuka
      // bareng reveal — "baru muncul backgroundnya" persis permintaan Nehemiah
      const r = introState.phase === 'idle' ? 1 : introState.reveal
      scene.fog.near = THREE.MathUtils.lerp(9, near, r)
      scene.fog.far = THREE.MathUtils.lerp(17, far, r)
      // warna kabut geser ke biru gletser makin dalam — objek (batu/dinding es)
      // membaur ke biru dalam, bukan abu pucat
      _fogCol.copy(FOG_TOP).lerp(FOG_DEEP, THREE.MathUtils.smoothstep(k, 0.15, 0.85))
      scene.fog.color.copy(_fogCol)
    }
  })
  return null
}

// batu hero jatuh dari atas — digerakin BRIDGE (satu jalur buat intro & loop):
//  - intro pertama (phase 'fall'): App nge-drive bridge 0.6→1.0 (animasi emerge)
//  - tiap loop (idle, bridge): pas biru nutup batu keangkat, lalu jatuh mendarat
//    pas biru nyingkap → mendarat = awal descend (loop mulus)
const easeDrop = (x) => 1 + 1.9 * Math.pow(x - 1, 3) + 0.9 * Math.pow(x - 1, 2)
const smoothstep = (a, b, x) => {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}
function HeroDrop({ children }) {
  const ref = useRef()
  useFrame(() => {
    if (!ref.current) return
    const S = introState
    let e
    if (S.phase === 'wait') e = 0
    else {
      // 'fall' (intro emerge) & 'idle' (loop) sama-sama dikendalikan bridge.
      // b=0 (descend/mendarat) → e=1. b naik → keangkat (di balik biru),
      // b>0.45 → jatuh lagi sampai mendarat di b~0.95
      const b = scrollState.bridge
      if (b <= 0) e = 1
      else if (b < 0.45) e = 1 - smoothstep(0, 0.45, b) // keangkat (di balik biru)
      else e = easeDrop(THREE.MathUtils.clamp((b - 0.45) / 0.5, 0, 1)) // jatuh
    }
    ref.current.position.y = (1 - e) * 26
  })
  return <group ref={ref}>{children}</group>
}

// batu ASAL yang muncul dari BAWAH podium pas loop (permintaan Nehemiah): pas
// scroll turun dari panggung, di bawah tempat kita berdiri, batu pertama naik —
// kamera nyelam ke situ, lalu (ketutup wash) muncul balik di hero atas. Pakai
// geometri hero yang sama, material lebih murah (tanpa transmission pass ekstra)
// skala dasar echo — ice_gen.glb dimensi ~1 unit, dinaikin biar sebesar batu hero
const ECHO_S = 3.5
function HeroEcho() {
  // pakai ice_gen.glb (model es detail hasil generate Nehemiah) — di-clone &
  // center biar poros-nya pas di tengah grup. Cuma dirender pas bridge (hemat)
  const { nodes } = useGLTF('/models/ice_gen.glb')
  const geo = useMemo(() => {
    const src = Object.values(nodes).find((n) => n.isMesh)?.geometry
    if (!src) return null
    const g = src.clone()
    g.center()
    return g
  }, [nodes])
  const grp = useRef()
  const mat = useRef()
  useFrame((state) => {
    if (!grp.current) return
    const b = scrollState.bridge
    const vis = b > 0.001 && b < 0.68
    grp.current.visible = vis
    if (!vis) return
    // naik dari bawah frame (-46) ke level dasar podium (-40) selama dive — di z
    // lebih deket kamera (5.5) biar gak keblok dais podium yg solid, jadi batu
    // keliatan "muncul dari bawah tempat berdiri" pas kamera nyelam ke arahnya
    const rise = smoothstep(0, 0.5, b)
    grp.current.position.y = -44 + rise * 7
    grp.current.rotation.y = state.clock.elapsedTime * 0.18
    // membesar "menelan" layar — jadi ISI utama biru (bukan biru kosong): batu
    // gede berputar nembus wash tembus, baru pudar pas seam teleport lewat
    const grow = 1 + smoothstep(0.26, 0.58, b) * 2.2
    grp.current.scale.setScalar(ECHO_S * grow)
    // muncul cepat, tetep keliatan nembus wash yg tembus, pudar setelah seam 0.55
    const o = smoothstep(0.02, 0.16, b) * (1 - smoothstep(0.58, 0.67, b))
    if (mat.current) mat.current.opacity = o
  })
  return (
    <group ref={grp} position={[0, -44, 5.5]} scale={ECHO_S} visible={false}>
      <mesh geometry={geo}>
        {/* biru gletser PEKAT — sengaja gelap biar kontras nongol di depan
            podium/kabut yg terang pas dive (bukan pucat yg nyaru) */}
        <meshStandardMaterial
          ref={mat}
          color="#7ba3c4"
          roughness={0.4}
          metalness={0}
          emissive="#3d6d95"
          emissiveIntensity={0.55}
          transparent
          opacity={0}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}

// pecahan es kecil yang melayang naik pelan sepanjang jalur turun, looping terus —
// ngasih rasa "dunia hidup" tanpa perlu video background
function DriftingIce() {
  const { nodes } = useGLTF('/models/iceberg.glb')
  const geometry = useMemo(() => Object.values(nodes).find((n) => n.isMesh)?.geometry, [nodes])
  const material = useMemo(
    () => new THREE.MeshBasicMaterial({ color: '#d3e2ec', transparent: true, opacity: 0.35, depthWrite: false }),
    []
  )
  const shards = useMemo(() => {
    const rand = (i, n) => {
      const x = Math.sin(i * 91.7 + n * 269.5) * 43758.5453
      return x - Math.floor(x)
    }
    return Array.from({ length: 18 }, (_, i) => ({
      x: (rand(i, 1) - 0.5) * 22,
      y0: 8 - rand(i, 2) * 54,
      z: -4 - rand(i, 3) * 9,
      scale: 0.12 + rand(i, 4) * 0.3,
      rise: 0.25 + rand(i, 5) * 0.5,
      spin: 0.15 + rand(i, 6) * 0.4,
    }))
  }, [])
  const refs = useRef([])
  useFrame((state, delta) => {
    const t = state.clock.elapsedTime
    for (let i = 0; i < shards.length; i++) {
      const m = refs.current[i]
      if (!m) continue
      const s = shards[i]
      // naik pelan, wrap balik ke bawah pas lewat atas (rentang y: -46 .. 8)
      let y = s.y0 + t * s.rise
      y = ((y + 46) % 54) - 46
      m.position.set(s.x + Math.sin(t * 0.3 + i) * 0.6, y, s.z)
      m.rotation.x += delta * s.spin
      m.rotation.y += delta * s.spin * 0.7
    }
  })
  return shards.map((s, i) => (
    <mesh key={i} ref={(el) => (refs.current[i] = el)} geometry={geometry} material={material} scale={s.scale} />
  ))
}

// podium = CLUSTER KRISTAL NATURAL (dimodel di Blender: mound es lumpy +
// belasan kristal prisma variatif — ukuran, ketebalan, tilt, arah beda-beda,
// sengaja GAK simetris/sejajar & gak jarum tajem, permintaan Nehemiah). Wajah
// partikel Nehemiah melayang di atas cluster ini.
function OutroStage() {
  const { nodes } = useGLTF('/models/podium.glb')
  const geo = useMemo(() => Object.values(nodes).find((n) => n.isMesh)?.geometry, [nodes])
  return (
    <group position={[0, -40.35, 1.5]}>
      <mesh geometry={geo}>
        {/* es padat biru-pucat, flat shading biar tiap facet kristal kebaca */}
        <meshStandardMaterial
          color="#aec2d0"
          roughness={0.34}
          metalness={0}
          emissive="#5f89ac"
          emissiveIntensity={0.22}
          flatShading
        />
      </mesh>
      {/* shell tipis lebih terang = rim subsurface, kesan cahaya nembus es */}
      <mesh geometry={geo} scale={1.012}>
        <meshBasicMaterial color="#e0f0fb" transparent opacity={0.07} depthWrite={false} />
      </mesh>
      {/* ring cahaya tipis melingkar di lantai dais */}
      <mesh position={[0, 0.4, 0]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[2.9, 3.12, 96]} />
        <meshBasicMaterial color="#eaf6ff" toneMapped={false} transparent opacity={0.34} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

function BackgroundField() {
  // 3 varian bongkahan es ORGANIK dari Blender — di-remesh + decimate dari model
  // ice_gen (es tengah) jadi low-poly tapi bentuknya realistik senada es tengah,
  // ganti facet tajem yg dulu keliatan aneh (permintaan Nehemiah)
  const { nodes } = useGLTF('/models/ice_rock.glb')
  const geos = useMemo(() => Object.values(nodes).filter((n) => n.isMesh).map((n) => n.geometry), [nodes])
  // SATU material dishare semua bongkahan, TANPA transmission (bikin scene
  // dirender ulang tiap frame = lag). smooth shading = permukaan es organik
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#93b4ce',
        roughness: 0.5,
        metalness: 0,
        transparent: true,
        opacity: 0.92,
        emissive: '#274d68',
        emissiveIntensity: 0.16,
      }),
    []
  )
  // shell transparan sedikit lebih gede di tiap bongkahan = pinggiran lembut,
  // niru depth-of-field blur tanpa post-processing
  const shellMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#a9c8dc',
        transparent: true,
        opacity: 0.16,
        depthWrite: false,
      }),
    []
  )
  const chunks = useMemo(() => {
    // hash deterministik biar layout-nya konsisten tiap load
    const rand = (i, n) => {
      const x = Math.sin(i * 127.1 + n * 311.7) * 43758.5453
      return x - Math.floor(x)
    }
    return Array.from({ length: 28 }, (_, i) => {
      const side = i % 2 === 0 ? 1 : -1
      return {
        position: [side * (7 + rand(i, 1) * 10), 5 - i * 1.75 - rand(i, 2) * 2, -7 - rand(i, 3) * 11],
        rotation: [rand(i, 4) * Math.PI, rand(i, 5) * Math.PI * 2, rand(i, 6) * Math.PI],
        scale: 1.1 + rand(i, 7) * 2.8,
        speed: 0.02 + rand(i, 8) * 0.05,
      }
    })
  }, [])
  return (
    <>
      {/* gate kemunculan: di puncak (hero) background disembunyiin, baru MUNCUL
          pas mulai turun — biar frame awal bersih cuma batu hero (permintaan
          Nehemiah: "ada yg muncul duluan"). depthK = kedalaman efektif */}
      <BgFade material={material} shellMaterial={shellMaterial} />
      {chunks.map((c, i) => (
        <BgChunk key={i} geometry={geos[i % geos.length]} material={material} shellMaterial={shellMaterial} {...c} />
      ))}
    </>
  )
}

// nyalain background pelan-pelan ngikut kedalaman scroll: opacity 0 di hero,
// penuh pas udah agak dalam. Satu useFrame nyetel material yg di-share semua chunk.
function BgFade({ material, shellMaterial }) {
  useFrame(() => {
    const g = smoothstep(0.05, 0.32, scrollState.depthK)
    material.opacity = 0.92 * g
    shellMaterial.opacity = 0.16 * g
  })
  return null
}

function BgChunk({ geometry, material, shellMaterial, speed, ...props }) {
  const ref = useRef()
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * speed
  })
  return (
    <group ref={ref} {...props}>
      <mesh geometry={geometry} material={material} />
      <mesh geometry={geometry} material={shellMaterial} scale={1.05} />
    </group>
  )
}

// kolom cahaya vertikal samar (fake god-rays) — ngisi kekosongan kabut
function LightShafts() {
  const tex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 64
    c.height = 256
    const g = c.getContext('2d')
    let grad = g.createLinearGradient(0, 0, 64, 0)
    grad.addColorStop(0, 'rgba(255,255,255,0)')
    grad.addColorStop(0.5, 'rgba(255,255,255,0.6)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, 64, 256)
    // fade juga di ujung atas/bawah biar gak keliatan potongan plane
    g.globalCompositeOperation = 'destination-in'
    grad = g.createLinearGradient(0, 0, 0, 256)
    grad.addColorStop(0, 'rgba(0,0,0,0)')
    grad.addColorStop(0.25, 'rgba(0,0,0,1)')
    grad.addColorStop(0.75, 'rgba(0,0,0,1)')
    grad.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, 64, 256)
    return new THREE.CanvasTexture(c)
  }, [])
  const shafts = [
    { pos: [-6.5, -5, -7], rot: 0.16, w: 2.6 },
    { pos: [5.5, -15, -9], rot: -0.12, w: 3.6 },
    { pos: [-4.5, -26, -8], rot: 0.1, w: 2.2 },
    { pos: [2.5, -33.5, -6], rot: -0.08, w: 3.2 },
  ]
  return shafts.map((s, i) => (
    <mesh key={i} position={s.pos} rotation={[0, 0, s.rot]}>
      <planeGeometry args={[s.w, 36]} />
      <meshBasicMaterial map={tex} transparent opacity={0.14} blending={THREE.AdditiveBlending} depthWrite={false} />
    </mesh>
  ))
}

// selama rentang ini di sekitar tiap KRISTAL, kamera berhenti sebentar aja.
// hold-nya per-anchor: anchor sequence portal pakai hold 0 — dulu hold rata
// 0.03 bikin segmen sempit (0.8 - 0.86) kehabisan jendela gerak, kamera
// "jebret" lompat sekali frame di 82-83/100
const HOLD = 0.03

function CameraRig() {
  const camera = useThree((s) => s.camera)
  const parallax = useMemo(() => ({ v: 1 }), [])
  const [p, t, anchors] = useMemo(() => {
    const v = (x, y, z) => new THREE.Vector3(x, y, z)
    // posisi kamera per anchor = tepat di depan kristalnya (offset +z)
    const front = (c, dz) => v(c[0], c[1] + 0.4, c[2] + dz)
    return [
      new THREE.Vector3(),
      new THREE.Vector3(),
      [
        { t: 0, pos: v(0, 1.8, 11), look: v(0, 0.5, 0), hold: 0 },
        // anchor ngikut daftar CRYSTALS — nambah batu tinggal nambah di content.js
        ...CRYSTALS.map((c, i) => ({
          t: (i + 1) / (CRYSTALS.length + 1),
          pos: front(c.position, 7.5),
          look: v(...c.position),
          hold: HOLD,
        })),
        // koreografi portal (permintaan Nehemiah): abis batu terakhir kamera
        // NAIK ke atas cluster kristal, NYOROT lurus dari atas (portal ring
        // ngebingkai kristal di bawahnya — "persis atas si tajem2"), lalu NYELAM
        // turun nembus ring sambil angle-nya muter dari nunduk ke depan, mendarat
        // natap wajah partikel di 100/120
        { t: 0.86, pos: v(0, -30.5, 8.5), look: v(0, -37, 1.5), hold: 0 },
        { t: 0.905, pos: v(0, -25.5, 2.6), look: v(0, -38, 1.4), hold: 0.02 },
        { t: 0.95, pos: v(0, -31.5, 7), look: v(0, -37, 3), hold: 0 },
        { t: 1, pos: v(0, -36.4, 12), look: v(0, -37, 0), hold: 0 },
      ],
    ]
  }, [])

  useFrame((state, delta) => {
    // damped di-smoothing di App (master loop) — di sini tinggal baca
    const k = THREE.MathUtils.clamp(scrollState.damped, 0, 1)

    // cari segmen anchor aktif, lalu interpolasi dengan plateau per-anchor
    let i = 0
    while (i < anchors.length - 2 && k > anchors[i + 1].t) i++
    const a = anchors[i]
    const b = anchors[i + 1]
    const start = a.t + a.hold
    const end = b.t - b.hold
    let u = THREE.MathUtils.clamp((k - start) / Math.max(1e-4, end - start), 0, 1)
    u = u * u * (3 - 2 * u)
    p.lerpVectors(a.pos, b.pos, u)
    t.lerpVectors(a.look, b.look, u)

    // ---- jembatan loop (100→120): animasi MENYELAM, bukan fade. Dari panggung,
    //      kamera turun ke bawah podium natap batu asal yg naik dari bawah
    //      (HeroEcho). Di tengah bridge tirai wash nutup sekejap buat nyamarin
    //      lompatan balik ke hero atas; pas bridge kelar (==awal descend) kamera
    //      udah di hero → loop nyambung mulus ----
    const br = scrollState.bridge
    if (br > 0) {
      const L = THREE.MathUtils.lerp
      const hero = anchors[0]
      const podium = anchors[anchors.length - 1]
      if (br <= 0.55) {
        // MENYELAM: view panggung → turun & natap batu asal yg naik di depan podium
        let d = THREE.MathUtils.clamp(br / 0.55, 0, 1)
        d = d * d * (3 - 2 * d)
        p.set(L(podium.pos.x, 0, d), L(podium.pos.y, -38.8, d), L(podium.pos.z, 9.5, d))
        t.set(L(podium.look.x, 0, d), L(podium.look.y, -42, d), L(podium.look.z, 5, d))
      } else {
        // MUNCUL (awalnya ketutup wash): emerge di hero, settle naik halus
        let e = THREE.MathUtils.clamp((br - 0.55) / 0.45, 0, 1)
        e = e * e * (3 - 2 * e)
        p.set(hero.pos.x, L(hero.pos.y - 2.4, hero.pos.y, e), L(hero.pos.z + 1.6, hero.pos.z, e))
        t.set(hero.look.x, hero.look.y, hero.look.z)
      }
    }

    // parallax pointer dimatiin halus selama hero di-drag
    easing.damp(parallax, 'v', dragState.active ? 0 : 1, 0.2, delta)
    camera.position.set(p.x + state.pointer.x * 0.5 * parallax.v, p.y + state.pointer.y * 0.3 * parallax.v, p.z)
    camera.lookAt(t)
  })
  return null
}

useGLTF.preload('/models/podium.glb')
useGLTF.preload('/models/ice_rock.glb')
useGLTF.preload('/models/ice_gen.glb')
