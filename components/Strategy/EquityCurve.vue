<script setup lang="ts">
import { computed } from 'vue'
import { seededRandom } from '@/composables/useSeededRandom'

const props = withDefaults(defineProps<{
  /** Stable seed so the curve is reproducible per strategy/bot id */
  seed: string
  initialValue: number
  finalValue: number
  steps?: number
  width?: number
  height?: number
}>(), {
  steps: 60,
  width: 600,
  height: 100
})

const series = computed<number[]>(() => {
  const init = props.initialValue
  const final = props.finalValue
  const n = props.steps
  const target = (final - init) / Math.max(1, init)
  const rand = seededRandom(props.seed)
  const stepsArr: number[] = []
  let acc = 0
  for (let i = 0; i < n; i++) {
    const s = rand() - 0.5
    stepsArr.push(s)
    acc += s
  }
  const factor = acc === 0 ? 0 : target / acc
  const out: number[] = []
  let v = init
  for (let i = 0; i < n; i++) {
    v = Math.max(0.01, v * (1 + stepsArr[i] * factor + (rand() - 0.5) * 0.003))
    out.push(v)
  }
  out[n - 1] = final
  return out
})

const isPositive = computed(() => props.finalValue >= props.initialValue)

const svg = computed(() => {
  const data = series.value
  if (!data.length) return { points: '', area: '', lastX: 0, lastY: 0 }
  const w = props.width
  const h = props.height
  const pad = 4
  const min = Math.min(...data) * 0.98
  const max = Math.max(...data) * 1.02
  const range = max - min || 1
  const step = (w - pad * 2) / Math.max(1, data.length - 1)
  const pts = data.map((v, i) => ({
    x: pad + i * step,
    y: pad + (h - pad * 2) * (1 - (v - min) / range)
  }))
  const points = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ')
  const area = `M ${pts[0].x} ${h - pad} ` +
    pts.map(p => `L ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ') +
    ` L ${pts[pts.length - 1].x} ${h - pad} Z`
  return { points, area, lastX: pts[pts.length - 1].x, lastY: pts[pts.length - 1].y }
})

const gradId = computed(() => `equity-grad-${props.seed.replace(/[^a-zA-Z0-9]/g, '')}`)
const lineColor = computed(() => isPositive.value ? 'var(--success-green, #00ff88)' : '#ff4d6a')
const fillTop = computed(() => isPositive.value ? 'rgba(0,255,136,0.25)' : 'rgba(255,77,106,0.25)')
</script>

<template>
  <svg
    :viewBox="`0 0 ${width} ${height}`"
    :width="width"
    :height="height"
    preserveAspectRatio="none"
    class="equity-svg"
  >
    <defs>
      <linearGradient :id="gradId" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" :stop-color="fillTop" />
        <stop offset="100%" stop-color="rgba(0,0,0,0)" />
      </linearGradient>
    </defs>
    <path :d="svg.area" :fill="`url(#${gradId})`" />
    <path
      :d="svg.points"
      :stroke="lineColor"
      stroke-width="1.75"
      fill="none"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <circle :cx="svg.lastX" :cy="svg.lastY" r="3.5" :fill="lineColor" />
  </svg>
</template>

<style scoped>
.equity-svg {
  display: block;
  width: 100%;
  height: auto;
  margin: 0 auto;
}
</style>
