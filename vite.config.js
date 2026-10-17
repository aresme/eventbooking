import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// Three separate pages: the public site (index.html), the admin area (admin.html at /admin)
// and the organizer portal (organizer.html at /organizer).
// In dev, route /admin/* and /organizer/* to their pages like Firebase Hosting does in production.
const adminPage = {
  name: 'admin-page',
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      const m = req.url.match(/^\/(admin|organizer)(\/|$|\?)/)
      if (m) req.url = `/${m[1]}.html`
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
        navigateFallbackDenylist: [/^\/admin/, /^\/organizer/],
        // Precache only what the public site needs; the admin page and its chunks
        // and extra font subsets are cached on first use instead, to save students' data.
        globPatterns: ['**/*.{js,css,html,svg}', '**/*latin-wght*.woff2'],
        globIgnores: [
          '**/admin.html', '**/admin-*', '**/organizer.html', '**/organizer-*', '**/esm-*', '**/*latin-ext*',
          ...['AdminApp', 'Events', 'EventForm', 'Bookings', 'Waitlist', 'Scanner', 'Organizers', 'Activity', 'Settings', 'DoorStaff', 'Inbox', 'PromoDialog', 'UpdatesDialog'].map((p) => `**/${p}-*`),
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
      input: { main: 'index.html', admin: 'admin.html', organizer: 'organizer.html' },
    },
  },
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
})
