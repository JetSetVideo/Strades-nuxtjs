/**
 * Data Pipeline Bootstrap
 *
 * Per Structure.md: data is fetched once globally, distributed via Pinia stores,
 * and live updates are batched through requestAnimationFrame to avoid main-thread
 * blocking during high-volatility ticks.
 *
 * This plugin replaces ad-hoc onMounted fetches in pages by hydrating the global
 * stores on app boot, and starts a mock event-loop that simulates WebSocket
 * deltas (volatility jitter, flow direction changes, news pulses).
 */
import { defineNuxtPlugin } from '#app'
import { useMacroStore, type AssetClass } from '~/stores/macro'
import { useUserPreferencesStore } from '~/stores/userPreferences'
import { useNewsStore } from '~/stores/news'
import { usePipelineStore } from '~/stores/pipeline'
import { usePrefetchStore } from '~/stores/prefetch'
import { useAgentsStore } from '~/stores/agents'
import { useTrainingStore } from '~/stores/training'
import { useOpinionsStore } from '~/stores/opinions'
import { usePlatformsStore } from '~/stores/platforms'
import { useInfluencersStore } from '~/stores/influencers'
import { useBotsStore } from '~/stores/bots'
import { useWalletStore } from '~/stores/wallet'
import { useChatStore } from '~/stores/chat'
import { useSharesStore } from '~/stores/shares'
import { useActivityLogStore } from '~/stores/activityLog'

const TICK_BUDGET_MS = 33 // ~30fps cap for visual updates

export default defineNuxtPlugin(async () => {
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

  await Promise.all([
    macro.fetchMacroState().then(() => pipeline.markStage('macro', 'streaming')),
    prefs.fetchPreferences().then(() => pipeline.markStage('preferences', 'streaming')),
    news.initializeStore().then(() => pipeline.markStage('news', 'streaming')),
    agents.fetchAgents().then(() => {
      pipeline.markStage('agents', 'streaming')
      if (agents.personalId) opinions.plug(agents.personalId, 0.6)
      opinions.recompute()
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

  // Seed news globe coords from the first post; cache full list for the rotator
  let postsCache: Array<{ geographic_origin?: { lat: number; lng: number }; weight?: number }> = []
  try {
    const res = await fetch('/data/social/posts.json')
    if (res.ok) {
      postsCache = await res.json()
      if (postsCache[0]?.geographic_origin) {
        const { lat, lng } = postsCache[0].geographic_origin
        prefetch.updateLatestNewsCoords(lat, lng)
      }
    }
  } catch { /* posts.json optional */ }

  // ── 2. Streaming loop (mock WebSocket via RAF) ──────────────────────────
  if (typeof window === 'undefined') return

  let lastTick = performance.now()
  let pendingPatch: Record<string, any> = {}
  let pendingNewsCoords: { lat: number; lng: number } | null = null

  // Source of synthetic updates — every ~1.5s we mutate the macro state slightly
  const synth = setInterval(() => {
    const vol = macro.global_volatility_index
    // Jitter volatility around its mean
    pendingPatch.global_volatility_index = clamp(vol + (Math.random() - 0.5) * 0.08)
    pendingPatch.flow_velocity = clamp(macro.flow_velocity + (Math.random() - 0.5) * 0.05)
    pendingPatch.news_pulse_count = macro.news_pulse_count + (Math.random() < 0.3 ? 1 : 0)
    pendingPatch.fear_greed = Math.round(clamp(macro.fear_greed + (Math.random() - 0.5) * 4, 0, 100))

    // Per-class volatility wobble
    const vbc = { ...macro.volatility_by_class }
    ;(Object.keys(vbc) as AssetClass[]).forEach(k => {
      vbc[k] = clamp(vbc[k] + (Math.random() - 0.5) * 0.04)
    })
    pendingPatch.volatility_by_class = vbc

    // Occasionally rotate the news globe — weighted pick from posts cache
    if (Math.random() < 0.35 && postsCache.length > 0) {
      const totalWeight = postsCache.reduce((s, p) => s + (p.weight ?? 0.5), 0)
      let r = Math.random() * totalWeight
      const picked = postsCache.find(p => (r -= (p.weight ?? 0.5)) <= 0) ?? postsCache[0]
      if (picked.geographic_origin) {
        pendingNewsCoords = { lat: picked.geographic_origin.lat, lng: picked.geographic_origin.lng }
      }
    }
  }, 1500)

  // Bot tick — every 6s nudge live bot PnL so the UI feels alive
  const botTick = setInterval(() => {
    pipeline.markStage('bots', 'streaming')
    bots.list.forEach(b => {
      if (b.status !== 'live') return
      const delta = (Math.random() - 0.48) * 8 // mostly small, slight positive bias
      b.pnl_today_usd = +(b.pnl_today_usd + delta).toFixed(2)
      b.pnl_30d_usd = +(b.pnl_30d_usd + delta).toFixed(2)
      if (b.capital_allocated_usd > 0) {
        b.pnl_30d_pct = +((b.pnl_30d_usd / b.capital_allocated_usd) * 100).toFixed(2)
      }
    })
  }, 6000)

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

  // Opinion tick — every 4s each plugged agent's opinion is re-aggregated and
  // (in 'auto' mode) pushed straight to the wallet allocation. Per CodingAgent.md
  // section 3: "When dropped into the NodeCanvas this Opinion Vector acts as a live data source".
  const opinionTick = setInterval(() => {
    pipeline.markStage('opinions', 'streaming')
    // Wobble each agent's opinion slightly to simulate live re-inference
    agents.all.forEach(a => {
      const ov = { ...a.opinion_vector }
      const k = (['fiat','crypto','stocks','commodities'] as const)[Math.floor(Math.random() * 4)]
      const delta = (Math.random() - 0.5) * 2 // ±1%
      ov[k] = clamp(ov[k] + delta, 0, 100)
      // Renormalize so the four still sum to 100
      const sum = ov.fiat + ov.crypto + ov.stocks + ov.commodities
      if (sum > 0) {
        ov.fiat = (ov.fiat / sum) * 100
        ov.crypto = (ov.crypto / sum) * 100
        ov.stocks = (ov.stocks / sum) * 100
        ov.commodities = (ov.commodities / sum) * 100
      }
      agents.patchAgent(a.id, { opinion_vector: ov })
    })
    opinions.recompute()
  }, 4000)

  // Avatar drift tick — every 12s the personal avatar's opinion vector drifts
  // toward the user's current wallet allocation, making the avatar learn their
  // preferences. Per "avatar that trades like they would" in the vision.
  const avatarDrift = setInterval(() => {
    const personal = agents.personal
    if (!personal) return
    const walletPie = macro.dominant_asset_class === 'crypto'
      ? { fiat: 15, crypto: 45, stocks: 25, commodities: 15 }
      : macro.dominant_asset_class === 'stocks'
        ? { fiat: 20, crypto: 10, stocks: 55, commodities: 15 }
        : macro.dominant_asset_class === 'commodities'
          ? { fiat: 20, crypto: 15, stocks: 25, commodities: 40 }
          : { fiat: 40, crypto: 20, stocks: 25, commodities: 15 }
    // Drift the opinion vector 3% toward the wallet allocation per tick
    const DRIFT_RATE = 0.03
    const ov = { ...personal.opinion_vector }
    ;(Object.keys(ov) as Array<keyof typeof ov>).forEach(cls => {
      ov[cls] += (walletPie[cls] - ov[cls]) * DRIFT_RATE
    })
    agents.patchAgent(personal.id, { opinion_vector: ov })
  }, 12000)

  // RAF batcher — applies pending patches at most once per frame, with min budget
  const flush = () => {
    const now = performance.now()
    if (now - lastTick >= TICK_BUDGET_MS) {
      if (Object.keys(pendingPatch).length > 0) {
        macro.applyTick(pendingPatch)
        pendingPatch = {}
        pipeline.recordTick()
      }
      if (pendingNewsCoords) {
        prefetch.updateLatestNewsCoords(pendingNewsCoords.lat, pendingNewsCoords.lng)
        pendingNewsCoords = null
      }
      lastTick = now
    }
    rafId = requestAnimationFrame(flush)
  }
  let rafId = requestAnimationFrame(flush)

  // Cleanup on hot-reload / app teardown
  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      clearInterval(synth)
      clearInterval(trainingTick)
      clearInterval(trainingOverflowWatch)
      clearInterval(activityReduceWatch)
      clearInterval(opinionTick)
      clearInterval(avatarDrift)
      clearInterval(botTick)
      cancelAnimationFrame(rafId)
    })
  }
})

function clamp(v: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, v))
}
