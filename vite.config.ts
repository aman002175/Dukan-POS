/// <reference types="vitest/config" />
import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  // Root-based base — './' (relative) rehte to /auth/callback jaise nested routes pe
  // JS assets /auth/assets/... se resolve hote the → 404 → white screen (silent).
  base: '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'icon-*.png', 'logo.png'],
      manifest: {
        name: 'Dukaan POS - Kirana Store Manager',
        short_name: 'Dukaan POS',
        description: 'Offline Kirana Dukaan Management App - POS, Inventory, Khata, Reports',
        theme_color: '#f97316',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ],
        categories: ['business', 'finance', 'productivity'],
        lang: 'hi',
        dir: 'ltr',
        screenshots: [],
        shortcuts: [
          {
            name: 'POS - Bikri',
            short_name: 'Bikri',
            description: 'Seedha billing screen kholo',
            url: '/?tab=pos',
            icons: [{ src: 'icon-192.png', sizes: '192x192' }]
          },
          {
            name: 'Khata Book',
            short_name: 'Khata',
            description: 'Udhaar khata dekhein',
            url: '/?tab=khata',
            icons: [{ src: 'icon-192.png', sizes: '192x192' }]
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] }
            }
          }
        ],
        // Skip waiting and claim clients for instant update
        skipWaiting: true,
        clientsClaim: true
      },
      devOptions: {
        enabled: true,
        type: 'module'
      }
    })
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
  },
  optimizeDeps: {
    exclude: ['@vitejs/plugin-react'],
  },
});
