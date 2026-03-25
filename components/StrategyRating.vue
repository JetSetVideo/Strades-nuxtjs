<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  risk: number            // 0–10
  complexity: string      // e.g. "3/10"
  computationalCost: number
  selectedSources?: number
  frequency?: string
}>()

// ── Derived ──────────────────────────────────────────────────────────────────
const riskPct = computed(() => Math.min(10, Math.max(0, props.risk)) * 10)

const complexityNum = computed(() => {
  const n = parseFloat(String(props.complexity))
  return isNaN(n) ? 0 : n
})

// Risk colour: green → yellow → red, morphed by risk
const riskColor = computed(() => {
  const r = riskPct.value / 100
  if (r < 0.4) return '#4caf50'
  if (r < 0.7) return '#ff9800'
  return '#f44336'
})

// Border-radius morphs with risk: low risk = very round, high risk = sharp
const riskRadius = computed(() => `${20 - props.risk * 1.6}px`)

// Pulse speed: more conditions/cost = faster heartbeat
const pulseMs = computed(() => {
  const base = Math.max(600, 2500 - props.computationalCost * 15)
  return `${base}ms`
})

const freqLabel = computed(() => props.frequency ?? '1D')
</script>

<template>
  <div class="rating-root" :style="{ '--risk-color': riskColor, '--pulse-ms': pulseMs }">

    <!-- Risk gauge -->
    <div class="gauge-row">
      <div class="gauge-block" :style="{ borderRadius: riskRadius }">
        <div class="gauge-inner">
          <span class="gauge-value" :style="{ color: riskColor }">{{ risk }}<span class="gauge-denom">/10</span></span>
          <span class="gauge-label">Risk</span>
        </div>
        <!-- Animated ring -->
        <div class="gauge-ring" :style="{ borderColor: riskColor }" />
      </div>

      <!-- Bars -->
      <div class="bars-col">
        <!-- Risk bar -->
        <div class="bar-row">
          <span class="bar-label">Risk</span>
          <div class="bar-track">
            <div class="bar-fill" :style="{ width: riskPct + '%', background: riskColor, borderRadius: riskRadius }" />
          </div>
          <span class="bar-val" :style="{ color: riskColor }">{{ risk }}/10</span>
        </div>

        <!-- Complexity bar -->
        <div class="bar-row">
          <span class="bar-label">Complexity</span>
          <div class="bar-track">
            <div class="bar-fill complexity" :style="{ width: (complexityNum * 10) + '%' }" />
          </div>
          <span class="bar-val">{{ complexity }}</span>
        </div>

        <!-- Cost bar -->
        <div class="bar-row">
          <span class="bar-label">CPU Cost</span>
          <div class="bar-track">
            <div class="bar-fill cost" :style="{ width: Math.min(100, computationalCost / 10) + '%' }" />
          </div>
          <span class="bar-val cost-val">{{ computationalCost }} pts</span>
        </div>
      </div>
    </div>

    <!-- Metadata tags -->
    <div class="meta-row">
      <span class="meta-tag">
        <span class="meta-dot" :style="{ background: riskColor }" />
        {{ risk <= 3 ? 'Conservative' : risk <= 6 ? 'Moderate' : 'Aggressive' }}
      </span>
      <span class="meta-tag">
        ⏱ {{ freqLabel }} cadence
      </span>
      <span class="meta-tag cost-tag">
        💳 {{ computationalCost }} credits/run
      </span>
      <span v-if="selectedSources" class="meta-tag">
        📡 {{ selectedSources }} source{{ selectedSources !== 1 ? 's' : '' }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.rating-root {
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  padding: var(--spacing-md);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

/* ── Gauge + Bars layout ── */
.gauge-row {
  display: flex;
  gap: var(--spacing-md);
  align-items: center;
}

/* Gauge circle */
.gauge-block {
  position: relative;
  width: 64px;
  height: 64px;
  flex-shrink: 0;
  border: 2px solid var(--risk-color);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-radius 0.4s ease, border-color 0.4s ease;
  animation: gauge-pulse var(--pulse-ms) ease infinite;
}

@keyframes gauge-pulse {
  0%, 100% { box-shadow: 0 0 0   0 color-mix(in srgb, var(--risk-color) 30%, transparent); }
  50%       { box-shadow: 0 0 14px 4px color-mix(in srgb, var(--risk-color) 20%, transparent); }
}

.gauge-ring {
  position: absolute;
  inset: -6px;
  border: 1px solid var(--risk-color);
  border-radius: inherit;
  opacity: 0.3;
  animation: ring-expand var(--pulse-ms) ease infinite;
}

@keyframes ring-expand {
  0%   { transform: scale(1);    opacity: 0.3; }
  70%  { transform: scale(1.25); opacity: 0; }
  100% { transform: scale(1.25); opacity: 0; }
}

.gauge-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.gauge-value {
  font-size: 1.2rem;
  font-weight: 800;
  line-height: 1;
  transition: color 0.4s ease;
}

.gauge-denom { font-size: 0.55rem; color: var(--text-gray); font-weight: 400; }

.gauge-label {
  font-size: 0.5rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-gray);
}

/* ── Bars ── */
.bars-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.bar-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.bar-label {
  font-size: 0.62rem;
  color: var(--text-gray);
  width: 72px;
  flex-shrink: 0;
}

.bar-track {
  flex: 1;
  height: 6px;
  background: rgba(255,255,255,0.06);
  border-radius: 999px;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  border-radius: 999px;
  transition: width 0.4s ease, background 0.4s ease, border-radius 0.4s ease;
}

.bar-fill.complexity { background: var(--primary-blue); }
.bar-fill.cost       { background: var(--warning-orange); }

.bar-val {
  font-size: 0.65rem;
  font-weight: 600;
  color: var(--text-white);
  min-width: 38px;
  text-align: right;
}

.bar-val.cost-val { color: var(--warning-orange); }

/* ── Meta tags ── */
.meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.meta-tag {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.6rem;
  color: var(--text-gray);
  background: rgba(255,255,255,0.04);
  border: 1px solid var(--border-secondary);
  padding: 3px 8px;
  border-radius: 999px;
}

.meta-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.cost-tag { color: var(--warning-orange); }
</style>
