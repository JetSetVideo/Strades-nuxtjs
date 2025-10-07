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
})
