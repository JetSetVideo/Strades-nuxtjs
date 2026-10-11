<template>
  <div class="community">
    <header class="head">
      <div>
        <h1>Community bots</h1>
        <p class="sub">Bots other Strades users chose to make public: what they trade, which side, and how they're doing. Read-only: nobody can act on someone else's bot.</p>
      </div>
      <button class="refresh" :disabled="loading" @click="load">{{ loading ? 'Refreshing…' : '↻ Refresh' }}</button>
    </header>

    <p v-if="signedOut" class="muted">Sign in to see community bots.</p>
    <p v-else-if="error" class="err">{{ error }}</p>
    <p v-else-if="!loading && !bots.length" class="muted">No public bots yet. Launch one from <NuxtLink to="/predict">Predict</NuxtLink> or <NuxtLink to="/trade">Trade</NuxtLink> and choose "Everyone on Strades".</p>

    <div class="grid">
      <article v-for="b in bots" :key="b.bot_id" class="card" :class="{ mine: isMine(b) }">
        <header>
          <div>
            <h3>{{ b.market?.title ?? b.strategy?.name ?? (b.market_ticker ? b.market_ticker : `Bot ${b.bot_id.slice(0, 8)}`) }}</h3>
            <small v-if="b.market?.subtitle">{{ b.market.subtitle }}</small>
            <small v-else-if="b.kind !== 'prediction'">{{ b.ticks ?? 0 }} bars traded</small>
          </div>
          <span class="owner" :title="isMine(b) ? 'This is your bot' : 'Owner'">{{ isMine(b) ? 'yours' : (b.owner_display || 'a trader') }}</span>
        </header>
        <div class="tags">
          <span class="tag">{{ kindLabel(b) }}</span>
          <span v-if="b.market?.side ?? b.side" class="tag" :class="b.market?.side ?? b.side">{{ (b.market?.side ?? b.side ?? '').toUpperCase() }}</span>
          <span class="tag" :class="b.alive ? (b.paused ? 'paused' : 'live') : 'stopped'">{{ !b.alive ? 'stopped' : b.paused ? 'paused' : 'running' }}</span>
        </div>
        <div class="kpis">
          <div><span>P&amp;L</span><b :class="b.pnl >= 0 ? 'up' : 'down'">{{ signed(b.pnl) }}</b></div>
          <div><span>Return</span><b :class="b.pnl >= 0 ? 'up' : 'down'">{{ (b.pnl_pct ?? 0).toFixed(2) }}%</b></div>
          <div v-if="b.position"><span>Position</span><b>{{ b.position.contracts }} @ {{ b.position.avg_cents }}¢</b></div>
          <div v-else><span>Closed trades</span><b>{{ b.stats?.closed ?? 0 }}</b></div>
          <div v-if="b.position?.mark_cents !== undefined && b.position?.mark_cents !== null"><span>Now</span><b>{{ b.position.mark_cents }}¢</b></div>
        </div>
      </article>
    </div>
  </div>
</template>

<script setup lang="ts">
import { TradingApiError, useTradingApi, type BotStatus } from '~/composables/useTradingApi'

definePageMeta({ title: 'Community bots', layout: 'default' })

const api = useTradingApi()
const { enrich } = usePredictMarkets()
const bots = ref<BotStatus[]>([])
const loading = ref(false)
const error = ref('')
const signedOut = ref(false)

async function load() {
  loading.value = true
  error.value = ''
  try {
    bots.value = await enrich(await api.publicBots())
  } catch (e) {
    if (e instanceof TradingApiError && e.status === 401) signedOut.value = true
    else if (e instanceof TradingApiError && e.status >= 500) error.value = 'Community bots are unavailable right now (server error). Try Refresh in a moment.'
    else error.value = e instanceof TradingApiError ? e.message : "Couldn't load community bots."
  } finally {
    loading.value = false
  }
}

const isMine = (b: BotStatus) => !!b.is_mine
const kindLabel = (b: BotStatus) => (b.kind === 'prediction' ? 'Kalshi market' : b.kind === 'rules' ? 'Strategy' : 'Behaviour mix')
const usd = (v: number) => (v ?? 0).toLocaleString(APP_LOCALE, { style: 'currency', currency: 'USD' })
const signed = (v: number) => `${v >= 0 ? '+' : '−'}${usd(Math.abs(v ?? 0))}`

let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  load()
  timer = setInterval(() => { if (!document.hidden && !signedOut.value) load() }, 15000)
})
onBeforeUnmount(() => clearInterval(timer))
</script>

<style scoped>
.community { max-width: 1100px; margin: 0 auto; padding: 1rem; display: flex; flex-direction: column; gap: 1rem; color: var(--text-primary); }
.head { display: flex; justify-content: space-between; align-items: flex-end; gap: 1rem; flex-wrap: wrap; }
h1 { margin: 0 0 .2rem; }
.sub { margin: 0; color: var(--text-secondary); font-size: .9rem; max-width: 60ch; }
.refresh { padding: .45rem .8rem; border-radius: 8px; border: 1px solid var(--border-primary); background: transparent; color: var(--text-primary); cursor: pointer; }
.muted { color: var(--text-secondary); }
.err { color: var(--app-color-down, #ff4444); }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: .8rem; }
.card { border: 1px solid var(--border-primary); border-radius: var(--radius-lg, 12px); padding: .9rem; background: var(--surface-raised, transparent); display: flex; flex-direction: column; gap: .6rem; }
.card.mine { border-color: var(--border-accent); }
.card header { display: flex; justify-content: space-between; gap: .6rem; align-items: flex-start; }
h3 { margin: 0; font-size: .95rem; }
small { color: var(--text-secondary); }
.owner { font-size: .72rem; padding: .15rem .5rem; border-radius: 999px; border: 1px solid var(--border-primary); white-space: nowrap; }
.tags { display: flex; gap: .3rem; flex-wrap: wrap; }
.tag { font-size: .68rem; padding: .1rem .45rem; border-radius: 999px; border: 1px solid var(--border-primary); color: var(--text-secondary); }
.tag.yes, .tag.live { color: var(--app-color-up, #00ff88); border-color: currentColor; }
.tag.no, .tag.stopped { color: var(--app-color-down, #ff4444); border-color: currentColor; }
.tag.paused { color: var(--warning-orange, #f5a623); border-color: currentColor; }
.kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(90px, 1fr)); gap: .4rem; }
.kpis div { display: flex; flex-direction: column; font-size: .7rem; color: var(--text-secondary); }
.kpis b { font-size: .9rem; color: var(--text-primary); font-family: var(--font-market-data, monospace); }
.up { color: var(--app-color-up, #00ff88) !important; }
.down { color: var(--app-color-down, #ff4444) !important; }
</style>
