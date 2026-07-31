import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages project sites live at https://<user>.github.io/<repo>/, so the
// bundle has to be built with that sub-path as its base. The deploy workflow
// passes the repo name through BASE_PATH; override it for a custom domain.
const base = process.env.BASE_PATH ?? '/tower-defense-sample/';

export default defineConfig(() => ({
  // Applied in dev and preview too, so every mode exercises the same URLs the
  // deployed site uses. `npm run dev` therefore serves at localhost:5173<base>.
  base,
  build: {
    target: 'es2022',
    // The game's art lives in public/assets, so Vite's own chunks get their
    // own folder rather than being merged into it.
    assetsDir: 'bundle',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        // Phaser is ~1.2 MB and never changes between game patches; splitting it
        // out keeps it in the browser cache across deploys.
        manualChunks: (id: string) => (id.includes('node_modules/phaser') ? 'phaser' : undefined),
      },
    },
  },
  server: { host: true },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/*.png', 'fonts/*.woff2'],
      manifest: {
        id: base,
        name: 'Tiny Siege',
        short_name: 'Tiny Siege',
        description:
          'Deploy your troops, hold the lane and smash the goblin castle. A lane-battle tower defense game.',
        start_url: base,
        scope: base,
        display: 'fullscreen',
        display_override: ['fullscreen', 'standalone', 'minimal-ui'],
        orientation: 'landscape',
        background_color: '#1b2432',
        theme_color: '#1b2432',
        categories: ['games', 'entertainment'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Everything the game needs is static, so precache the lot: once the
        // service worker settles the game runs fully offline.
        globPatterns: ['**/*.{js,css,html,png,svg,woff2,webmanifest}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallback: `${base}index.html`,
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false },
    }),
  ],
}));
