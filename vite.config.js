import { defineConfig } from 'vite'

const apiTarget = process.env.VITE_API_PROXY || 'http://localhost:8787'

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
  },
  server: {
    port: 5173,
    proxy: {
      '/api': apiTarget,
    },
  },
  build: { outDir: 'dist' },
})
