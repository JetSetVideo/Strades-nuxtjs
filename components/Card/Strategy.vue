<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  strategy: Record<string, unknown> & {
    id?: string
    name?: string
    monthlyGain?: number
    monthlyDrawdown?: number
    winRate?: number
    riskScore?: number
    total_return_percentage?: number
    max_drawdown?: number
    win_rate?: number
  }
  variant?: 'featured' | 'compact'
  selected?: boolean
}>()

const emit = defineEmits<{
  select: []
  copy: []
  share: []
  view: []
  toggle: []
  delete: []
}>()

const isFeatured = computed(() => props.variant === 'featured')

// ── Design.md: PnL saturation drives color intensity ──────────────────────
const gain = computed(() => props.strategy.monthlyGain ?? 0)
const drawdown = computed(() => props.strategy.monthlyDrawdown ?? 0)
const winRate = computed(() => props.strategy.winRate ?? 0)
const riskScore = computed(() => props.strategy.riskScore ?? 5)

// Color from PnL magnitude
const gainColor = computed(() => {
  const sat = Math.min(100, Math.abs(gain.value) * 5)
  return gain.value >= 0
    ? `oklch(65% ${sat / 200} 142)`
    : `oklch(55% ${sat / 200} 25)`
})

const drawdownColor = computed(() => {
  const sat = Math.min(100, Math.abs(drawdown.value) * 5)
  return `oklch(55% ${sat / 200} 25)`
})

// Design.md: risk score → border-radius morph (high risk = sharp)
const borderRadius = computed(() => `${Math.max(4, 18 - riskScore.value * 1.3)}px`)

// Design.md: execution frequency → heartbeat animation speed
const FREQ_BEAT: Record<string, string> = {
  '1m': '0.4s', '5m': '0.7s', '15m': '1s', '1h': '1.6s',
  '4h': '2.2s', '1D': '3.2s', '1W': '5s', '1M': '9s',
}
const heartbeatMs = computed(() => FREQ_BEAT[props.strategy.frequency] ?? '3.2s')

// Status visual
const STATUS = {
  active:  { color: '#4caf50', label: 'ACTIVE',  glow: true  },
  paused:  { color: '#ff9800', label: 'PAUSED',  glow: false },
  stopped: { color: '#9e9e9e', label: 'STOPPED', glow: false },
  draft:   { color: '#607d8b', label: 'DRAFT',   glow: false },
}
const statusMeta = computed(() => STATUS[props.strategy.status as keyof typeof STATUS] ?? STATUS.stopped)

// Category accent color
const CAT_COLOR: Record<string, string> = {
  crypto: '#f7931a', stocks: '#2196f3', forex: '#4caf50',
  commodities: '#ffd700', 'multi-asset': '#9c27b0',
}
const catColor = computed(() => CAT_COLOR[props.strategy.category] ?? '#607d8b')

// Asset color dot
const ASSET_COLOR: Record<string, string> = {
  BTC:'#f7931a', ETH:'#627eea', SOL:'#9945ff', BNB:'#f3ba2f',
  TSLA:'#cc0000', AAPL:'#555', NVDA:'#76b900', MSFT:'#00a4ef', AMZN:'#ff9900',
  'EUR/USD':'#0052b4', XAU:'#ffd700', WTI:'#704214',
  USD:'#4caf50', USDC:'#2775ca', USDT:'#26a17b', WBTC:'#e8a100',
}
const assetColor = (a: string) => ASSET_COLOR[a] ?? '#607d8b'

// Sparkline SVG from equity_preview
const sparkPoints = computed(() => {
  const pts: number[] = props.strategy.equity_preview ?? []
  if (pts.length < 2) return ''
  const min = Math.min(...pts)
  const max = Math.max(...pts)
  const range = max - min || 1
  const W = 100, H = 30
  return pts.map((p, i) => {
    const x = (i / (pts.length - 1)) * W
    const y = H - ((p - min) / range) * H
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
})

const sparkColor = computed(() => gain.value >= 0 ? '#4caf50' : '#f44336')

// Win rate ring SVG
const winRingDash = computed(() => `${winRate.value} ${100 - winRate.value}`)

// Frequency label
const freqLabel = (f: string) => {
  const m: Record<string,string> = { '1m':'1m','5m':'5m','15m':'15m','1h':'1H','4h':'4H','1D':'1D','1W':'1W','1M':'1M' }
  return m[f] ?? f
}
</script>

<template>
  <!-- ── FEATURED variant ────────────────────────────────────────────── -->
  <div
    v-if="isFeatured"
    class="strategy-card featured"
    :class="{ selected }"
    :style="{
      borderRadius,
      '--card-cat': catColor,
      '--beat-ms': heartbeatMs,
      '--gain-color': gainColor,
    }"
    @click="emit('select')"
  >
    <!-- Top accent bar -->
    <div class="feat-accent-bar" :style="{ background: catColor }" />

    <!-- Glow ring for active strategies -->
    <div v-if="statusMeta.glow && strategy.status === 'active'" class="status-glow" />

    <!-- Header row -->
    <div class="feat-header">
      <div class="feat-title-col">
        <div class="feat-name-row">
          <span class="feat-name">{{ strategy.name }}</span>
          <span class="status-dot" :style="{ background: statusMeta.color }"
            :class="{ beating: strategy.status === 'active' }" />
        </div>
        <div class="feat-meta-row">
          <span class="feat-cat-tag" :style="{ color: catColor, borderColor: catColor + '44', background: catColor + '18' }">
            {{ strategy.category }}
          </span>
          <span v-for="tag in (strategy.tags ?? []).slice(0,2)" :key="tag" class="feat-tag">{{ tag }}</span>
        </div>
      </div>

      <!-- Sparkline -->
      <div class="feat-sparkline">
        <svg :viewBox="`0 0 100 30`" preserveAspectRatio="none" class="spark-svg">
          <polyline :points="sparkPoints" :stroke="sparkColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" />
          <polyline :points="`${sparkPoints} 100,30 0,30`" :fill="sparkColor + '22'" stroke="none" />
        </svg>
        <span class="spark-pct" :style="{ color: gainColor }">
          {{ gain >= 0 ? '+' : '' }}{{ gain.toFixed(1) }}%
        </span>
      </div>
    </div>

    <!-- Description -->
    <p class="feat-desc">{{ strategy.description }}</p>

    <!-- Flow row: fromAsset → toAsset + freq -->
    <div class="feat-flow-row">
      <span class="flow-asset" :style="{ color: assetColor(strategy.fromAsset ?? ''), borderColor: assetColor(strategy.fromAsset ?? '') + '55' }">
        {{ strategy.fromAsset ?? '—' }}
      </span>
      <span class="flow-arrow">→</span>
      <span class="flow-asset" :style="{ color: assetColor(strategy.toAsset ?? ''), borderColor: assetColor(strategy.toAsset ?? '') + '55' }">
        {{ strategy.toAsset ?? '—' }}
      </span>
      <span class="flow-freq" :style="{ color: catColor }">{{ freqLabel(strategy.frequency ?? '1D') }}</span>
      <span class="flow-creator">by {{ strategy.creator }}</span>
    </div>

    <!-- Metrics grid -->
    <div class="feat-metrics">
      <!-- Gain -->
      <div class="metric-block">
        <span class="mb-label">Monthly</span>
        <span class="mb-value" :style="{ color: gainColor }">
          {{ gain >= 0 ? '+' : '' }}{{ gain.toFixed(1) }}%
        </span>
      </div>
      <!-- Drawdown -->
      <div class="metric-block">
        <span class="mb-label">Max DD</span>
        <span class="mb-value" :style="{ color: drawdownColor }">
          {{ drawdown.toFixed(1) }}%
        </span>
      </div>
      <!-- Win Rate with ring -->
      <div class="metric-block wr-block">
        <svg class="wr-ring" viewBox="0 0 36 36">
          <circle class="wr-bg" cx="18" cy="18" r="15.9" stroke-width="3" fill="none" />
          <circle class="wr-fill" cx="18" cy="18" r="15.9"
            stroke-width="3" fill="none"
            :stroke="gainColor"
            :stroke-dasharray="winRingDash"
            stroke-dashoffset="25" />
        </svg>
        <div class="wr-text">
          <span class="mb-value">{{ winRate.toFixed(0) }}%</span>
          <span class="mb-label">Win</span>
        </div>
      </div>
      <!-- Trades -->
      <div class="metric-block">
        <span class="mb-label">Trades</span>
        <span class="mb-value">{{ strategy.numberOfTrades }}</span>
      </div>
      <!-- Sharpe -->
      <div class="metric-block">
        <span class="mb-label">Sharpe</span>
        <span class="mb-value" :style="{ color: (strategy.sharpeRatio ?? 0) > 1.5 ? 'var(--success-green)' : 'var(--text-white)' }">
          {{ (strategy.sharpeRatio ?? 0).toFixed(2) }}
        </span>
      </div>
      <!-- Risk -->
      <div class="metric-block">
        <span class="mb-label">Risk</span>
        <span class="mb-value" :style="{ color: riskScore >= 7 ? 'var(--error-red)' : riskScore >= 5 ? 'var(--warning-orange)' : 'var(--success-green)' }">
          {{ riskScore }}/10
        </span>
      </div>
    </div>

    <!-- Cumulative return bar -->
    <div class="feat-cum-row">
      <span class="cum-label">Cumulative return</span>
      <div class="cum-track">
        <div class="cum-fill" :style="{ width: Math.min(100, Math.abs(strategy.totalProfit ?? 0) / 3) + '%', background: gainColor }" />
      </div>
      <span class="cum-val" :style="{ color: gainColor }">+{{ (strategy.totalProfit ?? 0).toFixed(1) }}%</span>
    </div>

    <!-- Asset pills -->
    <div class="feat-assets">
      <span
        v-for="asset in (strategy.targetAssets ?? [])"
        :key="asset"
        class="asset-pill"
        :style="{ borderColor: assetColor(asset), color: assetColor(asset), background: assetColor(asset) + '18' }"
      >
        {{ asset }}
      </span>
      <span class="sub-count">👥 {{ strategy.subscriberCount ?? 0 }}</span>
    </div>

    <!-- Actions -->
    <div class="feat-actions" @click.stop>
      <button class="act-btn primary" @click="emit('copy')">⤴ Copy</button>
      <button class="act-btn" @click="emit('view')">→ View</button>
      <button class="act-btn" @click="emit('toggle')">
        {{ strategy.status === 'active' ? '⏸ Pause' : '▶ Start' }}
      </button>
      <button class="act-btn icon-btn" @click="emit('share')" title="Share">⇪</button>
    </div>
  </div>

  <!-- ── COMPACT variant ─────────────────────────────────────────────── -->
  <div
    v-else
    class="strategy-card compact"
    :class="{ selected }"
    :style="{
      borderRadius,
      '--card-cat': catColor,
      '--beat-ms': heartbeatMs,
      '--gain-color': gainColor,
    }"
    @click="emit('select')"
  >
    <!-- Left color bar based on gain -->
    <div class="compact-bar" :style="{ background: gainColor }" />

    <div class="compact-body">
      <!-- Name + status -->
      <div class="compact-head">
        <span class="compact-name">{{ strategy.name }}</span>
        <span class="status-dot sm" :style="{ background: statusMeta.color }"
          :class="{ beating: strategy.status === 'active' }" />
      </div>

      <!-- Assets + creator + frequency -->
      <div class="compact-sub">
        <span v-for="a in (strategy.targetAssets ?? []).slice(0,2)" :key="a"
          class="compact-asset" :style="{ color: assetColor(a) }">{{ a }}</span>
        <span class="compact-freq" :style="{ color: catColor }">{{ freqLabel(strategy.frequency ?? '1D') }}</span>
        <span class="compact-creator">{{ strategy.creator }}</span>
      </div>

      <!-- Key metrics row -->
      <div class="compact-metrics">
        <span class="cm" :style="{ color: gainColor }">
          {{ gain >= 0 ? '+' : '' }}{{ gain.toFixed(1) }}%
        </span>
        <span class="cm-sep">·</span>
        <span class="cm" :style="{ color: drawdownColor }">{{ drawdown.toFixed(1) }}%</span>
        <span class="cm-sep">·</span>
        <span class="cm">{{ winRate.toFixed(0) }}% W</span>
      </div>
    </div>

    <!-- Mini sparkline -->
    <svg class="compact-spark" :viewBox="`0 0 60 20`" preserveAspectRatio="none">
      <polyline :points="sparkPoints" :stroke="sparkColor" stroke-width="2" fill="none"
        vector-effect="non-scaling-stroke" />
    </svg>
  </div>
</template>

<style scoped>
/* ── Shared ── */
.strategy-card {
  position: relative;
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  color: var(--text-white);
  cursor: pointer;
  overflow: hidden;
  transition: border-color 0.25s ease, transform 0.15s ease, box-shadow 0.25s ease;
  font-family: inherit;
}

.strategy-card:hover { transform: translateY(-2px); border-color: var(--border-primary); }
.strategy-card.selected {
  border-color: var(--card-cat, var(--primary-green));
  box-shadow: 0 0 0 1px var(--card-cat, var(--primary-green)), 0 4px 20px rgba(0,0,0,0.4);
}

/* Status dot */
.status-dot {
  width: 7px; height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-dot.beating {
  animation: beat var(--beat-ms) ease infinite;
}

.status-dot.sm { width: 5px; height: 5px; }

@keyframes beat {
  0%, 100% { box-shadow: 0 0 0 0 currentColor; opacity: 1; }
  50% { box-shadow: 0 0 0 4px transparent; opacity: 0.7; }
}

/* ─────────────── FEATURED ─────────────── */
.featured {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px 16px 14px;
}

.feat-accent-bar {
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 2px;
  opacity: 0.9;
}

.status-glow {
  position: absolute;
  inset: -1px;
  border-radius: inherit;
  pointer-events: none;
  animation: glow-pulse 3s ease infinite;
  border: 1px solid var(--card-cat);
}

@keyframes glow-pulse {
  0%, 100% { opacity: 0.4; }
  50%       { opacity: 0.1; }
}

/* Header */
.feat-header { display: flex; align-items: flex-start; gap: 10px; margin-top: 4px; }

.feat-title-col { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 5px; }

.feat-name-row { display: flex; align-items: center; gap: 6px; }

.feat-name {
  font-size: 1rem;
  font-weight: 800;
  color: var(--text-white);
  line-height: 1.2;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.feat-meta-row { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; }

.feat-cat-tag {
  font-size: 0.58rem;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 999px;
  border: 1px solid;
  text-transform: capitalize;
  flex-shrink: 0;
}

.feat-tag {
  font-size: 0.55rem;
  color: var(--text-gray);
  background: rgba(255,255,255,0.05);
  padding: 1px 5px;
  border-radius: 999px;
}

/* Sparkline */
.feat-sparkline {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  flex-shrink: 0;
  width: 70px;
}

.spark-svg { width: 70px; height: 30px; }

.spark-pct {
  font-size: 0.72rem;
  font-weight: 800;
  text-align: right;
}

/* Description */
.feat-desc {
  font-size: 0.68rem;
  color: var(--text-gray);
  line-height: 1.4;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Flow row */
.feat-flow-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.flow-asset {
  font-size: 0.72rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid;
}

.flow-arrow { font-size: 0.75rem; color: var(--text-gray); }

.flow-freq {
  font-size: 0.62rem;
  font-weight: 700;
  background: rgba(255,255,255,0.06);
  padding: 2px 7px;
  border-radius: 999px;
}

.flow-creator { font-size: 0.6rem; color: var(--text-gray); margin-left: auto; }

/* Metrics grid */
.feat-metrics {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  padding: var(--spacing-sm) 0;
  border-top: 1px solid var(--border-primary);
  border-bottom: 1px solid var(--border-primary);
}

.metric-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.wr-block { flex-direction: row; gap: 6px; align-items: center; }

.mb-label {
  font-size: 0.55rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-gray);
}

.mb-value {
  font-size: 0.88rem;
  font-weight: 800;
  color: var(--text-white);
  line-height: 1;
}

/* Win rate ring */
.wr-ring { width: 32px; height: 32px; transform: rotate(-90deg); flex-shrink: 0; }
.wr-bg { stroke: rgba(255,255,255,0.08); }
.wr-text { display: flex; flex-direction: column; gap: 1px; }
.wr-text .mb-value { font-size: 0.75rem; }
.wr-text .mb-label { font-size: 0.5rem; }

/* Cumulative return bar */
.feat-cum-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cum-label { font-size: 0.58rem; color: var(--text-gray); flex-shrink: 0; }

.cum-track {
  flex: 1;
  height: 4px;
  background: rgba(255,255,255,0.06);
  border-radius: 999px;
  overflow: hidden;
}

.cum-fill {
  height: 100%;
  border-radius: 999px;
  transition: width 0.4s ease;
}

.cum-val { font-size: 0.68rem; font-weight: 700; flex-shrink: 0; }

/* Asset pills + subscribers */
.feat-assets {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-wrap: wrap;
}

.asset-pill {
  font-size: 0.6rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid;
}

.sub-count {
  font-size: 0.6rem;
  color: var(--text-gray);
  margin-left: auto;
}

/* Actions */
.feat-actions {
  display: flex;
  gap: 6px;
  padding-top: 4px;
}

.act-btn {
  flex: 1;
  padding: 7px 6px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-secondary);
  background: rgba(255,255,255,0.04);
  color: var(--text-light-gray);
  cursor: pointer;
  font-size: 0.65rem;
  font-weight: 600;
  transition: all 0.15s ease;
  font-family: inherit;
}

.act-btn:hover { background: rgba(255,255,255,0.09); color: var(--text-white); }
.act-btn.primary {
  background: rgba(0,255,136,0.1);
  border-color: rgba(0,255,136,0.35);
  color: var(--primary-green);
}
.act-btn.primary:hover { background: rgba(0,255,136,0.18); }
.act-btn.icon-btn { flex: 0 0 36px; font-size: 0.8rem; }

/* ─────────────── COMPACT ─────────────── */
.compact {
  display: flex;
  align-items: center;
  min-width: 220px;
  max-width: 260px;
  height: 88px;
  padding: 0;
  flex-shrink: 0;
}

.compact-bar {
  width: 3px;
  align-self: stretch;
  border-radius: 2px 0 0 2px;
  flex-shrink: 0;
}

.compact-body {
  flex: 1;
  padding: 10px 10px 10px 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.compact-head {
  display: flex;
  align-items: center;
  gap: 5px;
}

.compact-name {
  font-size: 0.72rem;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.compact-sub {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-wrap: nowrap;
}

.compact-asset {
  font-size: 0.6rem;
  font-weight: 700;
}

.compact-freq {
  font-size: 0.55rem;
  background: rgba(255,255,255,0.06);
  padding: 1px 5px;
  border-radius: 999px;
}

.compact-creator {
  font-size: 0.55rem;
  color: var(--text-gray);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.compact-metrics {
  display: flex;
  align-items: center;
  gap: 4px;
}

.cm { font-size: 0.7rem; font-weight: 700; }
.cm-sep { font-size: 0.6rem; color: var(--text-gray); }

.compact-spark {
  width: 52px;
  height: 30px;
  flex-shrink: 0;
  margin-right: 10px;
  opacity: 0.75;
}
</style>
