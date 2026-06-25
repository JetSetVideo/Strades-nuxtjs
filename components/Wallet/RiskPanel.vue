<script setup lang="ts">
import { computed } from 'vue'
import type { AssetClass } from '~/stores/macro'

interface Position {
  asset_id: string
  symbol: string
  current_value: number
  return_percentage: number
  allocation_percentage: number
}

interface PerfPoint { change_percentage: number; change: number }

const props = defineProps<{
  positions: Position[]
  performanceHistory: Record<string, PerfPoint> | undefined
  walletId: string
}>()

const ASSET_CLASS: Record<string, AssetClass> = {
  BTC: 'crypto', ETH: 'crypto', SOL: 'crypto', ADA: 'crypto', DOT: 'crypto', LINK: 'crypto',
  AAPL: 'stocks', TSLA: 'stocks', AMZN: 'stocks', GOOG: 'stocks',
  USD: 'fiat', EUR: 'fiat', CNY: 'fiat', JPY: 'fiat', GBP: 'fiat'
}
const classOf = (sym: string): AssetClass => ASSET_CLASS[sym] || 'stocks'

const exposureByClass = computed<Record<AssetClass, number>>(() => {
  const out: Record<AssetClass, number> = { fiat: 0, crypto: 0, stocks: 0, commodities: 0 }
  for (const p of props.positions) {
    out[classOf(p.symbol)] += p.allocation_percentage
  }
  return out
})

// Synthetic risk metrics derived from period returns
const sharpe = computed(() => {
  const periods = ['1d', '7d', '30d', '90d', '1y']
  const returns = periods.map(p => props.performanceHistory?.[p]?.change_percentage ?? 0)
  if (!returns.length) return 0
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length
  const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / returns.length
  const std = Math.sqrt(variance)
  return std === 0 ? 0 : mean / std
})

const winningPositions = computed(() => props.positions.filter(p => p.return_percentage > 0).length)
const winRate = computed(() => {
  if (props.positions.length === 0) return 0
  return (winningPositions.value / props.positions.length) * 100
})

const concentration = computed(() => {
  // Herfindahl-like: sum of (weight%)² — higher = more concentrated
  return props.positions.reduce((acc, p) => acc + Math.pow(p.allocation_percentage / 100, 2), 0)
})

const riskLevel = computed<'low' | 'medium' | 'high'>(() => {
  const crypto = exposureByClass.value.crypto
  if (crypto > 60 || concentration.value > 0.5) return 'high'
  if (crypto > 30 || concentration.value > 0.3) return 'medium'
  return 'low'
})

const riskScore = computed(() => {
  const crypto = exposureByClass.value.crypto
  return Math.min(100, Math.round(crypto * 0.6 + concentration.value * 100 * 0.4))
})

const fmt = (n: number) => n.toFixed(1)

const CLASS_COLORS: Record<AssetClass, string> = {
  fiat: '#4A90E2',
  crypto: '#F5A623',
  stocks: '#7ED321',
  commodities: '#F8E71C'
}
</script>

<template>
  <div class="risk-panel">
    <header class="head">
      <span class="title">Risk Profile</span>
      <span :class="['risk-pill', `lv-${riskLevel}`]">{{ riskLevel }}</span>
    </header>

    <div class="metrics">
      <div class="metric">
        <span class="m-label">Sharpe</span>
        <span class="m-value">{{ fmt(sharpe) }}</span>
      </div>
      <div class="metric">
        <span class="m-label">Win rate</span>
        <span class="m-value">{{ fmt(winRate) }}%</span>
      </div>
      <div class="metric">
        <span class="m-label">Concentration</span>
        <span class="m-value">{{ (concentration * 100).toFixed(0) }}</span>
      </div>
      <div class="metric">
        <span class="m-label">Risk score</span>
        <span class="m-value">{{ riskScore }}/100</span>
      </div>
    </div>

    <div class="exposure">
      <span class="exp-label">Exposure by class</span>
      <ul class="bars">
        <li v-for="cls in (['crypto','stocks','commodities','fiat'] as AssetClass[])" :key="cls">
          <span class="bar-name" :style="{ color: CLASS_COLORS[cls] }">{{ cls }}</span>
          <span class="bar-track">
            <span class="bar-fill" :style="{ width: `${Math.min(100, exposureByClass[cls])}%`, background: CLASS_COLORS[cls] }" />
          </span>
          <span class="bar-pct">{{ exposureByClass[cls].toFixed(0) }}%</span>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.risk-panel {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  min-width: 0;
}

.head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
}
.title {
  font-size: 0.72rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.65);
  font-weight: 700;
}
.risk-pill {
  font-size: 0.58rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  padding: 2px 7px;
  border-radius: 999px;
}
.lv-low { background: rgba(0,255,136,0.12); color: var(--success-green, #00ff88); }
.lv-medium { background: rgba(255,170,0,0.12); color: #ffaa00; }
.lv-high { background: rgba(255,77,106,0.15); color: #ff4d6a; }

.metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.35rem;
  min-width: 0;
}
@media (max-width: 540px) {
  .metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
.metric {
  display: flex;
  flex-direction: column;
  gap: 0.05rem;
  background: rgba(255,255,255,0.03);
  padding: 0.4rem 0.55rem;
  border-radius: 5px;
  min-width: 0;
  overflow: hidden;
}
.m-label {
  font-size: 0.55rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.45);
  font-weight: 700;
}
.m-value {
  font-size: 0.95rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.01em;
}

.exposure {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  min-width: 0;
}
.exp-label {
  font-size: 0.55rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.45);
  font-weight: 700;
}
.bars { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.25rem; min-width: 0; }
.bars li {
  display: grid;
  grid-template-columns: 80px minmax(0, 1fr) 36px;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}
.bar-name {
  font-size: 0.65rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  font-weight: 700;
}
.bar-track {
  display: block;
  width: 100%;
  height: 5px;
  background: rgba(255,255,255,0.05);
  border-radius: 3px;
  overflow: hidden;
}
.bar-fill { display: block; height: 100%; transition: width 0.3s ease; }
.bar-pct {
  font-size: 0.72rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  text-align: right;
  color: rgba(255,255,255,0.7);
}
</style>
