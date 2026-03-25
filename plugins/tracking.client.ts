/**
 * Tracking plugin — initializes user session after auth is ready.
 * Runs client-side only. Called once on app boot.
 */
export default defineNuxtPlugin(async () => {
  const { isAuthenticated, fetchUser } = useAuth()
  const { startSession } = useTracking()

  // Restore auth state from refresh token cookie
  if (!isAuthenticated.value) {
    await fetchUser()
  }

  if (isAuthenticated.value) {
    await startSession()
  }
})
