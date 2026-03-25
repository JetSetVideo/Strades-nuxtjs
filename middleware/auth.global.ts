/**
 * Global auth middleware — runs on every navigation.
 *
 * Public routes: /auth and its sub-paths
 * All other routes require a valid JWT (access token in memory
 * or a refresh token that can silently renew it).
 */
export default defineNuxtRouteMiddleware(async (to) => {
  const { isAuthenticated, refreshAccessToken } = useAuth()

  const PUBLIC_ROUTES = ['/auth', '/about', '/contact']
  const isPublic = PUBLIC_ROUTES.some(p => to.path === p || to.path.startsWith(p + '/'))

  if (isPublic) {
    // If already authenticated, redirect away from /auth to the app
    if (isAuthenticated.value && to.path.startsWith('/auth')) {
      return navigateTo('/prices')
    }
    return
  }

  // Protected route — ensure we have a valid token
  if (!isAuthenticated.value) {
    // Try to silently refresh using the stored cookie refresh token
    const refreshed = await refreshAccessToken()
    if (!refreshed) {
      return navigateTo('/auth')
    }
  }
})
