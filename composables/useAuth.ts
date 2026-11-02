/**
 * useAuth — Authentication composable
 *
 * Supports:
 *  - Email + password login/registration
 *  - Google Sign-In (sends ID token to backend)
 *  - JWT tokens: access in memory; refresh in an httpOnly cookie the BACKEND sets (board-security S5)
 *  - Automatic token refresh on 401
 *
 * Refresh cookie (S5). Page scripts never see the refresh token any more:
 *  - login / register / google / demo / demo resume / refresh / logout go to `/api/auth/*` on THIS
 *    origin; nuxt.config.ts proxies them to the API, so the `strades_rt` cookie the API sets
 *    (HttpOnly; SameSite=Lax; Path=/api/auth/) is first-party whatever host the API runs on
 *    (localhost:3000 vs 127.0.0.1:8000 are different sites: a cookie set by the API host directly
 *    would never come back).
 *  - Every such call sends `X-Strades-Refresh-Cookie: 1`, so the API leaves the token out of JSON.
 *  - `strades_session=1` is a non-secret hint cookie (no token in it) so SSR and the boot plugin
 *    know whether a refresh is worth trying.
 *  - Migration: a refresh token still sitting in the old JS-readable `strades_refresh` cookie is
 *    sent once in the body; the API answers with the httpOnly cookie, and the old cookie is deleted.
 */

import type { Ref } from 'vue'
import type { Router } from 'vue-router'
import type { AuthUser } from '~/types/user'
import { clearUserStorage, setStorageUser } from '~/utils/userStorage'


interface AuthResponse {
  user: AuthUser
  access: string
  /** Only for callers that did not opt into the cookie (old tabs during the transition release). */
  refresh?: string
}

interface DemoMeta {
  expires_at: string | null
  inactivity_days: number
  can_import_wallet: boolean
  /** Only on creation and on POST demo/code/: the server stores a hash, never the id. */
  code?: string
}
type DemoResponse = AuthResponse & { demo?: DemoMeta }

// The demo id stays on this device (not a cookie: the server never needs it back). It is a bearer
// credential for a paper-money account. It is removed by "Forget this device" at sign-out, by
// Settings › "Forget the demo ID on this device", and when the demo is claimed (board-security S6).
const DEMO_CODE_KEY = 'strades_demo_code'

/** The demo id remembered on this device, if any (client only). */
export function storedDemoCode(): string | null {
  if (!import.meta.client) return null
  try { return localStorage.getItem(DEMO_CODE_KEY) } catch { return null }
}

function rememberDemoCode(code: string) {
  if (!import.meta.client) return
  try { localStorage.setItem(DEMO_CODE_KEY, code) } catch { /* private mode: the id is still shown once */ }
}

/** HTTP status of a $fetch error (0 = no answer: network error, server restarting). */
export function httpStatusOf(e: unknown): number {
  return (e as { response?: { status?: number } })?.response?.status
    ?? (e as { statusCode?: number }).statusCode ?? 0
}

export function forgetDemoCode() {
  if (!import.meta.client) return
  try { localStorage.removeItem(DEMO_CODE_KEY) } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Cookies the browser code may touch (none of them holds a token any more)
// ---------------------------------------------------------------------------
const LEGACY_REFRESH_COOKIE = 'strades_refresh'   // pre-S5, JS-readable: migrated then deleted
const SESSION_HINT_COOKIE = 'strades_session'     // "a refresh cookie was issued here" — no secret
const THIRTY_DAYS = 60 * 60 * 24 * 30

function readBrowserCookie(name: string): string | null {
  if (!import.meta.client) return null
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return m ? decodeURIComponent(m[1]!) : null
}

function writeBrowserCookie(name: string, value: string, maxAge: number) {
  if (!import.meta.client) return
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; SameSite=Lax${secure}`
}

const legacyRefreshCookie = () => readBrowserCookie(LEGACY_REFRESH_COOKIE) || null
const dropLegacyRefreshCookie = () => { if (readBrowserCookie(LEGACY_REFRESH_COOKIE) !== null) writeBrowserCookie(LEGACY_REFRESH_COOKIE, '', 0) }
const hasSessionHint = () => readBrowserCookie(SESSION_HINT_COOKIE) === '1'
const setSessionHint = () => writeBrowserCookie(SESSION_HINT_COOKIE, '1', THIRTY_DAYS)
const dropSessionHint = () => { if (readBrowserCookie(SESSION_HINT_COOKIE) !== null) writeBrowserCookie(SESSION_HINT_COOKIE, '', 0) }

/**
 * Same-origin call to an /api/auth/* endpoint (proxied to the API by nuxt.config.ts), with the
 * refresh cookie and the cookie-only opt-in. A 502/503/504 from the proxy means "the API did not
 * answer": surfaced as status 0, exactly like a network error, so the existing retry / "can't reach
 * the server" / sample-data paths keep working.
 */
async function authFetch<T>(path: string, body: Record<string, unknown> = {}): Promise<T> {
  try {
    return await $fetch<T>(path, {
      method: 'POST',
      body,
      credentials: 'include',
      headers: { 'X-Strades-Refresh-Cookie': '1' },
    })
  } catch (e: unknown) {
    if ([502, 503, 504].includes(httpStatusOf(e))) {
      throw Object.assign(new Error("Can't reach the Strades server"), { statusCode: 0, cause: e })
    }
    throw e
  }
}

// Where the access token lives — it must be per-request on the server AND
// never serialized into the HTML payload:
//  * module-scope ref on the server is shared by every SSR request (one user's
//    login leaked into other users' renders);
//  * useState() is per-request but is shipped in __NUXT_DATA__, i.e. the JWT
//    ends up inside the page HTML (caches, saved pages, proxy logs).
// So: server → the request's own event.context; client → a module ref (one tab
// is one user). The client re-derives its token from the httpOnly refresh cookie.
let clientAccessToken: Ref<string | null> | undefined
let clientRefreshInflight: Promise<boolean> | null = null

function accessTokenRef(): Ref<string | null> {
  if (import.meta.server) {
    const ctx = useRequestEvent()!.context as { stradesAccessToken?: Ref<string | null> }
    return (ctx.stradesAccessToken ??= ref<string | null>(null))
  }
  return (clientAccessToken ??= ref<string | null>(null))
}

/** After an account switch, reload once the caller has navigated, so no store keeps the previous user's state. */
function reloadAfterNextNavigation(router: Router | null) {
  if (!import.meta.client || !router) return
  const off = router.afterEach((to) => {
    off()
    reloadNuxtApp({ path: to.fullPath, force: true })
  })
}

export const useAuth = () => {
  const config = useRuntimeConfig()
  const apiBase = config.public.apiBase as string
  let router: Router | null = null
  try { router = useRouter() } catch { /* outside a Nuxt context */ }

  // Access token: memory only, per request, never in the SSR payload (see above).
  const accessToken = accessTokenRef()
  // The user profile is not a secret and is safe to hydrate.
  const currentUser = useState<AuthUser | null>('auth.user', () => null)

  const isAuthenticated = computed(() => !!accessToken.value)

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------
  /** Per-user local storage (S13): switch namespace; on an account switch reload after navigation. */
  const _adoptStorageUser = (user: AuthUser | null | undefined, reloadOnSwitch: boolean) => {
    if (!import.meta.client || !user?.id) return
    const switched = setStorageUser(user.id)
    if (switched && reloadOnSwitch) reloadAfterNextNavigation(router)
  }

  const _storeTokens = (response: AuthResponse) => {
    accessToken.value = response.access
    currentUser.value = response.user
    setSessionHint()
    dropLegacyRefreshCookie()        // the API has just set the httpOnly cookie
    _adoptStorageUser(response.user, true)
  }

  const _clearTokens = () => {
    accessToken.value = null
    currentUser.value = null
    dropSessionHint()
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
    const data = await authFetch<AuthResponse>('/api/auth/register/', payload)
    _storeTokens(data)
    return data.user
  }

  // -------------------------------------------------------------------------
  // Login (email + password)
  // -------------------------------------------------------------------------
  const login = async (email: string, password: string) => {
    const data = await authFetch<AuthResponse>('/api/auth/login/', { email, password })
    _storeTokens(data)
    nextTick(() => useTracking().startSession())
    return data.user
  }

  // -------------------------------------------------------------------------
  // Google Sign-In (frontend sends Google ID token to backend)
  // -------------------------------------------------------------------------
  const loginWithGoogle = async (idToken: string) => {
    const data = await authFetch<AuthResponse>('/api/auth/google/', { id_token: idToken })
    _storeTokens(data)
    nextTick(() => useTracking().startSession())
    return data.user
  }

  // -------------------------------------------------------------------------
  // Refresh the access token from the httpOnly refresh cookie
  // -------------------------------------------------------------------------
  /**
   * Refresh tokens are single-use (rotated + blacklisted). Parallel loads (several tabs, a reload
   * while another tab refreshes) all present the same cookie: the API answers the losers with the
   * pair it already issued (120 s grace) and sets the same cookie, so rotation is server-driven.
   * Here:
   *  - in the browser, one refresh at a time (callers share the request);
   *  - after a rejection, ask once more: the browser then sends whatever cookie a sibling tab may
   *    have just received;
   *  - never sign out during SSR or on a network error. Only a second definite rejection does.
   */
  const refreshAccessToken = async (): Promise<boolean> => {
    // The server never rotates: SSR renders no private data, and a server-side rotation
    // races the browser's own refresh. The browser does the one refresh per load.
    if (import.meta.server) return false
    if (clientRefreshInflight) return clientRefreshInflight
    const run = async (): Promise<boolean> => {
      let legacy = legacyRefreshCookie()
      if (!legacy && !hasSessionHint()) return false        // never signed in here: no request
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const data = await authFetch<{ access: string }>('/api/auth/token/refresh/',
            legacy ? { refresh: legacy } : {})
          accessToken.value = data.access
          setSessionHint()
          dropLegacyRefreshCookie()
          return true
        } catch (e: unknown) {
          if (!httpStatusOf(e)) return false                          // network error: keep the session
          if (legacy) { dropLegacyRefreshCookie(); legacy = null }    // migrated by another tab, or dead
          if (attempt === 0) await new Promise(res => setTimeout(res, 200))
        }
      }
      _clearTokens()                                                  // rejected twice: expired or revoked
      return false
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
      _adoptStorageUser(user, false)     // app boot (plugins/tracking.client.ts): stores not hydrated yet
      return user
    } catch {
      _clearTokens()
      return null
    }
  }

  // -------------------------------------------------------------------------
  // Logout — revoke the refresh cookie on the server, clear this device
  // -------------------------------------------------------------------------
  /**
   * Always: the server revokes the refresh token and clears its cookie; this tab forgets the access
   * token, the active-user pointer and the unscoped local copies, then reloads /auth so no store keeps
   * the signed-out user's data in memory. The user's own namespaced data stays for their next sign-in
   * and is invisible to any other account (S13).
   * `forgetDevice: true` also removes every account's local data on this browser and the remembered
   * demo id (S6): "Continue my demo" then starts a new demo.
   */
  const logout = async (opts: { forgetDevice?: boolean } = {}) => {
    const demoFlag = useCookie('strades_demo')
    const legacy = legacyRefreshCookie()
    try {
      // No access token needed: the cookie (or a legacy body token) is the credential.
      await authFetch('/api/auth/logout/', legacy ? { refresh: legacy } : {})
    } catch {
      // Proceed with local clear even if server call fails
    }
    dropLegacyRefreshCookie()
    _clearTokens()
    demoFlag.value = null
    try {
      usePriceCache().clearAll()
    } catch { /* ignore */ }
    try { useTracking().stopHeartbeat() } catch { /* ignore */ }
    clearUserStorage({ forgetDevice: !!opts.forgetDevice })
    if (opts.forgetDevice) forgetDemoCode()
    if (import.meta.client) reloadNuxtApp({ path: '/auth', force: true })
    else await navigateTo('/auth')
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
   * Demo: the backend mints a real account per visitor (unusable password, rate-limited) and returns
   * the same shape as login plus a demo id (`demo.code`, shown once). The id is remembered on this
   * device so "Continue my demo" works after a logout; typed on another device it resumes the same
   * account. The account lives while it is used and is deleted after 30 days without a visit.
   */
  const startDemo = async () => {
    const data = await authFetch<DemoResponse>('/api/auth/demo/')
    _storeTokens(data)
    if (data.demo?.code) rememberDemoCode(data.demo.code)
    nextTick(() => useTracking().startSession())
    return data
  }

  const resumeDemo = async (code: string) => {
    const data = await authFetch<DemoResponse>('/api/auth/demo/resume/', { code: code.trim() })
    _storeTokens(data)
    rememberDemoCode(code.trim().toUpperCase())
    nextTick(() => useTracking().startSession())
    return data
  }

  /**
   * Make sure this visitor has a REAL demo account: resume the one remembered on this device, else mint
   * one. Retries when the server does not answer (in development the API restarts on every code change;
   * one failed request used to drop visitors into the sample-data mode, where the profile mirror,
   * wallets and bots have no account behind them). Clears the sample-data flag on success.
   */
  const activateDemo = async (attempts = 3): Promise<DemoResponse> => {
    const demoFlag = useCookie('strades_demo')
    let last: unknown
    for (let i = 0; i < attempts; i++) {
      try {
        const saved = storedDemoCode()
        if (saved) {
          try {
            const d = await resumeDemo(saved)
            demoFlag.value = null
            return d
          } catch (e: unknown) {
            if (httpStatusOf(e) !== 404) throw e
            forgetDemoCode()             // deleted after 30 idle days, or claimed: start a fresh one
          }
        }
        const d = await startDemo()
        demoFlag.value = null
        return d
      } catch (e: unknown) {
        last = e
        const s = httpStatusOf(e)
        if (s && ![502, 503, 504].includes(s)) throw e      // a real answer (429, 4xx): retrying won't help
        await new Promise(res => setTimeout(res, 700 * (i + 1)))
      }
    }
    throw last
  }

  /** A fresh demo id for the signed-in demo account (the previous id stops working). */
  const newDemoCode = async (): Promise<string> => {
    if (!accessToken.value) await refreshAccessToken()
    const data = await $fetch<{ demo: DemoMeta }>('/api/auth/demo/code/', {
      baseURL: apiBase, method: 'POST', headers: { Authorization: `Bearer ${accessToken.value}` },
    })
    if (data.demo.code) rememberDemoCode(data.demo.code)
    return data.demo.code ?? ''
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
    resumeDemo,
    activateDemo,
    newDemoCode,
    loginWithGoogle,
    logout,
    fetchUser,
    refreshAccessToken,
    updateProfile,
  }
}
