/**
 * Canonical session user identity.
 * Resolves authenticated AuthUser when available; falls back to demo user_001.
 */
import { computed } from 'vue'
import { authUserToProfile } from '~/types/user'

const DEMO_USER_ID = 'user_001'

export function useCurrentUser() {
  const { user, isAuthenticated } = useAuth()

  const userId = computed(() => {
    if (isAuthenticated.value && user.value?.id) return user.value.id
    return DEMO_USER_ID
  })

  const isDemo = computed(() => !isAuthenticated.value || userId.value === DEMO_USER_ID)

  const profile = computed(() => {
    if (user.value) return authUserToProfile(user.value)
    return { id: DEMO_USER_ID, username: 'demo' }
  })

  return {
    userId,
    /** Synchronous string for call sites that need a plain id (e.g. store actions). */
    getUserId: () => userId.value,
    isDemo,
    profile,
    DEMO_USER_ID,
  }
}
