// ===== satu sumber kebenaran: device ini kuat atau nggak =====
// Dipakai buat nurunin beban render di HP. Sengaja dihitung SEKALI pas modul
// dimuat, bukan per-render: nilainya gak boleh berubah di tengah jalan, soalnya
// dipakai nentuin jumlah partikel & isi scene (kalau berubah, scene remount).
// Yang boleh gerak di tengah jalan cuma resolusi (dpr), itu urusan quality.js.
//
// Kriteria LOW, cukup satu yang kena:
//  - pointer utama kasar (jari): HP & tablet biasa
//  - iPad yang nyamar jadi Mac (UA "Macintosh" + multi-touch). Kalau iPad-nya
//    dipasangin trackpad, pointer utamanya jadi "fine" dan lolos cek pertama
//  - layar sentuh + UA mobile (Android/iPhone/iPad): tablet Android yang
//    nyolok keyboard/mouse, HP stylus yang ngaku pointer "fine"
//  - jendela sempit (< 700 px). Desktop yang jendelanya dikecilin ikut kena
//    LOW, dan itu gak masalah: yang dia dapet cuma versi lebih ringan
// Laptop Windows layar sentuh SENGAJA gak kena: pointer utamanya mouse/trackpad
// dan UA-nya desktop, GPU-nya sekelas laptop biasa.
//
// Buat ngetes di HP asli: ?tier=high / ?tier=low maksa tier-nya.
function detect() {
  if (typeof window === 'undefined') return { low: false, reason: 'ssr' }
  const force = new URLSearchParams(window.location.search).get('tier')
  if (force === 'low' || force === 'high') return { low: force === 'low', reason: 'forced ?tier=' + force }
  const mm = (q) => window.matchMedia?.(q).matches === true
  const nav = window.navigator || {}
  const touch = (nav.maxTouchPoints || 0) > 0
  const ua = nav.userAgent || ''
  if (mm('(pointer: coarse)')) return { low: true, reason: 'coarse pointer' }
  if (touch && nav.maxTouchPoints > 1 && /Macintosh/.test(ua)) return { low: true, reason: 'iPad (desktop UA)' }
  if (touch && (nav.userAgentData?.mobile || /Android|iPhone|iPad|iPod|Mobile/i.test(ua))) return { low: true, reason: 'touch + mobile UA' }
  if (window.innerWidth < 700) return { low: true, reason: 'narrow window' }
  return { low: false, reason: 'desktop' }
}

export const TIER = detect()
export const LOW = TIER.low

// video latar versi HP: 1,75 MB 720p + audio (padahal selalu muted) itu file
// terbesar di jalur loading. Versi HP-nya 540p tanpa audio, faststart
export const SCENE_VIDEO = LOW ? '/scene/scene_mobile.mp4' : '/scene/scene.mp4'
// video panel batu versi HP. Audio-nya DIPERTAHANKAN (suara nyala default)
export const GLACIER_VIDEO = LOW ? '/glacier_inside_mobile.mp4' : '/glacier_inside.mp4'
