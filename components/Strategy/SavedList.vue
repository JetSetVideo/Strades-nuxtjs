<script setup lang="ts">
/**
 * Strategies saved on the server (built in the creator, backtested on real prices).
 * Before this list, a saved strategy vanished from the UI on reload (PROCESSES.md M3).
 */
import { TradingApiError, useTradingApi, type SavedStrategy } from '~/composables/useTradingApi'

const api = useTradingApi()
const items = ref<SavedStrategy[]>([])
const state = ref<'loading' | 'ready' | 'signed-out' | 'error'>('loading')
const deleting = ref<string | null>(null)

async function load() {
  try {
    items.value = await api.listStrategies()
    state.value = 'ready'
  } catch (e) {
    state.value = e instanceof TradingApiError && e.status === 401 ? 'signed-out' : 'error'
  }
}
onMounted(load)

async function remove(s: SavedStrategy) {
  deleting.value = s.id
  try { await api.deleteStrategy(s.id); items.value = items.value.filter(x => x.id !== s.id) } catch { /* keep row */ }
  deleting.value = null
}

const pct = (v?: number | null) => (v === undefined || v === null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`)
const tone = (s: SavedStrategy) => {
  const r = s.last_backtest.return_pct, b = s.last_backtest.benchmark?.buy_hold_pct
  return r === undefined || b === undefined ? '' : r >= b ? 'up' : 'down'
}
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(APP_LOCALE, { month: 'short', day: 'numeric' }) : '')
</script>

<template>
  <section class="saved" aria-labelledby="saved-h">
    <header>
      <h2 id="saved-h">Saved strategies <small>backtested on real prices</small></h2>
    </header>
    <p v-if="state === 'loading'" class="muted">Loading…</p>
    <p v-else-if="state === 'signed-out'" class="muted">Sign in to see the strategies you saved.</p>
    <p v-else-if="state === 'error'" class="muted">Couldn't load saved strategies.</p>
    <p v-else-if="!items.length" class="muted">Nothing saved yet. Build one in the Strategy Creator and press Backtest.</p>
    <table v-else>
      <thead><tr><th>Strategy</th><th>Market</th><th>Last backtest</th><th>Buy &amp; hold</th><th>Max DD</th><th>Closed</th><th>Win rate</th><th></th></tr></thead>
      <tbody>
        <tr v-for="s in items" :key="s.id">
          <td><NuxtLink :to="`/strategy/${s.id}?tab=backtest`">{{ s.name }}</NuxtLink></td>
          <td>{{ s.assets_entry }} · {{ s.frequency }}</td>
          <td :class="tone(s)">{{ pct(s.last_backtest.return_pct) }} <small>{{ day(s.last_backtest_at) }}</small></td>
          <td>{{ pct(s.last_backtest.benchmark?.buy_hold_pct) }}</td>
          <td>{{ s.last_backtest.metrics ? pct(-s.last_backtest.metrics.max_dd_pct) : '—' }}</td>
          <td>{{ s.last_backtest.metrics?.trades ?? '—' }}</td>
          <td>{{ s.last_backtest.metrics?.win_rate === null || s.last_backtest.metrics?.win_rate === undefined ? '—' : `${s.last_backtest.metrics.win_rate.toFixed(0)}%` }}</td>
          <td><button class="del" :disabled="deleting === s.id" :aria-label="`Delete ${s.name}`" @click="remove(s)">Delete</button></td>
        </tr>
      </tbody>
    </table>
    <p v-if="items.length" class="muted small">Green/red compares each strategy with simply holding the same market over the same window.</p>
  </section>
</template>

<style scoped>
.saved { border: 1px solid var(--border-primary); border-radius: var(--radius-lg, 12px); padding: .55rem .7rem; margin: 0; }
h2 { margin: 0 0 .35rem; font-size: .92rem; }
h2 small { font-weight: 400; color: var(--text-secondary); font-size: .75rem; margin-left: .4rem; }
table { width: 100%; border-collapse: collapse; font-size: .8rem; }
th { text-align: left; color: var(--text-secondary); font-weight: 500; padding: .3rem; }
td { padding: .35rem .3rem; border-top: 1px solid var(--border-primary); font-family: var(--font-market-data, monospace); }
td a { color: var(--text-primary); }
td small { color: var(--text-secondary); }
.up { color: var(--app-color-up, #00ff88); }
.down { color: var(--app-color-down, #ff4444); }
.muted { color: var(--text-secondary); font-size: .85rem; margin: 0; }
.small { font-size: .72rem; margin-top: .5rem; }
.del { border: 0; background: none; color: var(--app-color-down, #ff4444); cursor: pointer; font: inherit; font-size: .75rem; }
@media (max-width: 640px) { th:nth-child(5), td:nth-child(5), th:nth-child(6), td:nth-child(6) { display: none; } }
</style>
