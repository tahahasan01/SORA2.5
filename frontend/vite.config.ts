import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const isVercel = process.env.VERCEL === '1'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: isVercel ? 'dist' : '../static/dist',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/sora': 'http://127.0.0.1:8000',
      '/dma': 'http://127.0.0.1:8000',
      '/health': 'http://127.0.0.1:8000',
    },
  },
})
