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
      <select v-model="side" aria-label="Buy or sell"><option value="buy">Buy</option><option value="sell">Sell</option></select>
      <input v-model="qty" type="number" min="0" step="any" inputmode="decimal" aria-label="Quantity" />
      <select v-model="assetId" aria-label="Asset">
        <option v-for="a in tradable" :key="a.id" :value="a.id">{{ a.symbol }} · {{ usd(a.current_price) }}{{ a.live ? '' : ' (sim)' }}</option>
      </select>
      <span class="cost">≈ {{ usd(cost) }}</span>
      <button :disabled="busy || !(Number(qty) > 0)">{{ busy ? '…' : side === 'buy' ? 'Buy' : 'Sell' }}</button>
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
.hand { border: 1px solid var(--border-primary); border-radius: var(--radius-lg, 12px); padding: .8rem 1rem; margin: 0 0 .8rem; }
header { display: flex; justify-content: space-between; align-items: baseline; gap: .8rem; }
h3 { margin: 0; font-size: .95rem; }
h3 small { font-weight: 400; color: var(--text-secondary); font-size: .72rem; margin-left: .3rem; }
.cash { font-family: var(--font-market-data, monospace); font-size: .85rem; }
.note { margin: .3rem 0 .6rem; font-size: .76rem; color: var(--text-secondary); }
.row { display: flex; gap: .5rem; flex-wrap: wrap; align-items: center; }
.row select, .row input { padding: .45rem .55rem; border-radius: 6px; border: 1px solid var(--border-primary); background: var(--surface-sunken, transparent); color: var(--text-primary); font: inherit; }
.row input { width: 7rem; }
.cost { font-size: .8rem; color: var(--text-secondary); font-family: var(--font-market-data, monospace); }
.row button { padding: .45rem .9rem; border: 0; border-radius: 6px; background: var(--primary-blue, #3b82f6); color: #fff; font-weight: 600; cursor: pointer; }
.row button:disabled { opacity: .5; }
.ok { color: var(--app-color-up, #00ff88); font-size: .8rem; margin: .4rem 0 0; }
.err { color: var(--app-color-down, #ff4444); font-size: .8rem; margin: .4rem 0 0; }
table { width: 100%; border-collapse: collapse; font-size: .78rem; margin-top: .6rem; font-family: var(--font-market-data, monospace); }
th { text-align: left; color: var(--text-secondary); font-weight: 500; padding: .25rem; }
td { padding: .25rem; border-top: 1px solid var(--border-primary); }
.up { color: var(--app-color-up, #00ff88); } .down { color: var(--app-color-down, #ff4444); }
</style>
