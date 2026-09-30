/**
 * logKeeper — auto-tracks every page navigation into the activity log
 * (where / who / what / when / why / how) and mirrors to Django telemetry when authenticated.
 * Read Design.md, Data.md, CodingAgent.md, Components.md, and Structure.md before changing a surface.
 */
export default defineNuxtRouteMiddleware((to, from) => {
  if (import.meta.server) return

  // Don't track auth pages
  if (to.path.startsWith('/auth')) return

  const { userId } = useCurrentUser()
  const { pageView } = useActivityLog()
  pageView(to.path, {
    from: from?.path && !from.path.startsWith('/auth') ? from.path : undefined,
    route_name: typeof to.name === 'string' ? to.name : undefined,
    query: to.query as Record<string, unknown>,
    intent: from?.path ? 'navigate' : 'land',
    who: { actor: userId.value, role: 'user' },
    how: { method: 'client-navigation', inputs: [from?.path || 'land'] },
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
