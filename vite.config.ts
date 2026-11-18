import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Relative base so the build works from any path (GitHub Pages project sites included).
export default defineConfig({
  base: './',
  plugins: [react()],
  worker: { format: 'es' },
})
