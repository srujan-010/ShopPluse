import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Custom plugin to dynamically adjust Vite's HMR settings in the client browser.
// This makes HMR work seamlessly on localhost, ngrok, local IP, or custom domains.
const dynamicHmrPlugin = {
  name: 'dynamic-hmr',
  enforce: 'post',
  transform(code, id) {
    if (id.includes('vite/dist/client/client.mjs') || id.includes('@vite/client')) {
      let modified = code;
      const targetProtocol = 'const socketProtocol = __HMR_PROTOCOL__ || (importMetaUrl.protocol === "https:" ? "wss" : "ws");';
      const replacementProtocol = 'const socketProtocol = window.location.protocol === "https:" ? "wss" : "ws";';
      const targetHost = 'const socketHost = `${__HMR_HOSTNAME__ || importMetaUrl.hostname}:${hmrPort || importMetaUrl.port}${__HMR_BASE__}`;';
      const replacementHost = 'const socketHost = `${window.location.hostname}${window.location.protocol === "https:" ? "" : ":" + (window.location.port || "5173")}${__HMR_BASE__}`;';
      
      if (modified.includes(targetProtocol)) {
        modified = modified.replace(targetProtocol, replacementProtocol);
      }
      if (modified.includes(targetHost)) {
        modified = modified.replace(targetHost, replacementHost);
      }
      return {
        code: modified,
        map: null
      };
    }
  }
};

export default defineConfig({
  plugins: [
    react(),
    dynamicHmrPlugin,
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      devOptions: {
        enabled: true,
        type: 'module'
      },
      manifest: {
        name: 'ShopPulse POS',
        short_name: 'ShopPulse',
        description: 'ShopPulse Offline-First POS System',
        theme_color: '#1E6BFF',
        background_color: '#FFFFFF',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          {
            src: 'https://i.ibb.co/9mVRXF5q/Chat-GPT-Image-May-14-2026-01-56-04-PM.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'https://i.ibb.co/9mVRXF5q/Chat-GPT-Image-May-14-2026-01-56-04-PM.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,ttf,eot}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [
          /^\/api\//,
          /^\/@vite\/client/,
          /^\/node_modules/,
          /hot-update\.json$/,
          /\.hot-update\.js$/
        ],
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'html-pages',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 7 // 1 week
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365
              }
            }
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30
              }
            }
          },
          {
            urlPattern: ({ request }) => request.destination === 'style' || request.destination === 'script',
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'static-assets',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30
              }
            }
          }
        ]
      }
    })
  ],
  server: {
    host: "0.0.0.0",
    port: 5173,
    allowedHosts: [
      "enamel-stack-subzero.ngrok-free.dev",
      ".ngrok-free.dev",
      ".ngrok.io"
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
