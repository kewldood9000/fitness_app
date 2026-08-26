import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const configuredBase = process.env.BASE_PATH ?? '/'
const base = configuredBase.endsWith('/') ? configuredBase : `${configuredBase}/`

export default defineConfig({
  base,
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg'],
      manifest: {
        name: 'Pocket Pace',
        short_name: 'Pocket Pace',
        description: 'A private, offline-first personal fitness tracker.',
        theme_color: '#0d0d0f',
        background_color: '#0d0d0f',
        display: 'standalone',
        start_url: './',
        scope: './',
        icons: [
          {
            src: 'icons/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        navigateFallback: 'index.html',
        globPatterns: ['**/*.{js,css,html,svg,ico,png,webmanifest}'],
        globIgnores: [
          'assets/NutritionPage-*.js',
          'assets/ProgressPage-*.js',
          'assets/SettingsPage-*.js',
          'assets/WorkoutPage-*.js',
          'assets/charts-*.js',
          'assets/barcode-*.js'
        ],
        runtimeCaching: [{
          urlPattern: /\/assets\/(?:NutritionPage|ProgressPage|SettingsPage|WorkoutPage|charts|barcode)-[^/]+\.js$/,
          handler: 'CacheFirst',
          options: {
            cacheName: 'pocket-pace-feature-chunks',
            expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 30 },
            cacheableResponse: { statuses: [0, 200] }
          }
        }]
      }
    })
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          barcode: ['@zxing/browser']
        }
      }
    }
  }
})
