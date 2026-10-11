<template>
  <form class="launch" @submit.prevent="launch">
    <div class="row">
      <label>Capital (USD)
        <input v-model="capital" type="number" min="10" :max="maxCapital" step="any" inputmode="decimal" />
        <small>Available: {{ fmt(maxCapital) }}</small>
      </label>
      <label>Re-weight period
        <select v-model.number="period">
          <option :value="900">15 min</option>
          <option :value="3600">1 hour</option>
          <option :value="14400">4 hours</option>
          <option :value="86400">1 day</option>
        </select>
      </label>
    </div>

    <div class="mode">
      <label><input v-model="mode" type="radio" value="random" /> Random behaviour mix</label>
      <label><input v-model="mode" type="radio" value="custom" /> My own mix</label>
    </div>

    <div v-if="mode === 'custom'" class="sliders">
      <label v-for="k in KEYS" :key="k">
        <span>{{ LABELS[k] }} <b>{{ pct(weights[k]) }}</b></span>
        <input v-model.number="weights[k]" type="range" min="0" max="1" step="0.05" />
      </label>
      <small>Weights are normalised. The bot then adapts them every period based on which behaviours actually made money.</small>
    </div>

    <label class="vis"><input v-model="isPublic" type="checkbox" /> Share on Community bots (others see its P&amp;L and trades, never your wallet)</label>

    <p v-if="error" class="err">{{ error }}</p>
    <button class="primary" :disabled="busy || !valid">{{ busy ? 'Launching…' : 'Launch bot' }}</button>
  </form>
</template>

<script setup lang="ts">
import { useTradingPrefsStore } from '~/stores/tradingPrefs'
import { TradingApiError, useTradingApi, type BotStatus, type WeightKey } from '~/composables/useTradingApi'

const props = defineProps<{ walletId: string; maxCapital: number }>()
const emit = defineEmits<{ launched: [bot: BotStatus] }>()
const api = useTradingApi()

const KEYS: WeightKey[] = ['momentum', 'mean_reversion', 'breakout', 'grid_dca', 'chain_propagation']
const LABELS: Record<WeightKey, string> = {
  momentum: 'Momentum', mean_reversion: 'Mean reversion', breakout: 'Breakout',
  grid_dca: 'Grid / DCA', chain_propagation: 'BTC → alts lead-lag',
}

const prefs = useTradingPrefsStore()
prefs.hydrate()
const capital = ref(String(prefs.defaultCapital))
const period = ref(prefs.defaultPeriodS)
const mode = ref<'random' | 'custom'>('random')
const weights = reactive<Record<WeightKey, number>>({
  momentum: 0.4, mean_reversion: 0.2, breakout: 0.2, grid_dca: 0.1, chain_propagation: 0.1,
})
const isPublic = ref(false)
const busy = ref(false)
const error = ref('')

const total = computed(() => KEYS.reduce((s, k) => s + (weights[k] || 0), 0))
const valid = computed(() => Number(capital.value) >= 10 && Number(capital.value) <= props.maxCapital &&
  (mode.value === 'random' || total.value > 0))
const pct = (v: number) => total.value ? `${Math.round((v / total.value) * 100)}%` : '0%'
const fmt = (v: number) => v.toLocaleString(APP_LOCALE, { style: 'currency', currency: 'USD' })

async function launch() {
  busy.value = true
  error.value = ''
  try {
    const bot = await api.launchBot(props.walletId, {
      capital_usd: String(capital.value),
      weight_mode: mode.value,
      weights: mode.value === 'custom' ? { ...weights } : undefined,
      period_s: period.value,
      visibility: isPublic.value ? 'public' : 'private',
    })
    emit('launched', bot)
  } catch (e) {
    error.value = e instanceof TradingApiError ? e.message : 'Launch failed'
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
.launch { display: flex; flex-direction: column; gap: .8rem; }
.row { display: flex; gap: .8rem; flex-wrap: wrap; }
.row label { flex: 1; min-width: 140px; }
label { display: flex; flex-direction: column; gap: .3rem; font-size: .85rem; color: var(--text-secondary); }
input[type=number], select { padding: .5rem .65rem; border-radius: var(--radius-sm, 6px); border: 1px solid var(--border-primary);
  background: var(--surface-sunken, var(--bg-secondary)); color: var(--text-primary); font: inherit; }
.vis { flex-direction: row; align-items: center; gap: .4rem; color: var(--text-primary); }
.mode { display: flex; gap: 1.2rem; flex-wrap: wrap; }
.mode label { flex-direction: row; align-items: center; gap: .4rem; color: var(--text-primary); }
.sliders { display: flex; flex-direction: column; gap: .5rem; }
.sliders span { display: flex; justify-content: space-between; }
small { font-size: .75rem; color: var(--text-secondary); }
.err { color: var(--app-color-down, #e5484d); font-size: .85rem; }
.primary { padding: .65rem 1rem; border: 0; border-radius: var(--radius-md, 8px); background: var(--primary-blue, #3b82f6);
  color: #fff; font-weight: 600; cursor: pointer; }
.primary:disabled { opacity: .45; cursor: not-allowed; }
</style>
