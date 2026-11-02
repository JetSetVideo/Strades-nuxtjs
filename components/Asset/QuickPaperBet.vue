<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { usePaperStore, type PaperTrade } from '~/stores/paper'
import {
  floorQty, heldQuantity, orderQuantity, paperOwnerId, portfolioFill, portfolioHolding,
  resolvePaperCapital, tradeErrorText, type ServerPortfolio,
} from '~/utils/paperMarks'
import { livePrice, quickBetBlock, quoteDecimals } from '~/utils/quickBet'
import { fmtMoney, fmtSignedMoney } from '~/utils/format'
import UISourceChip from '~/components/UI/SourceChip.vue'

/**
 * Asset/QuickPaperBet.vue — inline paper trading panel for the asset detail page.
 *
 * Swarm 11-02 (TRADE-1/2/3, contract C1/C8):
 *  - Signed in: Buy/Sell go to the SERVER paper book, `POST /api/v1/portfolio/trade/` (the same book
 *    as Wallet › Hand trade and the Wallet "Your paper" KPI), with one `client_id` per click
 *    (idempotency key). Works with and without the optional `fill` in the response.
 *    Buy sizes on the book's free cash; Sell only reduces a held position (no shorts while
 *    Settings › Short selling is locked). After a fill, the shared own book refreshes (useOwnBook).
 *  - Signed out: a practice ledger in this browser (stores/paper, localStorage), labelled so, sized
 *    on Settings-free default 10,000 — never the old 100k.
 *  - No live price → the price reads "—" and nothing can be placed (never an invented price).
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
// Resolve identity + Nuxt context in setup (Design.md §10: never inside a computed / store action).
const { user, isAuthenticated } = useAuth()
const ownerId = computed(() => paperOwnerId(isAuthenticated.value, user.value?.id))
const own = useOwnBook()
const primary = usePrimarySettings()
const $api = useNuxtApp().$api as typeof $fetch

/** Server book for signed-in users; the browser ledger only for signed-out visitors. */
const serverBook = computed(() => isAuthenticated.value && own.state.value !== 'signed-out')
const pf = computed(() => (own.raw.value?.portfolio ?? null) as ServerPortfolio | null)
/** Free cash of the server book, when it was read (0 included); else null. */
const bookCash = computed<number | null>(() => {
  if (!serverBook.value || !pf.value) return null
  const v = Number(pf.value.cash_balance)
  return Number.isFinite(v) ? v : null
})

onMounted(() => {
  paper.hydrate()
  paper.markToMarket()
  interval = window.setInterval(() => paper.markToMarket(), 15_000)
  if (isAuthenticated.value) primary.load().catch(() => {})
})
let interval: number | undefined
onUnmounted(() => { if (interval) clearInterval(interval) })

// ── Form state ───────────────────────────────────────────────────────────
const side = ref<'buy' | 'sell'>('buy')
const walletPct = ref(5)
const busy = ref(false)
/** One-line result of the last order (role=status), kept until the next action. */
const result = ref<{ ok: boolean; text: string } | null>(null)

/** ONE paper-capital source (utils/paperMarks resolvePaperCapital). */
const cap = computed(() => resolvePaperCapital(bookCash.value, serverBook.value ? primary.values.value.starting_capital : undefined))
const held = computed(() => (serverBook.value ? heldQuantity(pf.value, props.assetId, props.assetSymbol) : 0))
const holding = computed(() => (serverBook.value ? portfolioHolding(pf.value, props.assetId, props.assetSymbol) : null))

const canSell = computed(() => serverBook.value && held.value > 0)
const sellReason = computed(() => (serverBook.value
  ? `Sell reduces a position you hold: you hold no ${props.assetSymbol}. Short selling is off (Settings › Short selling).`
  : 'Sell closes a position: use ✕ on an open position below. Short selling is off.'))
function pickSide(s: 'buy' | 'sell') {
  if (s === 'sell' && !canSell.value) return
  if (side.value !== s) walletPct.value = s === 'sell' ? 100 : 5
  side.value = s
  result.value = null
}

const pctMax = computed(() => (side.value === 'sell' ? 100 : 50))
const notionalValue = computed(() => (side.value === 'sell'
  ? (walletPct.value / 100) * held.value * (price.value ?? 0)
  : (walletPct.value / 100) * cap.value.amount))
const quantity = computed(() => floorQty(orderQuantity({ side: side.value, notional: notionalValue.value, price: price.value, held: held.value })))

/** Why the order cannot be placed ('' = it can). */
const blocked = computed(() => {
  const base = quickBetBlock(price.value, walletPct.value)
  if (base) return base
  if (side.value === 'buy' && cap.value.amount <= 0) return 'No free paper cash: sell a holding first (Wallet › Hand trade).'
  if (side.value === 'sell' && !canSell.value) return sellReason.value
  if (serverBook.value && !(quantity.value > 0)) return 'The size rounds to 0 units: pick a bigger %.'
  return ''
})

const capitalLabel = computed(() => ({
  cash: 'your paper cash',
  settings: 'from Settings › Paper starting capital',
  default: 'default paper capital',
}[cap.value.source]))
const capitalNote = computed(() => ({
  cash: 'Free cash of your paper portfolio: the same book as Wallet › Your paper. Orders here fill on the server.',
  settings: 'Your paper cash could not be read: sized on Settings › Paper starting capital. The server still checks your real paper cash.',
  default: 'Signed out: a practice ledger kept in this browser only, sized on a default $10,000. Sign in to trade your own paper book.',
}[cap.value.source]))

const newClientId = () => (globalThis.crypto?.randomUUID?.() ?? `qpb-${Date.now()}-${Math.random().toString(36).slice(2)}`)

async function placeBet() {
  const p = price.value
  if (p === null || blocked.value || busy.value) return
  result.value = null
  if (!serverBook.value) {
    // Signed-out practice ledger (this browser only).
    paper.placeOrder({
      asset_id: props.assetId,
      asset_symbol: props.assetSymbol,
      side: 'buy',
      wallet_pct: walletPct.value,
      simulated_price: p,
      user_id: ownerId.value,
      capital_usd: cap.value.amount,
    })
    paper.markToMarket()
    result.value = { ok: true, text: `Practice buy ${fmtMoney(notionalValue.value, { decimals: 0 })} ${props.assetSymbol} @ ${priceText.value} · this browser only` }
    return
  }
  busy.value = true
  const qty = quantity.value
  const verb = side.value === 'buy' ? 'Bought' : 'Sold'
  try {
    const resp = await $api<ServerPortfolio>('/api/v1/portfolio/trade/', {
      method: 'POST',
      // one idempotency key per click (C1): a retry of THIS click can never book twice
      body: { asset_id: props.assetId, type: side.value, quantity: qty, client_id: newClientId() },
    })
    const fill = portfolioFill(resp, props.assetSymbol, p)
    const units = fill.quantity ?? qty
    const fee = fill.fee && fill.fee > 0 ? ` · fee ${fmtMoney(fill.fee)}` : ''
    result.value = {
      ok: true,
      text: `${verb} ${units.toLocaleString('en-US', { maximumFractionDigits: 8 })} ${props.assetSymbol} @ ${fmtMoney(fill.price, { decimals: quoteDecimals(fill.price) })}${fee}${fill.source === 'quote' ? ' (your quote)' : ' (server fill)'}`,
    }
    await own.refresh()
    if (side.value === 'sell' && held.value <= 0) pickSide('buy')
  } catch (e) {
    result.value = { ok: false, text: tradeErrorText(e) }
  } finally {
    busy.value = false
  }
}

// ── Practice-ledger positions for this asset (browser only) ──────────────
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
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : null)
</script>

<template>
  <div class="qpb-panel">
    <header class="qpb-head">
      <div class="qpb-title">
        <span class="qpb-chip" title="Paper trade — simulated money, real prices">P</span>
        <h4>Paper Trade {{ assetSymbol }}</h4>
      </div>
      <span class="qpb-price">@ {{ priceText }}
        <UISourceChip v-if="price === null" source="pending" note="No live price yet: this asset has no quote right now, so a paper order cannot be placed. The form stays so you can see the options." />
      </span>
    </header>

    <!-- Quick form -->
    <div class="qpb-form">
      <div class="form-row">
        <label class="form-label">Side</label>
        <div class="side-toggle">
          <button :class="{ active: side === 'buy' }" @click="pickSide('buy')">Buy</button>
          <button
            :class="{ active: side === 'sell' }"
            :disabled="!canSell"
            :aria-disabled="!canSell"
            :title="canSell ? `Sell part of your ${assetSymbol}` : sellReason"
            @click="pickSide('sell')"
          >Sell</button>
        </div>
      </div>
      <div class="form-row">
        <label class="form-label">{{ side === 'sell' ? 'Holding %' : 'Cash %' }}</label>
        <input
          type="range" min="0.5" :max="pctMax" step="0.5"
          v-model.number="walletPct"
          class="pct-slider"
        />
        <span class="pct-value">{{ walletPct.toFixed(1) }}%</span>
      </div>
      <div class="form-row">
        <label class="form-label">Notional</label>
        <span class="notional-value">{{ fmtMoney(notionalValue, { decimals: 0 }) }}</span>
        <span v-if="side === 'buy'" class="capital-note">
          of {{ fmtMoney(cap.amount, { decimals: 0 }) }} {{ capitalLabel }}
          <UISourceChip :source="cap.source === 'cash' ? 'paper' : 'pending'" :note="capitalNote" />
        </span>
        <span v-else class="capital-note">
          of {{ held.toLocaleString('en-US', { maximumFractionDigits: 8 }) }} {{ assetSymbol }} held
          <UISourceChip source="paper" note="Your holding in the paper portfolio (Wallet). Sell never goes below 0: no shorts." />
        </span>
      </div>
      <button
        class="place-btn"
        :class="{ placed: result?.ok }"
        :disabled="!!blocked || busy"
        :aria-disabled="!!blocked || busy"
        :title="blocked || undefined"
        @click="placeBet"
      >
        {{ busy ? 'Sending…' : `Paper ${side === 'buy' ? 'Buy' : 'Sell'} ${assetSymbol}` }}
      </button>
      <small v-if="blocked" class="qpb-blocked" role="status">{{ blocked }}</small>
      <small v-if="result" class="qpb-result" :data-ok="result.ok" role="status">
        {{ result.text }}<template v-if="result.ok && serverBook"> · <NuxtLink to="/wallet">see Wallet →</NuxtLink></template>
      </small>
    </div>

    <!-- Server holding for this asset -->
    <div v-if="holding" class="positions">
      <h5>Your position <UISourceChip source="paper" note="In your paper portfolio on the server (Wallet › Your paper)." /></h5>
      <div class="pos-row" data-side="buy">
        <span class="pos-side">HOLD</span>
        <span class="pos-pct">{{ Number(holding.quantity).toLocaleString('en-US', { maximumFractionDigits: 8 }) }} {{ assetSymbol }}</span>
        <span class="pos-entry">avg {{ fmtMoney(num(holding.average_buy_price), { decimals: quoteDecimals(num(holding.average_buy_price)) }) }}</span>
        <span class="pos-pnl" :data-tone="num(holding.unrealized_pnl) === null ? 'none' : (num(holding.unrealized_pnl) ?? 0) >= 0 ? 'pos' : 'neg'"
          title="At the server's stored price">
          {{ fmtSigned(num(holding.unrealized_pnl)) }}
        </span>
      </div>
    </div>

    <!-- Practice ledger (this browser) -->
    <div v-if="openForAsset.length" class="positions">
      <h5>{{ serverBook ? 'Practice ledger (this browser, not in Wallet)' : 'Open practice positions' }} ({{ openForAsset.length }})</h5>
      <div v-for="t in openForAsset" :key="t.id" class="pos-row" :data-side="t.side">
        <span class="pos-side">{{ t.side.toUpperCase() }}</span>
        <span class="pos-pct">{{ t.wallet_pct.toFixed(1) }}% wallet</span>
        <span class="pos-entry">@ {{ fmtMoney(t.simulated_price, { decimals: quoteDecimals(t.simulated_price) }) }}</span>
        <UISourceChip v-if="t.sample" source="sample" note="Seeded example row, not a trade you placed." />
        <span class="pos-pnl" :data-tone="pnlOf(t) === null ? 'none' : (pnlOf(t) ?? 0) >= 0 ? 'pos' : 'neg'"
          :title="pnlOf(t) === null ? 'No live price for this asset: P&L not computed' : `Marked at ${fmtMoney(t.mark_price ?? null, { decimals: quoteDecimals(t.mark_price ?? null) })}`">
          {{ fmtSigned(pnlOf(t)) }}
        </span>
        <button class="pos-close" @click="paper.closeTrade(t.id)" title="Close">✕</button>
      </div>
    </div>

    <!-- Summary -->
    <div v-if="assetPositions.length" class="qpb-summary">
      <span>Practice P&L: <b :data-tone="totalPnl === null ? 'none' : totalPnl >= 0 ? 'pos' : 'neg'">{{ fmtSigned(totalPnl) }}</b>
        <UISourceChip v-if="unmarked" source="pending" :note="`${unmarked} position(s) have no live price, so their P&L is not computed (shown —).`" />
      </span>
      <span>{{ closedForAsset.length }} closed</span>
    </div>

    <NuxtLink :to="serverBook ? '/wallet' : '/historic'" class="qpb-link">{{ serverBook ? 'Your paper book (Wallet) →' : 'View full ledger →' }}</NuxtLink>
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
.qpb-result { font-size: 0.7rem; color: var(--success-green, #00ff88); }
.qpb-result[data-ok="false"] { color: var(--app-color-down, #ff4444); }
.qpb-result a { color: var(--primary-blue); text-decoration: none; }
.side-toggle button:disabled { opacity: 0.4; cursor: not-allowed; }
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