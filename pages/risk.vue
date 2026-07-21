<script setup lang="ts">import { ref, computed, onMounted } from 'vue'
import { useMacroStore } from '@/stores/macro'
import { useWalletStore } from '@/stores/wallet'
import { useAssetsStore } from '@/stores/assets'
import { useAllocationStore } from '@/stores/allocation'
import { useBacktest } from '@/composables/useBacktest'
import UIPageHeader from '@/components/UI/PageHeader.vue'
import UICard from '@/components/UI/Card.vue'
import UIStat from '@/components/UI/Stat.vue'
import UIMetricRow from '@/components/UI/MetricRow.vue'
import UIPill from '@/components/UI/Pill.vue'
import AppSkeletonLoader from '@/components/App/SkeletonLoader.vue'
import StrategyConsensusMeter from '@/components/Strategy/ConsensusMeter.vue'
import AssetCommodityPipeline from '@/components/Asset/CommodityPipeline.vue'

definePageMeta({ title: 'Risk & Exposure', layout: 'default' })

const macro = useMacroStore()
const walletStore = useWalletStore()
const assetsStore = useAssetsStore()
const allocation = useAllocationStore()
const backtest = useBacktest()

const loading = ref(true)
const stressTestResult = ref<number | null>(null)
const stressRunning = ref(false)

onMounted(async () => {
  await Promise.all([
    macro.initializeStore(),
    walletStore.initializeStore(),
    assetsStore.initializeStore()
  ])
  loading.value = false
})

// ─── Allocation pie ──────────────────────────────────────────────────────────
const pie = computed(() => allocation.allocationPie)

// ─── Asset class risk (volatility × allocation) ──────────────────────────────
const volatilityByClass = computed(() => macro.macroState?.volatility_by_class ?? {
  fiat: 0.05, crypto: 0.7, stocks: 0.3, commodities: 0.35
})

const riskByClass = computed(() => {
  const classes = ['fiat', 'crypto', 'stocks', 'commodities'] as const
  return classes.map(cls => ({
    class: cls,
    allocation: pie.value[cls] ?? 0,
    volatility: volatilityByClass.value[cls] ?? 0.2,
    risk: ((pie.value[cls] ?? 0) / 100) * (volatilityByClass.value[cls] ?? 0.2) * 100,
    color: cls === 'fiat' ? '#4A90E2' : cls === 'crypto' ? '#F5A623' : cls === 'stocks' ? '#7ED321' : '#F8E71C'
  }))
})

const totalRisk = computed(() =>
  riskByClass.value.reduce((s, r) => s + r.risk, 0)
)

// ─── Value at Risk (95% confidence, 1-day horizon) ───────────────────────────
const portfolioValue = computed(() => {
  const w = walletStore.getDefaultWallet('current_user')
  return w?.total_value ?? 10000
})

const var95 = computed(() => {
  // VaR = portfolioValue * sqrt(weighted variance) * 1.645
  let weightedVar = 0
  for (const r of riskByClass.value) {
    const w = r.allocation / 100
    weightedVar += (w * r.volatility / Math.sqrt(252)) ** 2
  }
  const dailyVol = Math.sqrt(weightedVar)
  const varLoss = portfolioValue.value * dailyVol * 1.645 // 95% CI
  return Math.round(varLoss * 100) / 100
})

// ─── Counterparty exposure from supply chain ─────────────────────────────────
const counterpartyExposure = computed(() => {
  const exposure: { name: string; type: string; risk: number }[] = []
  const supplyChainFiles = ['btc', 'eth', 'sol', 'aapl', 'amzn', 'tsla', 'usd', 'eur', 'cny']
  for (const sym of supplyChainFiles) {
    const asset = assetsStore.getAssetBySymbol(sym.toUpperCase())
    if (asset) {
      const vol = volatilityByClass.value[asset.type === 'cryptocurrency' ? 'crypto' : asset.type === 'stock' ? 'stocks' : 'fiat'] ?? 0.3
      exposure.push({
        name: `${asset.symbol} — ${asset.name}`,
        type: asset.type,
        risk: vol * 100
      })
    }
  }
  return exposure.sort((a, b) => b.risk - a.risk).slice(0, 10)
})

// ─── Stress test ─────────────────────────────────────────────────────────────
async function runStressTest(scenario: string) {
  stressRunning.value = true
  const config = {
    id: 'stress_test',
    name: scenario,
    conditions: [],
    variables: { stop_loss_percent: 10, take_profit_percent: 20, position_size: 100 },
    targetAssets: ['BTC'],
    initialCapital: portfolioValue.value,
    frequency: '1D',
    period: { start: new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10), end: new Date().toISOString().slice(0, 10) },
    counterpartyRiskFactor: scenario === 'supply_shock' ? 0.8 : scenario === 'volatility_crisis' ? 0.6 : 0.2,
    commodityCorrelation: scenario === 'commodity_spike' ? 0.7 : 0.3,
  }
  try {
    const result = await backtest.runBacktest(config, 100)
    stressTestResult.value = result.metrics.maxDrawdownPct
  } catch {
    stressTestResult.value = null
  }
  stressRunning.value = false
}

// ─── Exposure by counterparty type ───────────────────────────────────────────
const exposureByType = computed(() => {
  const map: Record<string, number> = {}
  for (const e of counterpartyExposure.value) {
    map[e.type] = (map[e.type] ?? 0) + e.risk
  }
  return Object.entries(map)
    .map(([type, risk]) => ({ type, risk }))
    .sort((a, b) => b.risk - a.risk)
})
</script>

<template>
  <div class="risk-page">
    <UIPageHeader title="Risk & Exposure" subtitle="Monitor and stress-test your portfolio risk across asset classes, counterparties, and commodities." />

    <template v-if="loading">
      <AppSkeletonLoader height="80px" />
      <AppSkeletonLoader height="200px" />
      <AppSkeletonLoader height="200px" />
    </template>

    <template v-else>
      <!-- ── Portfolio Value & VaR ──────────────────────────────────── -->
      <UIMetricRow :cols="4">
        <UIStat label="Portfolio Value" :value="portfolioValue" :precision="0" suffix="USD" size="lg" />
        <UIStat label="VaR (95% 1d)" :value="var95" :precision="0" suffix="USD" tone="negative" size="lg" />
        <UIStat label="Total Risk Score" :value="totalRisk" :precision="1" tone="auto" size="lg" />
        <UIStat label="Portfolio Vol" :value="riskByClass.reduce((s, r) => s + r.volatility * (r.allocation / 100), 0) * 100" :precision="1" suffix="%" size="lg" />
      </UIMetricRow>

      <!-- ── Asset Class Risk Breakdown ─────────────────────────────── -->
      <UICard title="Risk by Asset Class">
        <div class="risk-bars">
          <div v-for="r in riskByClass" :key="r.class" class="risk-row" :style="{ '--bar-color': r.color }">
            <span class="risk-class" :style="{ color: r.color }">{{ r.class.toUpperCase() }}</span>
            <div class="risk-bar-track">
              <div class="risk-bar-fill" :style="{ width: `${r.risk}%`, background: r.color }" />
            </div>
            <span class="risk-alloc">{{ r.allocation.toFixed(1) }}%</span>
            <span class="risk-vol">{{ (r.volatility * 100).toFixed(0) }}% vol</span>
            <span class="risk-score">{{ r.risk.toFixed(1) }}</span>
          </div>
        </div>
      </UICard>

      <!-- ── Allocation Pie Preview ─────────────────────────────────── -->
      <UICard title="Current Allocation">
        <div class="alloc-preview">
          <div class="alloc-strip">
            <div
              v-for="r in riskByClass"
              :key="r.class"
              class="alloc-seg"
              :style="{ width: `${r.allocation}%`, background: r.color }"
              :title="`${r.class}: ${r.allocation.toFixed(1)}%`"
            />
          </div>
          <div class="alloc-labels">
            <span v-for="r in riskByClass" :key="r.class" class="alloc-label" :style="{ color: r.color }">
              {{ r.class }}: {{ r.allocation.toFixed(1) }}%
            </span>
          </div>
        </div>
      </UICard>

      <!-- ── Counterparty Exposure ──────────────────────────────────── -->
      <UICard title="Counterparty & Supply-Chain Exposure">
        <div class="counterparty-list">
          <div v-for="e in counterpartyExposure" :key="e.name" class="cp-row">
            <span class="cp-name">{{ e.name }}</span>
            <UIPill :tone="e.risk > 40 ? 'danger' : e.risk > 20 ? 'warning' : 'success'" size="sm">
              {{ e.risk.toFixed(0) }}% risk
            </UIPill>
            <span class="cp-type">{{ e.type }}</span>
          </div>
        </div>
      </UICard>

      <!-- ── Exposure by Type ────────────────────────────────────────── -->
      <UICard title="Exposure by Counterparty Type">
        <div class="ex-type-list">
          <div v-for="e in exposureByType" :key="e.type" class="ex-row">
            <span class="ex-label">{{ e.type.replace('_', ' ') }}</span>
            <div class="ex-bar-track">
              <div class="ex-bar-fill" :style="{ width: `${e.risk * 1.5}%` }" />
            </div>
            <span class="ex-val">{{ e.risk.toFixed(0) }}%</span>
          </div>
        </div>
      </UICard>

      <!-- ── Stress Test ─────────────────────────────────────────────── -->
      <UICard title="Stress Test Scenarios">
        <p class="stress-desc">Simulate how your portfolio would hold up under extreme market conditions.</p>
        <div class="stress-grid">
          <button
            class="stress-btn"
            :disabled="stressRunning"
            @click="runStressTest('supply_shock')"
          >
            <span class="stress-icon">⚡</span>
            <span class="stress-name">Supply Shock</span>
            <span class="stress-detail">+80% counterparty vol</span>
          </button>
          <button
            class="stress-btn"
            :disabled="stressRunning"
            @click="runStressTest('volatility_crisis')"
          >
            <span class="stress-icon">🌪️</span>
            <span class="stress-name">Volatility Crisis</span>
            <span class="stress-detail">+60% market vol</span>
          </button>
          <button
            class="stress-btn"
            :disabled="stressRunning"
            @click="runStressTest('commodity_spike')"
          >
            <span class="stress-icon">🛢️</span>
            <span class="stress-name">Commodity Spike</span>
            <span class="stress-detail">+70% commodity corr</span>
          </button>
          <button
            class="stress-btn"
            :disabled="stressRunning"
            @click="runStressTest('rate_hike')"
          >
            <span class="stress-icon">📈</span>
            <span class="stress-name">Rate Hike</span>
            <span class="stress-detail">+40% fiat vol</span>
          </button>
        </div>

        <!-- Result -->
        <div v-if="stressRunning" class="stress-progress">
          <div class="spinner" />
          <span>Running Monte Carlo stress test...</span>
        </div>
        <div v-else-if="stressTestResult !== null" class="stress-result">
          <span class="result-icon">🔴</span>
          <span class="result-text">Projected max drawdown: <strong>{{ stressTestResult.toFixed(1) }}%</strong></span>
          <UIPill :tone="stressTestResult > 30 ? 'danger' : stressTestResult > 15 ? 'warning' : 'success'" size="sm">
            {{ stressTestResult > 30 ? 'High Risk' : stressTestResult > 15 ? 'Moderate' : 'Resilient' }}
          </UIPill>
        </div>
      </UICard>

      <!-- Community Consensus (sample assets) -->
      <UICard title="Community Sentiment on Holdings">
        <div class="consensus-grid">
          <StrategyConsensusMeter
            v-for="r in riskByClass.filter(r => r.allocation > 5)"
            :key="r.class"
            :asset-id="r.class"
            :compact="true"
          />
        </div>
      </UICard>

      <!-- Commodity Pipeline -->
      <UICard title="Commodity Pipeline — Strategy Exposure">
        <AssetCommodityPipeline :compact="true" />
      </UICard>
    </template>
  </div>
</template>

<style scoped>
.risk-page {
  display: flex;
  flex-direction: column;
  gap: var(--page-gap, 0.6rem);
  min-width: 0;
}

/* Risk bars */
.risk-bars { display: flex; flex-direction: column; gap: 0.5rem; }
.risk-row {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr) 60px 60px 40px;
  gap: 0.5rem;
  align-items: center;
  font-size: 0.72rem;
}
.risk-class { font-weight: 700; letter-spacing: 0.08em; font-size: 0.65rem; }
.risk-bar-track {
  height: 8px;
  background: rgba(255,255,255,0.06);
  border-radius: 999px;
  overflow: hidden;
}
.risk-bar-fill {
  height: 100%;
  border-radius: 999px;
  transition: width 0.5s ease;
}
.risk-alloc, .risk-vol { font-variant-numeric: tabular-nums; color: var(--text-light-gray); }
.risk-score { font-weight: 700; font-variant-numeric: tabular-nums; text-align: right; }

/* Allocation strip */
.alloc-preview { display: flex; flex-direction: column; gap: 0.4rem; }
.alloc-strip {
  display: flex;
  height: 12px;
  border-radius: 999px;
  overflow: hidden;
}
.alloc-seg { transition: width 0.5s ease; }
.alloc-labels {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.75rem;
  font-size: 0.65rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

/* Counterparty list */
.counterparty-list { display: flex; flex-direction: column; gap: 0.25rem; }
.cp-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem 0.5rem;
  background: rgba(255,255,255,0.02);
  border-radius: var(--radius-sm);
}
.cp-name { flex: 1; font-size: 0.78rem; }
.cp-type { font-size: 0.6rem; color: var(--text-gray); text-transform: capitalize; }

/* Exposure by type */
.ex-type-list { display: flex; flex-direction: column; gap: 0.4rem; }
.ex-row {
  display: grid;
  grid-template-columns: 120px minmax(0, 1fr) 50px;
  gap: 0.5rem;
  align-items: center;
}
.ex-label { font-size: 0.72rem; font-weight: 600; text-transform: capitalize; }
.ex-bar-track { height: 6px; background: rgba(255,255,255,0.06); border-radius: 999px; overflow: hidden; }
.ex-bar-fill { height: 100%; border-radius: 999px; background: var(--warning-orange); transition: width 0.5s ease; }
.ex-val { font-size: 0.72rem; font-weight: 700; font-variant-numeric: tabular-nums; text-align: right; }

/* Stress test */
.stress-desc {
  font-size: 0.78rem;
  color: var(--text-gray);
  margin: 0 0 var(--spacing-sm);
}
.stress-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 0.5rem;
}
.stress-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
  padding: 0.75rem 0.5rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-family: inherit;
  color: var(--text-white);
  transition: border-color 0.15s ease, background 0.15s ease;
}
.stress-btn:hover:not(:disabled) { border-color: var(--border-accent); background: rgba(255,255,255,0.04); }
.stress-btn:disabled { opacity: 0.4; cursor: default; }
.stress-icon { font-size: 1.2rem; }
.stress-name { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; }
.stress-detail { font-size: 0.6rem; color: var(--text-gray); }

.stress-progress {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: var(--spacing-sm);
  font-size: 0.78rem;
  color: var(--text-gray);
}
.stress-result {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: var(--spacing-sm);
  font-size: 0.82rem;
}

/* Consensus grid */
.consensus-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 0.5rem;
}

/* Spinner */
.spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255,255,255,0.1);
  border-top-color: var(--primary-green);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
