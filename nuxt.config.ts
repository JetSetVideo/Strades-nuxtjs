import { defineNuxtConfig } from 'nuxt/config'

export default defineNuxtConfig({
  compatibilityDate: '2025-10-01',
  modules: [
    '@pinia/nuxt',
    '@nuxt/ui'
  ],
  nitro: {
    preset: 'vercel-edge',
  },
  css: ['~/assets/css/variables.css'],
  alias: {
    '@public/data': '/public/data'
  },
  runtimeConfig: {
    public: {
      // Django REST backend base URL — override with NUXT_PUBLIC_API_BASE env var
      apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:8000',
      // Google Client ID for frontend Google Sign-In SDK
      googleClientId: process.env.NUXT_PUBLIC_GOOGLE_CLIENT_ID || '',
    }
  }
})
