import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages sirve la web en /<repositorio>/
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE ?? '/Finance/',
})
