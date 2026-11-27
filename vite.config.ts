import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { version } from './package.json'

const pagesPath = process.env.PAGES_BASE_PATH
const base = pagesPath === undefined ? './' : '/' + pagesPath.split('/').filter(Boolean).map(part=>part + '/').join('')

export default defineConfig({
  base,
  define: {__APP_VERSION__: JSON.stringify(version)},
  plugins: [react(), VitePWA({
    registerType: 'prompt',
    injectRegister: false,
    includeManifestIcons: false,
    manifest: {
      name: 'IRON COMPASS', short_name: 'IRON', lang: 'ja',
      start_url: './', scope: './', display: 'standalone',
      theme_color: '#101214', background_color: '#101214',
      icons: [
        { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
      skipWaiting: false,
      clientsClaim: false,
    },
  })],
})
