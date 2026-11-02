<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { usePaperStore, type PaperTrade } from '~/stores/paper'
import { useTradingApi } from '~/composables/useTradingApi'
import { DEFAULT_PAPER_CAPITAL, paperCapital, paperOwnerId } from '~/utils/paperMarks'
import { livePrice, quickBetBlock, quoteDecimals } from '~/utils/quickBet'
import { fmtMoney, fmtSignedMoney } from '~/utils/format'
import UISourceChip from '~/components/UI/SourceChip.vue'

/**
 * Asset/QuickPaperBet.vue — inline paper trading panel for the asset detail page.
 *
 * Lets the user simulate a bet on the current asset as a % of their paper cash,
 * without risking real money. Shows open positions for this asset + a quick
 * form to place a new one.
 *
 * Wave 2: P&L is marked to the live price (stores/paper markToMarket); no live
 * price → "—". Sizing uses the user's paper wallets' free cash, else a labelled
 * default. Trades are stamped with the signed-in user's id (else "guest").
 * Wave 4: currentPrice may be null (no quote yet): the form still shows, the price
 * reads "—" + "no live price yet", and the bet cannot be placed.
 */

const props = defineProps<{
  assetId: string
  assetSymbol: string
  /** Live quote, or null when there is none yet (never pass an invented price). */
  currentPrice: number | null
}>()

const price = computed(() => livePrice(props.currentPrice))
const priceText = computed(() => fmtMoney(price.value, { decimals: quoteDecimals(price.value) }))

const paper = usePaperStore()
// Resolve identity in setup (Design.md §10: never inside a computed / store action).
const { user, isAuthenticated } = useAuth()
const ownerId = computed(() => paperOwnerId(isAuthenticated.value, user.value?.id))
const tradingApi = useTradingApi()
const walletCash = ref<number | null>(null)

onMounted(async () => {
  paper.hydrate()
  paper.markToMarket()
  interval = window.setInterval(() => paper.markToMarket(), 15_000)
  if (isAuthenticated.value) {
    try { walletCash.value = paperCapital(await tradingApi.listWallets()) } catch { walletCash.value = null }
  }
})
let interval: number | undefined
onUnmounted(() => { if (interval) clearInterval(interval) })

// ── Form state ───────────────────────────────────────────────────────────
const side = ref<'buy' | 'sell'>('buy')
const walletPct = ref(5)
const placedId = ref<string | null>(null)

const capital = computed(() => walletCash.value ?? DEFAULT_PAPER_CAPITAL)
const capitalIsDefault = computed(() => walletCash.value === null)
const notionalValue = computed(() => (walletPct.value / 100) * capital.value)
/** Why the bet cannot be placed ('' = it can): no live price, or a 0 % size. */
const blocked = computed(() => quickBetBlock(price.value, walletPct.value))

const placeBet = () => {
  const p = price.value
  if (p === null || blocked.value) return
  const t = paper.placeOrder({
    asset_id: props.assetId,
    asset_symbol: props.assetSymbol,
    side: side.value,
    wallet_pct: walletPct.value,
    simulated_price: p,
    user_id: ownerId.value,
    capital_usd: walletCash.value,
  })
  placedId.value = t.id
  paper.markToMarket()
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

/** P&L of one position, or null when it has no price to be marked against. */
const pnlOf = (t: PaperTrade): number | null =>
  t.status === 'open'
    ? (typeof t.mark_price === 'number' ? t.hypothetical_pnl_value : null)
    : (t.realized_pnl_value ?? null)

const unmarked = computed(() => assetPositions.value.filter(t => pnlOf(t) === null).length)
const totalPnl = computed<number | null>(() => {
  const known = assetPositions.value.map(pnlOf).filter((v): v is number => v !== null)
  return known.length ? known.reduce((s, v) => s + v, 0) : null
})

const fmtSigned = (v: number | null) => fmtSignedMoney(v, { decimals: 0 })
</script>

<template>
  <div class="qpb-panel">
    <header class="qpb-head">
      <div class="qpb-title">
        <span class="qpb-chip" title="Paper trade — simulated bet as % of wallet">P</span>
        <h4>Paper Trade {{ assetSymbol }}</h4>
      </div>
      <span class="qpb-price">@ {{ priceText }}
        <UISourceChip v-if="price === null" source="pending" note="No live price yet: this asset has no quote right now, so a paper bet cannot be placed. The form stays so you can see the options." />
      </span>
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
        <span class="notional-value">{{ fmtMoney(notionalValue, { decimals: 0 }) }}</span>
        <span class="capital-note">
          of {{ fmtMoney(capital, { decimals: 0 }) }}
          {{ capitalIsDefault ? 'default paper capital' : 'paper cash' }}
          <UISourceChip
            :source="capitalIsDefault ? 'pending' : 'paper'"
            :note="capitalIsDefault
              ? 'No paper wallet found (signed out or none yet): sized on a default $100,000. Create a paper wallet on /trade to size on your own paper cash.'
              : 'Free cash of your paper wallets (/trade).'"
          />
        </span>
      </div>
      <button
        class="place-btn"
        :class="{ placed: placedId }"
        :disabled="!!blocked"
        :aria-disabled="!!blocked"
        :title="blocked || undefined"
        @click="placeBet"
      >
        {{ placedId ? '✓ Placed!' : `Paper ${side === 'buy' ? 'Buy' : 'Sell'} ${assetSymbol}` }}
      </button>
      <small v-if="blocked" class="qpb-blocked" role="status">{{ blocked }}</small>
    </div>

    <!-- Open positions for this asset -->
    <div v-if="openForAsset.length" class="positions">
      <h5>Open positions ({{ openForAsset.length }})</h5>
      <div v-for="t in openForAsset" :key="t.id" class="pos-row" :data-side="t.side">
        <span class="pos-side">{{ t.side.toUpperCase() }}</span>
        <span class="pos-pct">{{ t.wallet_pct.toFixed(1) }}% wallet</span>
        <span class="pos-entry">@ {{ fmtMoney(t.simulated_price, { decimals: quoteDecimals(t.simulated_price) }) }}</span>
        <span class="pos-pnl" :data-tone="pnlOf(t) === null ? 'none' : (pnlOf(t) ?? 0) >= 0 ? 'pos' : 'neg'"
          :title="pnlOf(t) === null ? 'No live price for this asset: P&L not computed' : `Marked at $${t.mark_price}`">
          {{ fmtSigned(pnlOf(t)) }}
        </span>
        <button class="pos-close" @click="paper.closeTrade(t.id)" title="Close">✕</button>
      </div>
    </div>

    <!-- Summary -->
    <div v-if="assetPositions.length" class="qpb-summary">
      <span>Total P&L: <b :data-tone="totalPnl === null ? 'none' : totalPnl >= 0 ? 'pos' : 'neg'">{{ fmtSigned(totalPnl) }}</b>
        <UISourceChip v-if="unmarked" source="pending" :note="`${unmarked} position(s) have no live price, so their P&L is not computed (shown —).`" />
      </span>
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
.capital-note { display: inline-flex; align-items: center; gap: 0.3rem; flex-wrap: wrap; font-size: 0.68rem; color: var(--text-gray); }

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
.place-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.place-btn:disabled:hover { background: color-mix(in oklch, var(--primary-blue) 12%, transparent); }
.qpb-blocked { font-size: 0.68rem; color: var(--text-gray); }
.qpb-price { display: inline-flex; align-items: center; gap: 0.3rem; }
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