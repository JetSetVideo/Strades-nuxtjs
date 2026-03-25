/**
 * logKeeper — auto-tracks every page navigation for authenticated users.
 * Fires a 'page_view' activity log on each route change.
 */
export default defineNuxtRouteMiddleware((to, from) => {
  if (import.meta.server) return

  const { isAuthenticated } = useAuth()
  const { track } = useTracking()

  if (!isAuthenticated.value) return

  // Don't track auth pages
  if (to.path.startsWith('/auth')) return

  const startTime = Date.now()

  // Track previous page duration if coming from a real page
  if (from?.path && !from.path.startsWith('/auth')) {
    const duration = Date.now() - startTime
    track('page_view', {
      page: to.path,
      payload: {
        from: from.path,
        to: to.path,
        query: to.query,
      },
    })
  } else {
    track('page_view', { page: to.path })
  }
})