/**
 * Data Pipeline Bootstrap
 *
 * Per Structure.md: data is fetched once globally, distributed via Pinia stores,
 * and live updates are batched through requestAnimationFrame to avoid main-thread
 * blocking during high-volatility ticks.
 *
 * This plugin replaces ad-hoc onMounted fetches in pages by hydrating the global
 * stores on app boot, and runs the client loops that are driven by real inputs:
 * the news-globe pointer (picks a real post), the training drain (the user's own
 * behaviour buffer), the activity-log compaction and the swarm re-aggregation.
 *
 * Honest data (swarm 2026-10-30b, board-data P0 #2, board-optimization O7): it no
 * longer invents numbers. The macro jitter (volatility, per-class volatility,
 * fear/greed, flow, news count), the live-bot P&L random walk, the agent opinion
 * wobble and the fixed-pie avatar drift are gone: they moved figures users read
 * (Risk vol/VaR, bot P&L, swarm divergence) with no market event behind them.
 */
import { defineNuxtPlugin } from '#app'
import { publicAssetUrl } from '~/composables/useLocalJson'
import { useMacroStore } from '~/stores/macro'
import { useUserPreferencesStore } from '~/stores/userPreferences'
import { useNewsStore } from '~/stores/news'
import { usePipelineStore } from '~/stores/pipeline'
import { usePrefetchStore } from '~/stores/prefetch'
import { useAgentsStore } from '~/stores/agents'
import { useTrainingStore } from '~/stores/training'
import { useOpinionsStore, type PlugsApi } from '~/stores/opinions'
import { usePlatformsStore } from '~/stores/platforms'
import { useInfluencersStore } from '~/stores/influencers'
import { useBotsStore } from '~/stores/bots'
import { useWalletStore } from '~/stores/wallet'
import { useChatStore } from '~/stores/chat'
import { useSharesStore } from '~/stores/shares'
import { useActivityLogStore } from '~/stores/activityLog'

const TICK_BUDGET_MS = 33 // ~30fps cap for visual updates

export default defineNuxtPlugin({
  name: 'data-pipeline',
  enforce: 'post',
  async setup(nuxtApp) {
  const pipeline = usePipelineStore()
  const macro = useMacroStore()
  const prefs = useUserPreferencesStore()
  const news = useNewsStore()
  const prefetch = usePrefetchStore()
  const agents = useAgentsStore()
  const training = useTrainingStore()
  const opinions = useOpinionsStore()
  const platforms = usePlatformsStore()
  const influencers = useInfluencersStore()
  const bots = useBotsStore()
  const wallet = useWalletStore()
  const chat = useChatStore()
  const sharesStore = useSharesStore()
  const activityLog = useActivityLogStore()
  const postsUrl = publicAssetUrl('/data/social/posts.json')
  const alreadyPainted = macro.hydrated && wallet.hydrated && prefs.hydrated

  if (!alreadyPainted) {
  pipeline.bootstrap()
  pipeline.stages.agents = pipeline.stages.agents ?? { name: 'agents', state: 'idle', lastTickMs: 0, errors: 0 }
  pipeline.stages.training = pipeline.stages.training ?? { name: 'training', state: 'idle', lastTickMs: 0, errors: 0 }
  pipeline.stages.opinions = pipeline.stages.opinions ?? { name: 'opinions', state: 'idle', lastTickMs: 0, errors: 0 }
  pipeline.stages.platforms = pipeline.stages.platforms ?? { name: 'platforms', state: 'idle', lastTickMs: 0, errors: 0 }
  pipeline.stages.influencers = pipeline.stages.influencers ?? { name: 'influencers', state: 'idle', lastTickMs: 0, errors: 0 }
  pipeline.stages.bots = pipeline.stages.bots ?? { name: 'bots', state: 'idle', lastTickMs: 0, errors: 0 }
  pipeline.stages.chat = pipeline.stages.chat ?? { name: 'chat', state: 'idle', lastTickMs: 0, errors: 0 }
  pipeline.stages.activityLog = pipeline.stages.activityLog ?? { name: 'activityLog', state: 'idle', lastTickMs: 0, errors: 0 }

  // ── 1. Initial hydration ────────────────────────────────────────────────
  pipeline.markStage('macro', 'hydrating')
  pipeline.markStage('preferences', 'hydrating')
  pipeline.markStage('news', 'hydrating')
  pipeline.markStage('agents', 'hydrating')

  pipeline.markStage('wallet', 'hydrating')
  pipeline.markStage('chat', 'hydrating')
  pipeline.markStage('activityLog', 'hydrating')

  if (!alreadyPainted) await Promise.all([
    macro.fetchMacroState().then(() => pipeline.markStage('macro', 'streaming')),
    prefs.fetchPreferences().then(() => pipeline.markStage('preferences', 'streaming')),
    news.initializeStore().then(() => pipeline.markStage('news', 'streaming')),
    agents.fetchAgents().then(() => {
      pipeline.markStage('agents', 'streaming')
      if (agents.personalId) opinions.plug(agents.personalId, 0.6)
      opinions.recompute()
      // Signed in: the saved plugs (server) replace the local default. A first-time account gets its
      // personal agent plugged and saved, so /wallet and /creator see the same list as /agents.
      if (import.meta.client) {
        const auth = useAuth()
        void opinions.connect({ signedIn: auth.isAuthenticated.value, userId: auth.user.value?.id, api: nuxtApp.$api as PlugsApi })
          .then(() => opinions.recompute())
      }
    }),
    platforms.fetchPlatforms().then(() => pipeline.markStage('platforms', 'streaming')),
    influencers.fetchInfluencers().then(() => pipeline.markStage('influencers', 'streaming')),
    bots.fetchBots().then(() => pipeline.markStage('bots', 'streaming')),
    wallet.initializeStore().then(() => pipeline.markStage('wallet', 'streaming')),
    chat.initializeStore().then(() => pipeline.markStage('chat', 'streaming')),
    sharesStore.hydrate(),
    activityLog.hydrate().then(() => pipeline.markStage('activityLog', 'streaming')),
  ]).catch(() => {
    pipeline.markStage('macro', 'error')
  })
  }

  if (!alreadyPainted) {
    try {
      const posts = await $fetch<Array<{ geographic_origin?: { lat: number; lng: number }; weight?: number }>>(postsUrl)
      if (posts[0]?.geographic_origin) {
        const { lat, lng } = posts[0].geographic_origin
        prefetch.updateLatestNewsCoords(lat, lng)
      }
    } catch { /* posts.json optional */ }
  }

  // Synthetic ticks and browser-only journals start after hydration so the
  // first client render matches the server markup.
  if (import.meta.server) return

  // app:suspense:resolve, not app:mounted: pages hydrate inside <Suspense>, and
  // app:mounted fires before they finish, so browser state applied there leaks
  // into the hydration pass (e.g. /news "Saved 3" vs "0").
  nuxtApp.hook('app:suspense:resolve', async () => {
    await activityLog.hydrate(true)
    news.adoptBrowserPersistence()

    let postsCache: Array<{ geographic_origin?: { lat: number; lng: number }; weight?: number }> = []
    try {
      postsCache = await $fetch(postsUrl)
    } catch { /* posts.json optional */ }

  let lastTick = performance.now()
  let pendingNewsCoords: { lat: number; lng: number } | null = null

  // News globe pointer: every ~1.5 s it may move to a real post's origin
  // (weighted pick from posts.json). It moves a map marker, never a number.
  // The macro jitter that used to run here is gone (see the header note).
  const newsPointer = setInterval(() => {
    if (Math.random() < 0.35 && postsCache.length > 0) {
      const totalWeight = postsCache.reduce((s, p) => s + (p.weight ?? 0.5), 0)
      let r = Math.random() * totalWeight
      const picked = postsCache.find(p => (r -= (p.weight ?? 0.5)) <= 0) ?? postsCache[0]
      if (picked?.geographic_origin) {
        pendingNewsCoords = { lat: picked.geographic_origin.lat, lng: picked.geographic_origin.lng }
      }
    }
  }, 1500)

  // Training tick — drains the user-behavior buffer and applies aggregate deltas
  // to the personal Avatar. Runs every 8s by default; faster if the buffer fills.
  const trainingTick = setInterval(() => {
    pipeline.markStage('training', 'streaming')
    const before = training.bufferSize
    if (before === 0) return
    training.applyTrainingTick()
  }, 8000)
  // Force a drain if the buffer overflows hard
  const trainingOverflowWatch = setInterval(() => {
    if (training.bufferSize > 80) training.applyTrainingTick()
  }, 1500)

  // Activity-log reduce watch — compact raw journal when threshold is crossed
  // (also triggered inline on write; this catches persistence / edge cases).
  const activityReduceWatch = setInterval(() => {
    if (!activityLog.needsReduce) return
    pipeline.markStage('activityLog', 'streaming')
    activityLog.reduce()
  }, 4000)

  // Opinion tick — every 4s the plugged agents' CURRENT opinions are re-aggregated
  // (plug/unplug and training change them) and, in 'auto' mode, pushed to the
  // allocation. No random wobble and no fixed-pie avatar drift: the swarm only
  // moves when one of its inputs moved.
  const opinionTick = setInterval(() => {
    pipeline.markStage('opinions', 'streaming')
    opinions.recompute()
  }, 4000)

  // RAF batcher — applies pending patches at most once per frame, with min budget
  const flush = () => {
    const now = performance.now()
    if (now - lastTick >= TICK_BUDGET_MS) {
      if (pendingNewsCoords) {
        prefetch.updateLatestNewsCoords(pendingNewsCoords.lat, pendingNewsCoords.lng)
        pendingNewsCoords = null
        pipeline.recordTick()
      }
      lastTick = now
    }
    rafId = requestAnimationFrame(flush)
  }
  let rafId = requestAnimationFrame(flush)

  // Cleanup on hot-reload / app teardown
  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      clearInterval(newsPointer)
      clearInterval(trainingTick)
      clearInterval(trainingOverflowWatch)
      clearInterval(activityReduceWatch)
      clearInterval(opinionTick)
      cancelAnimationFrame(rafId)
    })
  }
  })
  },
})

