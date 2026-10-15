/**
 * useAuth — Authentication composable
 *
 * Supports:
 *  - Email + password login/registration
 *  - Google Sign-In (sends ID token to backend)
 *  - JWT token management (access in memory, refresh in cookie)
 *  - Automatic token refresh on 401
 */

import type { Ref } from 'vue'
import type { AuthUser } from '~/types/user'


interface AuthResponse {
  user: AuthUser
  access: string
  refresh: string
}

// Where the access token lives — it must be per-request on the server AND
// never serialized into the HTML payload:
//  * module-scope ref on the server is shared by every SSR request (one user's
//    login leaked into other users' renders);
//  * useState() is per-request but is shipped in __NUXT_DATA__, i.e. the JWT
//    ends up inside the page HTML (caches, saved pages, proxy logs).
// So: server → the request's own event.context; client → a module ref (one tab
// is one user). The client re-derives its token from the refresh cookie.
let clientAccessToken: Ref<string | null> | undefined
let clientRefreshInflight: Promise<boolean> | null = null

/** The refresh cookie as the browser holds it right now (another tab may have rotated it). */
function browserRefreshCookie(): string | null {
  if (!import.meta.client) return null
  const m = document.cookie.match(/(?:^|; )strades_refresh=([^;]*)/)
  return m ? decodeURIComponent(m[1]!) : null
}

function accessTokenRef(): Ref<string | null> {
  if (import.meta.server) {
    const ctx = useRequestEvent()!.context as { stradesAccessToken?: Ref<string | null> }
    return (ctx.stradesAccessToken ??= ref<string | null>(null))
  }
  return (clientAccessToken ??= ref<string | null>(null))
}

export const useAuth = () => {
  const config = useRuntimeConfig()
  const apiBase = config.public.apiBase as string

  // Access token: memory only, per request, never in the SSR payload (see above).
  const accessToken = accessTokenRef()
  // The user profile is not a secret and is safe to hydrate.
  const currentUser = useState<AuthUser | null>('auth.user', () => null)

  // Refresh token cookie. The client sets it, so it cannot be httpOnly; at least make it Secure + SameSite=strict
  // whenever the site runs over HTTPS (production/staging). Plain http://localhost dev keeps working.
  // Target (programming manual §8): backend sets an httpOnly cookie itself — tracked as a P0 task.
  const isHttps = import.meta.client
    ? window.location.protocol === 'https:'
    : (useRequestURL().protocol === 'https:')
  const refreshToken = useCookie<string | null>('strades_refresh', {
    maxAge: 60 * 60 * 24 * 30, // 30 days
    sameSite: isHttps ? 'strict' : 'lax',
    secure: isHttps,
  })

  const isAuthenticated = computed(() => !!accessToken.value)

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------
  const _storeTokens = (response: AuthResponse) => {
    accessToken.value = response.access
    refreshToken.value = response.refresh
    currentUser.value = response.user
  }

  const _clearTokens = () => {
    accessToken.value = null
    refreshToken.value = null
    currentUser.value = null
  }

  // -------------------------------------------------------------------------
  // Register (email + password)
  // -------------------------------------------------------------------------
  const register = async (payload: {
    email: string
    password: string
    first_name?: string
    last_name?: string
    username?: string
  }) => {
    const data = await $fetch<AuthResponse>('/api/auth/register/', {
      baseURL: apiBase,
      method: 'POST',
      body: payload,
    })
    _storeTokens(data)
    return data.user
  }

  // -------------------------------------------------------------------------
  // Login (email + password)
  // -------------------------------------------------------------------------
  const login = async (email: string, password: string) => {
    const data = await $fetch<AuthResponse>('/api/auth/login/', {
      baseURL: apiBase,
      method: 'POST',
      body: { email, password },
    })
    _storeTokens(data)
    nextTick(() => useTracking().startSession())
    return data.user
  }

  // -------------------------------------------------------------------------
  // Google Sign-In (frontend sends Google ID token to backend)
  // -------------------------------------------------------------------------
  const loginWithGoogle = async (idToken: string) => {
    const data = await $fetch<AuthResponse>('/api/auth/google/', {
      baseURL: apiBase,
      method: 'POST',
      body: { id_token: idToken },
    })
    _storeTokens(data)
    nextTick(() => useTracking().startSession())
    return data.user
  }

  // -------------------------------------------------------------------------
  // Refresh access token using stored refresh token
  // -------------------------------------------------------------------------
  /**
   * Refresh tokens are single-use (rotated + blacklisted). Parallel loads (several
   * tabs, a reload while another tab refreshes) all present the same token: one
   * wins, the rest get 401. Deleting the cookie on that 401 used to log EVERY tab
   * out (reproduced 2026-10-08: 4 parallel loads → all on /auth). So:
   *  - in the browser, one refresh at a time (callers share the request);
   *  - after a 401, retry once with whatever the browser cookie holds NOW (a
   *    sibling tab may just have rotated it);
   *  - never delete the cookie during SSR or on a network error. Only a definite
   *    rejection with no newer cookie available signs the user out.
   */
  const refreshAccessToken = async (): Promise<boolean> => {
    // The server never rotates: SSR renders no private data, and a server-side rotation
    // races the browser's own refresh (lost response → stale cookie → logout). The browser
    // does the one refresh per load.
    if (import.meta.server) return false
    if (clientRefreshInflight) return clientRefreshInflight
    const run = async (): Promise<boolean> => {
      const attempt = async (token: string) => {
        const data = await $fetch<{ access: string; refresh: string }>('/api/auth/token/refresh/', {
          baseURL: apiBase, method: 'POST', body: { refresh: token },
        })
        accessToken.value = data.access
        refreshToken.value = data.refresh
        return true
      }
      const used = refreshToken.value
      if (!used) return false
      try {
        return await attempt(used)
      } catch (e: unknown) {
        const status = (e as { response?: { status?: number } })?.response?.status ?? 0
        if (!status) return false                          // network error: keep the session
        const fresh = browserRefreshCookie()
        if (fresh && fresh !== used) {
          try { return await attempt(fresh) } catch { /* fall through */ }
        }
        if (browserRefreshCookie() === used) _clearTokens() // nobody rotated it: genuinely expired/revoked
        return false
      }
    }
    clientRefreshInflight = run().finally(() => { clientRefreshInflight = null })
    return clientRefreshInflight
  }

  // -------------------------------------------------------------------------
  // Fetch / refresh the current user profile
  // -------------------------------------------------------------------------
  const fetchUser = async () => {
    if (!accessToken.value) {
      const refreshed = await refreshAccessToken()
      if (!refreshed) return null
    }
    try {
      const user = await $fetch<AuthUser>('/api/auth/me/', {
        baseURL: apiBase,
        headers: { Authorization: `Bearer ${accessToken.value}` },
      })
      currentUser.value = user
      return user
    } catch {
      _clearTokens()
      return null
    }
  }

  // -------------------------------------------------------------------------
  // Logout — blacklist refresh token on server
  // -------------------------------------------------------------------------
  const logout = async () => {
    // After a reload the access token isn't in memory; get one so the server can revoke the refresh token.
    if (refreshToken.value && !accessToken.value) await refreshAccessToken().catch(() => false)
    if (refreshToken.value && accessToken.value) {
      try {
        await $fetch('/api/auth/logout/', {
          baseURL: apiBase,
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken.value}` },
          body: { refresh: refreshToken.value },
        })
      } catch {
        // Proceed with local clear even if server call fails
      }
    }
    _clearTokens()
    useCookie('strades_demo').value = null
    try {
      usePriceCache().clearAll()
    } catch { /* ignore */ }
    useTracking().stopHeartbeat()
    await navigateTo('/auth')
  }

  // -------------------------------------------------------------------------
  // Update profile
  // -------------------------------------------------------------------------
  const updateProfile = async (payload: Partial<AuthUser>) => {
    const user = await $fetch<AuthUser>('/api/auth/me/', {
      baseURL: apiBase,
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken.value}` },
      body: payload,
    })
    currentUser.value = user
    return user
  }

  /**
   * Demo: the backend mints a throwaway account per visitor (24h, unusable
   * password, rate-limited) and returns the same shape as login.
   */
  const startDemo = async () => {
    const data = await $fetch<AuthResponse & { demo?: { expires_at: string; can_import_wallet: boolean } }>(
      '/api/auth/demo/', { baseURL: apiBase, method: 'POST' })
    _storeTokens(data)
    nextTick(() => useTracking().startSession())
    return data
  }

  return {
    // State
    accessToken: readonly(accessToken),
    user: readonly(currentUser),
    isAuthenticated,

    // Actions
    register,
    login,
    startDemo,
    loginWithGoogle,
    logout,
    fetchUser,
    refreshAccessToken,
    updateProfile,
  }
}
