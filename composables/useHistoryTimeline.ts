/**
 * useHistoryTimeline — the only place pages/historic.vue gets its data from.
 *
 * Server: GET /api/v1/history/ (client-side, Bearer via $api). Local: paper ledger, the user's own
 * calls not yet synced, catalog sample wallets, followed agents. Merge + tense rules live in
 * utils/historyTimeline.ts; this file only wires stores, the clock and the fetch.
 */
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { usePaperStore } from '~/stores/paper'
import { usePredictionsStore } from '~/stores/predictions'
import { useWalletStore } from '~/stores/wallet'
import { useOpinionsStore } from '~/stores/opinions'
import { useAgentsStore } from '~/stores/agents'
import { useOpinionProfileStore } from '~/stores/opinionProfile'
import { PREDICTION_OWNER } from '~/utils/predictionSync'
import {
  enrichRunningAgents, fromCatalogWallets, fromLocalPredictions, fromPaperTrades, fromPluggedAgents,
  historyServerClientIds, mergeHistoryEvents, retenseHistory, summarizeHistory,
  type HistoryEvent, type HistoryPayload,
} from '~/utils/historyTimeline'

export type HistoryStatus = 'idle' | 'loading' | 'ready' | 'error' | 'signed-out'

export function useHistoryTimeline() {
  const auth = useAuth()
  const { userId } = useCurrentUser()
  const paper = usePaperStore()
  const preds = usePredictionsStore()
  const wallet = useWalletStore()
  const opinions = useOpinionsStore()
  const agents = useAgentsStore()
  const reading = useOpinionProfileStore()

  const payload = shallowRef<HistoryPayload | null>(null)
  const status = ref<HistoryStatus>('idle')
  const error = ref<string | null>(null)
  const now = ref(Date.now())
  const liveBots = shallowRef<any[]>([])
  const liveState = ref<'idle' | 'loading' | 'done' | 'error'>('idle')
  const refreshing = ref(false)
  let timer: ReturnType<typeof setInterval> | null = null
  let seq = 0

  async function load() {
    if (!import.meta.client) return
    if (!auth.isAuthenticated.value) {
      status.value = 'signed-out'
      return
    }
    const mine = ++seq                   // a slower, older response must never overwrite a newer one
    refreshing.value = true
    if (!payload.value) status.value = 'loading'
    error.value = null
    try {
      const { $api } = useNuxtApp()
      // Wide past window: the range control narrows it client-side without a refetch.
      const from = new Date(Date.now() - 3 * 365 * 86_400_000).toISOString()
      const data = await ($api as typeof $fetch)<HistoryPayload>('/api/v1/history/', { query: { from } })
      if (mine !== seq) return
      payload.value = data
      now.value = Date.now()
      status.value = 'ready'
    } catch (e: any) {
      if (mine !== seq) return
      error.value = e?.data?.detail || e?.message || 'History could not be loaded'
      status.value = 'error'
    } finally {
      if (mine === seq) refreshing.value = false
    }
  }

  /**
   * The paper ledger and unsynced calls live in this browser's localStorage under keys shared by every
   * account. The first signed-in account to open History claims the device; another account sees those
   * rows hidden (counted in `foreignLocal`) instead of someone else's bets shown as its own.
   */
  const DEVICE_KEY = 'strades:history:device-owner'
  const deviceOwner = ref<string | null>(null)
  function claimDevice() {
    try {
      const cur = localStorage.getItem(DEVICE_KEY)
      if (!cur && auth.isAuthenticated.value && userId.value) localStorage.setItem(DEVICE_KEY, userId.value)
      deviceOwner.value = localStorage.getItem(DEVICE_KEY)
    } catch { deviceOwner.value = null }
  }
  const ownsDevice = computed(() => !deviceOwner.value || deviceOwner.value === userId.value)

  /** client ids the sync plugin already sent to the server (plugins/predictionsSync.client.ts). */
  function syncedIds(): Set<string> {
    try {
      const m = JSON.parse(localStorage.getItem('strades:predictions:sync:v1') || '{}') as Record<string, { sid?: string }>
      return new Set(Object.entries(m).filter(([, v]) => v?.sid).map(([k]) => k))
    } catch { return new Set() }
  }
  const synced = shallowRef<Set<string>>(new Set())

  /** Live P&L for agents the ledger says are running. Opt-in: the first call starts the trading engine. */
  async function loadLiveAgents() {
    if (!import.meta.client || liveState.value === 'loading') return
    liveState.value = 'loading'
    try {
      const { $api } = useNuxtApp()
      liveBots.value = await ($api as typeof $fetch)<any[]>('/api/v1/bots/')
      liveState.value = 'done'
    } catch {
      liveState.value = 'error'
    }
  }

  onMounted(() => {
    paper.hydrate()
    if (!preds.initialized) preds.init()
    if (!wallet.hydrated) void wallet.initializeStore()
    if (!agents.hydrated) void agents.fetchAgents()
    reading.hydrate()
    claimDevice()
    synced.value = syncedIds()
    void load()
    timer = setInterval(() => { now.value = Date.now() }, 30_000)
  })
  onBeforeUnmount(() => { if (timer) clearInterval(timer) })

  const serverEvents = computed<HistoryEvent[]>(() => payload.value?.events ?? [])

  const localCalls = computed(() => preds.predictions.filter(p => p.userId === PREDICTION_OWNER))
  const foreignLocal = computed(() => (ownsDevice.value ? 0 : paper.trades.length + localCalls.value.length))

  const events = computed<HistoryEvent[]>(() => {
    const t = now.value
    // calls on the server (in this window or not) never reappear as "only on this device"
    const ids = new Set([...historyServerClientIds(serverEvents.value), ...synced.value])
    const isDemo = !!payload.value?.profile?.is_demo
    const local = [
      ...(ownsDevice.value ? fromPaperTrades(paper.trades, t) : []),
      ...(ownsDevice.value ? fromLocalPredictions(localCalls.value, ids, t) : []),
      // the founder's catalog wallets are a demo prop, not part of a real account's own history
      ...(isDemo ? fromCatalogWallets(wallet.wallets as any, t) : []),
      ...fromPluggedAgents(opinions.plugs, id => agents.byId[id]?.name, t),
    ]
    return retenseHistory(enrichRunningAgents(mergeHistoryEvents(serverEvents.value, local), liveBots.value), t)
  })

  // The user's own numbers never include sample rows; sample totals are kept apart and chipped.
  const summary = computed(() => summarizeHistory(events.value.filter(e => !e.sample)))
  const sampleSummary = computed(() => summarizeHistory(events.value.filter(e => e.sample)))

  const readingProfile = computed(() => {
    const p = reading.getProfile(userId.value)
    return p && p.sample_count > 0 ? p : null
  })

  const personalAgent = computed(() => {
    const a = agents.personal
    // avatars.json ships the founder's catalog agents: one owned by someone else is sample data
    return a ? { id: a.id, name: a.name, samples: a.training_state?.samples_observed ?? 0, status: a.training_state?.status, last: a.training_state?.last_trained_at, sample: a.owner_id !== userId.value } : null
  })

  const engineNote = computed(() => {
    const n = payload.value?.sources?.wallets?.note
    return typeof n === 'string' && liveState.value !== 'done' ? n : null
  })

  const failedSources = computed(() =>
    Object.entries(payload.value?.sources ?? {}).filter(([, m]) => m && m.ok === false).map(([k, m]) => ({ source: k, note: m.note ?? '' })))

  return {
    payload, status, error, now, events, summary, sampleSummary, readingProfile, refreshing, foreignLocal, personalAgent, engineNote, failedSources,
    liveState, load, loadLiveAgents,
    followed: computed(() => opinions.plugs.filter(p => p.enabled).length),
  }
}
