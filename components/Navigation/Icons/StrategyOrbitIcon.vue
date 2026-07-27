<script setup lang="ts">
import { computed } from 'vue'
import { useStrategiesStore } from '~/stores/strategies'

const props = defineProps({ size: { type: Number, default: 22 } })
const stratStore = useStrategiesStore()

// Orbit ring radii
const INNER_R = computed(() => props.size * 0.27)
const OUTER_R = computed(() => props.size * 0.43)

// Dot physical size (px, for positioning math)
const DOT_R = 2.5   // radius = half the 5px dot

// Hub geometry
const HUB_RING = computed(() => props.size * 0.135)
const HUB_CORE = computed(() => props.size * 0.07)

// Asset-class → color lookup (matches strategies.ts activeStrategiesForOrbit)
const CLASS_COLOR: Record<string, string> = {
  crypto:      '#F5A623',   // orange/gold
  stocks:      '#00ff88',   // green
  fiat:        '#4A90E2',   // blue
  commodities: '#F8E71C',   // yellow
}

// Build orbit dots from the store getter
// Each dot: {id, color (by asset class), opacity (paused=dim), r (ring), dur (orbit period), delay}
const liveDots = computed(() => {
  const strats = stratStore.activeStrategiesForOrbit
  if (!strats.length) return []

  const inner = strats.filter((_, i) => i % 2 === 0)
  const outer = strats.filter((_, i) => i % 2 !== 0)

  const build = (list: typeof strats, r: number, baseDur: number) =>
    list.map((s, i) => ({
      id:      s.id,
      color:   s.color,               // already resolved to hex by the getter
      opacity: s.status === 'paused' ? 0.3 : 1,
      r,
      dur:     s.status === 'paused' ? baseDur * 2.0 : baseDur,
      delay:   -(i / Math.max(list.length, 1)) * baseDur,
    }))

  // Orbit periods: inner 16 s, outer 11 s (noticeably slow)
  return [
    ...build(inner, INNER_R.value, 16),
    ...build(outer, OUTER_R.value, 11),
  ]
})

const hasDots = computed(() => liveDots.value.length > 0)

// Fallback: one dot per asset class, one on each ring, very slow
const fallbackDots = computed(() => [
  { id: 'f-crypto', color: CLASS_COLOR.crypto,      opacity: 1, r: INNER_R.value, dur: 16, delay: 0 },
  { id: 'f-stocks', color: CLASS_COLOR.stocks,       opacity: 1, r: OUTER_R.value, dur: 11, delay: -2.8 },
  { id: 'f-fiat',   color: CLASS_COLOR.fiat,         opacity: 1, r: INNER_R.value, dur: 16, delay: -8 },
  { id: 'f-comm',   color: CLASS_COLOR.commodities,  opacity: 1, r: OUTER_R.value, dur: 11, delay: -6 },
])

const activeDots = computed(() => hasDots.value ? liveDots.value : fallbackDots.value)
</script>

<template>
  <div
    class="orbit-icon"
    :style="{ width: `${size}px`, height: `${size}px` }"
  >
    <!-- SVG layer: orbit guide rings + bullseye hub -->
    <svg :viewBox="`0 0 ${size} ${size}`" fill="none" class="hub-svg">
      <!-- Outer dashed guide ring -->
      <circle
        :cx="size / 2" :cy="size / 2" :r="OUTER_R"
        stroke="rgba(255,255,255,0.16)" stroke-width="0.65"
        stroke-dasharray="2.2 2.8"
      />
      <!-- Inner dashed guide ring -->
      <circle
        :cx="size / 2" :cy="size / 2" :r="INNER_R"
        stroke="rgba(255,255,255,0.12)" stroke-width="0.55"
        stroke-dasharray="1.6 2.2"
      />
      <!-- Hub ring -->
      <circle
        :cx="size / 2" :cy="size / 2" :r="HUB_RING"
        fill="none"
        stroke="rgba(255,255,255,0.30)" stroke-width="0.75"
      />
      <!-- Hub center core -->
      <circle
        :cx="size / 2" :cy="size / 2" :r="HUB_CORE"
        fill="rgba(255,255,255,0.65)"
      />
    </svg>

    <!--
      Orbiting dots.
      Each dot uses the CSS transform-origin trick:
        • positioned at the top of its orbit circle
        • transform-origin points back to the icon center
        • rotating 360° orbits the dot around the center
      Color = asset class of the strategy.
    -->
    <span
      v-for="dot in activeDots"
      :key="dot.id"
      class="orbit-dot"
      :style="{
        '--dot-color': dot.color,
        opacity:             dot.opacity,
        top:                 `calc(50% - ${DOT_R}px - ${dot.r}px)`,
        left:                `calc(50% - ${DOT_R}px)`,
        transformOrigin:     `${DOT_R}px ${dot.r + DOT_R}px`,
        animationDuration:   `${dot.dur}s`,
        animationDelay:      `${dot.delay}s`,
      }"
    />
  </div>
</template>

<style scoped>
.orbit-icon {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: inherit;
}

.hub-svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.orbit-dot {
  position: absolute;
  width:  5px;
  height: 5px;
  border-radius: 50%;
  background: var(--dot-color, #00ff88);
  box-shadow:
    0 0 3px 1px var(--dot-color, #00ff88),
    0 0 7px 2px var(--dot-color, #00ff88);
  animation: orbit-spin linear infinite;
  will-change: transform;
  transition: opacity 0.5s ease;
}

@keyframes orbit-spin {
  to { transform: rotate(360deg); }
}
</style>
