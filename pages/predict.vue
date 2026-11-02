<template>
  <div class="predict">
    <header class="head">
      <div>
        <h1>Predict</h1>
        <p class="sub">Back a real-world outcome (Kalshi markets) with a paper bot: real prices, simulated fills, no real orders.</p>
        <nav class="next" aria-label="Other ways to predict">
          <NuxtLink to="/prices" class="link">Make a call on an asset →</NuxtLink>
          <NuxtLink :to="{ path: '/historic', query: { lane: 'prediction' }, hash: '#history-river' }" class="link">Your calls →</NuxtLink>
        </nav>
      </div>
      <NuxtLink to="/community" class="link">Community bots →</NuxtLink>
    </header>

    <div class="controls">
      <input v-model="q" type="search" placeholder="Search markets (e.g. Fed, election, NATO)…" aria-label="Search markets" @input="debounced()" />
      <UIOpChips
        label="Category"
        :options="categories.map(c => ({ id: c, label: c }))"
        :states="catStates"
        @cycle="id => cycleKey(catStates, id)"
      />
    </div>

    <p v-if="error" class="err">{{ error }}</p>
    <p v-else-if="loading && !markets.length" class="muted">Loading markets…</p>
    <p v-else class="muted small">{{ visibleMarkets.length.toLocaleString(APP_LOCALE) }} of {{ total.toLocaleString(APP_LOCALE) }} markets<template v-if="hiddenRows"> (top {{ markets.length.toLocaleString(APP_LOCALE) }} by volume loaded)</template> · sorted by 24 h volume · prices in ¢ (100¢ = $1 payout if right)</p>

    <ul class="list">
      <li v-for="m in visibleMarkets" :key="m.ticker" class="mkt" :class="{ open: selected === m.ticker }">
        <div class="mkt-main" role="button" tabindex="0" :aria-expanded="selected === m.ticker"
          @click="toggle(m.ticker)" @keydown.enter="toggle(m.ticker)">
          <div class="mkt-title">
            <span class="cat">{{ m.category }}</span>
            <b>{{ m.title }}</b>
            <span v-if="m.subtitle" class="opt">{{ m.subtitle }}</span>
          </div>
          <div v-if="quoted(m)" class="px">
            <span class="yes" :title="`Buy YES at ${m.yes_ask}¢`">YES {{ m.yes_ask }}¢</span>
            <span class="no" :title="`Buy NO at ${m.no_ask}¢`">NO {{ m.no_ask }}¢</span>
          </div>
          <div v-else class="px"><span class="noq" title="No one is offering on both sides right now">no quote</span></div>
          <div class="meta">
            <span>24h {{ compact(m.volume_24h) }}</span>
            <span>closes {{ day(m.close_time) }}</span>
          </div>
        </div>
        <PredictBotForm v-if="selected === m.ticker" :market="m" @launched="onLaunched" />
      </li>
    </ul>
    <!-- 50 markets per request and per render (a 200-row list was 98 KB + 2.7k DOM nodes: PERF-8, O8). -->
    <div v-if="hiddenRows" class="more">
      <button type="button" class="more-btn" :disabled="loading" @click="showMore(nextMarketLimit(limit, total))">
        {{ loading ? 'Loading…' : `Show ${Math.min(PREDICT_PAGE, loadable - markets.length)} more` }}
      </button>
      <button v-if="loadable - markets.length > PREDICT_PAGE" type="button" class="more-btn ghost" :disabled="loading" @click="showMore(PREDICT_MAX)">
        Show top {{ loadable.toLocaleString(APP_LOCALE) }}
      </button>
    </div>
    <p v-if="launchedMsg" class="ok" role="status">{{ launchedMsg }}</p>
  </div>
</template>

<script setup lang="ts">
import type { PredictMarket } from '~/server/api/predict/markets.get'
import { allowsValue, cycleKey, type FilterTriState } from '~/utils/priceFilters'
import { PREDICT_MAX, PREDICT_PAGE, nextMarketLimit, usePredictMarkets } from '~/composables/usePredictMarkets'

definePageMeta({ title: 'Predict', layout: 'default' })

const q = ref('')
const catStates = reactive<Record<string, FilterTriState>>({})
const markets = ref<PredictMarket[]>([])
const categories = ref<string[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref('')
const selected = ref<string | null>(null)
const launchedMsg = ref('')
const { listMarkets } = usePredictMarkets()
/** How many markets to ask the server for (50, then +50 per "Show more", server cap 200). */
const limit = ref(PREDICT_PAGE)

async function load() {
  loading.value = true
  error.value = ''
  try {
    const r = await listMarkets(q.value, limit.value)
    markets.value = r.markets
    categories.value = r.categories
    total.value = r.total
  } catch {
    error.value = "Couldn't reach Kalshi right now. Try again in a moment."
  } finally {
    loading.value = false
  }
}

let t: ReturnType<typeof setTimeout> | undefined
// A new search starts at 50 again.
const debounced = () => { clearTimeout(t); t = setTimeout(() => { limit.value = PREDICT_PAGE; load() }, 300) }
const visibleMarkets = computed(() => markets.value.filter(m => allowsValue(m.category, catStates)))
/** Markets the server can still send (its list is capped at 200). */
const loadable = computed(() => Math.min(PREDICT_MAX, total.value))
const hiddenRows = computed(() => Math.max(0, loadable.value - markets.value.length))
function showMore(next: number) {
  if (next <= limit.value) return
  limit.value = next
  load()
}
const toggle = (ticker: string) => { selected.value = selected.value === ticker ? null : ticker }
function onLaunched(name: string) {
  launchedMsg.value = `Bot launched on "${name}". Follow it in Trade, or see everyone's public bots in Community.`
  selected.value = null
}

// 0¢/100¢ asks mean an empty side of the book, not a price (an empty book is a valid 200 at Kalshi).
const inBook = (v: number | null) => v !== null && v > 0 && v < 100
const quoted = (m: PredictMarket) => inBook(m.yes_ask) && inBook(m.no_ask)
const compact = (n: number) => n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : `${Math.round(n)}`
const day = (iso: string) => new Date(iso).toLocaleDateString(APP_LOCALE, { year: 'numeric', month: 'short', day: 'numeric' })

onMounted(load)
</script>

<style scoped>
.predict { max-width: 1100px; margin: 0 auto; padding: 1rem; display: flex; flex-direction: column; gap: .8rem; color: var(--text-primary); }
.head { display: flex; justify-content: space-between; align-items: flex-end; gap: 1rem; flex-wrap: wrap; }
h1 { margin: 0 0 .2rem; }
.sub { margin: 0; color: var(--text-secondary); font-size: .9rem; }
.next { display: flex; gap: 1rem; flex-wrap: wrap; margin-top: .35rem; font-size: .85rem; }
.link { color: var(--primary-blue, #3b82f6); text-decoration: none; font-weight: 600; }
.controls { display: flex; flex-direction: column; gap: .6rem; }
.controls input { padding: .6rem .8rem; border-radius: 8px; border: 1px solid var(--border-primary); background: var(--surface-sunken, transparent); color: var(--text-primary); font: inherit; }
.chips { display: flex; gap: .35rem; flex-wrap: wrap; }
.chips button { padding: .3rem .7rem; border-radius: 999px; border: 1px solid var(--border-primary); background: transparent; color: var(--text-secondary); cursor: pointer; font-size: .78rem; }
.chips button.on { color: var(--text-primary); border-color: var(--border-accent); background: var(--surface-raised); }
.muted { color: var(--text-secondary); margin: 0; }
.small { font-size: .75rem; }
.err { color: var(--app-color-down, #ff4444); }
.ok { color: var(--app-color-up, #00ff88); }
.more { display: flex; gap: .5rem; justify-content: center; flex-wrap: wrap; }
.more-btn { padding: .45rem .9rem; border-radius: 8px; border: 1px solid var(--border-primary); background: var(--surface-raised, transparent); color: var(--text-primary); cursor: pointer; font: inherit; font-size: .82rem; }
.more-btn.ghost { background: transparent; color: var(--text-secondary); }
.more-btn:hover { border-color: var(--border-accent); }
.list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: .5rem; }
.mkt { border: 1px solid var(--border-primary); border-radius: var(--radius-md, 10px); background: var(--surface-raised, transparent); }
.mkt.open { border-color: var(--border-accent); }
.mkt-main { display: grid; grid-template-columns: 1fr auto auto; gap: 1rem; align-items: center; padding: .7rem .9rem; cursor: pointer; }
.mkt-title { display: flex; flex-direction: column; gap: .15rem; min-width: 0; }
.cat { font-size: .65rem; text-transform: uppercase; letter-spacing: .05em; color: var(--text-secondary); }
.opt { font-size: .82rem; color: var(--text-secondary); }
.px { display: flex; gap: .4rem; font-family: var(--font-market-data, monospace); font-size: .8rem; }
.px span { padding: .25rem .5rem; border-radius: 6px; white-space: nowrap; }
.yes { background: rgba(0, 200, 120, .12); color: var(--app-color-up, #00ff88); }
.noq { color: var(--text-secondary); border: 1px dashed var(--border-primary); }
.no { background: rgba(255, 68, 68, .12); color: var(--app-color-down, #ff4444); }
.meta { display: flex; flex-direction: column; font-size: .72rem; color: var(--text-secondary); text-align: right; white-space: nowrap; }
@media (max-width: 640px) { .mkt-main { grid-template-columns: 1fr; } .meta { flex-direction: row; gap: .8rem; text-align: left; } }
</style>
