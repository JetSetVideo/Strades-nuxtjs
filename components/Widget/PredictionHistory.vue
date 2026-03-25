<script setup lang="ts">
/**
 * PredictionHistory Widget
 * Displays a user's full prediction history across all assets.
 * Intended for the Wallet > History section.
 *
 * Features:
 *  - Accuracy stats header (avg accuracy, streak, directional bias)
 *  - Filterable by asset, timeframe, status, direction
 *  - Sortable list of all recorded predictions
 *  - Color-coded outcomes with accuracy scores
 */
import { ref, computed } from 'vue'
import { usePredictionsStore } from '@/stores/predictions'

const props = withDefaults(defineProps<{
  userId?: string
  maxItems?: number
  showFilters?: boolean
}>(), {
  userId: 'current_user',
  maxItems: 50,
  showFilters: true,
})

const store = usePredictionsStore()
if (!store.initialized) { store.init(); store.seedFromFile() }

// ── Filters ─────────────────────────────────────────────────────────────────
const filterAsset     = ref('')
const filterStatus    = ref('all')    // 'all' | 'pending' | 'accurate' | 'missed' | 'expired'
const filterDirection = ref('all')    // 'all' | 'bullish' | 'bearish'
const filterTf        = ref('all')
const sortBy          = ref('newest') // 'newest' | 'oldest' | 'accuracy'
const showFiltersPanel = ref(false)

const TIMEFRAMES_OPTS = ['all', '1D', '1W', '1M', '3M', '6M', '1Y']

const allPredictions = computed(() => store.byUser(props.userId))

const filtered = computed(() => {
  let list = allPredictions.value
  if (filterAsset.value)              list = list.filter(p => p.assetId === filterAsset.value)
  if (filterStatus.value !== 'all')   list = list.filter(p => p.status  === filterStatus.value)
  if (filterDirection.value !== 'all') list = list.filter(p => p.direction === filterDirection.value)
  if (filterTf.value !== 'all')       list = list.filter(p => p.timeframe === filterTf.value)

  switch (sortBy.value) {
    case 'newest':   list = [...list].sort((a, b) => b.timestamp.localeCompare(a.timestamp)); break
    case 'oldest':   list = [...list].sort((a, b) => a.timestamp.localeCompare(b.timestamp)); break
    case 'accuracy': list = [...list].sort((a, b) => (b.accuracyScore ?? -1) - (a.accuracyScore ?? -1)); break
  }
  return list.slice(0, props.maxItems)
})

const stats = computed(() => store.statsForUser(props.userId))

const uniqueAssets = computed(() =>
  [...new Set(allPredictions.value.map(p => p.assetId))].sort()
)

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmtPrice(p: number) {
  if (p >= 1000) return '$' + p.toLocaleString('en-US', { maximumFractionDigits: 0 })
  if (p >= 1)    return '$' + p.toFixed(2)
  return '$' + p.toFixed(4)
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
}

function statusLabel(s: string) {
  return { accurate: '✓', missed: '✗', pending: '⏳', expired: '⊘' }[s] ?? '?'
}

function statusColor(s: string) {
  return {
    accurate: 'var(--success-green)',
    missed:   'var(--error-red)',
    pending:  'var(--warning-orange)',
    expired:  'var(--text-gray)',
  }[s] ?? 'var(--text-gray)'
}

function dirColor(d: string) {
  if (d === 'bullish') return 'var(--success-green)'
  if (d === 'bearish') return 'var(--error-red)'
  return 'var(--text-gray)'
}

const accuracyGradient = computed(() => {
  const pct = stats.value.avgAccuracy
  if (pct > 70) return `linear-gradient(to right, var(--success-green) ${pct}%, rgba(255,255,255,0.06) ${pct}%)`
  if (pct > 40) return `linear-gradient(to right, var(--warning-orange) ${pct}%, rgba(255,255,255,0.06) ${pct}%)`
  return `linear-gradient(to right, var(--error-red) ${pct}%, rgba(255,255,255,0.06) ${pct}%)`
})

function accuracyColor(score?: number) {
  if (score === undefined) return 'var(--text-gray)'
  if (score > 70) return 'var(--success-green)'
  if (score > 40) return 'var(--warning-orange)'
  return 'var(--error-red)'
}
</script>

<template>
  <div class="ph">
    <!-- ══ Stats header ══ -->
    <div class="ph-stats">
      <!-- Accuracy gauge -->
      <div class="ph-stat-block">
        <span class="ph-stat-lbl">Avg accuracy</span>
        <div class="ph-acc-bar" :style="{ background: accuracyGradient }" />
        <span class="ph-stat-val" :style="{ color: accuracyColor(stats.avgAccuracy) }">
          {{ stats.avgAccuracy }}%
        </span>
      </div>

      <!-- Totals -->
      <div class="ph-stat-block">
        <span class="ph-stat-lbl">Predictions</span>
        <span class="ph-stat-val">{{ stats.total }}</span>
      </div>

      <!-- Streak -->
      <div class="ph-stat-block">
        <span class="ph-stat-lbl">Streak</span>
        <span class="ph-stat-val" :style="{ color: stats.currentStreak > 2 ? 'var(--success-green)' : 'inherit' }">
          {{ stats.currentStreak }}🔥
        </span>
      </div>

      <!-- Directional bias -->
      <div class="ph-stat-block">
        <span class="ph-stat-lbl">Bias</span>
        <div class="ph-bias-bar">
          <div class="ph-bias-bull"
            :style="{ width: (stats.total ? stats.bullishCount / stats.total * 100 : 50) + '%' }" />
        </div>
        <span class="ph-stat-val">
          <span style="color:var(--success-green)">↑{{ stats.bullishCount }}</span>
          <span class="ph-bias-sep">/</span>
          <span style="color:var(--error-red)">↓{{ stats.bearishCount }}</span>
        </span>
      </div>

      <!-- Accurate / Missed -->
      <div class="ph-stat-block">
        <span class="ph-stat-lbl">Results</span>
        <span class="ph-stat-val">
          <span style="color:var(--success-green)">{{ stats.accurate }}✓</span>
          &nbsp;
          <span style="color:var(--error-red)">{{ stats.missed }}✗</span>
        </span>
      </div>
    </div>

    <!-- ══ Filter bar ══ -->
    <div v-if="showFilters" class="ph-filter-bar">
      <div class="ph-filter-left">
        <!-- Asset filter -->
        <select v-model="filterAsset" class="ph-select">
          <option value="">All assets</option>
          <option v-for="a in uniqueAssets" :key="a" :value="a">{{ a }}</option>
        </select>

        <!-- Status filter -->
        <select v-model="filterStatus" class="ph-select">
          <option value="all">All status</option>
          <option value="pending">⏳ Pending</option>
          <option value="accurate">✓ Accurate</option>
          <option value="missed">✗ Missed</option>
          <option value="expired">⊘ Expired</option>
        </select>

        <!-- Direction filter -->
        <select v-model="filterDirection" class="ph-select">
          <option value="all">All</option>
          <option value="bullish">↑ Bullish</option>
          <option value="bearish">↓ Bearish</option>
        </select>
      </div>

      <!-- Sort -->
      <div class="ph-filter-right">
        <span class="ph-count">{{ filtered.length }} predictions</span>
        <select v-model="sortBy" class="ph-select">
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="accuracy">Best accuracy</option>
        </select>
      </div>
    </div>

    <!-- ══ Table ══ -->
    <div class="ph-table-wrap">
      <!-- Header -->
      <div class="ph-row header">
        <span class="ph-col asset">Asset</span>
        <span class="ph-col dir">Dir</span>
        <span class="ph-col change">Prediction</span>
        <span class="ph-col tf">TF</span>
        <span class="ph-col date">Recorded</span>
        <span class="ph-col status">Result</span>
      </div>

      <!-- Empty -->
      <div v-if="!filtered.length" class="ph-empty">
        <span>No predictions yet.</span>
        <span class="ph-empty-hint">Use the Price Intuition widget on any asset.</span>
      </div>

      <!-- Rows -->
      <div
        v-for="p in filtered"
        :key="p.id"
        class="ph-row"
        :class="p.status"
      >
        <!-- Asset -->
        <span class="ph-col asset">
          <span class="ph-asset-id">{{ p.assetId }}</span>
          <span class="ph-asset-name">{{ p.assetName }}</span>
        </span>

        <!-- Direction -->
        <span class="ph-col dir" :style="{ color: dirColor(p.direction) }">
          {{ p.direction === 'bullish' ? '↑' : p.direction === 'bearish' ? '↓' : '→' }}
        </span>

        <!-- Predicted change + price -->
        <span class="ph-col change">
          <span class="ph-pred-pct" :style="{ color: dirColor(p.direction) }">
            {{ p.predictedChangePct >= 0 ? '+' : '' }}{{ p.predictedChangePct.toFixed(1) }}%
          </span>
          <span class="ph-pred-price-pair">
            {{ fmtPrice(p.currentPrice) }} → {{ fmtPrice(p.predictedPrice) }}
          </span>
          <span v-if="p.actualPrice" class="ph-actual-price">
            actual: {{ fmtPrice(p.actualPrice) }}
          </span>
        </span>

        <!-- Timeframe -->
        <span class="ph-col tf">
          <span class="ph-tf-chip">{{ p.timeframe }}</span>
        </span>

        <!-- Date -->
        <span class="ph-col date">
          <span class="ph-ts">{{ fmtDate(p.timestamp) }}</span>
          <span class="ph-target">→ {{ fmtDate(p.targetDate) }}</span>
        </span>

        <!-- Status + accuracy -->
        <span class="ph-col status">
          <span class="ph-status-icon" :style="{ color: statusColor(p.status) }">
            {{ statusLabel(p.status) }}
          </span>
          <span
            v-if="p.accuracyScore !== undefined"
            class="ph-accuracy-score"
            :style="{ color: accuracyColor(p.accuracyScore) }"
          >{{ p.accuracyScore }}%</span>
          <span v-if="p.note" class="ph-note-dot" :title="p.note">📝</span>
          <span v-if="p.latitude" class="ph-loc-dot" title="Location recorded">📍</span>
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ph {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  font-family: var(--font-family-secondary, 'Kanit', sans-serif);
  color: var(--text-white);
}

/* ── Stats header ── */
.ph-stats {
  display: flex;
  gap: var(--spacing-sm);
  flex-wrap: wrap;
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-lg);
}

.ph-stat-block {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  min-width: 70px;
}

.ph-stat-lbl {
  font-size: 0.52rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-gray);
}

.ph-stat-val {
  font-size: 0.88rem;
  font-weight: 800;
  line-height: 1;
}

/* Accuracy bar */
.ph-acc-bar {
  height: 3px;
  border-radius: 999px;
  width: 100%;
}

/* Bias bar */
.ph-bias-bar {
  height: 3px;
  background: rgba(255,68,68,0.4);
  border-radius: 999px;
  overflow: hidden;
  width: 100%;
}

.ph-bias-bull {
  height: 100%;
  background: var(--success-green);
  border-radius: 999px;
  transition: width 0.4s ease;
}

.ph-bias-sep { color: var(--text-gray); margin: 0 2px; }

/* ── Filter bar ── */
.ph-filter-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}

.ph-filter-left,
.ph-filter-right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.ph-select {
  padding: 5px 10px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-secondary);
  background: rgba(0,0,0,0.25);
  color: var(--text-light-gray);
  font-size: 0.65rem;
  cursor: pointer;
  outline: none;
  font-family: inherit;
  -webkit-appearance: none;
  appearance: none;
}

.ph-select:focus { border-color: var(--border-accent); }

.ph-count {
  font-size: 0.6rem;
  color: var(--text-gray);
  white-space: nowrap;
}

/* ── Table ── */
.ph-table-wrap {
  display: flex;
  flex-direction: column;
  gap: 3px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.ph-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-primary);
  transition: background 0.12s ease;
}

.ph-row:last-child { border-bottom: none; }

.ph-row:not(.header):hover { background: rgba(255,255,255,0.03); }

.ph-row.header {
  background: rgba(0,0,0,0.2);
  padding: 6px 12px;
}

.ph-row.accurate { border-left: 2px solid var(--success-green); }
.ph-row.missed   { border-left: 2px solid var(--error-red); }
.ph-row.pending  { border-left: 2px solid var(--warning-orange); }
.ph-row.expired  { border-left: 2px solid var(--text-gray); opacity: 0.6; }

/* Columns */
.ph-col {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ph-row.header .ph-col {
  font-size: 0.52rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-gray);
  flex-direction: row;
  align-items: center;
}

.ph-col.asset  { flex: 2; min-width: 60px; }
.ph-col.dir    { flex: 0 0 20px; align-items: center; font-size: 1rem; font-weight: 900; }
.ph-col.change { flex: 3; min-width: 0; }
.ph-col.tf     { flex: 0 0 30px; align-items: center; }
.ph-col.date   { flex: 2; min-width: 0; }
.ph-col.status { flex: 2; flex-direction: row; align-items: center; gap: 6px; }

.ph-asset-id   { font-size: 0.72rem; font-weight: 800; }
.ph-asset-name { font-size: 0.55rem; color: var(--text-gray); }

.ph-pred-pct   { font-size: 0.75rem; font-weight: 800; }
.ph-pred-price-pair { font-size: 0.55rem; color: var(--text-gray); }
.ph-actual-price { font-size: 0.55rem; color: var(--text-light-gray); font-weight: 600; }

.ph-tf-chip {
  font-size: 0.58rem;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 999px;
  background: rgba(255,255,255,0.06);
  border: 1px solid var(--border-secondary);
}

.ph-ts     { font-size: 0.62rem; }
.ph-target { font-size: 0.55rem; color: var(--text-gray); }

.ph-status-icon    { font-size: 0.8rem; font-weight: 800; flex-shrink: 0; }
.ph-accuracy-score { font-size: 0.62rem; font-weight: 700; }
.ph-note-dot,
.ph-loc-dot { font-size: 0.6rem; cursor: help; }

/* Empty state */
.ph-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: var(--spacing-lg);
  color: var(--text-gray);
  font-size: 0.78rem;
}

.ph-empty-hint {
  font-size: 0.62rem;
  opacity: 0.6;
}
</style>
