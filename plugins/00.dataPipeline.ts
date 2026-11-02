/**
 * Data Pipeline Bootstrap
 *
 * Per Structure.md: data is fetched once globally and distributed via Pinia stores.
 *
 * This plugin replaces ad-hoc onMounted fetches in pages by hydrating the global
 * stores on app boot, and runs the client loops that are driven by real inputs:
 * the training drain (the user's own behaviour buffer), the activity-log
 * compaction and the swarm re-aggregation.
 *
 * Honest data (swarm 2026-10-30b, board-data P0 #2, board-optimization O7): it no
 * longer invents numbers. The macro jitter (volatility, per-class volatility,
 * fear/greed, flow, news count), the live-bot P&L random walk, the agent opinion
 * wobble and the fixed-pie avatar drift are gone: they moved figures users read
 * (Risk vol/VaR, bot P&L, swarm divergence) with no market event behind them.
 *
 * Efficiency (swarm 2026-11-02 wave 2, board-perf PERF-3): the news-globe pointer
 * (a 1.5 s timer + a requestAnimationFrame loop re-armed every frame + two
 * /data/social/posts.json reads) and the stage bookkeeping (stores/pipeline) are
 * gone: they only wrote `prefetch.latestNewsCoords` / `pipeline.stages`, which no
 * component, composable or page read.
 */
import { defineNuxtPlugin } from '#app'
import { useMacroStore } from '~/stores/macro'
import { useUserPreferencesStore } from '~/stores/userPreferences'
import { useNewsStore } from '~/stores/news'
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

export default defineNuxtPlugin({
  name: 'data-pipeline',
  enforce: 'post',
  async setup(nuxtApp) {
  const macro = useMacroStore()
  const prefs = useUserPreferencesStore()
  const news = useNewsStore()
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
  const alreadyPainted = macro.hydrated && wallet.hydrated && prefs.hydrated

  // ── 1. Initial hydration ────────────────────────────────────────────────
  if (!alreadyPainted) {
    await Promise.all([
      macro.fetchMacroState(),
      prefs.fetchPreferences(),
      news.initializeStore(),
      agents.fetchAgents().then(() => {
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
      platforms.fetchPlatforms(),
      influencers.fetchInfluencers(),
      bots.fetchBots(),
      wallet.initializeStore(),
      chat.initializeStore(),
      sharesStore.hydrate(),
      activityLog.hydrate(),
    ]).catch((err) => {
      console.warn('[data-pipeline] a store failed to hydrate', err)
    })
  }

  // Browser-only journals and ticks start after hydration so the
  // first client render matches the server markup.
  if (import.meta.server) return

  // app:suspense:resolve, not app:mounted: pages hydrate inside <Suspense>, and
  // app:mounted fires before they finish, so browser state applied there leaks
  // into the hydration pass (e.g. /news "Saved 3" vs "0").
  nuxtApp.hook('app:suspense:resolve', async () => {
    await activityLog.hydrate(true)
    news.adoptBrowserPersistence()

  // Training tick — drains the user-behavior buffer and applies aggregate deltas
  // to the personal Avatar. Runs every 8s by default; faster if the buffer fills.
  const trainingTick = setInterval(() => {
    if (training.bufferSize === 0) return
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
    activityLog.reduce()
  }, 4000)

  // Opinion tick — every 4s the plugged agents' CURRENT opinions are re-aggregated
  // (plug/unplug and training change them) and, in 'auto' mode, pushed to the
  // allocation. No random wobble and no fixed-pie avatar drift: the swarm only
  // moves when one of its inputs moved.
  const opinionTick = setInterval(() => {
    opinions.recompute()
  }, 4000)

  // Cleanup on hot-reload / app teardown
  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      clearInterval(trainingTick)
      clearInterval(trainingOverflowWatch)
      clearInterval(activityReduceWatch)
      clearInterval(opinionTick)
    })
  }
  })
  },
})
