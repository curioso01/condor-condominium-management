import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Substitui __BUILD_ID__ no sw.js final (dist) por um timestamp único por build.
// Assim, todo deploy gera um Service Worker novo e os apps instalados se atualizam sozinhos.
const swBuildId = (): Plugin => ({
  name: 'condor-sw-build-id',
  apply: 'build',
  closeBundle() {
    const swPath = resolve(process.cwd(), 'dist', 'sw.js')
    if (!existsSync(swPath)) return
    const content = readFileSync(swPath, 'utf8')
    writeFileSync(swPath, content.replace(/__BUILD_ID__/g, String(Date.now())))
  },
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), swBuildId()],
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('react-dom') || id.includes('node_modules/react/')) {
            return 'react-vendor'
          }
          if (id.includes('@supabase')) {
            return 'supabase-vendor'
          }
          if (id.includes('recharts') || id.includes('d3-')) {
            return 'charts-vendor'
          }
          if (id.includes('lucide-react')) {
            return 'icons-vendor'
          }
          if (id.includes('qrcode') || id.includes('sonner')) {
            return 'ui-utils-vendor'
          }
          return undefined
        },
      },
    },
  },
  server: {
    port: 3000,
    open: false,
    host: true,
  },
})
