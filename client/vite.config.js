import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { defineConfig } from 'vite'

const SERVER_ORIGIN = process.env.VITE_DEV_SERVER_ORIGIN || 'http://localhost:3001'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
  ],
  envDir: '..',
  server: {
    port: 5173,
    strictPort: true,
    host: true,
    proxy: {
      '/api': { target: SERVER_ORIGIN, changeOrigin: false },
      '/socket.io': { target: SERVER_ORIGIN, ws: true, changeOrigin: false },
    },
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    assetsInlineLimit: 2048,
    chunkSizeWarningLimit: 1200,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
})
