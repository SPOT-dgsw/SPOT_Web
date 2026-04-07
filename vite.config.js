import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      injectRegister: null,
      registerType: 'autoUpdate',
      includeAssets: ['spot-logo.svg'],
      manifest: {
        name: 'SPOT - 대구소프트웨어마이스터고 방송부',
        short_name: 'SPOT',
        id: '/',
        scope: '/',
        start_url: '/',
        lang: 'ko',
        description: '대구소프트웨어마이스터고 방송부 노래 신청 시스템',
        theme_color: '#2563eb',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        categories: ['music', 'education', 'productivity'],
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        cleanupOutdatedCaches: true,
        globPatterns: ['**/*.{js,css,ico,png,svg}'],
        navigateFallback: null,
        runtimeCaching: [
          {
            // 공개 읽기 전용 엔드포인트만 캐싱
            urlPattern: ({ url }) =>
              url.origin === self.location.origin && (
                url.pathname === '/api/songs/today' ||
                url.pathname === '/api/songs/schedule' ||
                url.pathname === '/api/songs/daily'
              ),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-public-cache',
              expiration: {
                maxEntries: 5,
                maxAgeSeconds: 60
              },
              cacheableResponse: {
                statuses: [200]
              }
            }
          }
        ]
      }
    })
  ],
  build: {
    chunkSizeWarningLimit: 1100,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'md-editor': ['@uiw/react-md-editor'],
        },
      },
    },
  },
  server: {
    proxy: {
      '/auth': 'http://localhost:4000',
      '/api': 'http://localhost:4000',
    },
  },
})
