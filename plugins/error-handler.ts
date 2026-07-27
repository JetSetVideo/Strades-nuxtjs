/**
 * Global Vue error handler — logs and surfaces via a lightweight event bus
 * that layouts can toast. Avoids silent failures.
 */
export default defineNuxtPlugin((nuxtApp) => {
  const lastError = useState<string | null>('app:lastError', () => null)

  nuxtApp.vueApp.config.errorHandler = (error, _instance, info) => {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[vue error]', message, info, error)
    lastError.value = message
    // Auto-clear after a few seconds so UI can show a transient banner
    if (import.meta.client) {
      window.setTimeout(() => {
        if (lastError.value === message) lastError.value = null
      }, 6000)
    }
  }

  nuxtApp.hook('app:error', (error) => {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[nuxt app:error]', message)
    lastError.value = message
  })
})
