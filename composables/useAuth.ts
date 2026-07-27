/**
 * useAuth — Authentication composable
 *
 * Supports:
 *  - Email + password login/registration
 *  - Google Sign-In (sends ID token to backend)
 *  - JWT token management (access in memory, refresh in cookie)
 *  - Automatic token refresh on 401
 */

export interface AuthUser {
  id: string
  email: string
  username: string | null
  first_name: string
  last_name: string
  display_name: string
  full_name: string
  avatar_url: string | null
  bio: string
  role: 'user' | 'premium' | 'admin'
  auth_provider: 'email' | 'google'
  email_verified: boolean
  preferences: Record<string, unknown>
  created_at: string
  updated_at: string
}

interface AuthResponse {
  user: AuthUser
  access: string
  refresh: string
}

// Access token stored in memory (not in localStorage — avoids XSS)
const accessToken = ref<string | null>(null)
const currentUser = ref<AuthUser | null>(null)

export const useAuth = () => {
  const config = useRuntimeConfig()
  const apiBase = config.public.apiBase as string

  // Refresh token stored in cookie (httpOnly in prod; plain for dev SPA)
  const refreshToken = useCookie<string | null>('strades_refresh', {
    maxAge: 60 * 60 * 24 * 30, // 30 days
    sameSite: 'lax',
    secure: false, // set to true in production (HTTPS)
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
  const refreshAccessToken = async (): Promise<boolean> => {
    if (!refreshToken.value) return false
    try {
      const data = await $fetch<{ access: string; refresh: string }>('/api/auth/token/refresh/', {
        baseURL: apiBase,
        method: 'POST',
        body: { refresh: refreshToken.value },
      })
      accessToken.value = data.access
      refreshToken.value = data.refresh
      return true
    } catch {
      _clearTokens()
      return false
    }
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

  return {
    // State
    accessToken: readonly(accessToken),
    user: readonly(currentUser),
    isAuthenticated,

    // Actions
    register,
    login,
    loginWithGoogle,
    logout,
    fetchUser,
    refreshAccessToken,
    updateProfile,
  }
}
