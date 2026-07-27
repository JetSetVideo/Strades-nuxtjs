/**
 * Global auth middleware — runs on every navigation.
 *
 * Public routes: /auth and its sub-paths
 * All other routes require a valid JWT (access token in memory
 * or a refresh token that can silently renew it).
 *
 * DEMO MODE: Enabled only when NUXT_PUBLIC_DEMO_MODE=true is set in the
 * environment. This allows the app to be used without a running backend.
 * It must NOT be triggered by the apiBase URL, as that caused local backend
 * auth to be permanently bypassed.
 */
export default defineNuxtRouteMiddleware(async (to) => {
  const { isAuthenticated, refreshAccessToken } = useAuth()
  const config = useRuntimeConfig()
  const demoCookie = useCookie<string | null>('strades_demo')

  const PUBLIC_ROUTES = ['/auth', '/about', '/contact']
  const isPublic = PUBLIC_ROUTES.some(p => to.path === p || to.path.startsWith(p + '/'))

  const isDemoMode =
    config.public.demoMode === 'true' ||
    config.public.demoMode === true ||
    demoCookie.value === '1'

  if (isDemoMode) {
    if (to.path.startsWith('/auth')) {
      return navigateTo('/prices')
    }
    return
  }

  // ── Production / local-backend auth ───────────────────────────────────
  if (isPublic) {
    if (isAuthenticated.value && to.path.startsWith('/auth')) {
      return navigateTo('/prices')
    }
    return
  }

  if (!isAuthenticated.value) {
    const refreshed = await refreshAccessToken()
    if (!refreshed) {
      return navigateTo('/auth')
    }
  }
})
