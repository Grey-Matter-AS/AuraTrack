import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // Updates wait for the user's tap (never applied mid-recording)
      registerType: 'prompt',
      injectRegister: false,
      manifest: {
        name: 'AuraTrack',
        short_name: 'AuraTrack',
        description: 'Private seizure tracking for people with epilepsy and their carers',
        start_url: '/',
        display: 'standalone',
        background_color: '#0f172a',
        theme_color: '#0f172a',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      // push-sw.js shows the household hub's alerts when the app is closed
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png,json,woff2}'], importScripts: ['push-sw.js'] },
    }),
  ],
  build: { target: 'es2023', sourcemap: true },
});
