import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    cors: true,
    allowedHosts: ['enamel-stack-subzero.ngrok-free.dev', 'localhost'],
    hmr: {
      protocol: 'wss',
      host: 'enamel-stack-subzero.ngrok-free.dev',
      clientPort: 443
    },
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
        ws: true
      }
    }
  },
  optimizeDeps: {
    force: true
  }
})
