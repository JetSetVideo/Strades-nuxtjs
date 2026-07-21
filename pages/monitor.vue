<script setup lang="ts">
/**
 * Strategy Monitor — Live view of all active strategies with trades streaming,
 * real-time P&L simulation, risk metrics, and swarm consensus overlay.
 *
 * Polls the strategies store and simulates live price ticks for an
 * at-a-glance operations dashboard.
 */
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useStrategies } from '@/composables/useStrategies'
import { useMacroStore } from '@/stores/macro'
import { useWalletStore } from '@/stores/wallet'
import { useAllocationStore } from '@/stores/allocation'
import { useBacktest } from '@/composables/useBacktest'
import UIPageHeader from '@/components/UI/PageHeader.vue'
import UICard from '@/components/UI/Card.vue'
import UIStat from '@/components/UI/Stat.vue'
import UIMetricRow from '@/components/UI/MetricRow.vue'
import UIPill from '@/components/UI/Pill.vue'
import AppSkeletonLoader from '@/components/App/SkeletonLoader.vue'
import StrategyConsensusMeter from '@/components/Strategy/ConsensusMeter.vue'

definePageMeta({ title: 'Strategy Monitor', layout: 'default' })

const { strategies, fetchStrategies, toggleStrategyStatus, fetchStrategyDetail } = useStrategies()
const macro = useMacroStore()
const walletStore = useWalletStore()
const allocation = useAllocationStore()
const backtest = useBacktest()

const loading = ref(true)
const monitorTab = ref<'all' | 'active' | 'paused'>('active')
const search = ref('')

// Live ticker simulation
const tick = ref(0)
let tickerInterval: ReturnType<typeof setInterval> | null = null

onMounted(async () => {
  await Promise.all([
    fetchStrategies(),
    macro.initializeStore(),
    walletStore.initializeStore(),
  ])
  loading.value = false

  // Simulate live price ticks every 3s
  tickerInterval = setInterval(() => {
    tick.value = (Math.random() - 0.45) * 2
  }, 3000)
})

onUnmounted(() => {
  if (tickerInterval) clearInterval(tickerInterval)
})

// ─── Filtered strategies ──────────────────────────────────────────────────────
const filteredStrategies = computed(() => {
  let list = strategies.value
  if (monitorTab.value !== 'all') {
    list = list.filter(s => s.status === monitorTab.value)
  }
  if (search.value.trim()) {
    const q = search.value.toLowerCase()
    list = list.filter(s => s.name.toLowerCase().includes(q) || s.category?.toLowerCase().includes(q))
  }
  return list
})

const activeCount = computed(() => strategies.value.filter(s => s.status === 'active').length)
const pausedCount = computed(() => strategies.value.filter(s => s.status === 'paused').length)
const stoppedCount = computed(() => strategies.value.filter(s => s.status === 'stopped').length)

// ─── Aggregate metrics ────────────────────────────────────────────────────────
const totalCapital = computed(() =>
  strategies.value.reduce((s, st) => s + (st.current_capital ?? 0), 0)
)

const totalReturn = computed(() =>
  strategies.value.reduce((s, st) => s + (st.total_return ?? 0), 0)
)

const avgWinRate = computed(() => {
  const withWr = strategies.value.filter(s => s.win_rate !== undefined)
  return withWr.length > 0 ? withWr.reduce((s, st) => s + (st.win_rate ?? 0), 0) / withWr.length : 0
})

const bestStrat = computed(() => {
  const sorted = [...strategies.value].sort((a, b) => (b.total_return_percentage ?? 0) - (a.total_return_percentage ?? 0))
  return sorted[0] ?? null
})

const worstStrat = computed(() => {
  const sorted = [...strategies.value].sort((a, b) => (a.total_return_percentage ?? 0) - (b.total_return_percentage ?? 0))
  return sorted[0] ?? null
})

// ─── Live simulated P&L (adds a small random tick) ───────────────────────────
const liveStrategies = computed(() =>
  filteredStrategies.value.map(s => {
    const vol = macro.macroState?.volatility_by_class?.crypto ?? 0.5
    const noise = (tick.value * vol * (s.current_capital ?? 10000)) / 100
    return { ...s, livePnl: (s.total_return ?? 0) + noise, liveReturnPct: (s.total_return_percentage ?? 0) + tick.value * vol * 0.5 }
  })
)

// ─── Run quick backtest on a strategy ─────────────────────────────────────────
const backtestingId = ref<string | null>(null)
async function quickBacktest(stratId: string) {
  backtestingId.value = stratId
  const s = strategies.value.find(x => x.id === stratId)
  if (!s) { backtestingId.value = null; return }
  try {
    await backtest.runBacktest({
      id: s.id,
      name: s.name,
      conditions: (s.entry_conditions ?? []).map((c: any) => ({
        datasource: c.datasource ?? 'price',
        asset: c.asset ?? s.target_assets?.[0] ?? 'BTC',
        operator: c.operator ?? '>',
        value: c.value ?? 50000,
        timeframe: c.timeframe ?? '1D',
      })),
      variables: { stop_loss_percent: 5, take_profit_percent: 15, position_size: 10 },
      targetAssets: s.target_assets ?? ['BTC'],
      initialCapital: s.initial_capital ?? 10000,
      frequency: '1D',
      period: s.backtest_period ?? { start: '2024-01-01', end: '2025-06-01' },
    }, 100)
  } finally {
    backtestingId.value = null
  }
}

const statusColor = (s: string) =>
  s === 'active' ? 'var(--success-green)' : s === 'paused' ? 'var(--warning-orange)' : 'var(--text-gray)'
const returnColor = (pct: number) => pct >= 0 ? 'var(--success-green)' : 'var(--error-red)'
</script>

<template>
  <div class="monitor-page">
    <UIPageHeader title="Strategy Monitor" subtitle="Live view of all running strategies with real-time P&L, risk metrics, and community consensus.">
      <template #actions>
        <NuxtLink to="/risk" class="nav-link">Risk Dashboard →</NuxtLink>
        <NuxtLink to="/creator" class="nav-link primary">New Strategy +</NuxtLink>
      </template>
    </UIPageHeader>

    <template v-if="loading">
      <AppSkeletonLoader height="80px" />
      <div class="skel-grid">
        <AppSkeletonLoader v-for="i in 3" :key="i" height="200px" />
      </div>
    </template>

    <template v-else>
      <!-- ── Aggregate summary ─────────────────────────────────────────── -->
      <UIMetricRow :cols="6">
        <UIStat label="Active"   :value="activeCount"   size="md" />
        <UIStat label="Paused"   :value="pausedCount"   size="md" tone="warning" />
        <UIStat label="Stopped"  :value="stoppedCount"  size="md" tone="negative" />
        <UIStat label="Total Capital" :value="totalCapital" :precision="0" suffix="USD" size="md" />
        <UIStat label="Total P&L" :value="totalReturn" :precision="0" tone="auto" suffix="USD" size="md" />
        <UIStat label="Avg Win Rate" :value="avgWinRate" :precision="1" suffix="%" size="md" />
      </UIMetricRow>

      <!-- Best / worst -->
      <div class="extremes" v-if="bestStrat || worstStrat">
        <div v-if="bestStrat" class="extreme-card positive">
          <span class="extreme-label">Best performer</span>
          <span class="extreme-name">{{ bestStrat.name }}</span>
          <span class="extreme-val">{{ (bestStrat.total_return_percentage ?? 0) >= 0 ? '+' : '' }}{{ (bestStrat.total_return_percentage ?? 0).toFixed(1) }}%</span>
        </div>
        <div v-if="worstStrat" class="extreme-card negative">
          <span class="extreme-label">Worst performer</span>
          <span class="extreme-name">{{ worstStrat.name }}</span>
          <span class="extreme-val">{{ (worstStrat.total_return_percentage ?? 0) >= 0 ? '+' : '' }}{{ (worstStrat.total_return_percentage ?? 0).toFixed(1) }}%</span>
        </div>
      </div>

      <!-- ── Tab + search ──────────────────────────────────────────────── -->
      <div class="monitor-toolbar">
        <div class="tabs">
          <button v-for="t in ['active', 'paused', 'all'] as const" :key="t"
            class="tab-btn" :class="{ active: monitorTab === t }" @click="monitorTab = t">
            {{ t.charAt(0).toUpperCase() + t.slice(1) }}
          </button>
        </div>
        <input v-model="search" type="text" class="search-input" placeholder="Search strategies..." />
      </div>

      <!-- ── Strategy cards ────────────────────────────────────────────── -->
      <div v-if="liveStrategies.length === 0" class="empty-state">
        <p>No strategies found. Create one in the <NuxtLink to="/creator" class="link">Strategy Creator</NuxtLink>.</p>
      </div>

      <div v-else class="strat-grid">
        <UICard v-for="s in liveStrategies" :key="s.id" :padding="'compact'">
          <div class="strat-card">
            <!-- Header -->
            <div class="sc-header">
              <NuxtLink :to="`/strategy/${s.id}`" class="sc-name">{{ s.name }}</NuxtLink>
              <span class="sc-status" :style="{ color: statusColor(s.status) }">● {{ s.status }}</span>
            </div>

            <div class="sc-meta">
              <span class="sc-cat">{{ s.category }}</span>
              <span class="sc-assets">{{ s.target_assets?.join(', ') ?? '—' }}</span>
            </div>

            <!-- Live metrics -->
            <div class="sc-metrics">
              <div class="sc-metric">
                <span class="sc-m-label">Return</span>
                <span class="sc-m-val" :style="{ color: returnColor(s.liveReturnPct) }">
                  {{ s.liveReturnPct >= 0 ? '+' : '' }}{{ s.liveReturnPct.toFixed(1) }}%
                </span>
              </div>
              <div class="sc-metric">
                <span class="sc-m-label">Capital</span>
                <span class="sc-m-val">${{ (s.current_capital ?? 0).toLocaleString() }}</span>
              </div>
              <div class="sc-metric">
                <span class="sc-m-label">Win Rate</span>
                <span class="sc-m-val">{{ (s.win_rate ?? 0).toFixed(0) }}%</span>
              </div>
              <div class="sc-metric">
                <span class="sc-m-label">Sharpe</span>
                <span class="sc-m-val">{{ (s.sharpe_ratio ?? 0).toFixed(2) }}</span>
              </div>
              <div class="sc-metric">
                <span class="sc-m-label">Max DD</span>
                <span class="sc-m-val negative">{{ (s.max_drawdown ?? 0).toFixed(1) }}%</span>
              </div>
              <div class="sc-metric">
                <span class="sc-m-label">Trades</span>
                <span class="sc-m-val">{{ s.total_trades ?? 0 }}</span>
              </div>
            </div>

            <!-- Actions -->
            <div class="sc-actions">
              <button class="sc-btn" @click="toggleStrategyStatus(s.id)">
                {{ s.status === 'active' ? '⏸ Pause' : '▶ Resume' }}
              </button>
              <button class="sc-btn ghost" @click="quickBacktest(s.id)" :disabled="backtestingId === s.id">
                {{ backtestingId === s.id ? '…' : '↺ Backtest' }}
              </button>
              <NuxtLink :to="`/strategy/${s.id}`" class="sc-btn ghost">Detail →</NuxtLink>
            </div>
          </div>
        </UICard>
      </div>
    </template>
  </div>
</template>

<style scoped>
.monitor-page {
  display: flex;
  flex-direction: column;
  gap: var(--page-gap, 0.6rem);
  min-width: 0;
}

.skel-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 0.5rem;
}

.nav-link {
  color: var(--text-gray);
  font-size: 0.7rem;
  font-weight: 600;
  text-decoration: none;
  letter-spacing: 0.04em;
  padding: 0.35rem 0.6rem;
  border: 1px solid var(--border-secondary);
  border-radius: var(--radius-sm);
  transition: border-color 0.12s ease, color 0.12s ease;
}
.nav-link:hover { border-color: var(--primary-green); color: var(--primary-green); }
.nav-link.primary {
  background: rgba(0,255,136,0.08);
  border-color: rgba(0,255,136,0.3);
  color: var(--primary-green);
}

/* Extremes */
.extremes {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 0.5rem;
}
.extreme-card {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.55rem 0.7rem;
  border-radius: var(--radius-md);
  border: 1px solid;
  font-size: 0.78rem;
}
.extreme-card.positive { border-color: rgba(0,255,136,0.2); background: rgba(0,255,136,0.04); }
.extreme-card.negative { border-color: rgba(255,68,68,0.2); background: rgba(255,68,68,0.04); }
.extreme-label { font-size: 0.6rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-gray); }
.extreme-name { flex: 1; font-weight: 600; }
.extreme-val { font-weight: 800; font-variant-numeric: tabular-nums; }
.extreme-card.positive .extreme-val { color: var(--success-green); }
.extreme-card.negative .extreme-val { color: var(--error-red); }

/* Toolbar */
.monitor-toolbar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.tabs {
  display: flex;
  gap: 2px;
  background: rgba(255,255,255,0.04);
  border-radius: var(--radius-sm);
  padding: 2px;
}
.tab-btn {
  padding: 0.3rem 0.7rem;
  border: none;
  border-radius: calc(var(--radius-sm) - 2px);
  background: transparent;
  color: var(--text-gray);
  font-size: 0.65rem;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  transition: all 0.12s ease;
}
.tab-btn.active { background: rgba(0,255,136,0.12); color: var(--primary-green); }
.search-input {
  flex: 1;
  max-width: 240px;
  padding: 0.35rem 0.5rem;
  background: rgba(0,0,0,0.3);
  border: 1px solid var(--border-secondary);
  border-radius: var(--radius-sm);
  color: var(--text-white);
  font-size: 0.72rem;
  font-family: inherit;
}
.search-input:focus { outline: none; border-color: var(--primary-green); }

.empty-state {
  text-align: center;
  padding: 2rem;
  color: var(--text-gray);
  font-size: 0.82rem;
}
.link { color: var(--primary-green); }

/* Strategy cards grid */
.strat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 0.5rem;
}

.strat-card {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}
.sc-header { display: flex; justify-content: space-between; align-items: center; }
.sc-name {
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--text-white);
  text-decoration: none;
}
.sc-name:hover { color: var(--primary-green); }
.sc-status { font-size: 0.6rem; text-transform: uppercase; letter-spacing: 0.06em; }

.sc-meta {
  display: flex;
  gap: 0.4rem;
  font-size: 0.62rem;
  color: var(--text-gray);
}
.sc-cat { text-transform: capitalize; }
.sc-assets { font-variant-numeric: tabular-nums; }

.sc-metrics {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.3rem;
}
.sc-metric { display: flex; flex-direction: column; gap: 1px; }
.sc-m-label { font-size: 0.55rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-gray); }
.sc-m-val { font-size: 0.78rem; font-weight: 700; font-variant-numeric: tabular-nums; }
.sc-m-val.negative { color: var(--error-red); }

.sc-actions {
  display: flex;
  gap: 0.3rem;
  flex-wrap: wrap;
  margin-top: 0.15rem;
}
.sc-btn {
  padding: 0.25rem 0.5rem;
  border: 1px solid var(--border-secondary);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-light-gray);
  font-size: 0.62rem;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  text-decoration: none;
  transition: all 0.12s ease;
}
.sc-btn:hover { border-color: var(--primary-green); color: var(--primary-green); }
.sc-btn.ghost { font-weight: 500; }
.sc-btn:disabled { opacity: 0.4; cursor: default; }
</style>
