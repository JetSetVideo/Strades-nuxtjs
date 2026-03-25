<script setup lang="ts">
import type { PsychologyProfile } from '@/stores/users'

const props = defineProps<{
  profile: PsychologyProfile
  riskRadius?: string
}>()

/** Convert 0-1 score to a visual bar color */
const barColor = (val: number, invert = false): string => {
  const v = invert ? 1 - val : val
  const sat = Math.min(1, v * 1.2)
  if (v > 0.65) return `oklch(55% ${sat * 0.3} 25)`   // red — high = bad
  if (v > 0.35) return `oklch(65% 0.15 60)`            // orange — medium
  return `oklch(70% ${sat * 0.3} 145)`                 // green — low
}

const goodBarColor = (val: number): string => {
  const sat = Math.min(1, val * 1.2)
  if (val > 0.65) return `oklch(70% ${sat * 0.3} 145)` // green — high = good
  if (val > 0.35) return `oklch(65% 0.15 60)`           // orange
  return `oklch(55% ${sat * 0.3} 25)`                   // red
}

const metrics = computed(() => [
  { key: 'risk_score',                label: 'Risk Appetite',       val: props.profile.risk_score,                color: barColor(props.profile.risk_score) },
  { key: 'discipline_score',          label: 'Discipline',          val: props.profile.discipline_score,          color: goodBarColor(props.profile.discipline_score) },
  { key: 'patience_index',            label: 'Patience',            val: props.profile.patience_index,            color: goodBarColor(props.profile.patience_index) },
  { key: 'fomo_susceptibility',       label: 'FOMO Susceptibility', val: props.profile.fomo_susceptibility,       color: barColor(props.profile.fomo_susceptibility) },
  { key: 'revenge_trading_tendency',  label: 'Revenge Trading',     val: props.profile.revenge_trading_tendency,  color: barColor(props.profile.revenge_trading_tendency) },
  { key: 'overconfidence_bias',       label: 'Overconfidence',      val: props.profile.overconfidence_bias,       color: barColor(props.profile.overconfidence_bias) },
])
</script>

<template>
  <div class="psych-card" :style="{ '--psych-radius': riskRadius ?? '8px' }">
    <div class="psych-header">
      <span class="mbti-badge">{{ profile.mbti }}</span>
      <span class="style-label">{{ profile.trading_style?.replace('_', ' ') }}</span>
      <span class="control-score">
        Emotional Control: <strong>{{ profile.emotional_control_score?.toFixed(1) }}/10</strong>
      </span>
    </div>

    <p class="description">{{ profile.description }}</p>

    <div class="bars">
      <div v-for="m in metrics" :key="m.key" class="bar-row">
        <span class="bar-label">{{ m.label }}</span>
        <div class="bar-track">
          <div
            class="bar-fill"
            :style="{ width: `${m.val * 100}%`, background: m.color }"
          />
        </div>
        <span class="bar-val">{{ Math.round(m.val * 100) }}</span>
      </div>
    </div>

    <div class="strengths-weaknesses">
      <div class="list-block">
        <h5 class="list-title positive">Strengths</h5>
        <div class="tag-list">
          <span v-for="s in profile.strengths" :key="s" class="tag-pos">{{ s.replace(/_/g, ' ') }}</span>
        </div>
      </div>
      <div class="list-block">
        <h5 class="list-title negative">Weaknesses</h5>
        <div class="tag-list">
          <span v-for="w in profile.weaknesses" :key="w" class="tag-neg">{{ w.replace(/_/g, ' ') }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.psych-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  border-radius: var(--psych-radius, var(--radius-md));
  padding: var(--spacing-md);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.psych-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  flex-wrap: wrap;
}

.mbti-badge {
  font-size: 0.85rem;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: var(--psych-radius, var(--radius-sm));
  background: rgba(0, 170, 255, 0.15);
  border: 1px solid rgba(0, 170, 255, 0.4);
  color: var(--primary-blue);
  letter-spacing: 0.1em;
}

.style-label {
  font-size: 0.75rem;
  color: var(--text-light-gray);
  text-transform: capitalize;
}

.control-score {
  font-size: 0.75rem;
  color: var(--text-gray);
  margin-left: auto;
}

.control-score strong {
  color: var(--text-white);
}

.description {
  font-size: 0.8rem;
  color: var(--text-light-gray);
  line-height: 1.5;
  margin: 0;
}

.bars {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.bar-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.bar-label {
  font-size: 0.68rem;
  color: var(--text-gray);
  min-width: 120px;
  flex-shrink: 0;
}

.bar-track {
  flex: 1;
  height: 5px;
  background: rgba(255,255,255,0.07);
  border-radius: 999px;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  border-radius: 999px;
  transition: width 0.6s ease;
}

.bar-val {
  font-size: 0.65rem;
  color: var(--text-gray);
  min-width: 24px;
  text-align: right;
}

.strengths-weaknesses {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-xs);
}

.list-title {
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin: 0 0 4px;
}

.list-title.positive { color: var(--success-green); }
.list-title.negative { color: var(--error-red); }

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.tag-pos, .tag-neg {
  font-size: 0.62rem;
  padding: 2px 7px;
  border-radius: 999px;
}

.tag-pos {
  background: rgba(0,255,136,0.08);
  border: 1px solid rgba(0,255,136,0.25);
  color: var(--success-green);
}

.tag-neg {
  background: rgba(255,68,68,0.08);
  border: 1px solid rgba(255,68,68,0.25);
  color: var(--error-red);
}
</style>
