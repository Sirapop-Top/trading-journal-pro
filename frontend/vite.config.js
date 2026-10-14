import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons.svg'],
      manifest: {
        name: 'AlphaTrader Pro',
        short_name: 'AlphaTrader',
        description: 'Serverless Multi-Asset Portfolio Journal & Rebalance Terminal',
        theme_color: '#06080f',
        background_color: '#06080f',
        display: 'standalone',
        orientation: 'portrait',
        scope: './',
        start_url: './',
        icons: [
          {
            src: 'favicon.svg',
            sizes: '192x192 512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
        // Strictly avoid caching external API requests to Google or Yahoo
        navigateFallback: null,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/(script\.google\.com|docs\.google\.com|open\.er-api\.com|query1\.finance\.yahoo\.com)/,
            handler: 'NetworkOnly'
          }
        ]
      }
    })
  ]
});
