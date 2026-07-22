<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { usePaperStore } from '~/stores/paper'

/**
 * Asset/QuickPaperBet.vue — inline paper trading panel for the asset detail page.
 *
 * Lets the user simulate a bet on the current asset as a % of their wallet,
 * without risking real money. Shows open positions for this asset + a quick
 * form to place a new one.
 */

const props = defineProps<{
  assetId: string
  assetSymbol: string
  currentPrice: number
}>()

const paper = usePaperStore()

onMounted(() => {
  paper.hydrate()
  paper.markToMarket()
  interval = window.setInterval(() => paper.markToMarket(), 15_000)
})
let interval: number | undefined
onUnmounted(() => { if (interval) clearInterval(interval) })

// ── Form state ───────────────────────────────────────────────────────────
const side = ref<'buy' | 'sell'>('buy')
const walletPct = ref(5)
const placedId = ref<string | null>(null)

const notionalValue = computed(() => {
  // Approximate: $100k default wallet × walletPct
  return (walletPct.value / 100) * 100_000
})

const placeBet = () => {
  const t = paper.placeOrder({
    asset_id: props.assetId,
    asset_symbol: props.assetSymbol,
    side: side.value,
    wallet_pct: walletPct.value,
    simulated_price: props.currentPrice
  })
  placedId.value = t.id
  setTimeout(() => { placedId.value = null }, 2000)
}

// ── Positions for this asset ──────────────────────────────────────────────
const assetPositions = computed(() =>
  paper.trades.filter(t => t.asset_id === props.assetId)
)
const openForAsset = computed(() =>
  assetPositions.value.filter(t => t.status === 'open')
)
const closedForAsset = computed(() =>
  assetPositions.value.filter(t => t.status === 'closed')
)

const totalPnl = computed(() =>
  assetPositions.value.reduce((s, t) =>
    s + (t.status === 'open' ? t.hypothetical_pnl_value : (t.realized_pnl_value ?? 0)), 0
  )
)

const fmtSigned = (v: number) => `${v >= 0 ? '+' : ''}$${v.toFixed(0)}`
</script>

<template>
  <div class="qpb-panel">
    <header class="qpb-head">
      <div class="qpb-title">
        <span class="qpb-chip" title="Paper trade — simulated bet as % of wallet">P</span>
        <h4>Paper Trade {{ assetSymbol }}</h4>
      </div>
      <span class="qpb-price">@ ${{ currentPrice.toLocaleString() }}</span>
    </header>

    <!-- Quick form -->
    <div class="qpb-form">
      <div class="form-row">
        <label class="form-label">Side</label>
        <div class="side-toggle">
          <button :class="{ active: side === 'buy' }" @click="side = 'buy'">Buy</button>
          <button :class="{ active: side === 'sell' }" @click="side = 'sell'">Sell</button>
        </div>
      </div>
      <div class="form-row">
        <label class="form-label">Wallet %</label>
        <input
          type="range" min="0.5" max="50" step="0.5"
          v-model.number="walletPct"
          class="pct-slider"
        />
        <span class="pct-value">{{ walletPct.toFixed(1) }}%</span>
      </div>
      <div class="form-row">
        <label class="form-label">Notional</label>
        <span class="notional-value">${{ notionalValue.toLocaleString('en-US', { maximumFractionDigits: 0 }) }}</span>
      </div>
      <button
        class="place-btn"
        :class="{ placed: placedId }"
        @click="placeBet"
      >
        {{ placedId ? '✓ Placed!' : `Paper ${side === 'buy' ? 'Buy' : 'Sell'} ${assetSymbol}` }}
      </button>
    </div>

    <!-- Open positions for this asset -->
    <div v-if="openForAsset.length" class="positions">
      <h5>Open positions ({{ openForAsset.length }})</h5>
      <div v-for="t in openForAsset" :key="t.id" class="pos-row" :data-side="t.side">
        <span class="pos-side">{{ t.side.toUpperCase() }}</span>
        <span class="pos-pct">{{ t.wallet_pct.toFixed(1) }}% wallet</span>
        <span class="pos-entry">@ ${{ t.simulated_price.toLocaleString() }}</span>
        <span class="pos-pnl" :data-tone="t.hypothetical_pnl_value >= 0 ? 'pos' : 'neg'">
          {{ fmtSigned(t.hypothetical_pnl_value) }}
        </span>
        <button class="pos-close" @click="paper.closeTrade(t.id)" title="Close">✕</button>
      </div>
    </div>

    <!-- Summary -->
    <div v-if="assetPositions.length" class="qpb-summary">
      <span>Total P&L: <b :data-tone="totalPnl >= 0 ? 'pos' : 'neg'">{{ fmtSigned(totalPnl) }}</b></span>
      <span>{{ closedForAsset.length }} closed</span>
    </div>

    <NuxtLink to="/historic" class="qpb-link">View full ledger →</NuxtLink>
  </div>
</template>

<style scoped>
.qpb-panel {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.65rem 0.8rem;
  border: 1px dashed color-mix(in oklch, var(--primary-blue) 35%, transparent);
  border-radius: var(--app-border-radius, 8px);
  background: color-mix(in oklch, var(--primary-blue) 4%, transparent);
}

.qpb-head { display: flex; justify-content: space-between; align-items: center; }
.qpb-title { display: flex; align-items: center; gap: 0.4rem; }
.qpb-title h4 { margin: 0; font-size: 0.9rem; font-weight: 600; }
.qpb-chip {
  display: inline-flex;
  align-items: center; justify-content: center;
  width: 20px; height: 20px; border-radius: 50%;
  background: color-mix(in oklch, var(--primary-blue) 50%, transparent);
  color: white; font-size: 0.65rem; font-weight: 700;
}
.qpb-price { font-size: 0.75rem; color: var(--text-gray); }

.qpb-form { display: flex; flex-direction: column; gap: 0.4rem; }
.form-row { display: flex; align-items: center; gap: 0.5rem; }
.form-label {
  font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.05em;
  color: var(--text-gray); min-width: 55px;
}
.side-toggle { display: inline-flex; gap: 2px; background: rgba(255,255,255,0.04); border-radius: 6px; padding: 2px; }
.side-toggle button {
  padding: 0.25rem 0.7rem; border: 0; background: transparent;
  color: var(--text-gray); font-size: 0.75rem; border-radius: 4px; cursor: pointer;
}
.side-toggle button.active { background: rgba(255,255,255,0.1); color: white; }

.pct-slider { flex: 1; accent-color: var(--primary-blue); }
.pct-value { font-size: 0.8rem; font-weight: 600; min-width: 40px; text-align: right; }
.notional-value { font-size: 0.8rem; font-weight: 600; }

.place-btn {
  width: 100%;
  padding: 0.5rem;
  font-size: 0.8rem;
  font-weight: 600;
  border: 1px solid color-mix(in oklch, var(--primary-blue) 40%, transparent);
  background: color-mix(in oklch, var(--primary-blue) 12%, transparent);
  color: var(--primary-blue);
  border-radius: var(--app-border-radius, 6px);
  cursor: pointer;
  transition: background 0.15s;
}
.place-btn:hover { background: color-mix(in oklch, var(--primary-blue) 25%, transparent); }
.place-btn.placed {
  background: color-mix(in oklch, var(--success-green, #00ff88) 15%, transparent);
  border-color: var(--success-green, #00ff88);
  color: var(--success-green, #00ff88);
}

.positions { display: flex; flex-direction: column; gap: 0.25rem; }
.positions h5 { margin: 0; font-size: 0.75rem; color: var(--text-gray); text-transform: uppercase; letter-spacing: 0.04em; }
.pos-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.3rem 0.4rem;
  font-size: 0.72rem;
  background: rgba(255,255,255,0.02);
  border-radius: 4px;
  border-left: 2px dotted rgba(255,255,255,0.15);
}
.pos-row[data-side="sell"] { border-left-color: oklch(0.65 0.2 25 / 0.4); }
.pos-side { font-weight: 600; min-width: 2.5rem; }
.pos-pct { color: var(--text-gray); }
.pos-entry { color: var(--text-gray); flex: 1; }
.pos-pnl { font-weight: 600; }
.pos-pnl[data-tone="pos"] { color: oklch(0.7 0.2 145); }
.pos-pnl[data-tone="neg"] { color: oklch(0.65 0.2 25); }
.pos-close {
  width: 18px; height: 18px;
  border: 0; border-radius: 4px;
  background: rgba(255,255,255,0.05); color: var(--text-gray);
  cursor: pointer; font-size: 0.65rem; line-height: 1;
}
.pos-close:hover { background: oklch(0.65 0.2 25 / 0.3); color: white; }

.qpb-summary {
  display: flex;
  justify-content: space-between;
  font-size: 0.72rem;
  color: var(--text-gray);
  padding-top: 0.3rem;
  border-top: 1px solid rgba(255,255,255,0.04);
}
.qpb-summary b { font-weight: 600; }
.qpb-summary b[data-tone="pos"] { color: oklch(0.7 0.2 145); }
.qpb-summary b[data-tone="neg"] { color: oklch(0.65 0.2 25); }

.qpb-link {
  font-size: 0.7rem;
  color: var(--primary-blue);
  text-decoration: none;
}
</style>