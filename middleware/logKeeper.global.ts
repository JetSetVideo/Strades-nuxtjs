/**
 * logKeeper — auto-tracks every page navigation into the activity log
 * (where / when / what / why) and mirrors to Django telemetry when authenticated.
 */
export default defineNuxtRouteMiddleware((to, from) => {
  if (import.meta.server) return

  // Don't track auth pages
  if (to.path.startsWith('/auth')) return

  const { pageView } = useActivityLog()
  pageView(to.path, {
    from: from?.path && !from.path.startsWith('/auth') ? from.path : undefined,
    route_name: typeof to.name === 'string' ? to.name : undefined,
    query: to.query as Record<string, unknown>,
    intent: from?.path ? 'navigate' : 'land',
  })

  // Optional remote telemetry (auth-gated, best-effort)
  const { isAuthenticated } = useAuth()
  if (!isAuthenticated.value) return

  const { track } = useTracking()
  track('page_view', {
    page: to.path,
    payload: {
      from: from?.path,
      to: to.path,
      query: to.query,
    },
  })
})
