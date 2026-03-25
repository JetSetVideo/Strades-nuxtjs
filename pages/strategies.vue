<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import Carousel from '@/components/Carousel.vue'
import Filters from '@/components/Filters.vue'
import Comparator from '@/components/Comparator.vue'
import { useStrategies } from '@/composables/useStrategies'

const { strategies, fetchStrategies, updateStrategy, deleteStrategy, toggleStrategyStatus } = useStrategies()

const selectedStrategies = ref<Record<string,any>[]>([])
const showComparator    = ref(false)
const sortBy            = ref('gain')

interface FilterState {
  status: string
  profitMin: number; profitMax: number
  drawdownMin: number; drawdownMax: number
  winRateMin: number; winRateMax: number
  assets: string[]
  categories: string[]
  frequency: string[]
  search: string
}

const currentFilters = ref<FilterState>({
  status: 'all',
  profitMin: -100, profitMax: 100,
  drawdownMin: -100, drawdownMax: 0,
  winRateMin: 0, winRateMax: 100,
  assets: [], categories: [], frequency: [],
  search: '',
})

// ── Filtering ────────────────────────────────────────────────────────────
const filteredStrategies = computed(() => {
  const f = currentFilters.value
  return strategies.value.filter((s: Record<string,any>) => {
    if (f.status !== 'all' && s.status !== f.status) return false

    if (f.search) {
      const q = f.search.toLowerCase()
      const haystack = `${s.name} ${s.description} ${s.creator} ${(s.tags ?? []).join(' ')}`.toLowerCase()
      if (!haystack.includes(q)) return false
    }

    const gain = s.monthlyGain ?? 0
    if (gain < f.profitMin || gain > f.profitMax) return false

    const dd = s.monthlyDrawdown ?? 0
    if (dd < f.drawdownMin || dd > f.drawdownMax) return false

    const wr = s.winRate ?? 0
    if (wr < f.winRateMin || wr > f.winRateMax) return false

    if (f.assets.length) {
      const sa = (s.targetAssets ?? []) as string[]
      if (!f.assets.some((a: string) => sa.includes(a))) return false
    }

    if (f.categories.length && !f.categories.includes(s.category)) return false

    if (f.frequency.length && !f.frequency.includes(s.frequency)) return false

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
  if (idx > -1) selectedStrategies.value.splice(idx, 1)
  else          selectedStrategies.value.push(strategy)
  showComparator.value = selectedStrategies.value.length === 2
}

function clearSelection() {
  selectedStrategies.value = []
  showComparator.value = false
}

// ── Strategy actions ─────────────────────────────────────────────────────
function handleToggleStatus(id: string) { toggleStrategyStatus(id) }

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

    <!-- ── Page header: title + controls ── -->
    <div class="page-header">
      <div class="header-left">
        <h1 class="page-title">My Strategies</h1>
        <span class="strategy-count">
          {{ sortedStrategies.length }}<span class="count-of"> / {{ strategies.length }}</span>
        </span>
      </div>
      <div class="header-right">
        <!-- Sort control -->
        <div class="sort-wrap">
          <select v-model="sortBy" class="sort-select">
            <option v-for="opt in SORT_OPTIONS" :key="opt.id" :value="opt.id">
              {{ opt.label }}
            </option>
          </select>
        </div>

        <!-- New strategy CTA -->
        <NuxtLink to="/creator" class="new-strategy-btn">
          <span class="new-plus">+</span> New
        </NuxtLink>
      </div>
    </div>

    <!-- ── Filters ── -->
    <Filters @filter-changed="handleFilterChange" />

    <!-- ── Main content ── -->
    <div class="content-area">

      <!-- Carousel: featured + compact row -->
      <Carousel
        :strategies="sortedStrategies"
        :selectedStrategies="selectedStrategies"
        @select-strategy="handleStrategySelect"
        @toggle="s => handleToggleStatus(s.id)"
        @delete="s => handleDelete(s.id)"
        @view="s => navigateTo(`/profile/${s.creator}`)"
        @share="() => {}"
        @copy="() => {}"
      />

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
              {{ selectedStrategies[0]!.status === 'active' ? '⏸ Pause' : '▶ Start' }}
            </button>
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
            @click="showComparator = true"
          >⚖ Compare</button>
          <button class="sel-btn close" @click="clearSelection">✕</button>
        </div>
      </div>
    </Transition>

    <!-- ── Comparator ── -->
    <Comparator v-if="showComparator" :strategies="selectedStrategies" />

  </div>
</template>

<style scoped>
.strategies-page {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  min-height: 100vh;
  padding-bottom: 80px;
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
  font-size: 1.5rem;
  font-weight: 900;
  margin: 0;
  color: var(--text-white);
  letter-spacing: -0.01em;
}

@media (min-width: 768px) {
  .page-title { font-size: 2rem; }
  .strategies-page { padding: 1.5rem 2rem; }
}

.strategy-count {
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--text-white);
}

.count-of { color: var(--text-gray); font-weight: 400; }

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

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

/* New button */
.new-strategy-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 8px 14px;
  border-radius: var(--radius-md);
  background: rgba(0,255,136,0.12);
  border: 1px solid rgba(0,255,136,0.3);
  color: var(--primary-green);
  font-size: 0.72rem;
  font-weight: 700;
  text-decoration: none;
  transition: all 0.15s ease;
}

.new-strategy-btn:hover {
  background: rgba(0,255,136,0.2);
  border-color: rgba(0,255,136,0.5);
}

.new-plus {
  font-size: 1rem;
  line-height: 1;
  font-weight: 400;
}

/* ── Content area ── */
.content-area {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
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
  padding: 10px 16px;
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
.sel-btn.compare { border-color: rgba(0,255,136,0.3); color: var(--primary-green); }
.sel-btn.compare:hover { background: rgba(0,255,136,0.1); }
.sel-btn.close { padding: 5px 8px; }

/* ── Transitions ── */
.sel-bar-enter-active,
.sel-bar-leave-active { transition: all 0.25s ease; }
.sel-bar-enter-from,
.sel-bar-leave-to { opacity: 0; transform: translateX(-50%) translateY(16px); }
</style>
