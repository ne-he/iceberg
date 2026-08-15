import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Proxy /api ke backend RAG (Next.js di Vercel) — same-origin dari sisi browser,
// jadi gak perlu CORS. Di produksi, vercel.json yang ngurus rewrite ini.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'https://web-portofolio-rag.vercel.app',
        changeOrigin: true,
        secure: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Dulu semuanya nempel jadi satu file 1,5 MB: sekali ganti satu baris di
        // src/, seluruh three.js kena hash baru dan visitor lama download ulang
        // semuanya. Dipisah per vendor biar chunk berat (three, drei, postfx)
        // yang nyaris gak pernah berubah bisa nempel lama di cache browser.
        // Cuma DUA keranjang vendor, dan itu disengaja. Tiap kali three dipisah
        // lagi dari drei/postfx/gsap, Rollup ngeluh "circular chunk": paket-paket
        // itu saling narik (troika, meshline, @shadergradient semua nyantol ke
        // three), jadi chunk-nya nunjuk bolak-balik. React aman dipisah karena
        // dia daun: gak ngimpor apa pun dari sini.
        //
        // Hasil nyatanya yang penting: kode src/ berdiri sendiri di chunk ~82 kB.
        // Ganti satu baris copy = cuma 82 kB itu yang hash-nya berubah, 1,2 MB
        // library tetep nempel di cache browser pengunjung lama.
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          const rest = id.split('node_modules/').pop()
          const pkg = rest.startsWith('@')
            ? rest.split('/').slice(0, 2).join('/')
            : rest.split('/')[0]

          if (['react', 'react-dom', 'scheduler', 'react-reconciler'].includes(pkg)) return 'react'
          return 'vendor'
        },
      },
    },
    // batas warning dinaikin: three.js + drei emang segede itu, bukan tanda ada
    // yang salah, dan gak ada lagi yang bisa dipecah tanpa bikin siklus
    chunkSizeWarningLimit: 1300,
  },
})
