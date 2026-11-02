/**
 * useTracking — user telemetry to the Django backend (only when authenticated).
 *
 *  - Session start once per boot, heartbeat every 30 s while the tab is visible.
 *  - Events are QUEUED and sent in batches to POST /api/auth/tracking/batch/:
 *    every 10 s, as soon as 25 events wait, and when the tab is hidden / closed
 *    (fetch keepalive). One request per batch instead of one per click.
 *  - High-frequency interactions (hover, dwell, route ticks) are counted in the
 *    browser and sent as ONE `interaction_summary` per flush.
 *  - Bounded: at most 200 queued events (oldest dropped and counted), payloads
 *    trimmed client-side; the server re-validates everything
 *    (Strades-backend docs/data-pipeline.md).
 *
 * The public API keeps startSession(), stopHeartbeat(), track(), sessionId and
 * adds trackInteraction() and flush().
 *
 * Consent gate (Settings › Account): with "Help train my avatar" off nothing is sent.
 * Partial batches: the server keeps the valid events and returns `{accepted, rejected}`;
 * the rejected count is kept in `rejectedTotal` (one bad type no longer costs the batch).
 */
import { userGet, userSet } from '~/utils/userStorage'

export type ActivityAction =
  | 'page_view' | 'login' | 'logout' | 'register' | 'search'
  | 'strategy_create' | 'strategy_deploy' | 'strategy_backtest' | 'trade_execute'
  | 'wallet_create' | 'prediction_create' | 'friend_request' | 'friend_accept'
  | 'post_create' | 'message_send' | 'asset_view' | 'settings_change' | 'api_call'
  | 'interaction' | 'interaction_summary' | 'notification_open'

interface QueuedEvent {
  action: ActivityAction
  page: string
  payload: Record<string, unknown>
  duration_ms?: number
  ts: number
}

const BATCH_MAX = 25            // the server accepts up to 50
const QUEUE_MAX = 200
const FLUSH_MS = 10_000
const MAX_BACKOFF_MS = 120_000
const PAYLOAD_MAX_CHARS = 1800  // the server cap is 2 KB after encoding

/** Interaction types that fire continuously: counted, never sent one by one. */
const COALESCED = new Set(['asset_hover', 'article_dwell', 'page_route'])

interface TrackingState {
  sessionId: string | null
  heartbeatTimer: ReturnType<typeof setInterval> | null
  flushTimer: ReturnType<typeof setTimeout> | null
  queue: QueuedEvent[]
  counters: Record<string, number>
  dropped: number
  inFlight: boolean
  backoffMs: number
  listeners: boolean
  rejectedTotal: number
  lastRejectReasons: string[]
}

// ---- Consent: "Help train my avatar from my activity" (Settings › Account) ----
// No server preference endpoint exists for it yet, so it is kept per user in this browser
// (utils/userStorage.ts namespaces it by account). Default ON in the closed beta; OFF = this
// composable sends nothing at all (no session, no heartbeat, no batch) and drops what is queued.
export const TRACKING_CONSENT_KEY = 'strades_train_avatar_v1'

type ConsentKV = Parameters<typeof userGet>[1]

/** True unless the user switched training off on this device. */
export function trackingConsentOn(s?: ConsentKV): boolean {
  return userGet(TRACKING_CONSENT_KEY, s) !== '0'
}

export function writeTrackingConsent(on: boolean, s?: ConsentKV): void {
  try { userSet(TRACKING_CONSENT_KEY, on ? '1' : '0', s) } catch { /* storage full or blocked */ }
}

/** The single gate every send path goes through (pure, tested in tests/avatar-tracking.test.ts). */
export function trackingAllowed(o: { client: boolean; authed: boolean; consent: boolean }): boolean {
  return o.client && o.authed && o.consent
}

/** Server answer of POST tracking/batch/: `{accepted, rejected:[{index, reason}]}` (older servers: no `rejected`). */
export function batchOutcome(res: unknown): { accepted: number; rejected: number; reasons: string[] } {
  const r = (res && typeof res === 'object' ? res : {}) as { accepted?: unknown; rejected?: unknown }
  const rows = Array.isArray(r.rejected) ? r.rejected as { reason?: unknown }[] : []
  return {
    accepted: typeof r.accepted === 'number' && Number.isFinite(r.accepted) ? r.accepted : 0,
    rejected: rows.length,
    reasons: rows.map(x => String(x?.reason ?? '')).filter(Boolean).slice(0, 5),
  }
}

// Module scope is safe here only because every entry point returns early on the server:
// this state is never touched during SSR, so it is never shared between requests.
const state: TrackingState = {
  sessionId: null, heartbeatTimer: null, flushTimer: null, queue: [], counters: {},
  dropped: 0, inFlight: false, backoffMs: 0, listeners: false, rejectedTotal: 0, lastRejectReasons: [],
}

/** Payload as plain JSON within the size budget (bulky fields dropped, scalars kept). */
export function trimPayload(p: Record<string, unknown> | undefined, max = PAYLOAD_MAX_CHARS): Record<string, unknown> {
  if (!p) return {}
  try {
    const s = JSON.stringify(p)
    if (s.length <= max) return JSON.parse(s)
    const out: Record<string, unknown> = { _trimmed: true }
    for (const [k, v] of Object.entries(p)) {
      if (v === null || typeof v === 'number' || typeof v === 'boolean') out[k] = v
      else if (typeof v === 'string') out[k] = v.slice(0, 120)
    }
    return out
  } catch {
    return { _unserialisable: true }
  }
}

export const useTracking = () => {
  const { accessToken, isAuthenticated } = useAuth()
  const config = useRuntimeConfig()
  const apiBase = config.public.apiBase as string
  const _allowed = () => trackingAllowed({
    client: !!import.meta.client, authed: isAuthenticated.value, consent: import.meta.client ? trackingConsentOn() : false,
  })

  const _headers = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken.value}`,
  })

  // ---- Queue ----
  const _takeBatch = (): QueuedEvent[] => {
    const batch = state.queue.splice(0, BATCH_MAX)
    if ((Object.keys(state.counters).length || state.dropped) && batch.length < BATCH_MAX) {
      const payload: Record<string, unknown> = { ...state.counters }
      if (state.dropped) payload.dropped = state.dropped
      batch.push({ action: 'interaction_summary', page: window.location.pathname.slice(0, 255), payload, ts: Date.now() })
      state.counters = {}
      state.dropped = 0
    }
    return batch
  }

  const _schedule = (ms = FLUSH_MS) => {
    if (!import.meta.client || state.flushTimer) return
    state.flushTimer = setTimeout(() => { state.flushTimer = null; void flush() }, ms)
  }

  const _requeue = (batch: QueuedEvent[]) => {
    state.queue.unshift(...batch.filter(e => e.action !== 'interaction_summary'))
    if (state.queue.length > QUEUE_MAX) {
      state.dropped += state.queue.length - QUEUE_MAX
      state.queue.splice(0, state.queue.length - QUEUE_MAX)
    }
  }

  /**
   * A 401 on telemetry: the access token expired (these calls bypass the $api refresh plugin). Refresh once;
   * if the session is really gone, stop the timers so a dead tab stops hammering the API (the swarm audit
   * measured 76 % of all backend requests as 401s from such tabs, ~540 an hour).
   */
  const _onUnauthorized = async () => {
    const ok = await useAuth().refreshAccessToken().catch(() => false)
    if (!ok) {
      stopHeartbeat()
      state.sessionId = null
    }
  }

  /** Send queued events now. `beacon` = the page is going away: keepalive fetch, no retry. */
  const flush = async (beacon = false): Promise<void> => {
    if (!_allowed() || state.inFlight) return
    if (!state.queue.length && !Object.keys(state.counters).length && !state.dropped) return
    const batch = _takeBatch()
    if (!batch.length) return
    const body = { session_id: state.sessionId, events: batch }
    if (beacon) {
      try {
        void fetch(`${apiBase}/api/auth/tracking/batch/`, {
          method: 'POST', headers: _headers(), body: JSON.stringify(body), keepalive: true,
        }).catch(() => {})
      } catch { /* the page is closing */ }
      return
    }
    state.inFlight = true
    try {
      const res = await $fetch('/api/auth/tracking/batch/', { baseURL: apiBase, method: 'POST', headers: _headers(), body })
      const out = batchOutcome(res)
      if (out.rejected) {
        state.rejectedTotal += out.rejected
        state.lastRejectReasons = out.reasons
      }
      state.backoffMs = 0
    } catch (e: any) {
      const code = e?.response?.status ?? e?.statusCode
      if (code === 401) await _onUnauthorized()
      if (code !== 400) {
        // offline, 401 during a refresh, 429, 5xx: keep the events and back off
        _requeue(batch)
        state.backoffMs = Math.min(MAX_BACKOFF_MS, state.backoffMs ? state.backoffMs * 2 : FLUSH_MS * 2)
      }
      // 400 = a bad envelope or every event invalid: a retry would fail forever, so they are dropped
      if (code === 400) {
        const out = batchOutcome(e?.data ?? e?.response?._data)
        state.rejectedTotal += out.rejected || batch.length
        state.lastRejectReasons = out.reasons
      }
    } finally {
      state.inFlight = false
    }
    if (state.queue.length >= BATCH_MAX && !state.backoffMs) void flush()
    else if (state.queue.length || Object.keys(state.counters).length) _schedule(state.backoffMs || FLUSH_MS)
  }

  const _bindPageLifecycle = () => {
    if (!import.meta.client || state.listeners) return
    state.listeners = true
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') void flush(true)
    })
    window.addEventListener('pagehide', () => { void flush(true) })
  }

  const _enqueue = (e: QueuedEvent) => {
    state.queue.push(e)
    if (state.queue.length > QUEUE_MAX) {
      state.queue.shift()
      state.dropped++
    }
    _bindPageLifecycle()
    if (state.queue.length >= BATCH_MAX && !state.backoffMs) void flush()
    else _schedule()
  }

  // ---- Start session (called once after login / on app boot if authenticated) ----
  const startSession = async () => {
    if (!_allowed() || state.sessionId) return
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
      _bindPageLifecycle()
    } catch {
      // Non-critical — telemetry never blocks the app
    }
  }

  // ---- Heartbeat — keeps the session alive; skipped while the tab is hidden ----
  const _startHeartbeat = () => {
    if (state.heartbeatTimer) return
    state.heartbeatTimer = setInterval(async () => {
      if (!_allowed() || !state.sessionId || document.visibilityState === 'hidden') return
      try {
        await $fetch('/api/auth/tracking/heartbeat/', {
          baseURL: apiBase,
          method: 'POST',
          headers: _headers(),
          body: { session_id: state.sessionId },
        })
      } catch (e: any) {
        if ((e?.response?.status ?? e?.statusCode) === 401) await _onUnauthorized()
      }
    }, 30_000)
  }

  const stopHeartbeat = () => {
    if (state.heartbeatTimer) {
      clearInterval(state.heartbeatTimer)
      state.heartbeatTimer = null
    }
    void flush(true)
  }

  // ---- Log a specific action (queued, sent in batches) ----
  const track = async (
    action: ActivityAction,
    options: { page?: string; payload?: Record<string, unknown>; duration_ms?: number } = {}
  ) => {
    if (!_allowed()) return
    const d = options.duration_ms
    _enqueue({
      action,
      page: (options.page ?? window.location.pathname).slice(0, 255),
      payload: trimPayload(options.payload),
      duration_ms: typeof d === 'number' && Number.isFinite(d) && d >= 0 ? Math.min(Math.round(d), 86_400_000) : undefined,
      ts: Date.now(),
    })
  }

  /**
   * A training-buffer event (stores/training.ts TrainingEventType). Continuous ones are counted
   * locally and sent once per flush; deliberate ones are queued as `interaction` with payload.type.
   */
  const trackInteraction = (type: string, payload: Record<string, unknown> = {}) => {
    if (!_allowed()) return
    if (COALESCED.has(type)) {
      state.counters[type] = (state.counters[type] ?? 0) + 1
      const ms = Number(payload.dwell_ms)
      if (Number.isFinite(ms) && ms > 0) state.counters[`${type}_ms`] = (state.counters[`${type}_ms`] ?? 0) + Math.round(ms)
      _bindPageLifecycle()
      _schedule()
      return
    }
    void track('interaction', { payload: { ...payload, type } })
  }

  /** Settings › Account switch. Off: drop the queue and counters, stop the heartbeat, send nothing more. */
  const setConsent = (on: boolean) => {
    if (!import.meta.client) return
    writeTrackingConsent(on)
    if (!on) {
      state.queue = []
      state.counters = {}
      state.dropped = 0
      if (state.flushTimer) { clearTimeout(state.flushTimer); state.flushTimer = null }
      if (state.heartbeatTimer) { clearInterval(state.heartbeatTimer); state.heartbeatTimer = null }
      state.sessionId = null
    } else {
      void startSession()
    }
  }

  return {
    startSession, stopHeartbeat, track, trackInteraction, flush, setConsent,
    sessionId: computed(() => state.sessionId),
    rejectedTotal: computed(() => state.rejectedTotal),
  }
}
