/**
 * Global auth middleware — runs on every navigation.
 *
 * Public routes: /auth and its sub-paths
 * All other routes require a valid JWT (access token in memory
 * or a refresh token that can silently renew it).
 *
 * DEMO MODE: When apiBase points to localhost (no real backend running),
 * authentication is bypassed so the prototype is usable without a server.
 */
export default defineNuxtRouteMiddleware(async (to) => {
  const { isAuthenticated, refreshAccessToken } = useAuth()
  const config = useRuntimeConfig()

  const PUBLIC_ROUTES = ['/auth', '/about', '/contact']
  const isPublic = PUBLIC_ROUTES.some(p => to.path === p || to.path.startsWith(p + '/'))

  // ── Demo mode: no real backend ─────────────────────────────────────────
  // When apiBase is localhost (default dev value) and no refresh token can
  // be obtained, allow through instead of looping on /auth redirects.
  const apiBase = (config.public.apiBase as string) || ''
  const isDemoMode = apiBase.includes('localhost') || apiBase === ''
  if (isDemoMode) {
    // On the /auth page in demo mode, redirect straight to the app
    if (to.path.startsWith('/auth')) {
      return navigateTo('/prices')
    }
    return
  }

  // ── Production auth ────────────────────────────────────────────────────
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
