<script setup lang="ts">/**
 * DealRow — Single deal/trade card in the Deal Pipeline.
 * Shows the strategy name, target assets, counterparties,
 * commodity flow, live P&L, and risk score.
 */
import { computed } from 'vue'
import UIPill from '@/components/UI/Pill.vue'

export interface DealData {
  id: string
  name: string
  status: 'active' | 'paused' | 'stopped'
  targetAssets: string[]
  capital: number
  returnPct: number
  returnAbs: number
  winRate: number
  sharpe: number
  maxDd: number
  counterparties: { name: string; role: string; weight: number; country?: string }[]
  commodityFlows: { product: string; valueUsd: number; from: string; to: string }[]
  category: string
}

const props = withDefaults(defineProps<{
  deal: DealData
  compact?: boolean
}>(), { compact: false })

const statusTone = computed(() => {
  switch (props.deal.status) {
    case 'active': return 'success'
    case 'paused': return 'warning'
    case 'stopped': return 'danger'
    default: return 'neutral'
  }
})

const returnColor = (pct: number) => pct >= 0 ? 'var(--success-green)' : 'var(--error-red)'

const totalExposure = computed(() =>
  props.deal.counterparties.reduce((s, c) => s + c.weight, 0)
)

const topCounterparty = computed(() =>
  props.deal.counterparties.length > 0
    ? props.deal.counterparties.reduce((a, b) => a.weight > b.weight ? a : b)
    : null
)

const topFlow = computed(() =>
  props.deal.commodityFlows.length > 0
    ? props.deal.commodityFlows.reduce((a, b) => a.valueUsd > b.valueUsd ? a : b)
    : null
)

const riskScore = computed(() => {
  let score = 0
  // Higher max DD = higher risk
  score += Math.min(40, props.deal.maxDd * 2)
  // Lower sharpe = higher risk
  if (props.deal.sharpe < 0.5) score += 30
  else if (props.deal.sharpe < 1) score += 15
  else if (props.deal.sharpe < 1.5) score += 5
  // Counterparty concentration risk
  if (topCounterparty.value && topCounterparty.value.weight > 40) score += 30
  else if (topCounterparty.value && topCounterparty.value.weight > 25) score += 15
  else if (topCounterparty.value && topCounterparty.value.weight > 15) score += 5
  return Math.min(100, score)
})

const riskTone = computed(() => {
  if (riskScore.value > 60) return 'danger'
  if (riskScore.value > 30) return 'warning'
  return 'success'
})
</script>

<template>
  <div class="deal-row" :class="{ compact }">
    <!-- Header: name + status + risk -->
    <div class="dr-header">
      <div class="dr-title">
        <NuxtLink :to="`/strategy/${deal.id}`" class="dr-name">{{ deal.name }}</NuxtLink>
        <UIPill :tone="statusTone" size="sm">{{ deal.status }}</UIPill>
      </div>
      <UIPill :tone="riskTone" size="sm">Risk {{ riskScore }}/100</UIPill>
    </div>

    <!-- Assets + category -->
    <div class="dr-meta">
      <span class="dr-cat">{{ deal.category }}</span>
      <span class="dr-assets">{{ deal.targetAssets.join(', ') }}</span>
    </div>

    <!-- Metrics row -->
    <div class="dr-metrics">
      <div class="dr-m">
        <span class="dr-ml">Capital</span>
        <span class="dr-mv">${{ deal.capital.toLocaleString() }}</span>
      </div>
      <div class="dr-m">
        <span class="dr-ml">Return</span>
        <span class="dr-mv" :style="{ color: returnColor(deal.returnPct) }">
          {{ deal.returnPct >= 0 ? '+' : '' }}{{ deal.returnPct.toFixed(1) }}%
        </span>
      </div>
      <div class="dr-m">
        <span class="dr-ml">P&L</span>
        <span class="dr-mv" :style="{ color: returnColor(deal.returnAbs) }">
          {{ deal.returnAbs >= 0 ? '+' : '' }}${{ Math.abs(deal.returnAbs).toLocaleString() }}
        </span>
      </div>
      <div class="dr-m">
        <span class="dr-ml">Win Rate</span>
        <span class="dr-mv">{{ deal.winRate.toFixed(0) }}%</span>
      </div>
      <div class="dr-m">
        <span class="dr-ml">Sharpe</span>
        <span class="dr-mv">{{ deal.sharpe.toFixed(2) }}</span>
      </div>
    </div>

    <!-- Top counterparty -->
    <div v-if="topCounterparty" class="dr-counterparty">
      <span class="dr-cl">Top counterparty</span>
      <span class="dr-cn">{{ topCounterparty.name }}</span>
      <span class="dr-cr" :style="{ color: topCounterparty.weight > 25 ? 'var(--warning-orange)' : 'var(--text-gray)' }">
        {{ topCounterparty.role }} · {{ topCounterparty.weight }}% exposure
      </span>
    </div>

    <!-- Top commodity flow (non-compact) -->
    <div v-if="!compact && topFlow" class="dr-flow">
      <span class="dr-fl">Top flow</span>
      <span class="dr-fp">{{ topFlow.product }}</span>
      <span class="dr-fr">{{ topFlow.from }} → {{ topFlow.to }}</span>
      <span class="dr-fv">${{ (topFlow.valueUsd / 1_000_000).toFixed(1) }}M</span>
    </div>

    <!-- Counterparty list (compact) -->
    <div v-if="compact && deal.counterparties.length > 0" class="dr-cps">
      <span v-for="c in deal.counterparties.slice(0, 3)" :key="c.name" class="dr-cp-chip">
        {{ c.name.split(' ')[0] }}
        <span class="cp-role">{{ c.role }}</span>
      </span>
      <span v-if="deal.counterparties.length > 3" class="dr-cp-more">+{{ deal.counterparties.length - 3 }}</span>
    </div>

    <!-- Link -->
    <NuxtLink :to="`/strategy/${deal.id}`" class="dr-link">View Deal →</NuxtLink>
  </div>
</template>

<style scoped>
.deal-row {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 0.65rem 0.7rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  transition: border-color 0.15s ease;
}
.deal-row:hover { border-color: var(--border-accent); }
.deal-row.compact { padding: 0.45rem 0.5rem; gap: 0.25rem; }

.dr-header { display: flex; justify-content: space-between; align-items: center; }
.dr-title { display: flex; align-items: center; gap: 0.4rem; min-width: 0; }
.dr-name {
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--text-white);
  text-decoration: none;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dr-name:hover { color: var(--primary-green); }

.dr-meta { display: flex; gap: 0.5rem; font-size: 0.62rem; color: var(--text-gray); }
.dr-cat { text-transform: capitalize; }
.dr-assets { font-variant-numeric: tabular-nums; }

.dr-metrics {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}
.dr-m { display: flex; flex-direction: column; gap: 1px; }
.dr-ml { font-size: 0.55rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-gray); }
.dr-mv { font-size: 0.78rem; font-weight: 700; font-variant-numeric: tabular-nums; }

.dr-counterparty {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.68rem;
  flex-wrap: wrap;
}
.dr-cl { font-size: 0.55rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-gray); }
.dr-cn { font-weight: 600; color: var(--text-white); }
.dr-cr { font-size: 0.62rem; }

.dr-flow {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.65rem;
  flex-wrap: wrap;
}
.dr-fl { font-size: 0.55rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-gray); }
.dr-fp { font-weight: 600; }
.dr-fr { color: var(--text-gray); }
.dr-fv { font-weight: 700; font-variant-numeric: tabular-nums; margin-left: auto; }

.dr-cps { display: flex; gap: 3px; flex-wrap: wrap; }
.dr-cp-chip {
  font-size: 0.6rem;
  padding: 1px 6px;
  border-radius: 4px;
  background: rgba(255,255,255,0.04);
  border: 1px solid var(--border-secondary);
  color: var(--text-light-gray);
}
.cp-role { color: var(--text-gray); margin-left: 3px; }
.dr-cp-more { font-size: 0.6rem; color: var(--text-gray); }

.dr-link {
  font-size: 0.62rem;
  font-weight: 600;
  color: var(--primary-green);
  text-decoration: none;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-top: 0.1rem;
}
.dr-link:hover { text-decoration: underline; }
</style>
