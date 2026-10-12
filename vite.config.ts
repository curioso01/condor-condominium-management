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
  server: {
    port: 3000,
    open: false,
    host: true
  }
})
