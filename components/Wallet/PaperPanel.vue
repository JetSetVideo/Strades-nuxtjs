<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { usePaperStore, type PaperTrade } from '~/stores/paper'
import { useWalletStore } from '~/stores/wallet'

/**
 * Wallet/PaperPanel.vue — Paper / Live trading dashboard widget.
 *
 * The mode toggle binds KPIs + position history:
 *   - Paper → simulated ledger (blue dashed border, dotted row rails)
 *   - Live  → wallet holdings / transactions (solid green border)
 *
 * Visual language per Design.md §4:
 *   - Paper accent at 60% saturation; live at full green
 *   - Dotted left border on paper rows; solid on live rows
 */

const paper = usePaperStore()
const walletStore = useWalletStore()
const { signedUsd, notional, sources } = usePaperFormat()

onMounted(() => {
  paper.hydrate()
  if (paper.trades.length === 0) paper.seedDemo()
  if (!walletStore.hydrated) walletStore.initializeStore()
  // Mark to market every 30s so the user sees the positions breathe
  interval = window.setInterval(() => paper.markToMarket(), 30_000)
  paper.markToMarket()
})

let interval: number | undefined
onUnmounted(() => { if (interval) clearInterval(interval) })

const isPaper = computed(() => paper.mode === 'paper')
const isLive = computed(() => paper.mode === 'live')

const liveWallet = computed(() =>
  walletStore.wallets.find(w => w.is_default && w.is_active)
  ?? walletStore.wallets.find(w => w.is_default)
  ?? walletStore.wallets[0]
  ?? null
)

const liveAssets = computed(() => liveWallet.value?.assets ?? [])
const liveTransactions = computed(() =>
  [...(liveWallet.value?.transactions ?? [])]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
)

/** Unified row shape so the list can swap cleanly on mode change. */
interface PanelRow {
  id: string
  symbol: string
  side: 'buy' | 'sell'
  meta: string
  strategy_id?: string
  agent_id?: string
  pnl: number
  pnlPct: number
  timestamp: string
  closable: boolean
}

const paperRows = computed<PanelRow[]>(() =>
  paper.openTrades.map((t: PaperTrade) => ({
    id: t.id,
    symbol: t.asset_symbol,
    side: t.side,
    meta: `${t.side.toUpperCase()} · ${t.wallet_pct.toFixed(1)}% wallet · ${notional(t.notional_value)}`,
    strategy_id: t.strategy_id,
    agent_id: t.agent_id,
    pnl: t.hypothetical_pnl_value,
    pnlPct: t.hypothetical_pnl_pct,
    timestamp: t.timestamp,
    closable: true,
  }))
)

const liveRows = computed<PanelRow[]>(() =>
  liveAssets.value.map(a => ({
    id: `live-${a.asset_id}`,
    symbol: a.symbol,
    side: 'buy' as const,
    meta: `HOLD · ${a.allocation_percentage.toFixed(1)}% wallet · ${notional(a.current_value)}`,
    pnl: a.return_amount,
    pnlPct: a.return_percentage,
    timestamp: liveWallet.value?.updated_at ?? liveWallet.value?.created_at ?? new Date().toISOString(),
    closable: false,
  }))
)

const openRows = computed(() => (isPaper.value ? paperRows.value : liveRows.value))

const closedRows = computed(() => {
  if (isPaper.value) {
    return paper.closedTrades.slice(0, 5).map(t => ({
      id: t.id,
      symbol: t.asset_symbol,
      pnl: t.realized_pnl_value ?? 0,
    }))
  }
  return liveTransactions.value
    .filter(t => t.status === 'completed')
    .slice(0, 5)
    .map(t => ({
      id: t.id,
      symbol: `${t.type.toUpperCase()} ${t.asset_symbol}`,
      pnl: t.type === 'sell' ? t.total_value : -t.total_value,
    }))
})

const liveOpenPnl = computed(() =>
  liveAssets.value.reduce((s, a) => s + (a.return_amount ?? 0), 0)
)
const liveRealized = computed(() => liveWallet.value?.total_return ?? 0)
const liveWinRate = computed(() => {
  const assets = liveAssets.value
  if (!assets.length) return 0
  return (assets.filter(a => a.return_percentage > 0).length / assets.length) * 100
})

const kpis = computed(() => {
  if (isPaper.value) {
    return [
      { label: 'Open P&L', value: signedUsd(paper.openPnlValue, 0), tone: paper.openPnlValue >= 0 ? 'positive' : 'negative' },
      { label: 'Realized', value: signedUsd(paper.realizedPnlValue, 0), tone: paper.realizedPnlValue >= 0 ? 'positive' : 'negative' },
      { label: 'Win rate', value: paper.winRate.toFixed(0), suffix: '%' },
      { label: 'Positions', value: paper.openTrades.length },
    ]
  }
  return [
    { label: 'Open P&L', value: signedUsd(liveOpenPnl.value, 0), tone: liveOpenPnl.value >= 0 ? 'positive' : 'negative' },
    { label: 'Realized', value: signedUsd(liveRealized.value, 0), tone: liveRealized.value >= 0 ? 'positive' : 'negative' },
    { label: 'Win rate', value: liveWinRate.value.toFixed(0), suffix: '%' },
    { label: 'Positions', value: liveAssets.value.length },
  ]
})

const curve = computed(() => {
  if (isPaper.value) return paper.equityCurve
  // Live curve: cumulative signed cashflow from completed transactions
  const txs = [...liveTransactions.value]
    .filter(t => t.status === 'completed')
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
  let cum = 0
  return txs.map(t => {
    cum += t.type === 'sell' ? t.total_value : -t.total_value
    return { t: t.timestamp, v: cum }
  })
})

const curvePath = computed(() => {
  const pts = curve.value
  if (pts.length < 2) return ''
  const values = pts.map(p => p.v)
  const min = Math.min(...values, 0)
  const max = Math.max(...values, 0)
  const range = max - min || 1
  const w = 200, h = 40
  return pts.map((p, i) => {
    const x = (i / (pts.length - 1)) * w
    const y = h - ((p.v - min) / range) * h
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
})

const emptyCopy = computed(() =>
  isPaper.value
    ? 'No open paper positions. Place a simulated bet from any asset page.'
    : 'No live holdings in this wallet yet.'
)

const formatPnl = (v: number) => signedUsd(v)
const formatPct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`
const timeAgo = (ts: string) => {
  const m = Math.floor((Date.now() - new Date(ts).getTime()) / 60000)
  if (m < 60) return `${Math.max(0, m)}m`
  if (m < 1440) return `${Math.floor(m / 60)}h`
  return `${Math.floor(m / 1440)}d`
}

function setMode(mode: 'paper' | 'live') {
  if (paper.mode === mode) return
  paper.setMode(mode)
  if (mode === 'paper') paper.markToMarket()
}
</script>

<template>
  <div class="paper-panel" :class="isPaper ? 'is-paper' : 'is-live'" :data-mode="paper.mode">
    <header class="paper-head">
      <div
        class="mode-toggle"
        role="tablist"
        aria-label="Trading mode"
      >
        <button
          type="button"
          role="tab"
          :aria-selected="isPaper"
          class="mode-btn paper"
          :class="{ active: isPaper }"
          title="Paper trading — simulated bets as % of wallet"
          @click="setMode('paper')"
        >
          <span class="paper-chip" aria-hidden="true">P</span>
          Paper Trading
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="isLive"
          class="mode-btn live"
          :class="{ active: isLive }"
          title="Live wallet holdings and trade history"
          @click="setMode('live')"
        >Live</button>
      </div>
    </header>

    <div :key="paper.mode" class="mode-body">
      <!-- KPI strip -->
      <div class="kpi-row">
        <div v-for="k in kpis" :key="k.label" class="kpi">
          <span class="k-label">{{ k.label }}</span>
          <span class="k-value" :data-tone="k.tone">
            {{ k.value }}{{ k.suffix }}
          </span>
        </div>
      </div>

      <!-- Equity curve -->
      <div v-if="curve.length > 1" class="equity-strip">
        <svg viewBox="0 0 200 40" preserveAspectRatio="none">
          <path :d="curvePath" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.8" />
        </svg>
        <span class="equity-label">
          {{ isPaper ? 'Cumulative realized P&L' : 'Cumulative trade flow' }}
        </span>
      </div>

      <!-- Open positions / holdings — remounts when mode flips -->
      <div class="positions">
        <div v-if="!openRows.length" class="empty">{{ emptyCopy }}</div>
        <div
          v-for="t in openRows"
          :key="`${paper.mode}-${t.id}`"
          class="position-row"
          :data-side="t.side"
          :data-mode="paper.mode"
        >
          <div class="pos-left">
            <span class="pos-symbol">{{ t.symbol }}</span>
            <span class="pos-meta">{{ t.meta }}</span>
            <span v-if="t.strategy_id || t.agent_id" class="pos-source">
              via
              <template v-for="(s, i) in sources(t)" :key="s.kind">
                <template v-if="i"> · </template><NuxtLink :to="s.to" class="pos-source-link">{{ s.name }}</NuxtLink>
              </template>
            </span>
          </div>
          <div class="pos-right">
            <span class="pos-pnl" :data-tone="t.pnl >= 0 ? 'pos' : 'neg'">
              {{ formatPnl(t.pnl) }}
            </span>
            <span class="pos-pct" :data-tone="t.pnl >= 0 ? 'pos' : 'neg'">
              {{ formatPct(t.pnlPct) }}
            </span>
            <span class="pos-age">{{ timeAgo(t.timestamp) }}</span>
            <button
              v-if="t.closable"
              class="close-btn"
              title="Close position"
              @click="paper.closeTrade(t.id)"
            >✕</button>
          </div>
        </div>
      </div>

      <!-- Recent closed / completed -->
      <details v-if="closedRows.length" class="closed-block">
        <summary>
          {{ isPaper ? 'Recent closed' : 'Recent trades' }} ({{ closedRows.length }})
        </summary>
        <div
          v-for="t in closedRows"
          :key="`${paper.mode}-${t.id}`"
          class="closed-row"
        >
          <span>{{ t.symbol }}</span>
          <span class="closed-pnl" :data-tone="t.pnl >= 0 ? 'pos' : 'neg'">
            {{ formatPnl(t.pnl) }}
          </span>
        </div>
      </details>
    </div>
  </div>
</template>

<style scoped>
.paper-panel {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 0.75rem;
  border-radius: var(--app-border-radius, 8px);
  transition: border-color 0.25s ease, background 0.25s ease, border-style 0.25s ease;
}

/* Paper: cool blue dashed frame (Design.md §4) */
.paper-panel.is-paper {
  border: 1px dashed color-mix(in oklch, var(--primary-blue) 40%, transparent);
  background: color-mix(in oklch, var(--primary-blue) 4%, transparent);
}

/* Live: full solid green frame */
.paper-panel.is-live {
  border: 1px solid color-mix(in oklch, var(--app-color-up, var(--success-green, #30a46c)) 70%, transparent);
  background: color-mix(in oklch, var(--app-color-up, var(--success-green, #30a46c)) 6%, transparent);
}

.paper-head {
  display: flex;
  align-items: center;
  justify-content: flex-start;
}

.mode-toggle {
  display: inline-flex;
  align-items: stretch;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  padding: 2px;
  gap: 2px;
}

.mode-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.2rem 0.55rem;
  border: 0;
  background: transparent;
  color: var(--text-gray);
  font: inherit;
  font-size: 0.75rem;
  font-weight: 600;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  white-space: nowrap;
  line-height: 1.2;
}

.mode-btn.paper { font-size: 0.8rem; }

.paper-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: color-mix(in oklch, var(--primary-blue) 45%, transparent);
  color: white;
  font-size: 0.62rem;
  font-weight: 700;
  flex-shrink: 0;
  opacity: 0.7;
  transition: background 0.15s, opacity 0.15s;
}

.mode-btn.active {
  background: color-mix(in oklch, var(--primary-blue) 30%, transparent);
  color: white;
}

.mode-btn.paper.active .paper-chip {
  background: color-mix(in oklch, var(--primary-blue) 70%, transparent);
  opacity: 1;
}

.mode-btn.live.active {
  background: color-mix(in oklch, var(--app-color-up, var(--success-green, #30a46c)) 28%, transparent);
  color: var(--app-color-up, var(--success-green, #30a46c));
}

.mode-body {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.kpi-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
  gap: 0.4rem;
}
.kpi { display: flex; flex-direction: column; gap: 0.1rem; }
.k-label { font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-gray); }
.k-value { font-size: 0.9rem; font-weight: 600; }
.k-value[data-tone="positive"] { color: oklch(0.7 0.2 145); }
.k-value[data-tone="negative"] { color: oklch(0.65 0.2 25); }

.equity-strip {
  position: relative;
  height: 40px;
  opacity: 0.7;
}
.paper-panel.is-paper .equity-strip { color: var(--primary-blue); }
.paper-panel.is-live .equity-strip { color: var(--app-color-up, var(--success-green, #30a46c)); }
.equity-strip svg { width: 100%; height: 100%; }
.equity-label {
  position: absolute;
  top: 0; right: 0;
  font-size: 0.6rem;
  color: var(--text-gray);
}

.positions { display: flex; flex-direction: column; gap: 0.3rem; }
.empty {
  font-size: 0.8rem;
  color: var(--text-gray);
  padding: 0.4rem;
  text-align: center;
  font-style: italic;
}

.position-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.5rem;
  background: rgba(255,255,255,0.02);
  border-radius: 4px;
  border-left: 2px dotted color-mix(in oklch, var(--primary-blue) 50%, transparent);
  transition: border-left-color 0.2s ease, border-left-style 0.2s ease;
}
.position-row[data-side="sell"] { border-left-color: oklch(0.65 0.2 25 / 0.5); }

/* Live rows: solid full-green rail instead of paper dots */
.position-row[data-mode="live"] {
  border-left-style: solid;
  border-left-color: var(--app-color-up, var(--success-green, #30a46c));
}
.position-row[data-mode="live"][data-side="sell"] {
  border-left-color: oklch(0.65 0.2 25);
}

.pos-left { display: flex; flex-direction: column; gap: 0.1rem; min-width: 0; flex: 1; }
.pos-symbol { font-weight: 600; font-size: 0.85rem; }
.pos-meta { font-size: 0.7rem; color: var(--text-gray); }
.pos-source { font-size: 0.65rem; color: var(--primary-blue); font-style: italic; }
.paper-panel.is-live .pos-source { color: var(--app-color-up, var(--success-green, #30a46c)); }
.pos-source-link { color: inherit; text-decoration: none; }
.pos-source-link:hover { text-decoration: underline; }

.pos-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}
.pos-pnl { font-weight: 600; font-size: 0.85rem; }
.pos-pct { font-size: 0.75rem; opacity: 0.8; }
.pos-pnl[data-tone="pos"], .pos-pct[data-tone="pos"] { color: oklch(0.7 0.2 145); }
.pos-pnl[data-tone="neg"], .pos-pct[data-tone="neg"] { color: oklch(0.65 0.2 25); }
.pos-age { font-size: 0.65rem; color: var(--text-gray); }

.close-btn {
  width: 22px; height: 22px;
  border: 0;
  border-radius: 4px;
  background: rgba(255,255,255,0.05);
  color: var(--text-gray);
  cursor: pointer;
  font-size: 0.7rem;
  line-height: 1;
}
.close-btn:hover { background: oklch(0.65 0.2 25 / 0.3); color: white; }

.closed-block {
  font-size: 0.75rem;
  color: var(--text-gray);
}
.closed-block summary {
  cursor: pointer;
  padding: 0.3rem 0;
  user-select: none;
}
.closed-row {
  display: flex;
  justify-content: space-between;
  padding: 0.2rem 0.4rem;
  border-left: 2px dotted rgba(255,255,255,0.1);
  margin-top: 0.2rem;
}
.paper-panel.is-live .closed-row {
  border-left-style: solid;
  border-left-color: color-mix(in oklch, var(--app-color-up, var(--success-green, #30a46c)) 45%, transparent);
}
.closed-pnl[data-tone="pos"] { color: oklch(0.7 0.2 145); }
.closed-pnl[data-tone="neg"] { color: oklch(0.65 0.2 25); }
</style>
