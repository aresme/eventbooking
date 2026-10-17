import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// Two separate pages: the public site (index.html) and the admin area (admin.html at /admin).
// In dev, send /admin and /admin/* to admin.html like Firebase Hosting does in production.
const adminPage = {
  name: 'admin-page',
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      if (/^\/admin(\/|$|\?)/.test(req.url) && !req.url.startsWith('/admin.html')) req.url = '/admin.html'
      next()
    })
  },
}

export default defineConfig({
  plugins: [
    adminPage,
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'UniVibe Events',
        short_name: 'UniVibe',
        description: 'Discover and book university events instantly.',
        theme_color: '#C0181F',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
      },
      workbox: {
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/admin/],
        // Precache only what the public site needs; the admin page and its chunks
        // and extra font subsets are cached on first use instead, to save students' data.
        globPatterns: ['**/*.{js,css,html,svg}', '**/*latin-wght*.woff2'],
        globIgnores: [
          '**/admin.html', '**/admin-*', '**/esm-*', '**/*latin-ext*',
          ...['Events', 'EventForm', 'Bookings', 'Waitlist', 'Scanner', 'Organizers', 'Activity', 'Settings'].map((p) => `**/${p}-*`),
        ],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === self.location.origin && url.pathname.startsWith('/assets/'),
            handler: 'CacheFirst',
            options: { cacheName: 'assets', expiration: { maxEntries: 60 } },
          },
        ],
      },
    }),
  ],
  build: {
    rolldownOptions: {
      input: { main: 'index.html', admin: 'admin.html' },
    },
  },
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
})
