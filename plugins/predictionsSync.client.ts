/**
 * predictionsSync — keeps the user's price calls on the server (Strades-backend /api/v1/predictions/).
 *
 * The predictions store stays the UI's source (instant, works offline, localStorage). This plugin:
 *  - PULLS the user's calls once signed in: resolution results (status, resolved price, score)
 *    are written back onto the local calls; calls made on another device are imported. At most
 *    one pull per 5 min per account, remembered across reloads (`strades:predictions:pull:v1`);
 *    after the first one it asks only for rows changed since (`updated_since`).
 *  - PUSHES new or moved pending calls in batches of up to 50 (POST /predictions/sync/), 1.5 s
 *    after the last change. Idempotent on the local id (`client_id`), so a retry never duplicates.
 *  - WITHDRAWS on the server a pending call deleted locally (DELETE, the server keeps it as
 *    "withdrawn" for the trading profile).
 *  - Remembers what was sent in localStorage (`strades:predictions:sync:v1`) so an unchanged call is
 *    never resent and a call the server rejected (e.g. unknown asset) is not retried until it changes.
 *
 * Demo persona calls (`demo: true`) and other users' calls are never sent. Signed out = no-op.
 */
import { watch } from 'vue'
import { usePredictionsStore, type Prediction } from '~/stores/predictions'
import {
  isPredictionSyncable, predictionFromApi, predictionSyncSignature as signature, predictionToApi,
  type ServerPrediction as ServerCall,
} from '~/utils/predictionSync'
import { predictionPullDue, predictionPullSince, type PullMark } from '~/utils/requestGate'

const SYNC_KEY = 'strades:predictions:sync:v1'
/** When/for whom the last pull ran. Persisted, so a page reload no longer re-pulls 200 rows (O4). */
const PULL_KEY = 'strades:predictions:pull:v1'
const BATCH = 50
const DEBOUNCE_MS = 1500
/** Resolution results arrive with the server's upkeep run; a pull more often than this finds nothing new. */
const PULL_EVERY_MS = 5 * 60_000

interface SyncEntry { sid?: string; sig: string; err?: string; pending?: boolean }
type SyncMap = Record<string, SyncEntry>

function readMap(): SyncMap {
  try { return JSON.parse(localStorage.getItem(SYNC_KEY) || '{}') } catch { return {} }
}
function writeMap(m: SyncMap) {
  try { localStorage.setItem(SYNC_KEY, JSON.stringify(m)) } catch { /* quota: next run resends, idempotent */ }
}
function readMark(): PullMark | null {
  try {
    const m = JSON.parse(localStorage.getItem(PULL_KEY) || 'null')
    return m && typeof m.at === 'number' ? m as PullMark : null
  } catch { return null }
}
function writeMark(m: PullMark | null) {
  try {
    if (m) localStorage.setItem(PULL_KEY, JSON.stringify(m))
    else localStorage.removeItem(PULL_KEY)
  } catch { /* quota: the next boot pulls again */ }
}

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook('app:mounted', () => {
    const { isAuthenticated, user } = useAuth()
    const store = usePredictionsStore()
    if (!store.initialized) store.init()
    const uid = () => String(user.value?.id ?? '')

    // Through $api (plugins/api.ts): a 401 refreshes the token once and retries, so an expired tab
    // no longer polls 401 every minute (board-perf PERF-5).
    const $api = nuxtApp.$api as (u: string, o?: Record<string, any>) => Promise<unknown>
    const api = <T>(path: string, opts: Record<string, any> = {}) => $api(path, opts) as Promise<T>

    let busy = false
    let timer: ReturnType<typeof setTimeout> | null = null

    /**
     * Full pull the first time (per account), then incremental: `updated_since` asks only for rows
     * changed since the last pull. A backend that ignores the parameter answers with the latest 200,
     * which this merge handles the same way.
     */
    async function pull() {
      const since = predictionPullSince(readMark(), uid())
      const res = await api<{ results: ServerCall[] }>('/api/v1/predictions/', {
        query: { limit: 200, ...(since ? { updated_since: since } : {}) },
      })
      const map = readMap()
      const local = new Map(store.predictions.map(p => [p.id, p]))
      const imports: Prediction[] = []
      for (const c of res.results ?? []) {
        const mine = local.get(c.client_id)
        if (!mine) {
          imports.push(predictionFromApi(c))
        } else if (c.status !== 'pending' && mine.status === 'pending' || (c.score != null && mine.accuracyScore !== c.score)) {
          store.updatePrediction(mine.id, {
            status: c.status === 'withdrawn' ? 'expired' : c.status as Prediction['status'],
            actualPrice: c.resolved_price ?? undefined, accuracyScore: c.score ?? undefined,
          })
        }
        // the SERVER's version: a call moved locally since then differs and is pushed again
        map[c.client_id] = { sid: c.id, sig: signature(predictionFromApi(c)), pending: c.status === 'pending' }
      }
      if (imports.length) store.importPredictions(imports)
      writeMap(map)
      writeMark({ at: Date.now(), uid: uid(), count: store.predictions.length })
    }

    async function push() {
      const map = readMap()
      const now = Date.now()
      const todo = store.predictions.filter((p) => {
        if (!isPredictionSyncable(p, now)) return false
        const e = map[p.id]
        return !e || e.sig !== signature(p)
      })
      for (let i = 0; i < todo.length; i += BATCH) {
        const chunk = todo.slice(i, i + BATCH)
        const res = await api<{ results: { client_id: string; outcome: string; prediction?: { id: string; status: string }; errors?: unknown }[] }>(
          '/api/v1/predictions/sync/', { method: 'POST', body: { predictions: chunk.map(predictionToApi) } })
        const byId = new Map(chunk.map(p => [p.id, p]))
        for (const r of res.results ?? []) {
          const p = byId.get(r.client_id)
          if (!p) continue
          map[p.id] = r.outcome === 'error'
            ? { sig: signature(p), err: JSON.stringify(r.errors ?? '').slice(0, 200) }
            : { sid: r.prediction?.id, sig: signature(p), pending: r.prediction?.status === 'pending' }
        }
      }
      // pending calls deleted on this device: withdraw them on the server
      const live = new Set(store.predictions.map(p => p.id))
      for (const [cid, e] of Object.entries(map)) {
        if (live.has(cid)) continue
        if (e.sid && e.pending) {
          try { await api(`/api/v1/predictions/${e.sid}/`, { method: 'DELETE' }) } catch (err: any) {
            const code = err?.response?.status ?? err?.statusCode
            if (code !== 404 && code !== 409) continue      // offline: try again next time
          }
        }
        delete map[cid]
      }
      writeMap(map)
    }

    async function run() {
      if (busy || !isAuthenticated.value) return
      busy = true
      try {
        // Skip the pull when this account pulled < 5 min ago (even before a reload) and no local
        // calls were lost since; pushes still run on every change. Wait for the account id
        // (auth/me) so the mark is never written for an unknown account.
        if (uid() && predictionPullDue({ mark: readMark(), uid: uid(), localCount: store.predictions.length, now: Date.now(), everyMs: PULL_EVERY_MS })) await pull()
        await push()
      } catch {
        // offline / 401 during a token refresh / 429: the next change or the minute timer retries
      } finally {
        busy = false
      }
    }

    function schedule(ms = DEBOUNCE_MS) {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => { timer = null; void run() }, ms)
    }

    watch(() => store.predictions, () => schedule(), { deep: true })
    // Signing out forgets the pull mark, so the next sign-in (maybe another account) pulls in full.
    watch(isAuthenticated, (v, was) => { if (was && !v) writeMark(null); if (v) schedule(0) }, { immediate: true })
    watch(uid, (id) => { if (id && isAuthenticated.value) schedule(0) })
    setInterval(() => { if (document.visibilityState === 'visible') void run() }, 60_000)
  })
})
