<script setup lang="ts">
/**
 * ConsensusMeter — Shows community/friends' sentiment consensus for a single asset.
 * Aggregates predictions from the predictions store across all users.
 * Design.md: controversy_index drives shake animation; political_leaning tints the gauge.
 */
import { computed } from 'vue'
import { usePredictionsStore } from '@/stores/predictions'

const props = withDefaults(defineProps<{
  assetId: string
  compact?: boolean
}>(), { compact: false })

const predStore = usePredictionsStore()

const consensus = computed(() => {
  const all = predStore.allPredictions.filter(p =>
    p.assetId === props.assetId && p.status === 'pending'
  )
  if (all.length === 0) return null

  const bullish = all.filter(p => p.direction === 'bullish').length
  const bearish = all.filter(p => p.direction === 'bearish').length
  const neutral = all.filter(p => p.direction === 'neutral').length
  const total = all.length

  const avgConfidence = all.reduce((s, p) => s + p.confidence, 0) / total

  // Weighted sentiment: +1 bullish, -1 bearish, 0 neutral
  const sentiment =
    total > 0
      ? (bullish - bearish + neutral * 0) / total
      : 0

  const controversy = Math.min(1, (bullish > 0 && bearish > 0)
    ? (Math.min(bullish, bearish) / Math.max(bullish, bearish)) * 0.8
    : 0
  )

  return {
    total,
    bullish,
    bearish,
    neutral,
    sentiment,
    controversy,
    avgConfidence,
    bullishPct: (bullish / total) * 100,
    bearishPct: (bearish / total) * 100,
  }
})

const gaugeColor = computed(() => {
  if (!consensus.value) return 'var(--text-gray)'
  const s = consensus.value.sentiment
  if (s > 0.25) return 'var(--success-green)'
  if (s < -0.25) return 'var(--error-red)'
  return 'var(--warning-orange)'
})

const controversyAnim = computed(() => {
  if (!consensus.value || consensus.value.controversy < 0.4) return 'none'
  return `consensusShake ${0.3 + consensus.value.controversy * 0.5}s ease-in-out infinite`
})
</script>

<template>
  <div
    class="consensus-meter"
    :class="{ compact }"
    :style="{ '--gauge-color': gaugeColor, animation: controversyAnim }"
  >
    <!-- Header -->
    <div class="meter-header">
      <span class="meter-label">Community Consensus</span>
      <span class="meter-count" :title="`${consensus?.total ?? 0} predictions`">
        {{ consensus?.total ?? '—' }} votes
      </span>
    </div>

    <!-- Empty state -->
    <div v-if="!consensus" class="empty">No predictions yet. Be the first!</div>

    <template v-else>
      <!-- Sentiment gauge bar -->
      <div class="gauge-track">
        <div class="gauge-bear" :style="{ width: `${consensus.bearishPct}%` }">
          <span v-if="!compact && consensus.bearish > 0" class="gauge-label bear">
            {{ consensus.bearish }} bear
          </span>
        </div>
        <div class="gauge-neutral" :style="{ width: `${consensus.neutral / consensus.total * 100}%` }" />
        <div class="gauge-bull" :style="{ width: `${consensus.bullishPct}%` }">
          <span v-if="!compact && consensus.bullish > 0" class="gauge-label bull">
            {{ consensus.bullish }} bull
          </span>
        </div>
      </div>

      <!-- Bar labels -->
      <div class="gauge-labels">
        <span class="label-bear">Bearish {{ consensus.bearishPct.toFixed(0) }}%</span>
        <span class="label-bull">Bullish {{ consensus.bullishPct.toFixed(0) }}%</span>
      </div>

      <!-- Stats row -->
      <div class="stats-row">
        <div class="stat" :style="{ color: gaugeColor }">
          <span class="stat-val">{{ (consensus.sentiment * 100).toFixed(0) }}</span>
          <span class="stat-label">sentiment</span>
        </div>
        <div class="stat">
          <span class="stat-val">{{ consensus.avgConfidence.toFixed(1) }}</span>
          <span class="stat-label">avg conf</span>
        </div>
        <div class="stat" :class="{ hot: consensus.controversy > 0.5 }">
          <span class="stat-val">{{ (consensus.controversy * 100).toFixed(0) }}%</span>
          <span class="stat-label">controversy</span>
        </div>
        <div class="stat">
          <span class="stat-val">{{ consensus.neutral }}</span>
          <span class="stat-label">neutral</span>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.consensus-meter {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 0.6rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  transition: border-color 0.2s ease;
}
.consensus-meter.compact { padding: 0.4rem; gap: 0.25rem; }

.meter-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.meter-label {
  font-size: 0.62rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-gray);
}
.meter-count {
  font-size: 0.6rem;
  color: var(--text-light-gray);
  font-variant-numeric: tabular-nums;
}

.empty {
  font-size: 0.72rem;
  color: var(--text-gray);
  font-style: italic;
}

/* Gauge */
.gauge-track {
  display: flex;
  height: 22px;
  border-radius: 999px;
  overflow: hidden;
  background: rgba(255,255,255,0.04);
}
.gauge-bear {
  background: var(--error-red);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: width 0.5s ease;
  min-width: fit-content;
}
.gauge-neutral {
  background: rgba(255,255,255,0.08);
  transition: width 0.5s ease;
}
.gauge-bull {
  background: var(--success-green);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: width 0.5s ease;
  min-width: fit-content;
}
.gauge-label {
  font-size: 0.55rem;
  font-weight: 700;
  color: rgba(0,0,0,0.85);
  padding: 0 6px;
  white-space: nowrap;
}

.gauge-labels {
  display: flex;
  justify-content: space-between;
  font-size: 0.58rem;
  font-variant-numeric: tabular-nums;
  color: var(--text-gray);
}
.label-bear { color: var(--error-red); }
.label-bull { color: var(--success-green); }

/* Stats */
.stats-row {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}
.stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
}
.stat-val {
  font-size: 0.85rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.stat-label {
  font-size: 0.55rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-gray);
}
.stat.hot .stat-val {
  color: var(--warning-orange);
  animation: consensusPulse 1.2s ease-in-out infinite;
}

@keyframes consensusShake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-2px); }
  75% { transform: translateX(2px); }
}
@keyframes consensusPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}
</style>
