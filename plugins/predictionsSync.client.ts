/**
 * predictionsSync — keeps the user's price calls on the server (Strades-backend /api/v1/predictions/).
 *
 * The predictions store stays the UI's source (instant, works offline, localStorage). This plugin:
 *  - PULLS the user's calls once signed in: resolution results (status, resolved price, score)
 *    are written back onto the local calls; calls made on another device are imported.
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

const SYNC_KEY = 'strades:predictions:sync:v1'
const BATCH = 50
const DEBOUNCE_MS = 1500

interface SyncEntry { sid?: string; sig: string; err?: string; pending?: boolean }
type SyncMap = Record<string, SyncEntry>

function readMap(): SyncMap {
  try { return JSON.parse(localStorage.getItem(SYNC_KEY) || '{}') } catch { return {} }
}
function writeMap(m: SyncMap) {
  try { localStorage.setItem(SYNC_KEY, JSON.stringify(m)) } catch { /* quota: next run resends, idempotent */ }
}

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook('app:mounted', () => {
    const { isAuthenticated, accessToken } = useAuth()
    const apiBase = useRuntimeConfig().public.apiBase as string
    const store = usePredictionsStore()
    if (!store.initialized) store.init()

    const api = <T>(path: string, opts: Record<string, any> = {}) => $fetch<T>(path, {
      baseURL: apiBase, ...opts, headers: { Authorization: `Bearer ${accessToken.value}`, ...(opts.headers ?? {}) },
    })

    const PULL_EVERY_MS = 10 * 60_000   // resolution results arrive with the server's upkeep run
    let lastPull = 0
    let busy = false
    let timer: ReturnType<typeof setTimeout> | null = null

    async function pull() {
      const res = await api<{ results: ServerCall[] }>('/api/v1/predictions/', { query: { limit: 200 } })
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
      lastPull = Date.now()
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
        if (Date.now() - lastPull > PULL_EVERY_MS) await pull()
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
    watch(isAuthenticated, (v) => { lastPull = 0; if (v) schedule(0) }, { immediate: true })
    setInterval(() => { if (document.visibilityState === 'visible') void run() }, 60_000)
  })
})
