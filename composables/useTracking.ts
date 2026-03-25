/**
 * useTracking — User telemetry composable
 *
 * Sends to Django backend:
 *  - Session start (on first authenticated page load)
 *  - Heartbeat every 30s
 *  - Activity logs (page views, user actions)
 *
 * Collected data: device info, screen size, page path, action type
 * Privacy: only fires when user is authenticated
 */

export type ActivityAction =
  | 'page_view' | 'login' | 'logout' | 'register' | 'search'
  | 'strategy_create' | 'strategy_deploy' | 'strategy_backtest' | 'trade_execute'
  | 'wallet_create' | 'prediction_create' | 'friend_request' | 'friend_accept'
  | 'post_create' | 'message_send' | 'asset_view' | 'settings_change' | 'api_call'

interface TrackingState {
  sessionId: string | null
  heartbeatTimer: ReturnType<typeof setInterval> | null
}

const state: TrackingState = { sessionId: null, heartbeatTimer: null }

export const useTracking = () => {
  const { accessToken, isAuthenticated } = useAuth()
  const config = useRuntimeConfig()
  const apiBase = config.public.apiBase as string

  const _headers = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken.value}`,
  })

  // ---- Start session (called once after login / on app boot if authenticated) ----
  const startSession = async () => {
    if (!isAuthenticated.value) return
    try {
      const data = await $fetch<{ session_id: string }>('/api/auth/tracking/session/', {
        baseURL: apiBase,
        method: 'POST',
        headers: _headers(),
        body: {
          screen_width: window?.screen?.width,
          screen_height: window?.screen?.height,
        },
      })
      state.sessionId = data.session_id
      _startHeartbeat()
    } catch (e) {
      // Non-critical — silently ignore
    }
  }

  // ---- Heartbeat — keeps session alive ----
  const _startHeartbeat = () => {
    if (state.heartbeatTimer) return
    state.heartbeatTimer = setInterval(async () => {
      if (!isAuthenticated.value || !state.sessionId) return
      try {
        await $fetch('/api/auth/tracking/heartbeat/', {
          baseURL: apiBase,
          method: 'POST',
          headers: _headers(),
          body: { session_id: state.sessionId },
        })
      } catch {}
    }, 30_000)
  }

  const stopHeartbeat = () => {
    if (state.heartbeatTimer) {
      clearInterval(state.heartbeatTimer)
      state.heartbeatTimer = null
    }
  }

  // ---- Log a specific action ----
  const track = async (
    action: ActivityAction,
    options: { page?: string; payload?: Record<string, unknown>; duration_ms?: number } = {}
  ) => {
    if (!isAuthenticated.value) return
    try {
      await $fetch('/api/auth/tracking/activity/', {
        baseURL: apiBase,
        method: 'POST',
        headers: _headers(),
        body: {
          action,
          page: options.page ?? (import.meta.client ? window.location.pathname : ''),
          payload: options.payload ?? {},
          duration_ms: options.duration_ms,
          session_id: state.sessionId,
        },
      })
    } catch {}
  }

  return { startSession, stopHeartbeat, track, sessionId: computed(() => state.sessionId) }
}
