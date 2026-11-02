import { defineNuxtConfig } from 'nuxt/config'

// The Django API (same default as runtimeConfig.public.apiBase below). Also the target of the
// /api/auth/** proxy rule; NUXT_API_PROXY_TARGET overrides it when the server reaches the API on
// another address than the browser would.
const API_BASE = (process.env.NUXT_API_PROXY_TARGET || process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:8000')
  .replace(/\/+$/, '')

export default defineNuxtConfig({
  compatibilityDate: '2025-10-01',
  // Nuxt DevTools auto-enables in dev, which puts a floating "6 ms / gear" pill
  // over the UI — it showed up in our screenshots as a visual defect on /auth and
  // the 404 page. Developers can still have it with NUXT_DEVTOOLS=1; it is off by
  // default so the dev server renders what a user would see.
  devtools: { enabled: process.env.NUXT_DEVTOOLS === '1' },
  // e2e/ holds Deno scripts (Playwright journey); they're checked with `deno check`, not vue-tsc.
  typescript: {
    tsConfig: { exclude: ['../e2e/**'] },
  },
  modules: [
    '@pinia/nuxt',
    '@nuxt/ui'
  ],
  // Scanning option stores auto-imports the `actions` key (mlly treats it as
  // an extra export name). Stores are imported explicitly instead.
  pinia: {
    storesDirs: [],
  },
  nitro: {
    preset: 'vercel-edge',
  },
  css: ['~/assets/css/variables.css'],
  // One sign-in page: the old "/" landing card duplicated /auth. Signed-in users
  // are forwarded from /auth to the app by middleware/auth.global.ts.
  routeRules: {
    // Security headers on every page (board-security S14). frame-ancestors/X-Frame-Options: the
    // trade and wallet pages cannot be framed (clickjacking). A full CSP comes later (Nuxt's inline
    // payload script needs nonces first).
    '/**': {
      headers: {
        'X-Frame-Options': 'DENY',
        'Content-Security-Policy': "frame-ancestors 'none'",
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
      },
    },
    // Auth endpoints go through this origin so the httpOnly refresh cookie the API sets
    // (Path=/api/auth/) is first-party (board-security S5; composables/useAuth.ts). Everything else
    // still calls the API directly with the Bearer token. Target = the API base at build time.
    '/api/auth/**': { proxy: `${API_BASE}/api/auth/**` },
    '/': { redirect: '/auth' },
    '/monitor': { redirect: '/strategies' },
  },
  alias: {
    '@public/data': '/public/data'
  },
  // Font loading: @nuxt/ui already pulls in @nuxt/fonts, which auto-detects any
  // font-family referenced in our CSS (Poppins, Sora, IBM Plex Mono, Inter — the
  // curated choices in stores/appearance.ts) and self-hosts it — no manual
  // Google Fonts <link> needed.
  runtimeConfig: {
    public: {
      // Django REST backend base URL — override with NUXT_PUBLIC_API_BASE env var
      apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:8000',
      // Google Client ID for frontend Google Sign-In SDK
      googleClientId: process.env.NUXT_PUBLIC_GOOGLE_CLIENT_ID || '',
      // Set to 'true' to enable demo mode (bypasses auth, no real backend needed)
      demoMode: process.env.NUXT_PUBLIC_DEMO_MODE || 'false',
    }
  }
})
