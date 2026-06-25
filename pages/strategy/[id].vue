<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useStrategies } from '@/composables/useStrategies'
import { useAgentsStore } from '@/stores/agents'
import { useBotsStore } from '@/stores/bots'
import { seededRandom } from '@/composables/useSeededRandom'

import UIPageHeader from '@/components/UI/PageHeader.vue'
import UICard from '@/components/UI/Card.vue'
import UIStat from '@/components/UI/Stat.vue'
import UIPill from '@/components/UI/Pill.vue'
import UIMetricRow from '@/components/UI/MetricRow.vue'
import UISectionTabs, { type TabItem } from '@/components/UI/SectionTabs.vue'
import UIEmptyState from '@/components/UI/EmptyState.vue'
import AppSkeletonLoader from '@/components/App/SkeletonLoader.vue'

import StrategyEquityCurve from '@/components/Strategy/EquityCurve.vue'
import StrategyTradeList from '@/components/Strategy/TradeList.vue'
import StrategyRunByPanel from '@/components/Strategy/RunByPanel.vue'

definePageMeta({ title: 'Strategy', layout: 'default' })

const route = useRoute()
const strategyId = computed(() => String(route.params.id))

const { strategies, fetchStrategies, toggleStrategyStatus, backtestStrategy } = useStrategies()
const agents = useAgentsStore()
const bots = useBotsStore()

const loading = ref(true)
const tab = ref<'performance' | 'trades' | 'code' | 'backtest'>('performance')
const isBacktesting = ref(false)

onMounted(async () => {
  loading.value = true
  await Promise.all([
    fetchStrategies(),
    !agents.hydrated ? agents.fetchAgents() : Promise.resolve(),
    !bots.hydrated ? bots.fetchBots() : Promise.resolve()
  ])
  loading.value = false
})

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

const returnPct = computed(() => strategy.value?.total_return_percentage ?? 0)

const tabs = computed<TabItem[]>(() => [
  { id: 'performance', label: 'Performance' },
  { id: 'trades',      label: 'Trades',  count: strategy.value?.total_trades ?? null },
  { id: 'code',        label: 'Code' },
  { id: 'backtest',    label: 'Backtest' }
])

const lastRunRel = computed(() => {
  if (!strategy.value?.last_run) return '—'
  const days = Math.floor((Date.now() - new Date(strategy.value.last_run).getTime()) / 86_400_000)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days}d ago`
  return `${Math.floor(days / 30)}mo ago`
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

async function onRunBacktest() {
  if (!strategy.value) return
  isBacktesting.value = true
  try {
    await backtestStrategy(strategy.value.id)
  } finally {
    isBacktesting.value = false
  }
}

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
        <UIPill :tone="statusTone" show-dot>{{ strategy.status }}</UIPill>
        <button class="action" @click="onToggle" :title="strategy.status === 'active' ? 'Pause' : 'Resume'">
          {{ strategy.status === 'active' ? '⏸ Pause' : '▶ Resume' }}
        </button>
        <button class="action ghost" @click="onRunBacktest" :disabled="isBacktesting">
          {{ isBacktesting ? '…' : '↺ Backtest' }}
        </button>
      </template>
    </UIPageHeader>

    <UIMetricRow :cols="4">
      <UIStat label="Return"   :value="returnPct" tone="auto" suffix="%" :precision="2" size="lg" />
      <UIStat label="Capital"  :value="strategy.current_capital ?? 0" :precision="0" suffix="USD" size="md" />
      <UIStat label="Win rate" :value="strategy.win_rate ?? 0" suffix="%" :precision="0" size="md" />
      <UIStat label="Sharpe"   :value="strategy.sharpe_ratio ?? 0" :precision="2" size="md" />
    </UIMetricRow>

    <UISectionTabs v-model="tab" :tabs="tabs" />

    <!-- PERFORMANCE -->
    <template v-if="tab === 'performance'">
      <UICard title="Equity curve">
        <template #action><UIPill ghost tone="neutral">since inception</UIPill></template>
        <StrategyEquityCurve
          :seed="strategy.id"
          :initial-value="strategy.initial_capital ?? 10000"
          :final-value="strategy.current_capital ?? (strategy.initial_capital ?? 10000)"
        />
      </UICard>

      <div class="grid-3">
        <UICard title="Risk metrics">
          <UIMetricRow :cols="2">
            <UIStat label="Max DD"    :value="-(strategy.max_drawdown ?? 0)" tone="negative" suffix="%" :precision="1" size="sm" />
            <UIStat label="Vol (ann)" :value="strategy.performance_metrics?.volatility ?? 0" suffix="%" :precision="1" size="sm" />
            <UIStat label="Beta"      :value="strategy.performance_metrics?.beta ?? 0" :precision="2" size="sm" />
            <UIStat label="Alpha"     :value="strategy.performance_metrics?.alpha ?? 0" :precision="2" size="sm" tone="auto" />
          </UIMetricRow>
        </UICard>

        <UICard title="Trade stats">
          <UIMetricRow :cols="2">
            <UIStat label="Total trades" :value="strategy.total_trades ?? 0" size="sm" />
            <UIStat label="Successful"   :value="strategy.successful_trades ?? 0" tone="positive" size="sm" />
            <UIStat label="Avg duration" :value="strategy.average_trade_duration ?? '—'" size="sm" />
            <UIStat label="Last run"     :value="lastRunRel" size="sm" />
          </UIMetricRow>
        </UICard>

        <StrategyRunByPanel :agent="agent" :bots="attachedBots" />
      </div>
    </template>

    <!-- TRADES -->
    <template v-else-if="tab === 'trades'">
      <UICard title="Recent trades">
        <template #action>
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
          <NuxtLink to="/creator" class="link-btn">Edit in creator →</NuxtLink>
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
      <UICard title="Backtest summary">
        <template #action>
          <button class="action ghost" @click="onRunBacktest" :disabled="isBacktesting">
            {{ isBacktesting ? 'Running…' : '↺ Re-run' }}
          </button>
        </template>
        <UIMetricRow :cols="3">
          <UIStat label="Period" :value="`${strategy.backtest_period?.start ?? '—'} → ${strategy.backtest_period?.end ?? '—'}`" size="sm" />
          <UIStat label="Annual return" :value="strategy.performance_metrics?.annual_return ?? 0" tone="auto" suffix="%" :precision="1" size="md" />
          <UIStat label="Total return"  :value="returnPct" tone="auto" suffix="%" :precision="2" size="md" />
        </UIMetricRow>
        <p class="muted">
          Replays the strategy on historical data for the configured period. The metrics above reflect
          the most recent run. Adjust parameters in the Creator, then re-run to see impact.
        </p>
      </UICard>

      <UICard title="What's tested" padding="tight">
        <UIMetricRow :cols="4">
          <UIStat label="Win rate"   :value="strategy.win_rate ?? 0"               suffix="%" :precision="1" size="sm" />
          <UIStat label="Sharpe"     :value="strategy.sharpe_ratio ?? 0"           :precision="2" size="sm" />
          <UIStat label="Max DD"     :value="-(strategy.max_drawdown ?? 0)"        tone="negative" suffix="%" :precision="1" size="sm" />
          <UIStat label="Volatility" :value="strategy.performance_metrics?.volatility ?? 0" suffix="%" :precision="1" size="sm" />
        </UIMetricRow>
      </UICard>
    </template>
  </div>

  <div v-else class="not-found">
    <h1>Strategy not found</h1>
    <NuxtLink to="/strategies">← Back to Trading Lab</NuxtLink>
  </div>
</template>

<style scoped>
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
</style>
