// ===== pemanasan GPU di balik tirai loader =====
// three.js ngompilasi shader & upload geometri/tekstur pas objeknya PERTAMA kali
// kegambar. Di situs ini banyak objek yang baru kelihatan jauh di bawah (portal,
// podium, wajah partikel), jadi kerjaan itu jatuh pas pengunjung lagi scroll:
// freeze 100 sampai 480 ms, cuma di putaran pertama (diukur 24 Sep 2026, putaran
// kedua nol). Pengunjung baru, alias recruiter, justru yang kena semua.
//
// Warmup (lihat Warmup di Experience.jsx) maksa semua itu kejadian sekali di
// balik loader. Loader di UI.jsx nunggu warmState.done sebelum buka tirai.
//
// warmHooks: komponen yang punya pass GPU sendiri di luar render scene biasa
// (misal simulasi partikel GPGPU) daftarin fungsi (gl) => void di sini, biar
// shader pass-nya ikut dikompilasi di warmup. Hapus lagi pas unmount.
export const warmHooks = new Set()
export const warmState = { done: false }
