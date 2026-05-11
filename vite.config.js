import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite' // 1. Add this line

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(), // 2. Add this line
  ],
  server: {
    host: true, // 3. Ensure this is true for Podman
  }
})
