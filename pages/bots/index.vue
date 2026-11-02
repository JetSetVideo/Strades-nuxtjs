<script setup lang="ts">
/**
 * /bots — every bot in one place (board-optimization O9: /bots was a 404).
 *  - Your bots: the signed-in user's paper bots, read with the same API the Trade page uses
 *    (GET /api/wallets/ then GET /api/wallets/<id>/bots/). Managed on /trade.
 *  - Sample bots: the bundled catalog (stores/bots), chipped Sample — not the user's.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { TradingApiError, useTradingApi, type BotStatus } from '~/composables/useTradingApi'
import { useBotsStore } from '~/stores/bots'
import { sampleBotRow, serverBotRow, type BotRow } from '~/utils/botsIndex'
import { routeLabel } from '~/utils/routes'
import UISourceChip from '~/components/UI/SourceChip.vue'

// Title literal = routeLabel('/bots') (definePageMeta cannot call it).
definePageMeta({ title: 'Your bots', layout: 'default' })

const pageTitle = routeLabel('/bots')
const tradeLabel = routeLabel('/trade')

const api = useTradingApi()
const auth = useAuth()
const catalog = useBotsStore()

/** 'idle' | 'loading' | 'ok' | 'error' | 'signed-out' */
const status = ref<'idle' | 'loading' | 'ok' | 'error' | 'signed-out'>('idle')
const error = ref('')
const mine = ref<BotRow[]>([])

async function loadMine() {
  if (!auth.isAuthenticated.value) {
    status.value = 'signed-out'
    mine.value = []
    return
  }
  status.value = 'loading'
  error.value = ''
  try {
    const wallets = await api.listWallets()
    const perWallet = await Promise.all(
      wallets.map(async w => ({ w, bots: await api.listBots(w.id) as BotStatus[] })),
    )
    mine.value = perWallet.flatMap(({ w, bots }) => bots.map(b => serverBotRow(b, w.label)))
      // Running first, then paused, then stopped.
      .sort((a, b) => order(a.status) - order(b.status))
    status.value = 'ok'
  } catch (e) {
    if (e instanceof TradingApiError && e.status === 401) {
      status.value = 'signed-out'
    } else {
      error.value = e instanceof TradingApiError ? e.message : 'Could not reach the bot server.'
      status.value = 'error'
    }
  }
}

const order = (s: string) => (s === 'Running' ? 0 : s === 'Paused' ? 1 : 2)

const samples = computed(() => catalog.list.map(sampleBotRow))

onMounted(() => {
  loadMine()
  if (!catalog.hydrated && !catalog.loading) catalog.fetchBots()
})
watch(auth.isAuthenticated, () => loadMine())
</script>

<template>
  <div class="bots-page">
    <header class="bp-head">
      <h1>{{ pageTitle }}</h1>
      <p class="muted">Your paper bots and the sample catalog. Start, pause and stop bots in
        <NuxtLink to="/trade">{{ tradeLabel }}</NuxtLink>.</p>
    </header>

    <!-- ── Your bots ── -->
    <section class="bp-sec" aria-labelledby="bp-mine">
      <h2 id="bp-mine">Your bots <span v-if="status === 'ok'" class="count">{{ mine.length }}</span></h2>

      <div v-if="status === 'loading' || status === 'idle'" class="bp-note" aria-busy="true">Loading your bots…</div>

      <div v-else-if="status === 'signed-out'" class="bp-empty">
        <p>Bots belong to your account. <NuxtLink to="/auth?redirect=/bots">Sign in</NuxtLink> to see yours.</p>
      </div>

      <div v-else-if="status === 'error'" class="bp-empty" role="alert">
        <p class="err">Your bots could not load: {{ error }}</p>
        <button type="button" class="btn" @click="loadMine">Retry</button>
      </div>

      <div v-else-if="!mine.length" class="bp-empty">
        <p>No bot yet — start one in <NuxtLink to="/trade">{{ tradeLabel }}</NuxtLink>.</p>
      </div>

      <ul v-else class="bp-list">
        <li v-for="b in mine" :key="b.id">
          <NuxtLink :to="b.to" class="bp-row">
            <span class="bp-main">
              <b class="bp-name">{{ b.name }}</b>
              <small class="muted">{{ b.detail }}</small>
            </span>
            <span class="bp-status" :class="b.status.toLowerCase()">{{ b.status }}</span>
            <span class="bp-num">
              <small class="muted">{{ b.moneyLabel }}</small>
              <b>{{ b.money }}</b>
            </span>
            <span class="bp-num" :class="b.tone">
              <small class="muted">P&amp;L</small>
              <b>{{ b.pnl }} <small>({{ b.pnlPct }})</small></b>
            </span>
            <UISourceChip source="paper" />
          </NuxtLink>
        </li>
      </ul>
    </section>

    <!-- ── Sample bots ── -->
    <section class="bp-sec" aria-labelledby="bp-sample">
      <h2 id="bp-sample">
        Sample bots
        <UISourceChip source="sample" note="Bots from the sample catalog: they are not yours, do not trade and are not connected to an exchange." />
      </h2>
      <div v-if="catalog.loading && !samples.length" class="bp-note" aria-busy="true">Loading sample bots…</div>
      <div v-else-if="catalog.error && !samples.length" class="bp-empty" role="alert">
        <p class="err">The sample bots could not load.</p>
        <button type="button" class="btn" @click="catalog.hydrated = false; catalog.fetchBots()">Retry</button>
      </div>
      <ul v-else class="bp-list">
        <li v-for="b in samples" :key="b.id">
          <NuxtLink :to="b.to" class="bp-row">
            <span class="bp-main">
              <b class="bp-name">{{ b.name }}</b>
              <small class="muted">{{ b.detail }}</small>
            </span>
            <span class="bp-status">{{ b.status }}</span>
            <span class="bp-num">
              <small class="muted">{{ b.moneyLabel }}</small>
              <b>{{ b.money }}</b>
            </span>
            <span class="bp-num" :class="b.tone">
              <small class="muted">30-day P&amp;L</small>
              <b>{{ b.pnl }} <small>({{ b.pnlPct }})</small></b>
            </span>
            <UISourceChip source="sample" />
          </NuxtLink>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.bots-page { max-width: 960px; margin: 0 auto; padding: var(--spacing-md, 1rem) var(--spacing-sm, 0.6rem) 6rem; color: var(--text-white); display: grid; gap: 1rem; }
.bp-head h1 { margin: 0 0 0.25rem; font-family: var(--font-chrome, var(--font-family-primary)); font-size: 1.3rem; }
.muted { color: var(--text-gray); }
.bp-head p { margin: 0; font-size: 0.82rem; }
.bp-head a, .bp-empty a { color: var(--primary-green); }
.bp-sec h2 { display: flex; align-items: center; gap: 0.45rem; margin: 0 0 0.5rem; font-size: 0.95rem; font-family: var(--font-chrome, var(--font-family-primary)); }
.count { font-size: 0.7rem; font-weight: 700; padding: 0.05rem 0.45rem; border-radius: 999px; border: 1px solid var(--border-primary); color: var(--text-gray); }
.bp-note { font-size: 0.8rem; color: var(--text-gray); padding: 0.8rem; }
.bp-empty { padding: 1rem; background: var(--card-bg); border: 1px solid var(--border-primary); border-radius: var(--radius-lg); font-size: 0.85rem; }
.bp-empty p { margin: 0 0 0.5rem; }
.bp-empty p:last-child { margin: 0; }
.err { color: var(--error-red); }
.btn { background: var(--primary-gradient); color: var(--secondary-darker); border: none; padding: 0.45rem 1rem; border-radius: var(--radius-md); font-weight: 700; cursor: pointer; }
.bp-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.4rem; }
.bp-row {
  display: grid; grid-template-columns: minmax(0, 1fr) auto auto auto auto; align-items: center; gap: 0.6rem;
  padding: 0.6rem 0.7rem; background: var(--card-bg); border: 1px solid var(--border-primary); border-radius: var(--radius-lg);
  color: inherit; text-decoration: none; transition: var(--transition-fast);
}
.bp-row:hover { border-color: var(--primary-green); }
.bp-main { display: grid; min-width: 0; }
.bp-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.88rem; }
.bp-main small { font-size: 0.7rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bp-status { font-size: 0.7rem; color: var(--text-gray); white-space: nowrap; }
.bp-status.running { color: var(--primary-green); }
.bp-status.paused { color: var(--warning-orange); }
.bp-num { display: grid; justify-items: end; font-variant-numeric: tabular-nums; font-size: 0.82rem; white-space: nowrap; }
.bp-num small { font-size: 0.62rem; }
.bp-num.up b { color: var(--primary-green); }
.bp-num.down b { color: var(--error-red); }
@media (max-width: 640px) {
  .bp-row { grid-template-columns: minmax(0, 1fr) auto; }
  .bp-status { grid-column: 2; grid-row: 1; }
  .bp-num { justify-items: start; }
}
</style>
