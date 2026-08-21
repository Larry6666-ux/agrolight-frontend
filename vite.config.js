import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // Proxy API calls to your backend during local dev (avoids CORS locally)
    proxy: {
      '/api': {
        target: 'https://agrolight-os-backend.vercel.app',
        changeOrigin: true,
        secure: true,
      }
    }
  }
})
