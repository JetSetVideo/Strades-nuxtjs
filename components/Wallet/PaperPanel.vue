<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { usePaperStore } from '~/stores/paper'

/**
 * Wallet/PaperPanel.vue — Paper trading dashboard widget.
 *
 * Renders:
 *   - Live / Paper mode toggle
 *   - Aggregate KPIs (open P&L, realized P&L, win rate)
 *   - Open positions list with per-trade P&L and close button
 *   - Mini equity curve from closed trades
 *
 * Visual language per Design.md §4:
 *   - Accent color at 60% saturation (distinguishes paper from real)
 *   - "P" chip on every position
 *   - Dotted left border on rows (matches historic.vue ledger style)
 */

const paper = usePaperStore()

onMounted(() => {
  paper.hydrate()
  if (paper.trades.length === 0) paper.seedDemo()
  // Mark to market every 30s so the user sees the positions breathe
  interval = window.setInterval(() => paper.markToMarket(), 30_000)
  paper.markToMarket()
})

let interval: number | undefined
onUnmounted(() => { if (interval) clearInterval(interval) })

const kpis = computed(() => [
  { label: 'Open P&L', value: paper.openPnlValue.toFixed(0), prefix: '$', tone: paper.openPnlValue >= 0 ? 'positive' : 'negative' },
  { label: 'Realized', value: paper.realizedPnlValue.toFixed(0), prefix: '$', tone: paper.realizedPnlValue >= 0 ? 'positive' : 'negative' },
  { label: 'Win rate', value: paper.winRate.toFixed(0), suffix: '%' },
  { label: 'Positions', value: paper.openTrades.length }
])

const curve = computed(() => paper.equityCurve)
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

const formatPnl = (v: number) => `${v >= 0 ? '+' : ''}$${v.toFixed(2)}`
const formatPct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`
const timeAgo = (ts: string) => {
  const m = Math.floor((Date.now() - new Date(ts).getTime()) / 60000)
  if (m < 60) return `${m}m`
  if (m < 1440) return `${Math.floor(m / 60)}h`
  return `${Math.floor(m / 1440)}d`
}
</script>

<template>
  <div class="paper-panel">
    <!-- Header with Live / Paper toggle -->
    <header class="paper-head">
      <div class="title-block">
        <span class="paper-chip" title="Paper trading — simulated bets as % of wallet">P</span>
        <h3>Paper Trading</h3>
      </div>
      <div class="mode-toggle" role="tablist">
        <button
          :class="['mode-btn', { active: paper.mode === 'paper' }]"
          @click="paper.setMode('paper')"
        >Paper</button>
        <button
          :class="['mode-btn', { active: paper.mode === 'live' }]"
          @click="paper.setMode('live')"
        >Live</button>
      </div>
    </header>

    <!-- KPI strip -->
    <div class="kpi-row">
      <div v-for="k in kpis" :key="k.label" class="kpi">
        <span class="k-label">{{ k.label }}</span>
        <span class="k-value" :data-tone="k.tone">
          {{ k.prefix }}{{ k.value }}{{ k.suffix }}
        </span>
      </div>
    </div>

    <!-- Equity curve -->
    <div v-if="curve.length > 1" class="equity-strip">
      <svg viewBox="0 0 200 40" preserveAspectRatio="none">
        <path :d="curvePath" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.8" />
      </svg>
      <span class="equity-label">Cumulative realized P&L</span>
    </div>

    <!-- Open positions -->
    <div class="positions">
      <div v-if="!paper.openTrades.length" class="empty">
        No open paper positions. Place a simulated bet from any asset page.
      </div>
      <div
        v-for="t in paper.openTrades"
        :key="t.id"
        class="position-row"
        :data-side="t.side"
      >
        <div class="pos-left">
          <span class="pos-symbol">{{ t.asset_symbol }}</span>
          <span class="pos-meta">
            {{ t.side.toUpperCase() }} · {{ t.wallet_pct.toFixed(1) }}% wallet · ${{ t.notional_value.toFixed(0) }}
          </span>
          <span v-if="t.strategy_id || t.agent_id" class="pos-source">
            {{ t.strategy_id ? `via ${t.strategy_id}` : '' }}{{ t.agent_id ? `via ${t.agent_id}` : '' }}
          </span>
        </div>
        <div class="pos-right">
          <span class="pos-pnl" :data-tone="t.hypothetical_pnl_value >= 0 ? 'pos' : 'neg'">
            {{ formatPnl(t.hypothetical_pnl_value) }}
          </span>
          <span class="pos-pct" :data-tone="t.hypothetical_pnl_value >= 0 ? 'pos' : 'neg'">
            {{ formatPct(t.hypothetical_pnl_pct) }}
          </span>
          <span class="pos-age">{{ timeAgo(t.timestamp) }}</span>
          <button class="close-btn" @click="paper.closeTrade(t.id)" title="Close position">✕</button>
        </div>
      </div>
    </div>

    <!-- Recent closed -->
    <details v-if="paper.closedTrades.length" class="closed-block">
      <summary>Recent closed ({{ paper.closedTrades.length }})</summary>
      <div
        v-for="t in paper.closedTrades.slice(0, 5)"
        :key="t.id"
        class="closed-row"
      >
        <span>{{ t.asset_symbol }}</span>
        <span class="closed-pnl" :data-tone="(t.realized_pnl_value ?? 0) >= 0 ? 'pos' : 'neg'">
          {{ formatPnl(t.realized_pnl_value ?? 0) }}
        </span>
      </div>
    </details>
  </div>
</template>

<style scoped>
.paper-panel {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 0.75rem;
  border: 1px dashed color-mix(in oklch, var(--primary-blue) 40%, transparent);
  border-radius: var(--app-border-radius, 8px);
  background: color-mix(in oklch, var(--primary-blue) 4%, transparent);
}

.paper-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.title-block { display: flex; align-items: center; gap: 0.5rem; }
.title-block h3 { margin: 0; font-size: 0.95rem; font-weight: 600; }

.paper-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px; height: 20px;
  border-radius: 50%;
  background: color-mix(in oklch, var(--primary-blue) 60%, transparent);
  color: white;
  font-size: 0.7rem;
  font-weight: 700;
}

.mode-toggle {
  display: inline-flex;
  background: rgba(255,255,255,0.04);
  border-radius: 6px;
  padding: 2px;
  gap: 2px;
}
.mode-btn {
  padding: 0.2rem 0.6rem;
  border: 0;
  background: transparent;
  color: var(--text-gray);
  font-size: 0.75rem;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.15s;
}
.mode-btn.active {
  background: color-mix(in oklch, var(--primary-blue) 30%, transparent);
  color: white;
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
  color: var(--primary-blue);
  opacity: 0.7;
}
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
}
.position-row[data-side="sell"] { border-left-color: oklch(0.65 0.2 25 / 0.5); }

.pos-left { display: flex; flex-direction: column; gap: 0.1rem; min-width: 0; flex: 1; }
.pos-symbol { font-weight: 600; font-size: 0.85rem; }
.pos-meta { font-size: 0.7rem; color: var(--text-gray); }
.pos-source { font-size: 0.65rem; color: var(--primary-blue); font-style: italic; }

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
.closed-pnl[data-tone="pos"] { color: oklch(0.7 0.2 145); }
.closed-pnl[data-tone="neg"] { color: oklch(0.65 0.2 25); }
</style>
