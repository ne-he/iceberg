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
})
