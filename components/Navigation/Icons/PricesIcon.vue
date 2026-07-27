<script setup lang="ts">
import { computed } from 'vue'
import { useMacroStore } from '~/stores/macro'

const props = defineProps({ size: { type: Number, default: 22 } })
const macro = useMacroStore()

// Color follows live average % change
// Neutral uses cyan (visible on dark backgrounds, unlike grey)
const colorRGB = computed(() => {
  const a = macro.avg_change_pct
  if (a >  0.4) return '0,255,136'
  if (a < -0.4) return '255,68,68'
  return '0,180,255'
})
const color = computed(() => `rgb(${colorRGB.value})`)

// Pulse speed: slow baseline, only quickens at very high volatility
const pulseDur = computed(() => {
  const v = macro.global_volatility_index
  return Math.max(3.5, 6.0 - v * 3.5)
})

// ── Sparkline geometry ────────────────────────────────────────────────────
// Compact band: top 58% of icon height, leaving room for vol label at bottom
const pts = computed(() => {
  const w   = props.size - 3
  const h   = props.size * 0.52
  const top = props.size * 0.05
  const mid = top + h / 2

  const s  = macro.market_sentiment            // −1…+1
  const v  = Math.max(0.18, macro.global_volatility_index)
  const n  = 9
  const xs = w / (n - 1)

  // Fixed noise seeds — no random, no re-render jitter
  const N = [0.14, -0.48, 0.28, -0.16, 0.50, -0.24, 0.19, -0.38, 0.06]

  // Slope with minimum gradient so the line is never perfectly flat
  const slope    = s * h * 0.52
  const minSlope = Math.max(Math.abs(slope), h * 0.10) * (s >= 0 ? 1 : -1)
  const amp      = v * h * 0.20

  return Array.from({ length: n }, (_, i) => {
    const x     = 1.5 + i * xs
    const trend = mid + minSlope / 2 - (minSlope * i / (n - 1))
    const y     = Math.max(top + 0.5, Math.min(top + h - 0.5, trend + N[i] * amp))
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
})

// Tip dot coordinates
const tipArr = computed(() => {
  const last = pts.value.split(' ').at(-1) ?? '20,8'
  return last.split(',')
})

const volLabel = computed(() => `${(macro.global_volatility_index * 100).toFixed(0)}%`)
</script>

<template>
  <div
    class="prices-icon"
    :style="{
      width:         `${size}px`,
      height:        `${size}px`,
      '--clr':       color,
      '--pulse-dur': `${pulseDur}s`,
    }"
  >
    <svg :viewBox="`0 0 ${size} ${size}`" fill="none" overflow="visible">

      <!-- Soft glow under the line (slightly wider, very low opacity) -->
      <polyline
        :points="pts"
        :stroke="color"
        stroke-width="2.4"
        stroke-linecap="round"
        stroke-linejoin="round"
        opacity="0.14"
      />

      <!-- Main sparkline — thin but clearly visible -->
      <polyline
        :points="pts"
        :stroke="color"
        stroke-width="1.1"
        stroke-linecap="round"
        stroke-linejoin="round"
        fill="none"
      />

      <!-- Small live dot at sparkline tip -->
      <circle
        :cx="tipArr[0]"
        :cy="tipArr[1]"
        r="1.5"
        :fill="color"
        class="live-dot"
      />
      <!-- Outer pulse ring -->
      <circle
        :cx="tipArr[0]"
        :cy="tipArr[1]"
        r="2.8"
        :stroke="color"
        stroke-width="0.5"
        fill="none"
        class="live-ring"
      />

      <!-- Volatility % — tiny label at the bottom of the icon -->
      <text
        :x="size / 2"
        :y="size - 0.8"
        :fill="color"
        text-anchor="middle"
        dominant-baseline="auto"
        :font-size="size * 0.22"
        font-family="'Poppins', monospace"
        font-weight="600"
        opacity="0.85"
      >{{ volLabel }}</text>

    </svg>
  </div>
</template>

<style scoped>
.prices-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  animation: spark-pulse var(--pulse-dur, 5s) ease-in-out infinite;
}
@keyframes spark-pulse {
  0%, 100% { filter: drop-shadow(0 0 0px   var(--clr)); opacity: 0.84; }
  50%       { filter: drop-shadow(0 0 2px var(--clr));   opacity: 1.0;  }
}

.live-dot {
  animation: dot-blink 2.5s ease-in-out infinite;
}
.live-ring {
  animation: dot-blink 2.5s ease-in-out infinite reverse;
}
@keyframes dot-blink {
  0%, 100% { opacity: 1;    }
  50%       { opacity: 0.15; }
}
</style>
