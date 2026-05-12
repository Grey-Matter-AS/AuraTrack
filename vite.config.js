import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa' // 1. Add this import

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({ // 2. Add the PWA configuration
      registerType: 'autoUpdate',
      manifest: false, // We use the manual manifest.json in your public folder
      workbox: {
        // This ensures all your assets are available without internet
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'] 
      }
    })
  ],
  server: {
    host: true, // Required for your Podman setup
  }
})
