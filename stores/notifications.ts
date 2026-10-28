/**
 * Notifications store — one feed for the whole app (badge, /notifications page, calendar).
 *
 * Sources, merged by `key` (types/notification.ts), server rows winning:
 *   server   GET /api/v1/notifications/ (signed in): predictions due/scored, bots, friends' calls…
 *   browser  derived from data this device already holds (utils/notifications.ts): your calls,
 *            paper trades, price alerts, bots, avatar training — so demo mode and offline work too.
 *
 * Read state (seen) is separate from opened (clicked):
 *   read_at     set when the row has been shown on /notifications. Clears the nav badge.
 *   opened_at   set only when the user clicks the row. Kept on this device for every row.
 *   server rows their own `state.read_at` is the truth; changes are POSTed (read/ unread/ archive/).
 *               `opened: true` on that POST is the engagement signal, and only a click sends it.
 *   browser     localStorage (`strades:notifications:v2:<user>`): read, opened and archived maps,
 *               entries older than 180 days dropped (never evicted by count, so marking seen
 *               cannot resurrect rows).
 * Opening a notification marks it read and opened, sends a `notification_open` event, and returns
 * the in-app location to navigate to.
 * Switching account (or signing out) resets the store, so one user never sees another's rows.
 */
import { defineStore } from 'pinia'
import { watch } from 'vue'
import type { AppNotification, NotificationDomain, NotificationPage } from '~/types/notification'
import {
  deriveClosing, deriveFromBots, deriveFromPaper, deriveFromPredictions, deriveFromTraining, deriveFromTriggers,
  mergeNotifications, notificationLocation,
} from '~/utils/notifications'
import { indexLivePrices } from '~/utils/priceApproach'
import { usePredictionsStore } from '~/stores/predictions'
import { usePaperStore } from '~/stores/paper'
import { useAssetAnnotationsStore } from '~/stores/assetAnnotations'
import { useBotsStore } from '~/stores/bots'
import { useTrainingStore } from '~/stores/training'
import { useAgentsStore } from '~/stores/agents'
import { useAssetsStore } from '~/stores/assets'

const STORE_PREFIX = 'strades:notifications:v2:'
const KEEP_MS = 180 * 24 * 3_600_000
const POLL_MS = 60_000
const MIN_REFRESH_MS = 15_000
const PAGE = 50
const SERVER_CAP = 300
/** The predictions store files the user's own calls under this id, whoever is signed in. */
const LOCAL_OWNER = 'current_user'

interface LocalState { read: Record<string, string>; opened: Record<string, string>; archived: Record<string, string> }

interface NotificationsState {
  server: AppNotification[]
  serverUnread: number
  nextBefore: string | null
  local: LocalState
  userKey: string
  now: number
  loading: boolean
  error: string | null
  lastFetch: number
  initialized: boolean
}

function loadLocal(userKey: string): LocalState {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_PREFIX + userKey) || '{}')
    return { read: raw.read ?? {}, opened: raw.opened ?? {}, archived: raw.archived ?? {} }
  } catch { return { read: {}, archived: {} } }
}
function saveLocal(userKey: string, s: LocalState) {
  const cut = new Date(Date.now() - KEEP_MS).toISOString()
  const fresh = (m: Record<string, string>) => Object.fromEntries(Object.entries(m).filter(([, at]) => at >= cut))
  try { localStorage.setItem(STORE_PREFIX + userKey, JSON.stringify({ read: fresh(s.read), opened: fresh(s.opened), archived: fresh(s.archived) })) } catch { /* quota */ }
}

let pollTimer: ReturnType<typeof setInterval> | null = null
let clockTimer: ReturnType<typeof setInterval> | null = null
let onFocus: (() => void) | null = null
let stopUserWatch: (() => void) | null = null

export const useNotificationsStore = defineStore('notifications', {
  state: (): NotificationsState => ({
    server: [], serverUnread: 0, nextBefore: null, local: { read: {}, opened: {}, archived: {} }, userKey: 'anon',
    now: 0, loading: false, error: null, lastFetch: 0, initialized: false,
  }),

  getters: {
    /** Notifications this browser can prove from its own data (last 30 days). */
    derived(state): AppNotification[] {
      if (!state.initialized) return []
      const now = state.now
      const { userId, isDemo } = useCurrentUser()
      const names: Record<string, string> = {}
      for (const a of Object.values(useAgentsStore().byId ?? {})) names[a.id] = a.name
      const { prices, symbols } = indexLivePrices(useAssetsStore().assets ?? [])
      const triggers = Object.values(useAssetAnnotationsStore().triggersById ?? {}) as any
      return [
        ...deriveFromPredictions(usePredictionsStore().predictions as any, now, LOCAL_OWNER),
        ...deriveClosing(usePredictionsStore().predictions as any, triggers, prices, now, LOCAL_OWNER, symbols),
        ...deriveFromPaper(usePaperStore().trades as any, LOCAL_OWNER, names, now),
        ...deriveFromTriggers(triggers, LOCAL_OWNER, symbols, now),
        // The bundled bots are sample data: labelled "Demo" in demo mode, otherwise only the user's own.
        ...deriveFromBots(useBotsStore().list as any, now, userId.value, { demo: isDemo.value }),
        ...deriveFromTraining((useTrainingStore().recentDeltas ?? []) as any, names, LOCAL_OWNER),
      ]
    },
    items(state): AppNotification[] {
      const readKeys: Record<string, string> = { ...state.local.read }
      for (const [k, at] of Object.entries(state.local.opened)) readKeys[`opened:${k}`] = at
      for (const [k, at] of Object.entries(state.local.archived)) readKeys[`archived:${k}`] = at
      return mergeNotifications(state.server, (this as any).derived as AppNotification[], readKeys, state.now || Date.now())
    },
    unreadCount(): number {
      return ((this as any).items as AppNotification[]).filter(n => !n.state.read_at).length
    },
    byDomain() {
      return (d: NotificationDomain) => ((this as any).items as AppNotification[]).filter(n => n.domain === d)
    },
    hasMore: state => !!state.nextBefore,
  },

  actions: {
    /** Client only. Hydrates the source stores, loads read state, fetches the server feed, starts polling. */
    init() {
      if (this.initialized || !import.meta.client) return
      const { userId } = useCurrentUser()
      this.userKey = userId.value || 'anon'
      this.local = loadLocal(this.userKey)
      this.now = Date.now()
      const preds = usePredictionsStore()
      if (!preds.initialized) preds.init()
      try { usePaperStore().hydrate() } catch { /* optional source */ }
      try { (useAssetAnnotationsStore() as any).hydrateFromStorage?.() } catch { /* optional source */ }
      try { void useBotsStore().fetchBots() } catch { /* optional source */ }
      this.initialized = true
      void this.refresh()
      clockTimer = setInterval(() => { this.now = Date.now() }, 30_000)
      pollTimer = setInterval(() => {
        if (document.visibilityState === 'visible') void this.refresh({ incremental: true })
      }, POLL_MS)
      onFocus = () => { void this.refresh({ incremental: true }) }
      window.addEventListener('focus', onFocus)
      // Account switch / sign-out: never keep another user's rows or read state.
      stopUserWatch = watch(userId, (id) => {
        if ((id || 'anon') === this.userKey) return
        this.stop()
        this.$reset()
        this.init()
      })
    },

    stop() {
      if (pollTimer) clearInterval(pollTimer)
      if (clockTimer) clearInterval(clockTimer)
      if (onFocus) window.removeEventListener('focus', onFocus)
      stopUserWatch?.()
      pollTimer = clockTimer = null
      onFocus = null
      stopUserWatch = null
      this.initialized = false
    },

    _api<T>(path: string, opts: Record<string, any> = {}): Promise<T> | null {
      const { isAuthenticated, accessToken } = useAuth()
      if (!isAuthenticated.value) return null
      // Plain fetch typing (not Nitro's route-typed overload), as in composables/useLocalJson.ts.
      return ($fetch as (u: string, o: Record<string, any>) => Promise<T>)(path, {
        baseURL: useRuntimeConfig().public.apiBase as string, ...opts,
        headers: { Authorization: `Bearer ${accessToken.value}`, ...(opts.headers ?? {}) },
      })
    },

    /** Replace held copies by key (a row updated or read elsewhere shows its new state). */
    _upsert(rows: AppNotification[], cap = SERVER_CAP) {
      const byKey = new Map(this.server.map(n => [n.key, n]))
      for (const r of rows) byKey.set(r.key, r)
      this.server = [...byKey.values()]
        .sort((a, b) => Date.parse(b.when.occurred_at) - Date.parse(a.when.occurred_at))
        .slice(0, cap)
    },

    /**
     * Full first page, or (`incremental`) every row created or updated since the last fetch: the
     * server matches `after` on occurred_at OR created_at, so back-dated rows (a deadline row is
     * dated target − 24 h) still arrive. Pages until a short page, at most 4.
     */
    async refresh(opts: { incremental?: boolean } = {}) {
      this.now = Date.now()
      if (this.loading) return
      if (opts.incremental && Date.now() - this.lastFetch < MIN_REFRESH_MS) return
      const { isAuthenticated } = useAuth()
      if (!isAuthenticated.value) return                    // signed out: browser rows only
      const since = this.lastFetch ? new Date(this.lastFetch - 5_000).toISOString() : null
      this.loading = true
      const started = Date.now()
      try {
        if (opts.incremental && since) {
          let before: string | null = null
          for (let i = 0; i < 4; i++) {
            const query: Record<string, string | number> = { limit: PAGE, after: since }
            if (before) query.before = before
            const page = await this._api<NotificationPage>('/api/v1/notifications/', { query })!
            this._upsert(page.results)
            this.serverUnread = page.unread
            if (page.results.length < PAGE || !page.next_before) break
            before = page.next_before
          }
        } else {
          const page = await this._api<NotificationPage>('/api/v1/notifications/', { query: { limit: PAGE } })!
          this.server = []
          this._upsert(page.results)
          this.nextBefore = page.next_before
          this.serverUnread = page.unread
        }
        this.error = null
        this.lastFetch = started
      } catch (e: any) {
        const code = e?.statusCode ?? e?.response?.status
        this.error = code === 401 ? 'Sign in again to see your server notifications.'
          : code === 404 ? null
            : 'Notifications server unreachable — showing what this device knows.'
      } finally {
        this.loading = false
      }
    },

    async loadMore() {
      if (!this.nextBefore || this.loading) return
      const req = this._api<NotificationPage>('/api/v1/notifications/', { query: { limit: PAGE, before: this.nextBefore } })
      if (!req) return
      this.loading = true
      try {
        const page = await req
        this._upsert(page.results, this.server.length + page.results.length)
        this.nextBefore = page.next_before
      } catch { /* keep what we have */ } finally { this.loading = false }
    },

    /**
     * Mark seen (`read_at`). `opened` is true only when the user clicked the row:
     * that writes `opened_at` and tells the server the engagement signal.
     */
    markRead(keys: string[], opened = false) {
      if (!keys.length) return
      const at = new Date().toISOString()
      const serverKeys: string[] = []
      for (const k of keys) {
        if (opened) this.local.opened[k] = this.local.opened[k] ?? at
        const s = this.server.find(n => n.key === k)
        if (s) {
          if (!s.state.read_at) { s.state.read_at = at; this.serverUnread = Math.max(0, this.serverUnread - 1) }
          serverKeys.push(k)
        } else {
          this.local.read[k] = this.local.read[k] ?? at
        }
      }
      saveLocal(this.userKey, this.local)
      if (serverKeys.length) {
        void this._api<{ unread: number }>('/api/v1/notifications/read/', { method: 'POST', body: { keys: serverKeys.slice(0, 200), opened } })
          ?.then((r) => { if (typeof r?.unread === 'number') this.serverUnread = r.unread })
          .catch(() => {})
      }
    },

    markUnread(key: string) {
      delete this.local.read[key]
      saveLocal(this.userKey, this.local)
      const s = this.server.find(n => n.key === key)
      if (s) {
        s.state.read_at = null
        this.serverUnread++
        void this._api('/api/v1/notifications/unread/', { method: 'POST', body: { keys: [key] } })?.catch(() => {})
      }
    },

    /** One request for server rows (all, or one domain), the local map for browser rows. */
    markAllRead(domain?: NotificationDomain) {
      const at = new Date().toISOString()
      for (const n of this.items as AppNotification[]) {
        if (n.state.read_at || (domain && n.domain !== domain)) continue
        const s = this.server.find(x => x.key === n.key)
        if (s) s.state.read_at = at
        else this.local.read[n.key] = at
      }
      saveLocal(this.userKey, this.local)
      void this._api<{ unread: number }>('/api/v1/notifications/read/', { method: 'POST', body: { all: true, domain: domain ?? null } })
        ?.then((r) => { if (typeof r?.unread === 'number') this.serverUnread = r.unread })
        .catch(() => {})
    },

    archive(key: string) {
      const at = new Date().toISOString()
      const s = this.server.find(n => n.key === key)
      if (s) {
        s.state.archived_at = at
        void this._api('/api/v1/notifications/archive/', { method: 'POST', body: { keys: [key] } })?.catch(() => {})
      } else {
        this.local.archived[key] = at
        saveLocal(this.userKey, this.local)
      }
    },

    /** Mark read + opened, record the open for the trading profile, and return where to navigate. */
    open(n: AppNotification, ctx: { surface?: 'page' | 'calendar' | 'badge'; rank?: number; listLen?: number } = {}) {
      const wasUnread = !n.state.read_at
      this.markRead([n.key], true)
      try {
        useTracking().track('notification_open', {
          payload: {
            key: n.key, domain: n.domain, event: n.event, priority: n.priority, origin: n.from.origin,
            was_unread: wasUnread, age_ms: Math.max(0, Date.now() - Date.parse(n.when.occurred_at)),
            surface: ctx.surface ?? 'page', rank: ctx.rank, list_len: ctx.listLen,
          },
        })
      } catch { /* telemetry is optional */ }
      return notificationLocation(n)
    },
  },
})
