<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useStrategies } from '@/composables/useStrategies'
import { useStrategiesStore } from '@/stores/strategies'
import { useBacktest } from '@/composables/useBacktest'
import { useAgentsStore } from '@/stores/agents'
import { useBotsStore } from '@/stores/bots'
import { seededRandom } from '@/composables/useSeededRandom'
import StrategyConsensusMeter from '@/components/Strategy/ConsensusMeter.vue'
import StrategyCounterpartyCard from '@/components/Strategy/CounterpartyCard.vue'
import { useOpinionsStore } from '@/stores/opinions'

import UIPageHeader from '@/components/UI/PageHeader.vue'
import UICard from '@/components/UI/Card.vue'
import UIStat from '@/components/UI/Stat.vue'
import UIPill from '@/components/UI/Pill.vue'
import UIMetricRow from '@/components/UI/MetricRow.vue'
import UISectionTabs, { type TabItem } from '@/components/UI/SectionTabs.vue'
import UIEmptyState from '@/components/UI/EmptyState.vue'
import AppSkeletonLoader from '@/components/App/SkeletonLoader.vue'

import StrategyEquityCurve from '@/components/Strategy/EquityCurve.vue'
import { TradingApiError, useTradingApi, type RealBacktest, type TradingWallet } from '@/composables/useTradingApi'
import { useTradingPrefsStore } from '~/stores/tradingPrefs'
import StrategyTradeList from '@/components/Strategy/TradeList.vue'
import StrategyRunByPanel from '@/components/Strategy/RunByPanel.vue'
import UISourceChip from '@/components/UI/SourceChip.vue'
import { assumptionsLine, backtestFailureText, strategyTopStats, type BacktestAssumptions } from '~/utils/strategyRun'
import { toSimulatedConditions, type CreatorCondition } from '~/utils/strategyServer'
import { fmtDate, fmtMoney, fmtNumber, fmtPctFromPercent, fmtRelative, fmtTime, pctDecimals } from '~/utils/format'
import { fmtMoneyKpi } from '~/utils/valueTree'
import { strategyReturnTree } from '~/utils/strategyTree'
import { usePrimarySettings } from '~/composables/usePrimarySettings'
import UIValueTree from '@/components/UI/ValueTree.vue'

definePageMeta({ title: 'Strategy', layout: 'default' })

const route = useRoute()
const strategyId = computed(() => String(route.params.id))

// useStrategies() exposes a summary-shaped list for legacy list pages — this
// page needs the full canonical Strategy (current_capital, sharpe_ratio,
// max_drawdown, total_trades), so it reads the store's raw array directly.
const { fetchStrategies, toggleStrategyStatus, backtestStrategy, updateStrategy, generateComplementary } = useStrategies()
const strategiesStore = useStrategiesStore()
const strategies = computed(() => strategiesStore.strategies)
const backtestEngine = useBacktest()
const opinionsStore = useOpinionsStore()
const agents = useAgentsStore()
const bots = useBotsStore()

const loading = ref(true)
const tab = ref<'performance' | 'trades' | 'code' | 'backtest'>(route.query.tab === 'backtest' ? 'backtest' : 'performance')
const isBacktesting = ref(false)
// Show the run the creator just did, if any (shared by useBacktest per strategy id).
const backtestResult = ref<any>(backtestEngine.resultsById.value[String(route.params.id)] ?? null)

const simulations = ref(250)

// Real-history backtest run from the creator (backend rules engine on Binance candles).
const realBacktests = useState<Record<string, RealBacktest>>('backtest:real', () => ({}))
const realBacktest = computed(() => realBacktests.value[strategyId.value] ?? null)
const beatHold = computed(() => !!realBacktest.value && realBacktest.value.metrics.return_pct >= realBacktest.value.benchmark.buy_hold_pct)
const realCurve = computed(() => {
  const pts = realBacktest.value?.equity_curve ?? []
  if (pts.length < 2) return ''
  const ys = pts.map(p => p.equity)
  const lo = Math.min(...ys), hi = Math.max(...ys), span = hi - lo || 1
  return pts.map((p, i) => `${((i / (pts.length - 1)) * 600).toFixed(1)},${(134 - ((p.equity - lo) / span) * 128).toFixed(1)}`).join(' ')
})
// Deploy: run this (server-saved) strategy as a bot funded by one of the user's wallets.
const tradingApi = useTradingApi()
const walletsList = ref<TradingWallet[]>([])
const deployWalletId = ref('')
const tradingPrefs = useTradingPrefsStore()
tradingPrefs.hydrate()
// new bots start from the primary value "Paper starting capital" when signed in (Settings → Primary values)
const deployCapital = ref(String(tradingPrefs.newBotCapital))
tradingPrefs.syncPrimary().then(() => { deployCapital.value = String(tradingPrefs.newBotCapital) }).catch(() => {})
const deploying = ref(false)
const deployError = ref('')
onMounted(async () => {
  try {
    walletsList.value = await tradingApi.listWallets()
    deployWalletId.value = walletsList.value[0]?.id ?? ''
  } catch { /* signed out → the card explains */ }
})
async function deployToWallet() {
  deploying.value = true
  deployError.value = ''
  try {
    await tradingApi.launchBot(deployWalletId.value, {
      capital_usd: String(deployCapital.value), weight_mode: 'random', strategy_id: strategyId.value, period_s: 3600,
    })
    await navigateTo('/trade')
  } catch (e) {
    deployError.value = e instanceof TradingApiError ? e.message : 'Could not launch the bot.'
  } finally {
    deploying.value = false
  }
}
const curveRange = computed(() => {
  const ys = (realBacktest.value?.equity_curve ?? []).map(p => p.equity)
  return { lo: ys.length ? Math.min(...ys) : 0, hi: ys.length ? Math.max(...ys) : 0 }
})
// Money: tiles and P&L use fmtMoneyKpi (2 dp below $1M, compact above); the chart's y-axis is compact
// whole dollars, as on the wallet chart. Percent tiles use the UIStat default (1 dp, 2 dp under 1 %).
const usd0 = (v: number) => fmtMoney(v, { compact: true, decimals: 0 })
/** "12.3 points" — a difference of two percentages, same decimals rule as a percent. */
const points = (v: number, signed = false) => `${fmtNumber(v, { decimals: pctDecimals(v), signed })} points`
const intervalLabel = (i: string) => ({ '15m': '15-minute bars', '1h': 'hourly bars', '4h': '4-hour bars', '1d': 'daily bars', '1D': 'daily bars' } as Record<string, string>)[i] ?? i

// ── Real-price backtest: run, progress, result or the server's error ─────────
// The creator records the outcome of its run here (error + mapping notes) before
// navigating; the "↺ Backtest" / "↺ Re-run" buttons write the same record.
const backtestStatus = useState<Record<string, { error: string | null; notes: string[] }>>('backtest:status', () => ({}))
const runStatus = computed(() => backtestStatus.value[strategyId.value] ?? null)
const backtestError = computed(() => runStatus.value?.error ?? null)
const rerunning = ref(false)
const lastRealRunAt = ref<number | null>(null)
const assumptions = computed(() => assumptionsLine(realBacktest.value?.assumptions))
// "Strategy return" value tree: capital, final equity, trades, fees, slippage, buy & hold -> the Settings that drive them.
const primary = usePrimarySettings()
onMounted(() => { primary.load() })
const returnTree = computed(() => strategyReturnTree({
  run: realBacktest.value,
  error: backtestError.value,
  running: rerunning.value && !realBacktest.value,
  settings: primary.values.value,
  settingsDefaults: primary.defaults.value,
}))
function setRunStatus(patch: Partial<{ error: string | null; notes: string[] }>) {
  const prev = backtestStatus.value[strategyId.value] ?? { error: null, notes: [] }
  backtestStatus.value = { ...backtestStatus.value, [strategyId.value]: { ...prev, ...patch } }
}
async function rerunReal() {
  if (rerunning.value) return
  tab.value = 'backtest'
  rerunning.value = true
  try {
    // No capital in the body: the server takes capital / fees / slippage from Settings › primary values.
    const r = await tradingApi.backtestReal(strategyId.value, { bars: tradingPrefs.backtestBars })
    realBacktests.value = { ...realBacktests.value, [strategyId.value]: r }
    lastRealRunAt.value = Date.now()
    setRunStatus({ error: null })
  } catch (e) {
    setRunStatus({ error: e instanceof TradingApiError ? backtestFailureText(e.status, e.message) : backtestFailureText(0, e instanceof Error ? e.message : '') })
  } finally {
    rerunning.value = false
  }
}
const fmtDay = (ts: number) => fmtDate(ts)

onMounted(async () => {
  loading.value = true
  await Promise.all([
    fetchStrategies(),
    !agents.hydrated ? agents.fetchAgents() : Promise.resolve(),
    !bots.hydrated ? bots.fetchBots() : Promise.resolve()
  ])
  // Strategies saved on the server (opened from "Saved strategies", a bookmark or a reload)
  // aren't in the browser store: load them by id instead of showing "Strategy not found".
  if (!strategy.value) await loadServerStrategy().catch(() => {})
  loading.value = false
  // /summarizer "▶ Run backtest" → ?run=1: run it here, where progress and errors are visible.
  if (route.query.run === '1' && strategy.value) void rerunReal()
})

async function loadServerStrategy() {
  const s = await tradingApi.getStrategy(strategyId.value)
  await strategiesStore.createStrategy({
    id: s.id, name: s.name, description: s.description, category: s.category || 'technical', targetAssets: [s.assets_entry],
  })
  const lb = s.last_backtest
  if (!realBacktests.value[s.id] && lb?.metrics && lb.benchmark && lb.window) {
    // Summary only (the server keeps scalars): no curve or trade list until it is re-run.
    // It does keep capital, equity and the assumptions the run used (strategy_views._summary).
    const sum = lb as typeof lb & { capital?: number | string; equity?: number | string; assumptions?: RealBacktest['assumptions'] }
    realBacktests.value = { ...realBacktests.value, [s.id]: {
      engine: 'rules', capital: Number(sum.capital) || 0, equity: Number(sum.equity) || 0, return_pct: lb.return_pct ?? lb.metrics.return_pct,
      equity_curve: [], trades: [], metrics: lb.metrics, benchmark: lb.benchmark, window: lb.window,
      ...(sum.assumptions ? { assumptions: sum.assumptions } : {}),
    } as RealBacktest }
  }
}

const strategy = computed<any>(() =>
  (strategies.value ?? []).find((s: any) => s.id === strategyId.value)
)

const agent = computed(() =>
  strategy.value?.agent_id ? agents.getAvatarById(strategy.value.agent_id) : null
)

const attachedBots = computed(() =>
  bots.list.filter(b => b.strategy_id === strategyId.value)
)

const statusTone = computed(() => {
  switch (strategy.value?.status) {
    case 'active': return 'success'
    case 'paused': return 'warning'
    case 'stopped': return 'danger'
    default: return 'neutral'
  }
})

const hasTradeHistory = computed(() => (strategy.value?.total_trades ?? 0) > 0)
const isSample = computed(() => !!strategy.value?.sample)
/** Header numbers + where they come from ("—" + pending chip until a backtest ran). */
const top = computed(() => strategyTopStats(strategy.value ?? {}, realBacktest.value, backtestError.value))

const tabs = computed<TabItem[]>(() => [
  { id: 'performance', label: 'Performance' },
  { id: 'trades',      label: 'Trades',  count: strategy.value?.total_trades ?? null },
  { id: 'code',        label: 'Code' },
  { id: 'backtest',    label: 'Backtest' }
])

const lastRunRel = computed(() => {
  if (!strategy.value?.last_run) return '—'
  return fmtRelative(strategy.value.last_run)
})

// Synthetic trade list using total_trades + win_rate
const syntheticTrades = computed(() => {
  if (!strategy.value) return []
  const n = Math.min(20, strategy.value.total_trades ?? 0)
  const win = (strategy.value.win_rate ?? 0) / 100
  const rand = seededRandom(strategy.value.id + 'trades')
  const assets: string[] = strategy.value.target_assets ?? ['?']
  const out: any[] = []
  for (let i = 0; i < n; i++) {
    const isWin = rand() < win
    const asset = assets[Math.floor(rand() * assets.length)]
    const pct = (isWin ? rand() * 4 : -rand() * 3)
    const usd = pct * (strategy.value.initial_capital ?? 10000) / 100
    out.push({
      id: `t_${strategy.value.id}_${i}`,
      asset,
      type: isWin ? 'win' : 'loss',
      pct,
      usd,
      ts: Date.now() - (i + 1) * 86_400_000 * (1 + rand() * 2)
    })
  }
  return out
})

async function onToggle() {
  if (!strategy.value) return
  toggleStrategyStatus(strategy.value.id)
}

async function onFork() {
  if (!strategy.value) return
  try {
    await generateComplementary(strategy.value.id)
    navigateTo('/strategies')
  } catch { /* silent */ }
}

const simError = ref<string | null>(null)
const simSkipped = ref<string[]>([])
const lastSimAt = ref<number | null>(null)
async function onRunBacktest() {
  if (!strategy.value) return
  tab.value = 'backtest'
  isBacktesting.value = true
  simError.value = null
  try {
    // Rules: the creator's own blocks when this session built it, else the catalog's entry conditions.
    // Only "price vs number" rules can run on simulated prices; the rest are listed, never faked.
    const traded = strategy.value.target_assets?.[0] ?? 'BTC'
    const code = strategiesStore.detailsCache[strategy.value.id]?.code as unknown as { conditions?: unknown[] } | undefined
    const creatorRules = Array.isArray(code?.conditions) && code!.conditions!.some(c => c && typeof c === 'object' && 'indicator' in (c as object))
      ? (code!.conditions as CreatorCondition[])
      : null
    const catalogRules: CreatorCondition[] = (strategy.value.entry_conditions ?? [])
      .filter((c: any) => (c.datasource ?? 'price') === 'price' && c.value !== undefined && c.value !== null)
      .map((c: any) => ({ indicator: 'PRICE', operator: c.operator ?? '>', value: Number(c.value) }))
    const sim = toSimulatedConditions(creatorRules ?? catalogRules, traded, '1D')
    simSkipped.value = sim.skipped
    if (!sim.conditions.length) {
      simError.value = 'No rule of this strategy can run on simulated prices (only "Price vs a number" rules can). Use the real-price backtest above.'
      return
    }
    const config = {
      id: strategy.value.id,
      name: strategy.value.name,
      conditions: sim.conditions,
      variables: { stop_loss_percent: 5, take_profit_percent: 15, position_size: 10 },
      targetAssets: [traded],
      initialCapital: strategy.value.initial_capital ?? 10000,
      frequency: '1D',
      period: strategy.value.backtest_period ?? { start: '2024-01-01', end: '2025-06-01' },
      swarmVector: opinionsStore.swarmVector,
    }
    backtestResult.value = await backtestEngine.runBacktest(config, simulations.value)
    lastSimAt.value = Date.now()
    // Simulated numbers stay in this card: they are no longer written into the
    // strategy's own Return / Win rate (they were shown as if real).
  } catch (e) {
    simError.value = e instanceof Error && e.message ? `Simulation failed: ${e.message}` : 'Simulation failed.'
  } finally {
    isBacktesting.value = false
  }
}
// Run times: utils/format.ts fmtTime ("15:41", UTC like the top-bar clock).

const codeJson = computed(() => {
  if (!strategy.value) return ''
  const { id, name, description, category, type, target_assets, indicators,
          risk_level, entry_conditions, exit_conditions, tags } = strategy.value
  return JSON.stringify({
    id, name, description, category, type, target_assets, indicators, risk_level,
    entry_conditions, exit_conditions, tags
  }, null, 2)
})
</script>

<template>
  <!-- Loading shell -->
  <div v-if="loading" class="loading-shell">
    <AppSkeletonLoader height="20px" width="240px" />
    <AppSkeletonLoader height="14px" width="160px" />
    <div class="skel-metrics">
      <AppSkeletonLoader height="56px" />
      <AppSkeletonLoader height="56px" />
      <AppSkeletonLoader height="56px" />
      <AppSkeletonLoader height="56px" />
    </div>
    <AppSkeletonLoader height="180px" />
    <AppSkeletonLoader height="240px" />
  </div>

  <div v-else-if="strategy" class="strategy-detail">
    <UIPageHeader :title="strategy.name" :subtitle="strategy.description">
      <template #actions>
        <UISourceChip v-if="isSample" source="sample" note="Sample strategy from the catalog, shown to every user: it is not one of yours." />
        <UIPill :tone="statusTone" show-dot>{{ strategy.status }}</UIPill>
        <button class="action" @click="onToggle" :title="strategy.status === 'active' ? 'Pause' : 'Resume'">
          {{ strategy.status === 'active' ? '⏸ Pause' : '▶ Resume' }}
        </button>
        <button class="action ghost" @click="rerunReal" :disabled="rerunning" :aria-busy="rerunning" title="Backtest this strategy on real past prices">
          {{ rerunning ? 'Running…' : '↺ Backtest' }}
        </button>
        <button class="action ghost" @click="onFork">⎆ Fork</button>
        <NuxtLink class="action ghost" :to="`/summarizer/${strategyId}`" title="Plain-language review of the rules, assets and risk settings">≡ Review</NuxtLink>
      </template>
    </UIPageHeader>

    <div v-if="backtestError" class="bt-error" role="alert">
      <b>Backtest failed.</b> {{ backtestError }}
      <button class="action ghost" :disabled="rerunning" @click="rerunReal">{{ rerunning ? 'Running…' : '↺ Try again' }}</button>
      <NuxtLink class="action ghost" :to="`/creator?id=${encodeURIComponent(strategyId)}`">Edit in Creator</NuxtLink>
    </div>
    <ul v-if="runStatus?.notes?.length" class="bt-notes">
      <li v-for="(n, i) in runStatus.notes" :key="i">{{ n }}</li>
    </ul>

    <div class="top-source" v-if="top.source !== 'account'">
      <UISourceChip :source="top.source" :note="top.note" />
      <span class="muted-note">{{ top.source === 'pending' ? (backtestError ? 'No result: the backtest failed (see above).' : 'No result yet.') : top.source === 'simulated' ? 'From the backtest on past prices.' : '' }}</span>
    </div>
    <UIMetricRow :cols="4">
      <UIStat label="Return"   :value="top.returnPct" :tone="top.returnPct === null ? 'neutral' : 'auto'" :suffix="top.returnPct === null ? '' : '%'" size="lg" />
      <UIStat label="Capital"  :value="fmtMoneyKpi(top.capital)" size="md" />
      <UIStat label="Win rate" :value="top.winRate" :suffix="top.winRate === null ? '' : '%'" size="md" />
      <UIStat label="Sharpe"   :value="top.sharpe" :precision="2" size="md" />
    </UIMetricRow>

    <UISectionTabs v-model="tab" :tabs="tabs" />

    <!-- PERFORMANCE -->
    <template v-if="tab === 'performance'">
      <UICard title="Equity curve">
        <template #action><UIPill ghost tone="neutral">{{ hasTradeHistory ? 'illustrative path' : 'no trades yet' }}</UIPill></template>
        <UIEmptyState v-if="!hasTradeHistory" title="No trades yet" message="Run a backtest, or attach this strategy to a wallet, to see real results here." />
        <StrategyEquityCurve
          v-else
          :seed="strategy.id"
          :initial-value="strategy.initial_capital ?? 10000"
          :final-value="strategy.current_capital ?? (strategy.initial_capital ?? 10000)"
        />
      </UICard>

      <div class="grid-3">
        <UICard title="Risk metrics">
          <UIMetricRow :cols="2">
            <UIStat label="Max DD"    :value="-(strategy.max_drawdown ?? 0)" tone="negative" suffix="%" size="sm" />
            <UIStat label="Vol (ann)" :value="strategy.performance_metrics?.volatility ?? 0" suffix="%" size="sm" />
            <UIStat label="Beta"      :value="strategy.performance_metrics?.beta ?? 0" :precision="2" size="sm" />
            <UIStat label="Alpha"     :value="strategy.performance_metrics?.alpha ?? 0" :precision="2" size="sm" tone="auto" />
          </UIMetricRow>
        </UICard>

        <UICard title="Trade stats">
          <UIMetricRow :cols="2">
            <UIStat label="Total trades" :value="strategy.total_trades ?? 0" :precision="0" size="sm" />
            <UIStat label="Successful"   :value="strategy.successful_trades ?? 0" :precision="0" tone="positive" size="sm" />
            <UIStat label="Avg duration" :value="strategy.average_trade_duration ?? '—'" size="sm" />
            <UIStat label="Last run"     :value="lastRunRel" size="sm" />
          </UIMetricRow>
        </UICard>

        <StrategyRunByPanel :agent="agent" :bots="attachedBots" />
      </div>

      <!-- Counterparty exposure for this strategy's target assets -->
      <UICard v-if="strategy.target_assets?.length" title="Counterparty & Commodity Exposure">
        <StrategyCounterpartyCard :target-assets="strategy.target_assets" :compact="true" />
      </UICard>
    </template>

    <!-- TRADES -->
    <template v-else-if="tab === 'trades'">
      <UICard title="Recent trades">
        <template #action>
          <UISourceChip :source="isSample ? 'sample' : 'simulated'" note="Illustrative trades drawn from the strategy's totals, not real fills." />
          <UIPill ghost tone="neutral">
            {{ syntheticTrades.length }} shown · {{ strategy.total_trades ?? 0 }} total
          </UIPill>
        </template>
        <UIEmptyState
          v-if="syntheticTrades.length === 0"
          icon="◯"
          message="This strategy hasn't run any trades yet."
        />
        <StrategyTradeList v-else :trades="syntheticTrades" />
      </UICard>
    </template>

    <!-- CODE -->
    <template v-else-if="tab === 'code'">
      <UICard title="Strategy code">
        <template #action>
          <NuxtLink :to="`/creator?id=${encodeURIComponent(strategyId)}`" class="link-btn">Edit in creator →</NuxtLink>
        </template>
        <pre class="code-block">{{ codeJson }}</pre>
      </UICard>

      <UICard title="Indicators">
        <div class="tag-row" v-if="strategy.indicators?.length">
          <span v-for="ind in strategy.indicators" :key="ind" class="tag info">{{ ind }}</span>
        </div>
        <UIEmptyState v-else size="sm" icon="◯" message="No indicators configured." />
      </UICard>

      <UICard title="Tags">
        <div class="tag-row" v-if="strategy.tags?.length">
          <span v-for="t in strategy.tags" :key="t" class="tag">{{ t }}</span>
        </div>
        <UIEmptyState v-else size="sm" icon="◯" message="No tags." />
      </UICard>
    </template>

    <!-- BACKTEST -->
    <template v-else-if="tab === 'backtest'">
      <UICard v-if="realBacktest" title="Backtest on real prices" class="real-bt">
        <template #action>
          <UIPill ghost tone="info">{{ realBacktest.window.symbol }} · {{ intervalLabel(realBacktest.window.interval) }} · {{ realBacktest.window.bars }} bars · {{ fmtDay(realBacktest.window.from_ts) }} → {{ fmtDay(realBacktest.window.to_ts) }}</UIPill>
        </template>
        <UIValueTree :node="returnTree" size="lg" class="real-return" />
        <div class="real-kpis">
          <UIStat label="Buy & hold" :value="realBacktest.benchmark.buy_hold_pct" tone="auto" suffix="%" size="lg" />
          <UIStat label="Max drawdown" :value="-realBacktest.metrics.max_dd_pct" tone="auto" suffix="%" size="md" />
          <UIStat label="Closed trades" :value="realBacktest.metrics.trades" :precision="0" size="md" />
          <UIStat label="Win rate" :value="realBacktest.metrics.trades ? (realBacktest.metrics.win_rate ?? null) : null" suffix="%" size="md" />
          <UIStat :label="realBacktest.metrics.trades ? 'Fees paid' : 'Fees on open position'" :value="fmtMoneyKpi(realBacktest.metrics.fees)" size="md" />
        </div>
        <p v-if="!realBacktest.metrics.trades && !realBacktest.metrics.return_pct" class="real-verdict">
          Your entry rule never held in this window, so the strategy stayed in cash
          ({{ realBacktest.benchmark.buy_hold_pct >= 0 ? 'holding' : 'which beat holding' }} {{ realBacktest.window.symbol.replace('USDT', '') }}
          {{ realBacktest.benchmark.buy_hold_pct >= 0 ? 'would have made' : 'by' }}
          <b>{{ realBacktest.benchmark.buy_hold_pct >= 0 ? fmtPctFromPercent(realBacktest.benchmark.buy_hold_pct) : points(Math.abs(realBacktest.benchmark.buy_hold_pct)) }}</b>).
          <span class="caveat">Check the rule's threshold in the Creator: no trade means nothing was tested.</span>
        </p>
        <p v-else class="real-verdict">
          {{ beatHold ? 'Did better than' : 'Did worse than' }} simply holding {{ realBacktest.window.symbol.replace('USDT', '') }}:
          <b :class="beatHold ? 'up' : 'down'">{{ points(realBacktest.metrics.return_pct - realBacktest.benchmark.buy_hold_pct, true) }}</b>
          over this window.
          <span class="caveat">One past window doesn't predict future returns.</span>
        </p>
        <div v-if="realCurve" class="real-chart">
          <div class="y-axis"><span>{{ usd0(curveRange.hi) }}</span><span>{{ usd0(curveRange.lo) }}</span></div>
          <svg class="real-curve" viewBox="0 0 600 140" preserveAspectRatio="none" role="img" aria-label="Equity curve on real prices">
            <polyline :points="realCurve" fill="none" stroke="currentColor" stroke-width="1.6" />
          </svg>
          <div class="x-axis"><span>{{ fmtDay(realBacktest.window.from_ts) }}</span><span>equity (USD) over time</span><span>{{ fmtDay(realBacktest.window.to_ts) }}</span></div>
        </div>
        <table v-if="realBacktest.trades.length" class="real-trades">
          <thead><tr><th>Closed</th><th>Entry</th><th>Exit</th><th>P&L</th><th>Why</th></tr></thead>
          <tbody>
            <tr v-for="(t, i) in realBacktest.trades.slice(-10).reverse()" :key="i">
              <td>{{ fmtDay(t.ts) }}</td><td>{{ fmtMoney(t.entry) }}</td><td>{{ fmtMoney(t.exit) }}</td>
              <td :class="t.pnl >= 0 ? 'up' : 'down'">{{ fmtMoneyKpi(t.pnl, { signed: true }) }}</td><td>{{ t.reason }}</td>
            </tr>
          </tbody>
        </table>
        <p v-else class="muted-note">{{ realBacktest.equity_curve.length ? 'No trade closed in this window.' : 'Saved summary of the last run. Re-run the backtest to see the curve and trades.' }}</p>
        <p v-if="assumptions" class="muted-note assumptions">{{ assumptions }}</p>
        <button class="deploy-btn rerun" :disabled="rerunning" @click="rerunReal">{{ rerunning ? 'Running…' : '↺ Re-run on real prices' }}</button>
        <span v-if="lastRealRunAt && !rerunning" class="muted-note"> Updated {{ fmtTime(lastRealRunAt) }}</span>
      </UICard>

      <UICard v-else title="Backtest on real prices" class="real-bt">
        <template #action><UISourceChip source="pending" :note="backtestError ? `Backtest failed: ${backtestError}` : 'Not run yet.'" /></template>
        <UIValueTree :node="returnTree" size="lg" class="real-return" />
        <div class="real-kpis">
          <UIStat label="Buy & hold" value="—" size="lg" />
          <UIStat label="Max drawdown" value="—" size="md" />
          <UIStat label="Closed trades" value="—" size="md" />
          <UIStat label="Win rate" value="—" size="md" />
          <UIStat label="Fees paid" value="—" size="md" />
        </div>
        <p v-if="backtestError" class="deploy-err" role="alert">{{ backtestError }}</p>
        <p v-else-if="rerunning" class="muted-note" aria-live="polite">Replaying real candles on the server…</p>
        <p v-else class="muted-note">Not run yet: replays this strategy's rules on real past candles (capital, fees and slippage from Settings).</p>
        <button class="deploy-btn rerun" :disabled="rerunning" @click="rerunReal">{{ rerunning ? 'Running…' : '↺ Run on real prices' }}</button>
      </UICard>

      <UICard v-if="realBacktest" title="Run this strategy on a wallet" class="deploy-card">
        <p v-if="!walletsList.length" class="muted-note">
          No wallet yet. <NuxtLink to="/trade">Create or import one</NuxtLink>, then come back.
        </p>
        <form v-else class="deploy-form" @submit.prevent="deployToWallet">
          <label>Wallet
            <select v-model="deployWalletId">
              <option v-for="w in walletsList" :key="w.id" :value="w.id">{{ w.label }} · {{ fmtMoneyKpi(Number(w.cash_usd)) }} free</option>
            </select>
          </label>
          <label>Capital (USD)
            <input v-model="deployCapital" type="number" min="10" step="any" inputmode="decimal" />
          </label>
          <button class="deploy-btn" :disabled="deploying">{{ deploying ? 'Launching…' : 'Run on wallet' }}</button>
        </form>
        <p v-if="deployError" class="deploy-err">{{ deployError }}</p>
        <p class="muted-note">Paper trading: the bot executes this strategy's rules on live prices with simulated dollars from the wallet.</p>
      </UICard>

      <UICard title="Simulated paths (Monte Carlo): synthetic prices, not history">
        <template #action>
          <div class="backtest-actions">
            <UISourceChip source="simulated" note="Synthetic price paths from a model, not market history." />
            <span class="sim-count">{{ simulations }} simulations</span>
            <button class="action ghost" @click="onRunBacktest" :disabled="isBacktesting">
              {{ isBacktesting ? `Running… ${backtestEngine.progress}%` : '↺ Run' }}
            </button>
          </div>
        </template>

        <p v-if="simError" class="deploy-err" role="alert">{{ simError }}</p>
        <ul v-if="simSkipped.length" class="bt-notes"><li v-for="(n, i) in simSkipped" :key="i">{{ n }}</li></ul>
        <p v-if="lastSimAt && !isBacktesting" class="muted-note">Last run {{ fmtTime(lastSimAt) }} (same rules give the same paths: the simulation is seeded).</p>

        <!-- Progress -->
        <div v-if="isBacktesting" class="backtest-progress">
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: `${backtestEngine.progress}%` }" />
          </div>
          <span class="progress-label">{{ backtestEngine.progress }}% — simulating {{ simulations }} synthetic price paths</span>
        </div>

        <!-- Results -->
        <template v-else-if="backtestResult">
          <UIMetricRow :cols="4">
            <UIStat label="Total Return" :value="backtestResult.metrics.totalReturnPct" tone="auto" suffix="%" size="lg" />
            <UIStat label="Annual Return" :value="backtestResult.metrics.annualReturn" tone="auto" suffix="%" size="md" />
            <UIStat label="Sharpe" :value="backtestResult.metrics.sharpeRatio" :precision="2" size="md" />
            <UIStat label="Sortino" :value="backtestResult.metrics.sortinoRatio" :precision="2" size="md" />
          </UIMetricRow>
          <UIMetricRow :cols="4">
            <UIStat label="Max DD" :value="-(backtestResult.metrics.maxDrawdownPct)" tone="negative" suffix="%" size="md" />
            <UIStat label="Volatility" :value="backtestResult.metrics.volatility" suffix="%" size="md" />
            <UIStat label="Win Rate" :value="backtestResult.metrics.winRate" suffix="%" size="md" />
            <UIStat label="Profit Factor" :value="backtestResult.metrics.profitFactor" :precision="2" size="md" />
          </UIMetricRow>
          <UIMetricRow :cols="4">
            <UIStat label="Calmar Ratio" :value="backtestResult.metrics.calmarRatio" :precision="3" size="sm" />
            <UIStat label="Total Trades" :value="backtestResult.metrics.totalTrades" :precision="0" size="sm" />
            <UIStat label="Winning / Losing" :value="`${backtestResult.metrics.winningTrades} / ${backtestResult.metrics.losingTrades}`" size="sm" />
            <UIStat label="Avg Win / Loss" :value="`${fmtMoneyKpi(backtestResult.metrics.avgWin)} / ${fmtMoneyKpi(backtestResult.metrics.avgLoss)}`" size="sm" />
          </UIMetricRow>
        </template>

        <!-- Empty / first visit -->
        <p v-else class="muted">
          Run a Monte Carlo simulation with {{ simulations }} paths to evaluate this strategy's risk-adjusted performance across varying market conditions.
        </p>
      </UICard>

      <!-- Community consensus on this strategy's assets -->
      <UICard v-if="strategy.target_assets?.length" title="Community Sentiment">
        <div class="consensus-grid">
          <StrategyConsensusMeter
            v-for="assetId in strategy.target_assets"
            :key="assetId"
            :asset-id="assetId"
            :compact="true"
          />
        </div>
      </UICard>
    </template>
  </div>

  <div v-else class="not-found">
    <h1>Strategy not found</h1>
    <NuxtLink to="/strategies">← Back to Trading Lab</NuxtLink>
  </div>
</template>

<style scoped>
.real-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: .6rem; }
.real-return { margin-bottom: .6rem; }
.real-verdict { margin: .8rem 0 .4rem; font-size: .85rem; color: var(--text-primary); }
.real-verdict .caveat { color: var(--text-secondary); }
.real-chart { display: grid; grid-template-columns: auto 1fr; grid-template-rows: auto auto; gap: .2rem .5rem; }
.y-axis { display: flex; flex-direction: column; justify-content: space-between; font-size: .68rem; color: var(--text-secondary); font-family: var(--font-market-data, monospace); }
.x-axis { grid-column: 2; display: flex; justify-content: space-between; font-size: .68rem; color: var(--text-secondary); }
.real-verdict .up, .real-trades .up { color: var(--app-color-up, #00ff88); }
.real-verdict .down, .real-trades .down { color: var(--app-color-down, #ff4444); }
.real-curve { width: 100%; height: 140px; color: var(--primary-blue, #3b82f6); margin: .4rem 0; }
.real-trades { width: 100%; border-collapse: collapse; font-size: .78rem; font-family: var(--font-market-data, monospace); }
.real-trades th { text-align: left; color: var(--text-secondary); font-weight: 500; padding: .3rem; }
.real-trades td { padding: .3rem; border-top: 1px solid var(--border-primary); }
.muted-note { color: var(--text-secondary); font-size: .8rem; }
.deploy-form { display: flex; gap: .8rem; align-items: flex-end; flex-wrap: wrap; }
.deploy-form label { display: flex; flex-direction: column; gap: .3rem; font-size: .8rem; color: var(--text-secondary); }
.deploy-form select, .deploy-form input { padding: .5rem .6rem; border-radius: 6px; border: 1px solid var(--border-primary); background: var(--surface-sunken, transparent); color: var(--text-primary); font: inherit; }
.deploy-btn { padding: .55rem 1rem; border: 0; border-radius: 8px; background: var(--primary-blue, #3b82f6); color: #fff; font-weight: 600; cursor: pointer; }
.deploy-btn:disabled { opacity: .5; }
.rerun { margin-top: .6rem; }
.deploy-err { color: var(--app-color-down, #ff4444); font-size: 0.85rem; }
.bt-error {
  display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem;
  padding: 0.55rem 0.75rem; border-radius: 8px; font-size: 0.82rem;
  border: 1px solid var(--app-color-down, #ff4444);
  background: color-mix(in srgb, var(--app-color-down, #ff4444) 10%, transparent);
  color: var(--text-primary, #fff);
}
.bt-notes { margin: 0; padding-left: 1.1rem; font-size: 0.75rem; color: var(--text-secondary); }
.top-source { display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap; }
.assumptions { margin: 0.4rem 0 0; }
.strategy-detail {
  display: flex;
  flex-direction: column;
  gap: var(--page-gap, 0.6rem);
  min-width: 0;
}

.loading-shell {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-width: 0;
}
.skel-metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.4rem;
}
@media (max-width: 640px) {
  .skel-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

.not-found {
  text-align: center;
  padding: 3rem 1rem;
  color: rgba(255,255,255,0.5);
}
.not-found a { color: var(--primary-green, #00ff88); }

.action {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  color: rgba(255,255,255,0.85);
  padding: 0.35rem 0.7rem;
  border-radius: var(--app-border-radius, 6px);
  cursor: pointer;
  font-size: 0.7rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  font-weight: 700;
  font-family: inherit;
}
.action:hover {
  border-color: var(--primary-green, #00ff88);
  color: var(--primary-green, #00ff88);
}
.action.ghost { font-weight: 600; }
.action:disabled { opacity: 0.5; cursor: not-allowed; }

.grid-3 {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr));
  gap: 0.6rem;
  min-width: 0;
}
.grid-3 > * { min-width: 0; }

.link-btn {
  color: var(--primary-green, #00ff88);
  font-size: 0.7rem;
  text-decoration: none;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.link-btn:hover { text-decoration: underline; }

.code-block {
  margin: 0;
  background: rgba(0,0,0,0.4);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: var(--app-border-radius, 6px);
  padding: 0.7rem 0.85rem;
  font-family: ui-monospace, Menlo, monospace;
  font-size: 0.72rem;
  line-height: 1.5;
  color: rgba(255,255,255,0.85);
  overflow-x: auto;
  white-space: pre;
  max-height: 320px;
  overflow-y: auto;
}

.tag-row { display: flex; flex-wrap: wrap; gap: 0.3rem; }
.tag {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.08);
  color: rgba(255,255,255,0.7);
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  padding: 2px 7px;
  border-radius: 999px;
  text-transform: uppercase;
}
.tag.info {
  background: rgba(0,170,255,0.08);
  border-color: rgba(0,170,255,0.25);
  color: var(--primary-blue, #00aaff);
}

.muted {
  font-size: 0.78rem;
  color: rgba(255,255,255,0.55);
  margin: 0.4rem 0 0 0;
  line-height: 1.5;
}

.backtest-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.sim-count {
  font-size: 0.62rem;
  color: var(--text-gray);
  font-variant-numeric: tabular-nums;
}
.backtest-progress {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}
.progress-bar {
  height: 6px;
  background: rgba(255,255,255,0.06);
  border-radius: 999px;
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  background: var(--primary-green);
  border-radius: 999px;
  transition: width 0.3s ease;
}
.progress-label {
  font-size: 0.65rem;
  color: var(--text-gray);
  font-variant-numeric: tabular-nums;
}
.consensus-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 0.5rem;
}
</style>
