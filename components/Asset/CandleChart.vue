<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { useAssetAnnotationsStore } from '~/stores/assetAnnotations'

interface Candle { o: number; h: number; l: number; c: number; t: number; v: number }

const props = withDefaults(defineProps<{
  assetId: string
  basePrice?: number
  height?: number
}>(), {
  basePrice: 100,
  height: 340
})

const emit = defineEmits<{
  (e: 'annotation-added'): void
  (e: 'trigger-added'): void
}>()

const store = useAssetAnnotationsStore()

// ─── Time-frame ────────────────────────────────────────────────────────
type Frame = '1H' | '4H' | '1D' | '1W'
const frame = ref<Frame>('1D')

const FRAME_CFG: Record<Frame, { count: number; stepMs: number; vol: number }> = {
  '1H':  { count: 60,  stepMs: 60_000,        vol: 0.012 },
  '4H':  { count: 48,  stepMs: 4 * 60_000,    vol: 0.018 },
  '1D':  { count: 60,  stepMs: 60 * 60_000,   vol: 0.028 },
  '1W':  { count: 52,  stepMs: 7 * 86_400_000, vol: 0.045 }
}

// ─── Responsive sizing ────────────────────────────────────────────────
const wrapRef = ref<HTMLDivElement | null>(null)
const W = ref(800)
const H = computed(() => props.height)
let resizeObserver: ResizeObserver | null = null

const padL = 40
const padR = 12
const padT = 12
const padB = 22
const VOL_H = 38
const innerW = computed(() => Math.max(60, W.value - padL - padR))
const candleAreaH = computed(() => H.value - padT - padB - VOL_H)
const innerH = candleAreaH

const candleCount = computed(() => FRAME_CFG[frame.value].count)
const slotW = computed(() => innerW.value / candleCount.value)
const bodyW = computed(() => Math.max(1.5, slotW.value * 0.65))

// ─── Deterministic candles ────────────────────────────────────────────
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

const candles = computed<Candle[]>(() => {
  const cfg = FRAME_CFG[frame.value]
  const seed = cyrb53(`${props.assetId}::${frame.value}`)
  const rand = mulberry32(seed)
  const out: Candle[] = []
  let last = props.basePrice
  const now = Date.now()
  for (let i = 0; i < cfg.count; i++) {
    const o = last
    const variation = (rand() - 0.5) * cfg.vol * 2
    const c = Math.max(0.01, o * (1 + variation))
    const range = Math.abs(c - o) + rand() * o * cfg.vol
    const h = Math.max(o, c) + range * (0.3 + rand() * 0.5)
    const l = Math.min(o, c) - range * (0.3 + rand() * 0.5)
    const v = (0.3 + rand() * 0.7) * (Math.abs(c - o) / o + 0.005) * 1e6
    out.push({ o, h, l, c, t: now - (cfg.count - i) * cfg.stepMs, v })
    last = c
  }
  return out
})

const currentPrice = computed(() => candles.value[candles.value.length - 1]?.c ?? props.basePrice)

const minMax = computed(() => {
  const lows = candles.value.map(c => c.l)
  const highs = candles.value.map(c => c.h)
  const min = Math.min(...lows) * 0.97
  const max = Math.max(...highs) * 1.03
  return { min, max }
})

const maxVol = computed(() => Math.max(...candles.value.map(c => c.v), 1))

// ─── Projection helpers ───────────────────────────────────────────────
const priceToY = (p: number) => {
  const { min, max } = minMax.value
  const range = max - min || 1
  return padT + (innerH.value * (1 - (p - min) / range))
}
const yToPrice = (y: number) => {
  const { min, max } = minMax.value
  const range = max - min || 1
  return min + range * (1 - (y - padT) / innerH.value)
}
const indexToX = (i: number) => padL + i * slotW.value + slotW.value / 2
const xToIndex = (x: number) =>
  Math.max(0, Math.min(candleCount.value - 1, Math.floor((x - padL) / slotW.value)))

const yTicks = computed(() => {
  const { min, max } = minMax.value
  const range = max - min
  const ticks = []
  for (let i = 0; i <= 4; i++) {
    const p = min + (range * i) / 4
    ticks.push({ p, y: priceToY(p) })
  }
  return ticks
})

const xTicks = computed(() => {
  const total = candles.value.length
  if (!total) return [] as { x: number; label: string }[]
  const fmt = (t: number) => {
    const d = new Date(t)
    if (frame.value === '1H') return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    if (frame.value === '4H') return d.toLocaleTimeString([], { hour: '2-digit' })
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
  }
  const ticks: { x: number; label: string }[] = []
  for (let i = 0; i < 4; i++) {
    const idx = Math.floor((i * (total - 1)) / 3)
    ticks.push({ x: indexToX(idx), label: fmt(candles.value[idx].t) })
  }
  return ticks
})

const candleViews = computed(() =>
  candles.value.map((c, i) => {
    const cx = indexToX(i)
    const yO = priceToY(c.o)
    const yC = priceToY(c.c)
    const top = Math.min(yO, yC)
    const bottom = Math.max(yO, yC)
    const volTop = padT + candleAreaH.value + (VOL_H - (c.v / maxVol.value) * (VOL_H - 4))
    const volH = padT + candleAreaH.value + VOL_H - volTop
    return {
      cx,
      yH: priceToY(c.h),
      yL: priceToY(c.l),
      bodyY: top,
      bodyH: Math.max(1, bottom - top),
      bodyX: cx - bodyW.value / 2,
      bullish: c.c >= c.o,
      volY: volTop, volH
    }
  })
)

// ─── Drawing ──────────────────────────────────────────────────────────
type Tool = 'pointer' | 'trendline' | 'level' | 'trigger_above' | 'trigger_below'
const tool = ref<Tool>('pointer')

interface DraftLine { x1: number; y1: number; x2: number; y2: number }
const draft = ref<DraftLine | null>(null)
const svgRef = ref<SVGSVGElement | null>(null)
const hoverPoint = ref<{ x: number; y: number; price: number } | null>(null)

const getSvgPoint = (evt: MouseEvent): { x: number; y: number } | null => {
  if (!svgRef.value) return null
  const rect = svgRef.value.getBoundingClientRect()
  const x = ((evt.clientX - rect.left) / rect.width) * W.value
  const y = ((evt.clientY - rect.top) / rect.height) * H.value
  return { x, y }
}

const onPointerDown = (evt: MouseEvent) => {
  const pt = getSvgPoint(evt)
  if (!pt) return
  if (tool.value === 'trendline') {
    draft.value = { x1: pt.x, y1: pt.y, x2: pt.x, y2: pt.y }
  } else if (tool.value === 'level') {
    const price = yToPrice(pt.y)
    store.addAnnotation({ asset_id: props.assetId, kind: 'level', price_a: price, label: price.toFixed(2), color: '#00aaff' })
    emit('annotation-added'); tool.value = 'pointer'
  } else if (tool.value === 'trigger_above') {
    const price = yToPrice(pt.y)
    store.addTrigger({ asset_id: props.assetId, kind: 'cross_above', target_price: price, current_price_at_creation: currentPrice.value, note: `Notify ↑ ${price.toFixed(2)}` })
    emit('trigger-added'); tool.value = 'pointer'
  } else if (tool.value === 'trigger_below') {
    const price = yToPrice(pt.y)
    store.addTrigger({ asset_id: props.assetId, kind: 'cross_below', target_price: price, current_price_at_creation: currentPrice.value, note: `Notify ↓ ${price.toFixed(2)}` })
    emit('trigger-added'); tool.value = 'pointer'
  }
}

const onPointerMove = (evt: MouseEvent) => {
  const pt = getSvgPoint(evt)
  if (!pt) return
  if (pt.y >= padT && pt.y <= padT + innerH.value) {
    hoverPoint.value = { x: pt.x, y: pt.y, price: yToPrice(pt.y) }
  } else {
    hoverPoint.value = null
  }
  if (draft.value) {
    draft.value.x2 = pt.x
    draft.value.y2 = pt.y
  }
}

const onPointerUp = () => {
  if (draft.value && tool.value === 'trendline') {
    const idxA = xToIndex(draft.value.x1)
    const idxB = xToIndex(draft.value.x2)
    if (Math.hypot(draft.value.x2 - draft.value.x1, draft.value.y2 - draft.value.y1) > 6) {
      store.addAnnotation({
        asset_id: props.assetId,
        kind: 'trendline',
        time_a_idx: idxA,
        time_b_idx: idxB,
        price_a: yToPrice(draft.value.y1),
        price_b: yToPrice(draft.value.y2),
        color: '#00ff88'
      })
      emit('annotation-added')
    }
  }
  draft.value = null
  tool.value = 'pointer'
}

const onPointerLeave = () => {
  draft.value = null
  hoverPoint.value = null
}

const onKeyUp = (e: KeyboardEvent) => {
  if (e.key === 'Escape') { draft.value = null; tool.value = 'pointer' }
  if (e.key === 't' || e.key === 'T') tool.value = 'trendline'
  if (e.key === 'h' || e.key === 'H') tool.value = 'level'
}

// ─── Lifecycle ────────────────────────────────────────────────────────
onMounted(() => {
  if (!store.hydrated) store.hydrateFromStorage()
  window.addEventListener('keyup', onKeyUp)

  if (wrapRef.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(entries => {
      const entry = entries[0]
      if (entry) {
        const w = Math.round(entry.contentRect.width)
        if (w > 0) W.value = w
      }
    })
    resizeObserver.observe(wrapRef.value)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('keyup', onKeyUp)
  resizeObserver?.disconnect()
})

const annotations = computed(() => store.annotationsByAsset(props.assetId))
const triggers = computed(() => store.triggersByAsset(props.assetId))

defineExpose({ currentPrice, tool, frame })
</script>

<template>
  <div class="chart-shell" ref="wrapRef">
    <div class="toolbar" role="toolbar" aria-label="Chart tools">
      <div class="frames" role="group">
        <button v-for="f in (['1H','4H','1D','1W'] as Frame[])" :key="f" :class="{ active: frame === f }" @click="frame = f">{{ f }}</button>
      </div>
      <div class="divider" />
      <div class="tools">
        <button :class="{ active: tool === 'pointer' }" @click="tool = 'pointer'" title="Pointer (ESC)">▾</button>
        <button :class="{ active: tool === 'trendline' }" @click="tool = 'trendline'" title="Trendline (T)">╱</button>
        <button :class="{ active: tool === 'level' }" @click="tool = 'level'" title="Horizontal level (H)">═</button>
        <button :class="{ active: tool === 'trigger_above' }" @click="tool = 'trigger_above'" title="Alert above">↑</button>
        <button :class="{ active: tool === 'trigger_below' }" @click="tool = 'trigger_below'" title="Alert below">↓</button>
      </div>
      <span class="hint" v-if="tool !== 'pointer'">Click to place</span>
    </div>

    <svg
      ref="svgRef"
      :viewBox="`0 0 ${W} ${H}`"
      :width="W"
      :height="H"
      class="chart-svg"
      :class="`tool-${tool}`"
      preserveAspectRatio="none"
      @mousedown="onPointerDown"
      @mousemove="onPointerMove"
      @mouseup="onPointerUp"
      @mouseleave="onPointerLeave"
    >
      <!-- Grid -->
      <g class="grid">
        <line v-for="(t, i) in yTicks" :key="i" :x1="padL" :y1="t.y" :x2="W - padR" :y2="t.y" />
        <text v-for="(t, i) in yTicks" :key="`yt${i}`" :x="padL - 6" :y="t.y + 3" text-anchor="end">{{ t.p.toFixed(2) }}</text>
        <text v-for="(t, i) in xTicks" :key="`xt${i}`" :x="t.x" :y="H - 6" text-anchor="middle" class="x-tick">{{ t.label }}</text>
      </g>

      <!-- Volume bars -->
      <g class="volume">
        <rect
          v-for="(cv, i) in candleViews" :key="`v${i}`"
          :x="cv.bodyX" :y="cv.volY" :width="bodyW" :height="cv.volH"
          :class="cv.bullish ? 'up' : 'down'"
        />
      </g>

      <!-- Candles -->
      <g v-for="(cv, i) in candleViews" :key="i" :class="['candle', cv.bullish ? 'up' : 'down']">
        <line :x1="cv.cx" :y1="cv.yH" :x2="cv.cx" :y2="cv.yL" stroke="currentColor" stroke-width="1" />
        <rect :x="cv.bodyX" :y="cv.bodyY" :width="bodyW" :height="cv.bodyH" fill="currentColor" rx="0.5" />
      </g>

      <!-- Annotations -->
      <g v-for="a in annotations" :key="a.id">
        <line
          v-if="a.kind === 'trendline' && a.time_a_idx !== undefined && a.time_b_idx !== undefined && a.price_a !== undefined && a.price_b !== undefined"
          :x1="indexToX(a.time_a_idx)" :y1="priceToY(a.price_a)"
          :x2="indexToX(a.time_b_idx)" :y2="priceToY(a.price_b)"
          :stroke="a.color || '#00ff88'" stroke-width="1.4"
        />
        <g v-else-if="a.kind === 'level' && a.price_a !== undefined">
          <line
            :x1="padL" :y1="priceToY(a.price_a)" :x2="W - padR" :y2="priceToY(a.price_a)"
            :stroke="a.color || '#00aaff'" stroke-width="1" stroke-dasharray="4 4"
          />
          <text :x="W - padR - 4" :y="priceToY(a.price_a) - 3" text-anchor="end" class="anno-label" :fill="a.color || '#00aaff'">{{ a.label }}</text>
        </g>
      </g>

      <!-- Triggers -->
      <g v-for="t in triggers" :key="t.id" :class="['trigger', t.status]">
        <line
          :x1="padL" :y1="priceToY(t.target_price)" :x2="W - padR" :y2="priceToY(t.target_price)"
          stroke="#ffaa00" stroke-width="1" stroke-dasharray="6 3" stroke-opacity="0.85"
        />
        <text :x="padL + 4" :y="priceToY(t.target_price) - 3" class="trig-label">
          {{ t.kind === 'cross_above' ? '↑' : '↓' }} {{ t.target_price.toFixed(2) }}
        </text>
      </g>

      <!-- Draft line -->
      <line
        v-if="draft && tool === 'trendline'"
        :x1="draft.x1" :y1="draft.y1" :x2="draft.x2" :y2="draft.y2"
        stroke="#00ff88" stroke-width="1.4" stroke-dasharray="3 3"
      />

      <!-- Hover crosshair -->
      <g v-if="hoverPoint && tool !== 'pointer'" class="crosshair">
        <line :x1="padL" :y1="hoverPoint.y" :x2="W - padR" :y2="hoverPoint.y" />
        <line :x1="hoverPoint.x" :y1="padT" :x2="hoverPoint.x" :y2="padT + innerH" />
        <rect :x="W - padR - 42" :y="hoverPoint.y - 8" width="42" height="14" fill="rgba(255,255,255,0.85)" rx="2" />
        <text :x="W - padR - 21" :y="hoverPoint.y + 2" text-anchor="middle" font-size="9" font-weight="700" fill="#000">{{ hoverPoint.price.toFixed(2) }}</text>
      </g>

      <!-- Current price -->
      <g class="cur-price">
        <line :x1="padL" :y1="priceToY(currentPrice)" :x2="W - padR" :y2="priceToY(currentPrice)" stroke="rgba(255,255,255,0.22)" stroke-width="0.5" stroke-dasharray="2 4" />
        <rect :x="W - padR - 42" :y="priceToY(currentPrice) - 8" width="42" height="14" fill="rgba(0,170,255,0.85)" rx="2" />
        <text :x="W - padR - 21" :y="priceToY(currentPrice) + 2" text-anchor="middle" font-size="9" font-weight="700" fill="#000">{{ currentPrice.toFixed(2) }}</text>
      </g>
    </svg>
  </div>
</template>

<style scoped>
.chart-shell {
  display: flex; flex-direction: column;
  background: linear-gradient(135deg, rgba(15,15,20,0.95), rgba(10,10,14,0.95));
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: var(--app-border-radius, 8px);
  overflow: hidden;
  min-width: 0;
  width: 100%;
  box-sizing: border-box;
}

.toolbar {
  display: flex;
  gap: 0.4rem;
  align-items: center;
  padding: 0.4rem 0.55rem;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  flex-wrap: wrap;
}
.frames, .tools { display: inline-flex; gap: 0.2rem; }

.toolbar button {
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.06);
  color: rgba(255,255,255,0.7);
  font-size: 0.68rem;
  padding: 0.28rem 0.55rem;
  border-radius: 5px;
  cursor: pointer;
  font-family: inherit;
  letter-spacing: 0.04em;
  min-width: 1.9rem;
}
.toolbar button.active {
  border-color: var(--primary-green, #00ff88);
  color: var(--primary-green, #00ff88);
  background: rgba(0,255,136,0.08);
}
.frames button { font-weight: 700; }
.toolbar .divider {
  width: 1px;
  height: 1.1rem;
  background: rgba(255,255,255,0.08);
}
.toolbar .hint {
  margin-left: auto;
  font-size: 0.62rem;
  letter-spacing: 0.08em;
  color: var(--primary-green, #00ff88);
  text-transform: uppercase;
}

.chart-svg {
  display: block;
  width: 100%;
  height: auto;
  cursor: crosshair;
}
.chart-svg.tool-pointer { cursor: default; }

.grid line { stroke: rgba(255,255,255,0.04); stroke-width: 0.5; }
.grid text { fill: rgba(255,255,255,0.45); font-size: 8.5px; font-family: ui-monospace, Menlo, monospace; }
.grid .x-tick { fill: rgba(255,255,255,0.35); font-size: 8px; }

.candle.up { color: var(--success-green, #00ff88); }
.candle.down { color: #ff4d6a; }

.volume rect { opacity: 0.4; }
.volume rect.up { fill: var(--success-green, #00ff88); }
.volume rect.down { fill: #ff4d6a; }

.crosshair line { stroke: rgba(255,255,255,0.18); stroke-width: 0.5; stroke-dasharray: 2 2; }

.anno-label, .trig-label { font-size: 8.5px; font-weight: 700; font-family: ui-monospace, Menlo, monospace; }
.trig-label { fill: #ffaa00; }
.trigger.triggered line { stroke: var(--primary-green, #00ff88); }
.trigger.triggered .trig-label { fill: var(--primary-green, #00ff88); }

@media (max-width: 640px) {
  .toolbar { padding: 0.35rem 0.45rem; gap: 0.3rem; }
  .toolbar button { padding: 0.25rem 0.45rem; font-size: 0.65rem; }
  .toolbar .hint { display: none; }
}
</style>
