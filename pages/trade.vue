<template>
  <div class="trade">
    <header class="head">
      <div>
        <h1>Trade with bots</h1>
        <p>Link a crypto wallet, fund bots, and let them trade every liquid market. <b>Paper mode</b>: real prices, simulated dollars.</p>
      </div>
      <select v-if="wallets.length" v-model="walletId" class="wsel">
        <option v-for="w in wallets" :key="w.id" :value="w.id">{{ w.label }} · {{ short(w.address) }}</option>
      </select>
    </header>

    <!-- Wallet page still shows sample platform wallets; this page is the real paper desk. -->
    <div class="sample-banner" role="note">
      <span><b>Sample portfolio.</b> Platform wallets on Wallet are demo data. This page holds your paper wallet, its bots, and its ledger.</span>
      <NuxtLink to="/wallet" class="sample-cta">See sample wallets →</NuxtLink>
    </div>

    <section v-if="signedOut" class="panel narrow">
      <template v-if="isDemo">
        <h2>This is where demo mode stops</h2>
        <p class="muted">Demo mode runs on shared sample data. A wallet and the bots it funds belong to one person,
          so linking one needs your own account. Paper trading only: no real money moves.</p>
        <template v-if="!envDemo">
          <button class="cta" @click="leaveDemo('register')">Create a free account →</button>
          <button class="link" @click="leaveDemo('login')">I already have one</button>
        </template>
        <p v-else class="muted">This server runs in demo-only mode, so accounts are disabled here.</p>
      </template>
      <template v-else>
        <h2>Sign in to link a wallet</h2>
        <p class="muted">Wallets and bots belong to your account, so this page needs you to be signed in.</p>
        <NuxtLink class="link" to="/auth?redirect=/trade">Sign in →</NuxtLink>
      </template>
    </section>
    <p v-else-if="error" class="err">{{ error }}</p>
    <p v-if="demoAccount && !signedOut" class="demo-banner">
      Demo account: paper money only, kept while you use it and deleted after 30 days without a visit. You can create a new wallet here, but importing an existing recovery phrase is disabled.
    </p>

    <section v-if="!signedOut && (!wallets.length || adding)" class="panel narrow">
      <h2>{{ wallets.length ? 'Add another wallet' : 'Link your wallet' }}</h2>
      <TradeWalletOnboarding :allow-import="!demoAccount" @ready="onWalletReady" />
      <button v-if="wallets.length" class="link" @click="adding = false">Cancel</button>
    </section>

    <template v-else-if="wallet">
      <section class="panel stats">
        <div><span>Address</span><b class="mono">{{ wallet.address }}</b></div>
        <div><span>Free cash</span><b>{{ usd(+wallet.cash_usd) }}</b></div>
        <div><span>In bots</span><b>{{ usd(+wallet.allocated_usd) }}</b></div>
        <div><span>Bot P&L (live)</span><b :class="livePnl >= 0 ? 'up' : 'down'">{{ usd(livePnl) }}</b></div>
        <button class="link" @click="adding = true">+ wallet</button>
      </section>

      <div class="grid">
        <section class="panel">
          <h2>Launch a bot</h2>
          <TradeBotLauncher :wallet-id="wallet.id" :max-capital="+wallet.cash_usd" @launched="refresh" />
          <div v-if="markets.length" class="markets">
            <small>Markets ({{ feed }}):</small>
            <span v-for="m in markets" :key="m" class="chip">{{ m.replace('USDT', '') }}</span>
          </div>
          <div v-if="devReplay" class="replay">
            <button :disabled="stepping || clock?.exhausted" @click="step(24)">Replay +24 bars</button>
            <button :disabled="stepping || clock?.exhausted" @click="step(200)">+200</button>
            <small v-if="clock">bar {{ clock.tick }}{{ clock.exhausted ? ' · end of data' : '' }}</small>
          </div>
          <p v-if="clock?.exhausted" class="clock-note">
            The replay window (≈41 days of real hourly prices) has been fully played. Bots launched now won't
            process any bars until the engine loads a new window.
          </p>
        </section>

        <section class="bots">
          <div v-if="hasPrediction" class="poll-row">
            <button class="poll" :disabled="polling" @click="pollNow">{{ polling ? 'Checking…' : '↻ Check Kalshi markets now' }}</button>
            <small>Prediction bots re-check their market every minute while this page is open.</small>
          </div>
          <p v-if="!bots.length" class="empty">No bots yet. Launch two with different mixes and compare them.</p>
          <TradeBotCard v-for="b in bots" :key="b.bot_id" :bot="b" :busy="stopping === b.bot_id" @stop="stop" @pause="pause" @visibility="setVisibility" />
        </section>
      </div>

      <section class="panel">
        <h2>Ledger</h2>
        <table class="ledger">
          <thead><tr><th>#</th><th>Kind</th><th>Amount</th><th>P&L</th><th>Bot</th><th>Cash after</th></tr></thead>
          <tbody>
            <tr v-for="e in ledger" :key="e.id">
              <td>{{ e.id }}</td><td>{{ e.kind }}</td><td>{{ usd(+e.amount_usd) }}</td>
              <td :class="+e.pnl_usd >= 0 ? 'up' : 'down'">{{ e.kind === 'release' ? usd(+e.pnl_usd) : '' }}</td>
              <td class="mono">{{ e.ref.slice(0, 8) }}</td><td>{{ usd(+e.cash_after) }}</td>
            </tr>
          </tbody>
        </table>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { TradingApiError, useTradingApi, type BotStatus, type LedgerEntry, type TradingWallet } from '~/composables/useTradingApi'

definePageMeta({ title: 'Trade', layout: 'default' })

const api = useTradingApi()
const { enrich } = usePredictMarkets()
const config = useRuntimeConfig()
const devReplay = import.meta.dev || config.public.demoMode === 'true'

const wallets = ref<TradingWallet[]>([])
const walletId = ref<string>('')
const bots = ref<BotStatus[]>([])
const ledger = ref<LedgerEntry[]>([])
const markets = ref<string[]>([])
const feed = ref('')
const clock = ref<{ tick: number; exhausted: boolean } | null>(null)
const adding = ref(false)
const error = ref('')
const stepping = ref(false)
const stopping = ref<string | null>(null)
const signedOut = ref(false)
const auth = useAuth()
const demoAccount = computed(() => !!auth.user.value?.is_demo)
const demoCookie = useCookie<string | null>('strades_demo')
const isDemo = computed(() => demoCookie.value === '1' || String(config.public.demoMode) === 'true')
const envDemo = String(config.public.demoMode) === 'true'
// The auth middleware bounces /auth → /prices while in demo, so drop the demo cookie first.
function leaveDemo(mode: 'register' | 'login') {
  demoCookie.value = null
  navigateTo({ path: '/auth', query: { mode, redirect: '/trade' } })
}

const wallet = computed(() => wallets.value.find(w => w.id === walletId.value))
const livePnl = computed(() => bots.value.filter(b => b.alive).reduce((s, b) => s + (b.pnl || 0), 0))
const usd = (v: number) => (v ?? 0).toLocaleString(APP_LOCALE, { style: 'currency', currency: 'USD' })
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`

const guard = async (fn: () => Promise<void>) => {
  try {
    error.value = ''
    await fn()
  } catch (e) {
    // 401 after the refresh attempt failed = no session: show sign-in, not a raw error.
    if (e instanceof TradingApiError && e.status === 401) signedOut.value = true
    else error.value = e instanceof TradingApiError ? e.message : 'Request failed'
  }
}

async function loadWallets() {
  wallets.value = await api.listWallets()
  if (!wallets.value.find(w => w.id === walletId.value)) walletId.value = wallets.value[0]?.id ?? ''
}

async function refresh() {
  if (!walletId.value) return
  const id = walletId.value
  const [w, b, l] = await Promise.all([api.getWallet(id), api.listBots(id), api.ledger(id)])
  wallets.value = wallets.value.map(x => (x.id === id ? w : x))
  bots.value = await enrich(b)
  ledger.value = l
}

function onWalletReady(w: TradingWallet) {
  adding.value = false
  wallets.value = [w, ...wallets.value.filter(x => x.id !== w.id)]
  walletId.value = w.id
  guard(refresh)
}

async function stop(botId: string) {
  stopping.value = botId
  await guard(async () => { await api.stopBot(botId); await refresh() })
  stopping.value = null
}

async function pause(botId: string, paused: boolean) {
  stopping.value = botId
  await guard(async () => { await api.pauseBot(botId, paused); await refresh() })
  stopping.value = null
}

async function setVisibility(botId: string, v: 'public' | 'private') {
  stopping.value = botId
  await guard(async () => { await api.setVisibility(botId, v); await refresh() })
  stopping.value = null
}

async function step(n: number) {
  stepping.value = true
  await guard(async () => { clock.value = await api.stepReplay(n); await refresh() })
  stepping.value = false
}

watch(walletId, () => guard(refresh))

let timer: ReturnType<typeof setInterval> | undefined
let pollTimer: ReturnType<typeof setInterval> | undefined
const hasPrediction = computed(() => bots.value.some(b => b.kind === 'prediction' && b.alive && !b.paused))
const polling = ref(false)
async function pollNow() {
  polling.value = true
  await guard(async () => { await api.pollPrediction(); await refresh() })
  polling.value = false
}
onMounted(() => {
  guard(async () => {
    await loadWallets()
    // The profile isn't refetched on reload; we need it for is_demo.
    if (!auth.user.value) await auth.fetchUser().catch(() => {})
    const m = await api.markets().catch(() => null)
    if (m) { markets.value = m.symbols; feed.value = m.feed; if (m.tick !== undefined) clock.value = { tick: m.tick, exhausted: !!m.exhausted } }
    await refresh()
  })
  timer = setInterval(() => { if (walletId.value && !signedOut.value && !document.hidden) refresh().catch(() => {}) }, 5000)
  // Prediction bots decide on wall-clock time: ask the engine once a minute while the page is open.
  pollTimer = setInterval(() => { if (hasPrediction.value && !document.hidden) pollNow() }, 60000)
})
onBeforeUnmount(() => { clearInterval(timer); clearInterval(pollTimer) })
</script>

<style scoped>
.trade { display: flex; flex-direction: column; gap: 1rem; padding: 1rem; max-width: 1280px; margin: 0 auto; color: var(--text-primary); }
.head { display: flex; justify-content: space-between; align-items: flex-end; gap: 1rem; flex-wrap: wrap; }
h1 { margin: 0 0 .25rem; }
h2 { margin: 0 0 .8rem; font-size: 1rem; }
.head p { margin: 0; color: var(--text-secondary); }
.panel { padding: 1rem; border: 1px solid var(--border-primary); border-radius: var(--radius-lg, 12px);
  background: var(--surface-raised, var(--card-bg)); }
.narrow { max-width: 560px; }
.stats { display: flex; gap: 1.5rem; flex-wrap: wrap; align-items: center; }
.stats div { display: flex; flex-direction: column; font-size: .75rem; color: var(--text-secondary); min-width: 0; }
.stats b { font-size: 1rem; color: var(--text-primary); font-family: var(--font-market-data, monospace); overflow-wrap: anywhere; }
.grid { display: grid; grid-template-columns: minmax(280px, 380px) 1fr; gap: 1rem; align-items: start; }
.bots { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 1rem; }
.empty { color: var(--text-secondary); }
.markets { display: flex; flex-wrap: wrap; gap: .3rem; margin-top: 1rem; align-items: center; }
.chip { font-size: .7rem; padding: .1rem .45rem; border-radius: 999px; border: 1px solid var(--border-primary); }
.replay { display: flex; gap: .5rem; align-items: center; margin-top: 1rem; }
.replay button, .wsel { padding: .45rem .7rem; border-radius: var(--radius-sm, 6px); border: 1px solid var(--border-primary);
  background: var(--surface-sunken, var(--bg-secondary)); color: var(--text-primary); cursor: pointer; }
.link { background: none; border: 0; color: var(--primary-blue, #3b82f6); cursor: pointer; padding: 0; }
.mono { font-family: var(--font-market-data, monospace); }
.up { color: var(--app-color-up, #30a46c); }
.down { color: var(--app-color-down, #e5484d); }
.muted { color: var(--text-secondary); }
.poll-row { grid-column: 1 / -1; display: flex; gap: .7rem; align-items: center; }
.poll { padding: .45rem .8rem; border-radius: 8px; border: 1px solid var(--border-primary); background: transparent; color: var(--text-primary); cursor: pointer; }
.clock-note { margin: .6rem 0 0; font-size: .78rem; color: var(--warning-orange, #f5a623); }
.demo-banner { margin: 0; padding: .55rem .8rem; border: 1px dashed var(--warning-orange, #f5a623); border-radius: var(--radius-md, 8px);
  color: var(--warning-orange, #f5a623); font-size: .85rem; }
.sample-banner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: .8rem;
  flex-wrap: wrap;
  margin: 0;
  padding: .6rem .9rem;
  border: 1px dashed var(--warning-orange, #f5a623);
  border-radius: var(--radius-md, 8px);
  color: var(--text-primary);
  font-size: .85rem;
}
.sample-banner b { color: var(--warning-orange, #f5a623); }
.sample-cta { color: var(--warning-orange, #f5a623); font-weight: 600; text-decoration: none; white-space: nowrap; }
.cta { display: inline-block; margin: .4rem 1rem .2rem 0; padding: .6rem 1rem; border-radius: var(--radius-md, 8px);
  background: var(--primary-blue, #3b82f6); color: #fff; font-weight: 600; text-decoration: none; border: 0; cursor: pointer; font-size: inherit; }
.err { color: var(--app-color-down, #e5484d); }
.ledger { width: 100%; border-collapse: collapse; font-size: .8rem; font-family: var(--font-market-data, monospace); }
.ledger th { text-align: left; color: var(--text-secondary); font-weight: 500; padding: .3rem; }
.ledger td { padding: .3rem; border-top: 1px solid var(--border-primary); }
small { color: var(--text-secondary); font-size: .75rem; }
@media (max-width: 900px) { .grid { grid-template-columns: 1fr; } .bots { grid-template-columns: 1fr; } }
</style>
