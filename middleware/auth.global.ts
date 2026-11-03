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
  // Read before any await (Nuxt context). No token in either: `strades_session` is a hint set by
  // useAuth; `strades_refresh` is a pre-S5 cookie still waiting to be migrated by the browser.
  const serverSeesSession = import.meta.server
    && (String(useCookie('strades_session').value ?? '') === '1' || !!useCookie('strades_refresh').value)

  // /test (component gallery + strategy card lab) shows sample data only: public in dev builds so lab captures need no sign-in.
  const PUBLIC_ROUTES = ['/auth', '/about', '/contact', ...(import.meta.dev ? ['/test'] : [])]
  const isPublic = PUBLIC_ROUTES.some(p => to.path === p || to.path.startsWith(p + '/'))

  // useCookie decodes with destr: the stored "1" comes back as the NUMBER 1, so compare as text
  // (a strict === '1' made the sample-data mode vanish on every reload).
  const sampleCookie = String(demoCookie.value ?? '') === '1'
  const envDemo = String(config.public.demoMode) === 'true'

  if (envDemo) {
    if (to.path.startsWith('/auth')) return navigateTo('/prices')
    return
  }
  // Sample-data browsing (the server did not answer when the demo was started): pages stay open, and
  // /auth stays reachable so the visitor can get a real demo account (it used to bounce to /prices,
  // trapping people in sample data for the cookie's 30 days).
  if (sampleCookie && !isAuthenticated.value) return

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
      // The server never refreshes (see useAuth.refreshAccessToken), and it cannot see the httpOnly
      // refresh cookie (Path=/api/auth/). With the session hint (or a pre-S5 refresh cookie still to
      // migrate) present, let the browser's run of this middleware decide.
      if (import.meta.server && serverSeesSession) return
      return navigateTo('/auth')
    }
  }
})
