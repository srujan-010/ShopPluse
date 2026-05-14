import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    cors: true,
    allowedHosts: true,
    hmr: {
      overlay: true,
      protocol: 'wss',
      clientPort: 443,
      host: 'overdefensively-racemed-karole.ngrok-free.dev'
    },
    proxy: {
      '/api': {
        target: 'https://shoppluse.onrender.com',
        changeOrigin: true,
        secure: true,
        ws: true
      }
    }
  },
  optimizeDeps: {
    force: true
  }
})
