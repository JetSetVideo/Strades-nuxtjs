export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.config.errorHandler = (error) => {
    // Handle global errors
    console.error(error)
    // Show toast notification
  }
}) 