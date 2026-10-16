<script setup lang="ts">
/**
 * Hand trading on the sample "Main Portfolio" (finance app, POST /api/portfolio/trade/).
 * The endpoint worked but had no control anywhere (PROCESSES.md §A6 / M8). Fills at the
 * asset's stored price (live for quoted assets via refresh_quotes). Paper money only, and it
 * is NOT the bot wallet on /trade, which the copy says plainly.
 */
import { TradingApiError, useTradingApi, type SamplePortfolio } from '~/composables/useTradingApi'
import { useAssetsStore } from '~/stores/assets'

const api = useTradingApi()
const assets = useAssetsStore()
const pf = ref<SamplePortfolio | null>(null)
const assetId = ref('btc')
const side = ref<'buy' | 'sell'>('buy')
const qty = ref('0.01')
const busy = ref(false)
const msg = ref<{ ok: boolean; text: string } | null>(null)
const state = ref<'loading' | 'ready' | 'signed-out' | 'error'>('loading')

async function load() {
  try { pf.value = await api.portfolio(); state.value = 'ready' }
  catch (e) { state.value = e instanceof TradingApiError && e.status === 401 ? 'signed-out' : 'error' }
}
onMounted(() => { load(); if (!assets.assets.length) assets.initializeStore() })

const tradable = computed(() => [...assets.assets].sort((a, b) => a.symbol.localeCompare(b.symbol)))
const price = computed(() => assets.getAssetById(assetId.value)?.current_price ?? 0)
const cost = computed(() => (Number(qty.value) || 0) * price.value)
const usd = (v: number | string) => Number(v).toLocaleString(APP_LOCALE, { style: 'currency', currency: 'USD' })

async function submit() {
  busy.value = true
  msg.value = null
  try {
    pf.value = await api.handTrade({ asset_id: assetId.value, type: side.value, quantity: Number(qty.value) }) as unknown as SamplePortfolio
    // Report the SERVER's fill (stored price), not the live quote shown in the picker: they can differ.
    const sym = assetId.value.toUpperCase()
    const fill = [...(pf.value.transactions ?? [])].filter(t => t.asset_symbol === sym)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0]
    const fillPrice = fill ? Number(fill.price) : price.value
    const gap = price.value ? Math.abs(fillPrice - price.value) / price.value : 0
    msg.value = { ok: true, text: `${side.value === 'buy' ? 'Bought' : 'Sold'} ${qty.value} ${sym} at ${usd(fillPrice)} (server fill)`
      + (gap > 0.001 ? `: the live quote was ${usd(price.value)}; the server's stored price is ${(gap * 100).toFixed(2)}% off.` : '.') }
  } catch (e) {
    msg.value = { ok: false, text: e instanceof TradingApiError ? e.message : 'Trade failed.' }
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="hand" aria-labelledby="hand-h">
    <header>
      <h3 id="hand-h">Hand trade <small>sample portfolio · paper money</small></h3>
      <span v-if="pf" class="cash">Cash {{ usd(pf.cash_balance) }}</span>
    </header>
    <p class="note">Buys and sells on this page's sample portfolio at the stored market price. Bots and your own paper wallet live in Trade.</p>
    <p v-if="state === 'signed-out'" class="note">Sign in to hand trade.</p>
    <form v-else class="row" @submit.prevent="submit">
      <div class="side-action" :class="side" role="group" aria-label="Buy or sell">
        <button
          type="submit"
          class="go"
          :disabled="busy || !(Number(qty) > 0)"
        >{{ busy ? '…' : side === 'buy' ? 'Buy' : 'Sell' }}</button>
        <button
          type="button"
          class="flip"
          :title="side === 'buy' ? 'Switch to Sell' : 'Switch to Buy'"
          :aria-label="side === 'buy' ? 'Switch to Sell' : 'Switch to Buy'"
          @click="side = side === 'buy' ? 'sell' : 'buy'"
        >⇄</button>
      </div>
      <input v-model="qty" type="number" min="0" step="any" inputmode="decimal" aria-label="Quantity" />
      <select v-model="assetId" aria-label="Asset">
        <option v-for="a in tradable" :key="a.id" :value="a.id">{{ a.symbol }} · {{ usd(a.current_price) }}{{ a.live ? '' : ' (sim)' }}</option>
      </select>
      <span class="cost">≈ {{ usd(cost) }}</span>
    </form>
    <p v-if="msg" :class="msg.ok ? 'ok' : 'err'">{{ msg.text }}</p>
    <table v-if="pf?.holdings?.length">
      <thead><tr><th>Asset</th><th>Qty</th><th>Avg price</th><th>Value</th><th>Unrealized</th></tr></thead>
      <tbody>
        <tr v-for="h in pf.holdings" :key="h.asset?.id ?? h.asset_id">
          <td>{{ h.asset?.symbol ?? h.symbol }}</td><td>{{ Number(h.quantity) }}</td><td>{{ usd(h.average_buy_price) }}</td>
          <td>{{ usd(h.current_value ?? 0) }}</td>
          <td :class="(h.unrealized_pnl ?? 0) >= 0 ? 'up' : 'down'">{{ usd(h.unrealized_pnl ?? 0) }}</td>
        </tr>
      </tbody>
    </table>
  </section>
</template>

<style scoped>
.hand {
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-lg, 12px);
  padding: .5rem .7rem;
  margin: 0 0 .45rem;
  box-shadow: inset 0 2px 10px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.04);
  background: color-mix(in srgb, var(--surface-sunken, #0a0b10) 55%, transparent);
}
header { display: flex; justify-content: space-between; align-items: baseline; gap: .6rem; }
h3 { margin: 0; font-size: .9rem; }
h3 small { font-weight: 400; color: var(--text-secondary); font-size: .68rem; margin-left: .25rem; }
.cash { font-family: var(--font-market-data, monospace); font-size: .8rem; }
.note { margin: .2rem 0 .4rem; font-size: .72rem; color: var(--text-secondary); }
.row { display: flex; gap: .4rem; flex-wrap: wrap; align-items: center; }
.row select, .row input {
  padding: .35rem .45rem;
  border-radius: 6px;
  border: 1px solid var(--border-primary);
  background: var(--surface-sunken, transparent);
  color: var(--text-primary);
  font: inherit;
}
.row input { width: 6.5rem; }
.cost { font-size: .75rem; color: var(--text-secondary); font-family: var(--font-market-data, monospace); }

.side-action {
  display: inline-flex;
  align-items: stretch;
  border-radius: 6px;
  overflow: hidden;
  flex-shrink: 0;
}
.side-action .go,
.side-action .flip {
  border: 0;
  cursor: pointer;
  font: inherit;
  font-weight: 700;
  color: #0a0b10;
  line-height: 1;
  transition: background 0.15s ease, color 0.15s ease, opacity 0.15s ease;
}
.side-action .go {
  padding: .4rem .75rem;
  min-width: 3.4rem;
}
.side-action .flip {
  padding: 0 .45rem;
  border-left: 1px solid rgba(0, 0, 0, 0.22);
  font-size: .75rem;
  opacity: 0.85;
}
.side-action .flip:hover { opacity: 1; }
.side-action .go:disabled { opacity: .45; cursor: not-allowed; }

.side-action.buy .go,
.side-action.buy .flip {
  background: var(--app-color-up, var(--success-green, #00ff88));
}
.side-action.sell .go,
.side-action.sell .flip {
  background: var(--app-color-down, var(--error-red, #ff4444));
  color: #fff;
}

.ok { color: var(--app-color-up, #00ff88); font-size: .75rem; margin: .3rem 0 0; }
.err { color: var(--app-color-down, #ff4444); font-size: .75rem; margin: .3rem 0 0; }
table { width: 100%; border-collapse: collapse; font-size: .75rem; margin-top: .4rem; font-family: var(--font-market-data, monospace); }
th { text-align: left; color: var(--text-secondary); font-weight: 500; padding: .2rem; }
td { padding: .2rem; border-top: 1px solid var(--border-primary); }
.up { color: var(--app-color-up, #00ff88); } .down { color: var(--app-color-down, #ff4444); }
</style>
