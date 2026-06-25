<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'

interface PerfPoint { change: number; change_percentage: number }

const props = defineProps<{
  walletId: string
  totalValue: number
  performanceHistory: Record<string, PerfPoint> | undefined
  period: '1d' | '7d' | '30d' | '90d' | '1y'
}>()

// ─── Responsive sizing ────────────────────────────────────────────────
const wrap = ref<HTMLElement | null>(null)
const W = ref(420)
const H = 120
let ro: ResizeObserver | null = null
onMounted(() => {
  if (wrap.value && typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(entries => {
      const w = Math.round(entries[0]?.contentRect.width ?? 0)
      if (w > 0) W.value = w
    })
    ro.observe(wrap.value)
  }
})
onBeforeUnmount(() => ro?.disconnect())

// ─── Synthesize daily equity series ───────────────────────────────────
// Given the period's change_percentage, we generate a plausible curve from
// today's total_value back N days using a deterministic walk seeded by
// `walletId + period`.
function cyrb53(str: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
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

const POINTS_FOR: Record<string, number> = { '1d': 24, '7d': 28, '30d': 30, '90d': 30, '1y': 52 }
const LABEL_FOR: Record<string, string> = { '1d': 'hours', '7d': 'days', '30d': 'days', '90d': 'days', '1y': 'weeks' }

interface CurvePoint { x: number; y: number; t: string; value: number }

const series = computed<CurvePoint[]>(() => {
  const n = POINTS_FOR[props.period] ?? 30
  const perf = props.performanceHistory?.[props.period]
  const totalChangePct = perf?.change_percentage ?? 0
  const start = props.totalValue / (1 + totalChangePct / 100)

  const seed = cyrb53(`${props.walletId}::${props.period}`)
  const rand = mulberry32(seed)

  // Random-walk steps that average to the right total. We generate raw deltas,
  // sum them, then rescale so the cumulative matches (end / start - 1).
  const rawSteps: number[] = []
  let acc = 0
  for (let i = 0; i < n; i++) {
    const step = (rand() - 0.45)
    rawSteps.push(step)
    acc += step
  }
  const target = (props.totalValue - start) / Math.max(1, start)
  const factor = acc === 0 ? 0 : target / acc

  const out: CurvePoint[] = []
  let v = start
  for (let i = 0; i < n; i++) {
    v = Math.max(0.01, v * (1 + rawSteps[i] * factor + (rand() - 0.5) * 0.005))
    out.push({ x: i, y: 0, t: '', value: v })
  }
  // Force the last point to equal totalValue exactly
  out[out.length - 1].value = props.totalValue
  return out
})

const minMax = computed(() => {
  if (!series.value.length) return { min: 0, max: 1 }
  const vals = series.value.map(p => p.value)
  return { min: Math.min(...vals), max: Math.max(...vals) }
})

const projected = computed(() => {
  const padX = 4, padY = 8
  const innerW = W.value - padX * 2
  const innerH = H - padY * 2
  const { min, max } = minMax.value
  const range = max - min || 1
  const step = innerW / Math.max(1, series.value.length - 1)
  return series.value.map((p, i) => ({
    ...p,
    x: padX + i * step,
    y: padY + innerH - ((p.value - min) / range) * innerH
  }))
})

const pathD = computed(() => {
  if (!projected.value.length) return ''
  return projected.value.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ')
})

const areaD = computed(() => {
  if (!projected.value.length) return ''
  const baseY = H - 8
  const head = `M ${projected.value[0].x.toFixed(2)} ${baseY}`
  const lines = projected.value.map(p => `L ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ')
  const tail = ` L ${projected.value[projected.value.length - 1].x.toFixed(2)} ${baseY} Z`
  return `${head} ${lines} ${tail}`
})

const minPoint = computed(() => projected.value.reduce((a, b) => (a.value < b.value ? a : b), projected.value[0]))
const maxPoint = computed(() => projected.value.reduce((a, b) => (a.value > b.value ? a : b), projected.value[0]))

const drawdownPct = computed(() => {
  if (!series.value.length) return 0
  let peak = -Infinity, maxDD = 0
  for (const p of series.value) {
    if (p.value > peak) peak = p.value
    const dd = (p.value - peak) / peak * 100
    if (dd < maxDD) maxDD = dd
  }
  return maxDD
})

// Best / worst single-step move
const bestWorstStep = computed(() => {
  if (series.value.length < 2) return { best: 0, worst: 0 }
  let best = -Infinity, worst = Infinity
  for (let i = 1; i < series.value.length; i++) {
    const pct = (series.value[i].value - series.value[i-1].value) / series.value[i-1].value * 100
    if (pct > best) best = pct
    if (pct < worst) worst = pct
  }
  return { best: best === -Infinity ? 0 : best, worst: worst === Infinity ? 0 : worst }
})

const isPositive = computed(() => {
  const perf = props.performanceHistory?.[props.period]
  return (perf?.change_percentage ?? 0) >= 0
})

const stroke = computed(() => isPositive.value ? 'var(--success-green, #00ff88)' : '#ff4d6a')
const fillFrom = computed(() => isPositive.value ? 'rgba(0,255,136,0.18)' : 'rgba(255,77,106,0.18)')

const fmt = (n: number) => Math.round(n).toLocaleString('en-US')
const periodLabel = computed(() => {
  return {
    '1d': 'Last 24h',
    '7d': 'Last week',
    '30d': 'Last 30d',
    '90d': 'Last 90d',
    '1y': 'Last year'
  }[props.period]
})
</script>

<template>
  <div class="equity-curve" ref="wrap">
    <header class="head">
      <span class="title">Equity · {{ periodLabel }}</span>
      <div class="head-stats">
        <span class="stat" title="Highest single-step gain">
          <em>Best</em>
          <strong class="pos">+{{ bestWorstStep.best.toFixed(2) }}%</strong>
        </span>
        <span class="stat" title="Lowest single-step loss">
          <em>Worst</em>
          <strong class="neg">{{ bestWorstStep.worst.toFixed(2) }}%</strong>
        </span>
        <span class="stat" title="Max peak-to-trough drawdown over the period">
          <em>Max DD</em>
          <strong :class="drawdownPct < 0 ? 'neg' : ''">{{ drawdownPct.toFixed(2) }}%</strong>
        </span>
      </div>
    </header>

    <svg :viewBox="`0 0 ${W} ${H}`" :width="W" :height="H" preserveAspectRatio="none" class="curve-svg">
      <defs>
        <linearGradient :id="`grad-${walletId}-${period}`" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" :stop-color="fillFrom" />
          <stop offset="100%" stop-color="rgba(0,0,0,0)" />
        </linearGradient>
      </defs>

      <!-- gridlines: just two faint horizontal -->
      <line :x1="0" :y1="H * 0.33" :x2="W" :y2="H * 0.33" stroke="rgba(255,255,255,0.04)" />
      <line :x1="0" :y1="H * 0.66" :x2="W" :y2="H * 0.66" stroke="rgba(255,255,255,0.04)" />

      <!-- area fill -->
      <path :d="areaD" :fill="`url(#grad-${walletId}-${period})`" />

      <!-- equity line -->
      <path :d="pathD" :stroke="stroke" stroke-width="1.75" fill="none" stroke-linecap="round" stroke-linejoin="round" />

      <!-- min / max markers -->
      <g v-if="projected.length">
        <circle :cx="maxPoint.x" :cy="maxPoint.y" r="3.5" fill="var(--success-green, #00ff88)" />
        <text :x="maxPoint.x + 6" :y="maxPoint.y" dominant-baseline="middle" class="lbl pos">${{ fmt(maxPoint.value) }}</text>
        <circle :cx="minPoint.x" :cy="minPoint.y" r="3.5" fill="#ff4d6a" />
        <text :x="minPoint.x + 6" :y="minPoint.y" dominant-baseline="middle" class="lbl neg">${{ fmt(minPoint.value) }}</text>
      </g>
    </svg>
  </div>
</template>

<style scoped>
.equity-curve {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  min-width: 0;
}

.head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.6rem;
  min-width: 0;
  flex-wrap: wrap;
}
.title {
  font-size: 0.72rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.65);
  font-weight: 700;
}
.head-stats {
  display: inline-flex;
  gap: 0.85rem;
  flex-wrap: wrap;
}
.stat {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.05rem;
  line-height: 1;
}
.stat em {
  font-style: normal;
  font-size: 0.52rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.4);
  font-weight: 700;
}
.stat strong {
  font-size: 0.78rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: rgba(255,255,255,0.85);
}
.stat strong.pos { color: var(--success-green, #00ff88); }
.stat strong.neg { color: #ff4d6a; }

.curve-svg {
  display: block;
  width: 100%;
  height: auto;
}

.lbl {
  font-size: 8.5px;
  font-family: ui-monospace, Menlo, monospace;
  font-weight: 700;
}
.lbl.pos { fill: var(--success-green, #00ff88); }
.lbl.neg { fill: #ff4d6a; }
</style>
