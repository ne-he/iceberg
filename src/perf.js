// ===== satu sumber kebenaran: device ini kuat atau nggak =====
// Dipakai buat nurunin beban render di HP. Sengaja dihitung SEKALI pas modul
// dimuat, bukan per-render: nilainya gak boleh berubah di tengah jalan, soalnya
// dipakai nentuin jumlah partikel & isi scene (kalau berubah, scene remount).
//
// Kriterianya kasar tapi cukup: layar sentuh + layar sempit. Desktop yang
// jendelanya dikecilin ikut kena LOW, dan itu gak masalah: yang dia dapet cuma
// versi lebih ringan dari scene yang sama.
export const LOW =
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(pointer: coarse)').matches === true || window.innerWidth < 700)

// video latar versi HP: 1,75 MB 720p + audio (padahal selalu muted) itu file
// terbesar di jalur loading. Versi HP-nya 540p tanpa audio, faststart
export const SCENE_VIDEO = LOW ? '/scene/scene_mobile.mp4' : '/scene/scene.mp4'
// video panel batu versi HP. Audio-nya DIPERTAHANKAN (suara nyala default)
export const GLACIER_VIDEO = LOW ? '/glacier_inside_mobile.mp4' : '/glacier_inside.mp4'
