import { defineNuxtConfig } from 'nuxt/config'

export default defineNuxtConfig({
  modules: [
    '@pinia/nuxt',
    '@nuxt/ui'
  ],
  nitro: {
    preset: 'vercel-edge',
  },
})
