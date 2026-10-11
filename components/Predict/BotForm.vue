<script setup lang="ts">
/**
 * Launch a paper bot on one Kalshi market. The backend engine fills it at the real
 * top of book (buy at ask), charges Kalshi's fee, and settles at 100¢/0¢ when the
 * market resolves. No real order is ever sent.
 */
import type { PredictMarket } from '~/server/api/predict/markets.get'
import { TradingApiError, useTradingApi, type TradingWallet } from '~/composables/useTradingApi'
import { useTradingPrefsStore } from '~/stores/tradingPrefs'

const props = defineProps<{ market: PredictMarket }>()
const emit = defineEmits<{ launched: [name: string] }>()
const api = useTradingApi()
const prefs = useTradingPrefsStore()
prefs.hydrate()

const wallets = ref<TradingWallet[]>([])
const walletId = ref('')
const side = ref<'yes' | 'no'>('yes')
const ask = computed(() => (side.value === 'yes' ? props.market.yes_ask : props.market.no_ask))
const bid = computed(() => (side.value === 'yes' ? props.market.yes_bid : props.market.no_bid))
const maxEntry = ref<number>(Math.min(99, (props.market.yes_ask ?? 50) + 1))
watch(side, () => { maxEntry.value = Math.min(99, (ask.value ?? 50) + 1) })
const capital = ref(String(prefs.defaultCapital))
const visibility = ref<'public' | 'private'>('private')
const busy = ref(false)
const error = ref('')
const signedOut = ref(false)

const spread = computed(() => (ask.value !== null && bid.value !== null ? ask.value - bid.value : null))
// Tradable = a real two-sided quote, not a penny longshot, and a spread small relative to the price:
// at 1¢/2¢ the bot would lose half its stake the moment it buys (marked at the bid).
const tradable = computed(() => !!ask.value && ask.value >= 5 && ask.value <= 95
  && spread.value !== null && spread.value <= Math.min(10, Math.max(1, Math.floor(ask.value * 0.2))))
/** Immediate paper loss on entry: buy at the ask, mark at the bid, pay the taker fee 0.07·P·(1−P) per contract. */
const entryCost = computed(() => {
  if (!ask.value || bid.value === null || !tradable.value) return null
  const p = ask.value / 100
  const fee = Math.ceil(0.07 * p * (1 - p) * 100 * 100) / 100 / 100 // per contract, cent-ceiling ≈ Kalshi table
  return ((ask.value - bid.value) / 100 + fee) / (p + fee) * 100
})
const contracts = computed(() => (ask.value ? Math.floor((Number(capital.value) || 0) / (ask.value / 100)) : 0))

onMounted(async () => {
  try {
    wallets.value = await api.listWallets()
    walletId.value = wallets.value[0]?.id ?? ''
  } catch (e) {
    signedOut.value = e instanceof TradingApiError && e.status === 401
  }
})

async function launch() {
  busy.value = true
  error.value = ''
  try {
    await api.launchBot(walletId.value, {
      kind: 'prediction', market_ticker: props.market.ticker, side: side.value,
      max_entry_cents: maxEntry.value, capital_usd: String(capital.value), visibility: visibility.value,
      weight_mode: 'random', period_s: 3600,
    })
    emit('launched', `${props.market.title}${props.market.subtitle ? ` · ${props.market.subtitle}` : ''}`)
  } catch (e) {
    error.value = e instanceof TradingApiError ? e.message : 'Launch failed.'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <form class="bf" @submit.prevent="launch">
    <p v-if="signedOut" class="note">Sign in to launch a bot.</p>
    <p v-else-if="!wallets.length" class="note">You need a paper wallet first. <NuxtLink to="/trade">Create one in Trade →</NuxtLink></p>
    <template v-else>
      <div class="row">
        <label>Wallet
          <select v-model="walletId">
            <option v-for="w in wallets" :key="w.id" :value="w.id">{{ w.label }} · ${{ Number(w.cash_usd).toFixed(2) }} free</option>
          </select>
        </label>
        <fieldset class="side">
          <legend>Bet on</legend>
          <label :class="{ on: side === 'yes' }"><input v-model="side" type="radio" value="yes" /> YES {{ market.yes_ask ?? '—' }}¢</label>
          <label :class="{ on: side === 'no' }"><input v-model="side" type="radio" value="no" /> NO {{ market.no_ask ?? '—' }}¢</label>
        </fieldset>
        <label>Max entry price (¢)
          <input v-model.number="maxEntry" type="number" min="1" max="99" step="1" />
          <small>Buys only while the ask is at or below this.</small>
          <small v-if="ask && maxEntry > ask + 3" class="warn">⚠ {{ maxEntry - ask }}¢ above the ask: on a thin book the bot buys up every level to that price and can lose a big share of its capital at once.</small>
        </label>
        <label>Capital (USD)
          <input v-model="capital" type="number" min="10" step="any" inputmode="decimal" />
          <small>≈ {{ contracts }} contracts at {{ ask ?? '—' }}¢</small>
          <small v-if="entryCost !== null">Starts ≈ {{ entryCost.toFixed(1) }}% down: valued at the {{ bid }}¢ bid, after Kalshi's taker fee.</small>
        </label>
      </div>
      <fieldset class="vis">
        <legend>Who can see this bot</legend>
        <label><input v-model="visibility" type="radio" value="private" /> Only me</label>
        <label><input v-model="visibility" type="radio" value="public" /> Everyone on Strades (Community bots shows its market, side and P&amp;L, never your wallet)</label>
      </fieldset>
      <p v-if="!tradable" class="warn">Not tradable for a bot right now: it needs a price between 5¢ and 95¢ and a spread of at most 10¢ and 20% of the price (here {{ bid ?? '—' }}¢ / {{ ask ?? '—' }}¢). Pick a busier market.</p>
      <p v-if="error" class="err">{{ error }}</p>
      <div class="actions">
        <button :disabled="busy || !tradable || !walletId || !(Number(capital) >= 10)">{{ busy ? 'Launching…' : `Launch ${side.toUpperCase()} bot` }}</button>
        <a :href="market.url" target="_blank" rel="noopener noreferrer" class="ext">View on Kalshi ↗</a>
      </div>
      <p class="note">Paper trading: fills at Kalshi's real best ask, minus Kalshi's fee; pays 100¢ per contract if your side wins, 0¢ if not. No real order is sent.</p>
    </template>
  </form>
</template>

<style scoped>
.bf { border-top: 1px solid var(--border-primary); padding: .8rem .9rem; display: flex; flex-direction: column; gap: .6rem; }
.row { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: .7rem; align-items: start; }
label { display: flex; flex-direction: column; gap: .25rem; font-size: .8rem; color: var(--text-secondary); }
select, input[type=number] { padding: .45rem .55rem; border-radius: 6px; border: 1px solid var(--border-primary); background: var(--surface-sunken, transparent); color: var(--text-primary); font: inherit; }
small { font-size: .7rem; }
fieldset { border: 0; padding: 0; margin: 0; display: flex; gap: .5rem; flex-wrap: wrap; }
legend { font-size: .8rem; color: var(--text-secondary); margin-bottom: .25rem; width: 100%; }
.side label { flex-direction: row; align-items: center; gap: .35rem; padding: .35rem .6rem; border: 1px solid var(--border-primary); border-radius: 6px; color: var(--text-primary); }
.side label.on { border-color: var(--border-accent); }
.vis { flex-direction: column; }
.vis label { flex-direction: row; align-items: center; gap: .4rem; color: var(--text-primary); }
.actions { display: flex; gap: 1rem; align-items: center; }
.actions button { padding: .55rem 1rem; border: 0; border-radius: 8px; background: var(--primary-blue, #3b82f6); color: #fff; font-weight: 600; cursor: pointer; }
.actions button:disabled { opacity: .45; cursor: not-allowed; }
.ext { font-size: .8rem; color: var(--text-secondary); }
.note { font-size: .72rem; color: var(--text-secondary); margin: 0; }
.warn { font-size: .8rem; color: var(--warning-orange, #f5a623); margin: 0; }
.err { font-size: .85rem; color: var(--app-color-down, #ff4444); margin: 0; }
</style>
