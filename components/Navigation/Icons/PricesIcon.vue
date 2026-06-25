<template>
  <div
    class="prices-icon"
    :style="{ width: `${size}px`, height: `${size}px`, '--pulse-d': pulseDuration }"
  >
    <svg :width="size" :height="size" viewBox="0 0 24 24" aria-hidden="true">
      <!-- Background grid -->
      <line x1="2" y1="20" x2="22" y2="20" stroke="rgba(255,255,255,0.15)" stroke-width="0.5" />

      <!-- Animated sparkline -->
      <polyline
        :points="sparkPoints"
        fill="none"
        :stroke="strokeColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="sparkline"
      />

      <!-- Pulsing endpoint dot -->
      <circle
        :cx="endpoint.x"
        :cy="endpoint.y"
        r="1.6"
        :fill="strokeColor"
        class="endpoint"
      />
      <circle
        :cx="endpoint.x"
        :cy="endpoint.y"
        r="3"
        fill="none"
        :stroke="strokeColor"
        stroke-width="0.5"
        opacity="0.5"
        class="endpoint-ring"
      />
    </svg>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useMacroStore } from '~/stores/macro'

const props = withDefaults(defineProps<{ size?: number }>(), { size: 24 })

const macro = useMacroStore()

// Generate a deterministic spark from class volatilities so it actually means something
const sparkData = computed(() => {
  const v = macro.volatility_by_class
  const base = [0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7]
  const tilt = macro.market_sentiment * 0.25
  return base.map((b, i) => b + tilt * (i / base.length) + (v.crypto - 0.5) * 0.2 * Math.sin(i))
})

const sparkPoints = computed(() => {
  const data = sparkData.value
  const w = 20
  const h = 14
  const offsetX = 2
  const offsetY = 4
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const step = w / (data.length - 1)
  return data
    .map((v, i) => `${(offsetX + i * step).toFixed(2)},${(offsetY + h - ((v - min) / range) * h).toFixed(2)}`)
    .join(' ')
})

const endpoint = computed(() => {
  const points = sparkPoints.value.split(' ')
  const last = points[points.length - 1].split(',').map(Number)
  return { x: last[0], y: last[1] }
})

const strokeColor = computed(() => {
  // Positive sentiment => green, negative => red, neutral => mid
  if (macro.market_sentiment > 0.15) return 'var(--success-green, #00ff88)'
  if (macro.market_sentiment < -0.15) return 'var(--error-red, #ff4444)'
  return 'rgba(255,255,255,0.85)'
})

const pulseDuration = computed(() => `${Math.max(0.3, 2.0 - macro.global_volatility_index * 1.7).toFixed(2)}s`)
</script>

<style scoped>
.prices-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: inherit;
}

.sparkline {
  filter: drop-shadow(0 0 3px currentColor);
  transition: stroke 0.6s ease;
}

.endpoint {
  animation: end-pulse var(--pulse-d, 1.2s) infinite ease-in-out;
}
.endpoint-ring {
  transform-origin: var(--ep-x) var(--ep-y);
  animation: ring-pulse var(--pulse-d, 1.2s) infinite ease-out;
}
@keyframes end-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.2); }
}
@keyframes ring-pulse {
  0% { opacity: 0.6; transform: scale(0.7); }
  100% { opacity: 0; transform: scale(2.2); }
}
</style>
