<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  seed?: string
  count?: number
  width?: number
  height?: number
  trend?: number   // -1..1, biases candle direction
  basePrice?: number
}>(), {
  count: 12,
  width: 110,
  height: 36,
  trend: 0,
  basePrice: 100
})

interface Candle { o: number; h: number; l: number; c: number }

// Deterministic PRNG seeded by string (mulberry32 + cyrb53 hash)
function cyrb53(str: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed
  for (let i = 0, ch: number; i < str.length; i++) {
    ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return 4294967296 * (2097151 & h2) + (h1 >>> 0)
}
function mulberry32(seed: number) {
  let t = seed >>> 0
  return () => {
    t = (t + 0x6D2B79F5) >>> 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

const candles = computed<Candle[]>(() => {
  const seed = cyrb53(props.seed ?? 'default')
  const rand = mulberry32(seed)
  const out: Candle[] = []
  let last = props.basePrice
  const drift = props.trend * 0.005 // bias per step
  for (let i = 0; i < props.count; i++) {
    const o = last
    const variation = (rand() - 0.5) * 0.04 + drift
    const c = Math.max(0.01, o * (1 + variation))
    const range = Math.abs(c - o) + rand() * o * 0.025
    const h = Math.max(o, c) + range * (0.4 + rand() * 0.5)
    const l = Math.min(o, c) - range * (0.4 + rand() * 0.5)
    out.push({ o, h, l, c })
    last = c
  }
  return out
})

const minMax = computed(() => {
  const lows = candles.value.map(c => c.l)
  const highs = candles.value.map(c => c.h)
  return { min: Math.min(...lows), max: Math.max(...highs) }
})

const W = computed(() => props.width)
const H = computed(() => props.height)
const padY = 2
const slotW = computed(() => W.value / props.count)
const bodyW = computed(() => Math.max(2, slotW.value * 0.6))

const project = (price: number) => {
  const { min, max } = minMax.value
  const range = max - min || 1
  return padY + (H.value - padY * 2) * (1 - (price - min) / range)
}

const candleViews = computed(() => candles.value.map((c, i) => {
  const cx = i * slotW.value + slotW.value / 2
  const yOpen = project(c.o)
  const yClose = project(c.c)
  const yHigh = project(c.h)
  const yLow = project(c.l)
  const bullish = c.c >= c.o
  const top = Math.min(yOpen, yClose)
  const bottom = Math.max(yOpen, yClose)
  return {
    cx, yHigh, yLow,
    bodyY: top,
    bodyH: Math.max(1, bottom - top),
    bodyX: cx - bodyW.value / 2,
    bullish
  }
}))
</script>

<template>
  <svg :viewBox="`0 0 ${W} ${H}`" :width="W" :height="H" class="mini-candles" preserveAspectRatio="none" aria-hidden="true">
    <g v-for="(cv, i) in candleViews" :key="i" :class="['candle', cv.bullish ? 'up' : 'down']">
      <line
        :x1="cv.cx" :y1="cv.yHigh"
        :x2="cv.cx" :y2="cv.yLow"
        stroke="currentColor" stroke-width="0.85"
      />
      <rect
        :x="cv.bodyX" :y="cv.bodyY"
        :width="bodyW" :height="cv.bodyH"
        fill="currentColor" rx="0.6"
      />
    </g>
  </svg>
</template>

<style scoped>
.mini-candles { display: block; }
.candle.up { color: var(--success-green, #00ff88); }
.candle.down { color: var(--error-red, #ff4444); }
</style>
