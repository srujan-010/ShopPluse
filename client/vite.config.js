import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    hmr: {
      protocol: "wss",
      host: "enamel-stack-subzero.ngrok-free.dev",
      clientPort: 443
    },
    allowedHosts: [
      "enamel-stack-subzero.ngrok-free.dev"
    ],
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
