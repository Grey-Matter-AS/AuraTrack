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
        icons: [{ src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,svg,json,woff2}'] },
    }),
  ],
  build: { target: 'es2023', sourcemap: true },
});
