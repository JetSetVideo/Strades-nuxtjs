<script setup lang="ts">import { ref, computed, onMounted } from 'vue'
import { useMacroStore } from '@/stores/macro'
import { useAssetsStore } from '@/stores/assets'
import { useAllocationStore } from '@/stores/allocation'
import { useOwnBook } from '@/composables/useOwnBook'
import { usePrimarySettings } from '@/composables/usePrimarySettings'
import UIPageHeader from '@/components/UI/PageHeader.vue'
import UICard from '@/components/UI/Card.vue'
import UIStat from '@/components/UI/Stat.vue'
import UIMetricRow from '@/components/UI/MetricRow.vue'
import UIPill from '@/components/UI/Pill.vue'
import UISourceChip from '@/components/UI/SourceChip.vue'
import UIValueTree from '@/components/UI/ValueTree.vue'
import AppSkeletonLoader from '@/components/App/SkeletonLoader.vue'
import StrategyConsensusMeter from '@/components/Strategy/ConsensusMeter.vue'
import AssetCommodityPipeline from '@/components/Asset/CommodityPipeline.vue'
import { OWN_BOOK_NOTE, emptyOwnBook } from '@/utils/ownBook'
import { CLASS_LABELS, heldExposureByClass, heldExposureRows, type PieClass } from '@/utils/walletBook'
import {
  CLASS_VOL_NOTE,
  RISK_BUDGET_NOTE,
  STRESS_PENDING_NOTE,
  classRiskRows,
  portfolioVolPct,
  riskBudgetMeaning,
  riskBudgetUsedPct,
  valueAtRisk,
  varParams,
} from '@/utils/riskBook'
import { DEFAULT_VOL_SOURCE, riskTrees } from '@/utils/riskTree'
import { fmtNumber, fmtPctFromFraction, fmtPctFromPercent } from '@/utils/format'
import { fmtMoneyKpi } from '@/utils/valueTree'

definePageMeta({ title: 'Risk & Exposure', layout: 'default' })

const macro = useMacroStore()
const assetsStore = useAssetsStore()
const allocation = useAllocationStore()

const loading = ref(true)

// ─── The signed-in account's own book ────────────────────────────────────────
// Custody paper wallets (cash + live bot equity) + /api/portfolio/ (cash + holdings).
// It used to read the demo wallets.json by user id: $0 for every real account, while
// the pie stayed on the 25/25/25/25 store default (board-finance F3, board-data P0 #1).
// C8: the same shared read as /wallet's KPI and the dock (composables/useOwnBook.ts).
const own = useOwnBook()
const book = computed(() => own.book.value ?? emptyOwnBook())
const bookState = computed(() => (own.state.value === 'idle' ? 'loading' : own.state.value))
const bookReady = computed(() => bookState.value === 'ready')
/** The raw rows the loader read: the Portfolio Value tree shows each part from them (utils/walletTree.ts). */
const bookRaw = computed(() => own.raw.value)

async function loadBook() {
  await own.refresh()
  // The shared allocation now holds the account's actual mix (Creator / Composer read it).
  if (own.state.value === 'ready' && own.book.value) allocation.setFromHoldings(own.book.value.pie)
}

// ─── The user's primary values (Settings): VaR confidence / horizon, days per year, drawdown alert ──
const primary = usePrimarySettings()
/** Signed out / not read → built-in defaults (95 % · 1 d · 365 d · 10 %), flagged "default". */
const params = computed(() => varParams(primary.values.value, primary.defaults.value, primary.status.value === 'ready'))
const paramsNote = computed(() => {
  if (params.value.fromSettings) return ''
  if (primary.status.value === 'error') return 'Default 95% · 1 d: your settings could not be read.'
  if (primary.status.value === 'signed-out') return 'Default 95% · 1 d: sign in to use your settings.'
  return 'Default 95% · 1 d until your settings are read.'
})

onMounted(async () => {
  await Promise.all([
    macro.fetchMacroState(),
    assetsStore.initializeStore(),
    loadBook(),
    primary.load(),
  ])
  loading.value = false
})

const bookReason = computed(() => {
  if (bookState.value === 'signed-out') return 'Sign in to read your own book.'
  if (bookState.value === 'error') return 'Your wallets could not be read right now.'
  if (bookState.value === 'loading') return 'Reading your wallets…'
  if (book.value.empty) return 'No paper wallet yet: create one in Trade. Values stay at 0.'
  return ''
})

// Money: fmtMoneyKpi (2 dp below $1M, compact above; utils/valueTree.ts). Percent: utils/format.ts
// (1 dp, 2 dp under 1 %). Portfolio Value, VaR and the VaR hint now print the same way ("$9,741.23").

// ─── Allocation: actual holdings of the book (zeros when there are none) ─────
const pie = computed(() => book.value.pie)

// ─── Asset class risk (volatility × allocation) ──────────────────────────────
const volatilityByClass = computed(() => macro.volatility_by_class ?? {
  fiat: 0.05, crypto: 0.7, stocks: 0.3, commodities: 0.35
})

const CLASS_COLOR: Record<string, string> = { fiat: '#4A90E2', crypto: '#F5A623', stocks: '#7ED321', commodities: '#F8E71C' }

const riskByClass = computed(() =>
  classRiskRows(pie.value, volatilityByClass.value).map(row => ({ ...row, color: CLASS_COLOR[row.class] })),
)

/** Σ w·σ (ρ = 1). The old "Total Risk Score" was this same number under a second label. */
const portfolioVol = computed(() => portfolioVolPct(riskByClass.value))

// ─── Value at Risk (your confidence and horizon; see utils/riskBook.ts) ─────
const portfolioValue = computed(() => (bookReady.value ? book.value.total : null))

/** The page's figure: classes independent (ρ = 0). */
const varUsd = computed(() => valueAtRisk(book.value.total, riskByClass.value, 0, params.value))
/** The other bound, shown in the one-line label: classes all move together (ρ = 1). */
const varTogether = computed(() => valueAtRisk(book.value.total, riskByClass.value, 1, params.value))
const varHint = computed(() => `Assumes the 4 classes move independently (ρ = 0); if they all moved together (ρ = 1): ${fmtMoneyKpi(varTogether.value)}.`)

// ─── Risk budget used: VaR ÷ (Portfolio Value × your drawdown alert) ────────
const budgetUsed = computed(() => riskBudgetUsedPct(bookReady.value ? varUsd.value : null, portfolioValue.value, params.value.alertDrawdownPct))
const budgetMeaning = computed(() => riskBudgetMeaning(budgetUsed.value, params.value, portfolioValue.value))

// ─── Value trees: each KPI opens to its formula, inputs and the settings that drive it ──
const volSource = computed(() => (macro.volatility_by_class ? DEFAULT_VOL_SOURCE : 'built-in fallback (macro state has none)'))
const trees = computed(() => riskTrees({
  state: bookState.value,
  raw: bookRaw.value,
  value: portfolioValue.value,
  rows: riskByClass.value,
  params: params.value,
  volSource: volSource.value,
  settings: primary.values.value,
  settingsDefaults: primary.defaults.value,
}))

// ─── Exposure: one row per asset YOUR book holds (REVIEW-6) ───────────────────
// risk = weight in the book × class vol (vol-weighted, ≤ 100 %). The old card listed 9 fixed assets the
// user may not hold and summed their vols per type (246 %). Without own holdings: a Sample list, chipped.
const heldRows = computed(() =>
  bookReady.value ? heldExposureRows(book.value.positions, book.value.total, volatilityByClass.value as Partial<Record<PieClass, number>>) : [])
const exposureIsOwn = computed(() => heldRows.value.length > 0)
const SAMPLE_EXPOSURE = ['btc', 'eth', 'aapl', 'eur']
const counterpartyExposure = computed(() => {
  if (exposureIsOwn.value) {
    return heldRows.value.slice(0, 10).map(r => ({
      name: `${r.symbol} — ${assetsStore.getAssetBySymbol(r.symbol)?.name ?? CLASS_LABELS[r.cls]}`,
      type: CLASS_LABELS[r.cls],
      risk: r.risk,
      weight: r.weightPct as number | null,
      id: assetsStore.getAssetBySymbol(r.symbol)?.id ?? r.symbol.toLowerCase(),
    }))
  }
  const rows: { name: string; type: string; risk: number; weight: number | null; id: string }[] = []
  for (const sym of SAMPLE_EXPOSURE) {
    const asset = assetsStore.getAssetBySymbol(sym.toUpperCase())
    if (!asset) continue
    const cls: PieClass = asset.type === 'cryptocurrency' ? 'crypto' : asset.type === 'stock' ? 'stocks' : asset.type === 'commodity' ? 'commodities' : 'fiat'
    // Sample: an asset at 25 % of a book, so the row reads like an own row (weight × vol) and stays ≤ 100 %.
    rows.push({ name: `${asset.symbol} — ${asset.name}`, type: CLASS_LABELS[cls], risk: 25 * Math.min(1, volatilityByClass.value[cls] ?? 0.3), weight: null, id: asset.id })
  }
  return rows.sort((a, b) => b.risk - a.risk)
})
const exposureReason = computed(() => {
  if (exposureIsOwn.value) return 'Assets your own book holds: weight in the book × class vol (vol-weighted).'
  if (!bookReady.value) return `Sample rows (4 assets at 25 % each): ${bookReason.value}`
  return 'Sample rows (4 assets at 25 % each): your book holds no asset yet, only cash. Buy one in Trade.'
})

// ─── Stress test ─────────────────────────────────────────────────────────────
// The old handler ran a backtest with `conditions: []` on BTC: it never entered a
// trade and always reported 0.0% "Resilient" (board-finance F4). The scenarios stay
// visible; the result is "—" until a strategy with an entry rule drives it.
const STRESS_LABELS: Record<string, string> = {
  supply_shock: 'Supply Shock',
  volatility_crisis: 'Volatility Crisis',
  commodity_spike: 'Commodity Spike',
  rate_hike: 'Rate Hike',
}
const stressScenario = ref<string | null>(null)

function runStressTest(scenario: string) {
  stressScenario.value = scenario
}

// ─── Exposure by type: Σ vol-weighted exposure per class (≤ 100 %) ────────────
const exposureByType = computed(() => {
  if (exposureIsOwn.value) return heldExposureByClass(heldRows.value).map(r => ({ type: CLASS_LABELS[r.cls], risk: r.risk }))
  const map: Record<string, number> = {}
  for (const e of counterpartyExposure.value) map[e.type] = Math.min(100, (map[e.type] ?? 0) + e.risk)
  return Object.entries(map).map(([type, risk]) => ({ type, risk })).sort((a, b) => b.risk - a.risk)
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
      <!-- ── Portfolio Value, VaR, Risk budget used: each opens to its formula, inputs and settings ── -->
      <UIMetricRow :cols="4" class="kpi-row">
        <div class="kpi">
          <UIValueTree :node="trees.value" size="lg" />
          <p class="kpi-hint">
            <UISourceChip :source="bookReady ? 'paper' : 'pending'" :note="bookReady ? OWN_BOOK_NOTE : bookReason" />
            <span>{{ bookReason || 'Your own paper book. Click the number to see its parts.' }}</span>
          </p>
        </div>
        <div class="kpi">
          <UIValueTree :node="trees.var" size="lg" />
          <p class="kpi-hint">
            <UISourceChip v-if="!params.fromSettings" source="pending" :note="paramsNote" />
            <span>{{ bookReady ? varHint : bookReason }}<template v-if="paramsNote"> {{ paramsNote }}</template></span>
          </p>
        </div>
        <div class="kpi">
          <UIValueTree :node="trees.budget" size="lg" />
          <p class="kpi-hint" :title="RISK_BUDGET_NOTE">{{ budgetMeaning }}</p>
        </div>
        <UIStat label="Portfolio Vol" :value="portfolioVol" suffix="%" size="lg" hint="Σ weight × class vol: assumes the classes move together (ρ = 1), an upper bound." />
      </UIMetricRow>

      <!-- ── Asset Class Risk Breakdown ─────────────────────────────── -->
      <UICard title="Risk by Asset Class">
        <p class="src-note">
          <UISourceChip source="sample" :note="CLASS_VOL_NOTE" />
          <span>Weights: your own book. Volatilities: bundled macro state (sample).</span>
        </p>
        <div class="risk-bars">
          <div v-for="r in riskByClass" :key="r.class" class="risk-row" :style="{ '--bar-color': r.color }">
            <span class="risk-class" :style="{ color: r.color }">{{ r.class.toUpperCase() }}</span>
            <div class="risk-bar-track">
              <div class="risk-bar-fill" :style="{ width: `${r.risk}%`, background: r.color }" />
            </div>
            <span class="risk-alloc">{{ fmtPctFromPercent(r.allocation) }}</span>
            <span class="risk-vol">{{ fmtPctFromFraction(r.volatility) }} vol</span>
            <span class="risk-score">{{ fmtNumber(r.risk, { decimals: 1 }) }}</span>
          </div>
        </div>
      </UICard>

      <!-- ── Allocation Pie Preview ─────────────────────────────────── -->
      <UICard title="Current Allocation">
        <p class="src-note">
          <UISourceChip :source="bookReady ? 'paper' : 'pending'" :note="bookReady ? OWN_BOOK_NOTE : bookReason" />
          <span>{{ bookReason || 'Share of your own paper book by class, from actual holdings.' }}</span>
        </p>
        <div class="alloc-preview">
          <div class="alloc-strip">
            <div
              v-for="r in riskByClass"
              :key="r.class"
              class="alloc-seg"
              :style="{ width: `${r.allocation}%`, background: r.color }"
              :title="`${r.class}: ${fmtPctFromPercent(r.allocation)}`"
            />
          </div>
          <div class="alloc-labels">
            <span v-for="r in riskByClass" :key="r.class" class="alloc-label" :style="{ color: r.color }">
              {{ r.class }}: {{ fmtPctFromPercent(r.allocation) }}
            </span>
          </div>
        </div>
      </UICard>

      <!-- ── Counterparty Exposure ──────────────────────────────────── -->
      <UICard title="Counterparty & Supply-Chain Exposure">
        <p class="src-note">
          <UISourceChip :source="exposureIsOwn ? 'paper' : 'sample'" :note="exposureReason" />
          <span>{{ exposureReason }}</span>
          <NuxtLink v-if="!exposureIsOwn" to="/trade" class="src-link">Trade →</NuxtLink>
        </p>
        <div class="counterparty-list">
          <div v-for="e in counterpartyExposure" :key="e.name" class="cp-row">
            <NuxtLink :to="`/assets/${e.id}`" class="cp-name">{{ e.name }}</NuxtLink>
            <UIPill :tone="e.risk > 40 ? 'danger' : e.risk > 20 ? 'warning' : 'success'" size="sm">
              {{ fmtPctFromPercent(e.risk) }} vol-weighted<template v-if="e.weight != null"> · {{ fmtPctFromPercent(e.weight) }} of book</template>
            </UIPill>
            <span class="cp-type">{{ e.type }}</span>
          </div>
        </div>
      </UICard>

      <!-- ── Exposure by Type ────────────────────────────────────────── -->
      <UICard title="Exposure by Counterparty Type">
        <p class="src-note">
          <UISourceChip :source="exposureIsOwn ? 'paper' : 'sample'" :note="exposureReason" />
          <span>Σ weight × class vol per type: never above 100 %.</span>
        </p>
        <div class="ex-type-list">
          <div v-for="e in exposureByType" :key="e.type" class="ex-row">
            <span class="ex-label">{{ e.type.replace('_', ' ') }}</span>
            <div class="ex-bar-track">
              <div class="ex-bar-fill" :style="{ width: `${Math.min(100, e.risk)}%` }" />
            </div>
            <span class="ex-val">{{ fmtPctFromPercent(e.risk) }}</span>
          </div>
        </div>
      </UICard>

      <!-- ── Stress Test ─────────────────────────────────────────────── -->
      <UICard title="Stress Test Scenarios">
        <p class="stress-desc">Simulate how your portfolio would hold up under extreme market conditions.</p>
        <div class="stress-grid">
          <button
            class="stress-btn"
            @click="runStressTest('supply_shock')"
          >
            <span class="stress-icon">⚡</span>
            <span class="stress-name">Supply Shock</span>
            <span class="stress-detail">+80% counterparty vol</span>
          </button>
          <button
            class="stress-btn"
            @click="runStressTest('volatility_crisis')"
          >
            <span class="stress-icon">🌪️</span>
            <span class="stress-name">Volatility Crisis</span>
            <span class="stress-detail">+60% market vol</span>
          </button>
          <button
            class="stress-btn"
            @click="runStressTest('commodity_spike')"
          >
            <span class="stress-icon">🛢️</span>
            <span class="stress-name">Commodity Spike</span>
            <span class="stress-detail">+70% commodity corr</span>
          </button>
          <button
            class="stress-btn"
            @click="runStressTest('rate_hike')"
          >
            <span class="stress-icon">📈</span>
            <span class="stress-name">Rate Hike</span>
            <span class="stress-detail">+40% fiat vol</span>
          </button>
        </div>

        <!-- Result: not computed until a strategy with an entry rule drives the scenario -->
        <div v-if="stressScenario" class="stress-result">
          <span class="result-text">{{ STRESS_LABELS[stressScenario] }} · projected max drawdown: <strong>—</strong></span>
          <UISourceChip source="pending" :note="STRESS_PENDING_NOTE" />
          <span class="result-why">not computed: needs a strategy with an entry rule</span>
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

/* KPI row: value trees open in place; the other tiles keep their height */
.kpi-row { align-items: start; }
.kpi { display: flex; flex-direction: column; gap: 0.25rem; min-width: 0; }
.kpi-hint {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.25rem 0.4rem;
  margin: 0;
  padding: 0 0.2rem;
  font-size: 0.6rem;
  line-height: 1.35;
  color: rgba(255,255,255,0.4);
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
a.cp-name { color: inherit; text-decoration: none; }
a.cp-name:hover { text-decoration: underline; }
.src-link { color: var(--primary-blue, #5b9cff); text-decoration: none; font-weight: 600; }
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
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  margin-top: var(--spacing-sm);
  font-size: 0.82rem;
}
.result-why { font-size: 0.7rem; color: var(--text-gray); }

/* Where a number comes from (wave 2 honest data) */
.src-note {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem 0.5rem;
  margin: 0 0 0.5rem;
  font-size: 0.7rem;
  line-height: 1.35;
  color: var(--text-gray);
}
.stat-sfx { font-size: 0.7em; font-weight: 500; color: rgba(255,255,255,0.55); }

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
