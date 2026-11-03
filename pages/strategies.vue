<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { allowsAny, allowsValue, type FilterTriState } from '~/utils/priceFilters'
import Carousel from '@/components/Carousel.vue'
import Filters from '@/components/Filters.vue'
import Comparator from '@/components/Comparator.vue'
import { useStrategies } from '@/composables/useStrategies'
import { useStrategiesStore } from '@/stores/strategies'
import { routeLabel } from '~/utils/routes'

// Title = utils/routes.ts label. definePageMeta is hoisted out of setup and cannot call
// routeLabel; tests/pageTitles.test.ts checks this literal against the registry.
definePageMeta({
  title: 'Lab',
  description: 'Your strategies, plus samples to start from',
  layout: 'default',
})

const PAGE_TITLE = routeLabel('/strategies')
const { strategies: allStrategies, fetchStrategies, deleteStrategy, toggleStrategyStatus, generateComplementary } = useStrategies()
const strategiesStore = useStrategiesStore()
// "My strategies" = the user's own; catalog samples are listed apart, labelled Sample.
const strategies = computed(() => allStrategies.value.filter(s => !s.sample))
const sampleStrategies = computed(() => allStrategies.value.filter(s => !!s.sample))

const selectedStrategies = ref<Record<string,any>[]>([])
const showComparator    = ref(false)
const sortBy            = ref('gain')
const runFocus          = ref<'running' | 'paused' | 'stopped' | null>(null)

function isRunning(status?: string) {
  return status === 'active' || status === 'backtesting'
}

function runBucket(status?: string): 'running' | 'paused' | 'stopped' {
  if (isRunning(status)) return 'running'
  if (status === 'paused') return 'paused'
  return 'stopped'
}

function runWord(status?: string) {
  if (isRunning(status)) return 'Pause'
  if (status === 'paused') return 'Resume'
  return 'Start'
}

function toggleRun(bucket: 'running' | 'paused' | 'stopped') {
  runFocus.value = runFocus.value === bucket ? null : bucket
}

interface FilterState {
  status: Record<string, FilterTriState>
  profitMin: number; profitMax: number
  drawdownMin: number; drawdownMax: number
  winRateMin: number; winRateMax: number
  assets: Record<string, FilterTriState>
  categories: Record<string, FilterTriState>
  frequency: Record<string, FilterTriState>
}

const currentFilters = ref<FilterState>({
  status: {},
  profitMin: -100, profitMax: 100,
  drawdownMin: -100, drawdownMax: 0,
  winRateMin: 0, winRateMax: 100,
  assets: {}, categories: {}, frequency: {},
})

// ── Filtering ────────────────────────────────────────────────────────────
const filteredStrategies = computed(() => {
  const f = currentFilters.value
  return strategies.value.filter((s: Record<string,any>) => {
    if (runFocus.value && runBucket(s.status) !== runFocus.value) return false
    if (!allowsValue(s.status, f.status)) return false

    const gain = s.monthlyGain ?? 0
    if (gain < f.profitMin || gain > f.profitMax) return false

    // monthlyDrawdown is stored as a positive magnitude (e.g. 12 meaning "12% drawdown"),
    // but the filter range is negative (min -100, max 0, worse = more negative) — normalize
    // before comparing or every strategy fails the default filter and the page looks empty.
    const dd = -Math.abs(s.monthlyDrawdown ?? 0)
    if (dd < f.drawdownMin || dd > f.drawdownMax) return false

    const wr = s.winRate ?? 0
    if (wr < f.winRateMin || wr > f.winRateMax) return false

    if (!allowsAny((s.targetAssets ?? []) as string[], f.assets)) return false

    if (!allowsValue(s.category, f.categories)) return false

    if (!allowsValue(s.frequency, f.frequency)) return false

    return true
  })
})

// ── Sorting ──────────────────────────────────────────────────────────────
const SORT_OPTIONS = [
  { id: 'gain',     label: '↑ Best Gain'    },
  { id: 'drawdown', label: '↓ Low Risk'     },
  { id: 'winrate',  label: '🏆 Win Rate'    },
  { id: 'sharpe',   label: '⚡ Sharpe'      },
  { id: 'newest',   label: '🕐 Newest'      },
  { id: 'trades',   label: '# Most Trades'  },
]

const bookState = computed(() => {
  const list = strategies.value as { status?: string }[]
  const running = list.filter(s => isRunning(s.status)).length
  const paused = list.filter(s => s.status === 'paused').length
  return { running, paused, stopped: list.length - running - paused }
})

const sortedStrategies = computed(() => {
  const list = [...filteredStrategies.value]
  switch (sortBy.value) {
    case 'gain':     return list.sort((a, b) => (b.monthlyGain ?? 0) - (a.monthlyGain ?? 0))
    case 'drawdown': return list.sort((a, b) => Math.abs(a.monthlyDrawdown ?? 0) - Math.abs(b.monthlyDrawdown ?? 0))
    case 'winrate':  return list.sort((a, b) => (b.winRate ?? 0) - (a.winRate ?? 0))
    case 'sharpe':   return list.sort((a, b) => ((b as any).sharpeRatio ?? 0) - ((a as any).sharpeRatio ?? 0))
    case 'newest':   return list.sort((a, b) => new Date(b.creationDate ?? 0).getTime() - new Date(a.creationDate ?? 0).getTime())
    case 'trades':   return list.sort((a, b) => (b.numberOfTrades ?? 0) - (a.numberOfTrades ?? 0))
    default:         return list
  }
})

// ── Selection ────────────────────────────────────────────────────────────
function handleStrategySelect(strategy: Record<string,any>) {
  const idx = selectedStrategies.value.findIndex(s => s.id === strategy.id)
  if (idx > -1) {
    selectedStrategies.value.splice(idx, 1)
  } else {
    // The grid renders from the summary shape (no current_capital/sharpe_ratio/
    // max_drawdown/total_trades) — the Comparator needs the full canonical
    // Strategy, so resolve by id against the store's raw array.
    const full = strategiesStore.strategies.find(s => s.id === strategy.id)
    selectedStrategies.value.push(full ?? strategy)
  }
  if (selectedStrategies.value.length < 2) showComparator.value = false
}

function clearSelection() {
  selectedStrategies.value = []
  showComparator.value = false
}

function swapSelection() {
  const list = selectedStrategies.value
  if (list.length < 2) return
  selectedStrategies.value = [list[1]!, list[0]!, ...list.slice(2)]
}

// ── Strategy actions ─────────────────────────────────────────────────────
function handleToggleStatus(id: string) { toggleStrategyStatus(id) }

async function handleClone(id: string) {
  try {
    await generateComplementary(id)
    clearSelection()
    await fetchStrategies()
  } catch { /* silent */ }
}

function handleDelete(id: string) {
  if (confirm('Delete this strategy? This cannot be undone.')) {
    deleteStrategy(id)
    selectedStrategies.value = selectedStrategies.value.filter(s => s.id !== id)
    if (selectedStrategies.value.length < 2) showComparator.value = false
  }
}

// ── Filters ───────────────────────────────────────────────────────────────
function handleFilterChange(filters: FilterState) {
  currentFilters.value = filters
}

onMounted(fetchStrategies)
</script>

<template>
  <div class="strategies-page">
    <NavigationAreaLinks area="lab" />

    <StrategySavedList />
    <StrategyLiveDesk
      :strategies="strategiesStore.ownStrategies"
      :running="bookState.running"
      :paused="bookState.paused"
      :stopped="bookState.stopped"
      :run-focus="runFocus"
      @focus="toggleRun"
    >
      <template #tools>
        <div id="strategy-filter-controls" class="filter-controls" />
        <div class="sort-wrap">
          <select v-model="sortBy" class="sort-select">
            <option v-for="opt in SORT_OPTIONS" :key="opt.id" :value="opt.id">
              {{ opt.label }}
            </option>
          </select>
        </div>
      </template>
    </StrategyLiveDesk>
    <StrategyBoard :strategies="strategiesStore.ownStrategies" :focus-ids="selectedStrategies.map(s => s.id)" />

    <!-- ── Page header: title + controls ── -->
    <div class="page-header">
      <div class="header-left">
        <h1 class="page-title">{{ PAGE_TITLE }}</h1>
        <span class="page-sub">My strategies</span>
        <span class="strategy-count">
          {{ sortedStrategies.length }}<span class="count-of"> / {{ strategies.length }}</span>
        </span>
      </div>
    </div>

    <!-- ── Filters ── -->
    <Filters @filter-changed="handleFilterChange" />

    <!-- ── Main content ── -->
    <div class="content-area">

      <p v-if="!strategies.length" class="own-empty">No strategy</p>

      <!-- Carousel: featured + compact row -->
      <Carousel
        v-else
        :strategies="sortedStrategies"
        :selectedStrategies="selectedStrategies"
        @select-strategy="handleStrategySelect"
        @toggle="s => handleToggleStatus(s.id)"
        @delete="s => handleDelete(s.id)"
        @view="s => navigateTo(`/strategy/${s.id}`)"
        @copy="s => navigateTo(`/creator?id=${s.id}`)"
      />

      <!-- Catalog samples: not the user's. Same full cards as the user's own, each chipped Sample (founder 11-02). -->
      <section v-if="sampleStrategies.length" class="sample-list" aria-label="Sample strategies">
        <h2 class="sample-head">Sample strategies <UISourceChip source="sample" /></h2>
        <Carousel
          :strategies="sampleStrategies"
          @view="s => navigateTo(`/strategy/${s.id}`)"
          @copy="s => navigateTo(`/creator?id=${s.id}`)"
        />
      </section>

    </div>

    <!-- ── Selection action bar (floating) ── -->
    <Transition name="sel-bar">
      <div v-if="selectedStrategies.length" class="selection-bar">
        <span class="sel-count">
          {{ selectedStrategies.length }} selected
          <span v-if="selectedStrategies.length === 2" class="compare-hint">— ready to compare</span>
        </span>
        <div class="sel-actions">
          <template v-if="selectedStrategies.length === 1 && selectedStrategies[0]">
            <button
              class="sel-btn toggle"
              @click="handleToggleStatus(selectedStrategies[0]!.id)"
            >
              {{ runWord(selectedStrategies[0]!.status) }}
            </button>
            <NuxtLink
              :to="`/strategy/${selectedStrategies[0]!.id}?tab=backtest`"
              class="sel-btn"
            >↺ Backtest</NuxtLink>
            <NuxtLink
              :to="`/creator?edit=${selectedStrategies[0]!.id}`"
              class="sel-btn edit"
            >✏ Edit</NuxtLink>
            <button
              class="sel-btn delete"
              @click="handleDelete(selectedStrategies[0]!.id)"
            >🗑 Delete</button>
          </template>
          <button
            v-if="selectedStrategies.length === 2"
            class="sel-btn compare"
            :class="{ on: showComparator }"
            :aria-pressed="showComparator"
            @click="showComparator = !showComparator"
          >{{ showComparator ? 'Hide' : '⚖ Compare' }}</button>
          <button class="sel-btn close" @click="clearSelection">✕</button>
        </div>
      </div>
    </Transition>

    <!-- ── Comparator ── -->
    <Comparator
      v-if="showComparator && selectedStrategies.length >= 2"
      :strategies="selectedStrategies"
      :on-close="() => { showComparator = false }"
      @clone="(id) => handleClone(id)"
      @swap="swapSelection"
    />

  </div>
</template>

<style scoped>
.strategies-page {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  padding: 0;
  min-height: 100%;
}

/* ── Page header ── */
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-sm);
  flex-wrap: wrap;
}

.header-left {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.page-title {
  font-size: 1.25rem;
  font-weight: 800;
  margin: 0;
  color: var(--text-white);
  letter-spacing: -0.01em;
}

@media (min-width: 768px) {
  .page-title { font-size: 1.45rem; }
}

.strategy-count {
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--text-white);
}
.page-sub { font-size: 0.8rem; color: var(--text-gray, #9aa); }
.own-empty { margin: 0.5rem 0 1rem; font-size: 0.9rem; font-weight: 700; color: #ff4d5e; }
.sample-list { margin-top: 1.25rem; display: flex; flex-direction: column; gap: 0.35rem; }
.sample-head { display: flex; align-items: center; gap: 0.4rem; margin: 0 0 0.25rem; font-size: 0.95rem; font-weight: 700; color: var(--text-white); }
.sample-row { display: flex; align-items: center; gap: 0.5rem; padding: 0.45rem 0.6rem; border-radius: 8px;
  border: 1px dashed rgba(255, 255, 255, 0.12); font-size: 0.85rem; }
.sample-name { color: var(--text-white); text-decoration: none; font-weight: 600; }
.sample-name:hover { text-decoration: underline; }
.sample-gain { margin-left: auto; font-variant-numeric: tabular-nums; }
.sample-gain[data-tone="pos"] { color: oklch(0.7 0.2 145); }
.sample-gain[data-tone="neg"] { color: oklch(0.65 0.2 25); }

.count-of { color: var(--text-gray); font-weight: 400; }

.filter-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}
.filter-controls:empty { display: none; }

/* Sort */
.sort-wrap { position: relative; }

.sort-select {
  padding: 7px 12px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-secondary);
  background: rgba(0,0,0,0.25);
  color: var(--text-light-gray);
  font-size: 0.72rem;
  cursor: pointer;
  outline: none;
  font-family: inherit;
  -webkit-appearance: none;
  appearance: none;
  padding-right: 24px;
}

.sort-select:focus { border-color: var(--border-accent); }

/* ── Content area ── */
.content-area {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

/* ── Selection bar ── */
.selection-bar {
  position: fixed;
  bottom: 70px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: 6px 10px;
  background: rgba(18, 18, 20, 0.92);
  backdrop-filter: blur(16px);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-lg);
  box-shadow: 0 8px 32px rgba(0,0,0,0.5);
  min-width: min(90vw, 420px);
  flex-wrap: wrap;
}

.sel-count {
  font-size: 0.72rem;
  color: var(--text-light-gray);
  flex: 1;
  white-space: nowrap;
}

.compare-hint {
  color: var(--primary-green);
  font-size: 0.65rem;
}

.sel-actions {
  display: flex;
  gap: 6px;
  align-items: center;
}

.sel-btn {
  font-size: 0.65rem;
  padding: 5px 10px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-secondary);
  background: transparent;
  color: var(--text-light-gray);
  cursor: pointer;
  transition: all 0.15s ease;
  font-family: inherit;
  white-space: nowrap;
}

.sel-btn:hover { background: rgba(255,255,255,0.08); color: var(--text-white); }
.sel-btn.delete { border-color: rgba(244,67,54,0.3); color: var(--error-red); }
.sel-btn.delete:hover { background: rgba(244,67,54,0.1); }
.sel-btn.compare {
  border-color: rgba(125, 255, 179, 0.55);
  color: #07140c;
  background: #7dffb3;
  font-weight: 700;
}
.sel-btn.compare:hover { background: #a8ffcf; }
.sel-btn.compare.on {
  background: transparent;
  color: #7dffb3;
}
.sel-btn.close { padding: 5px 8px; }

/* ── Transitions ── */
.sel-bar-enter-active,
.sel-bar-leave-active { transition: all 0.25s ease; }
.sel-bar-enter-from,
.sel-bar-leave-to { opacity: 0; transform: translateX(-50%) translateY(16px); }
</style>
