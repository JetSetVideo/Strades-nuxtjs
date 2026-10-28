<script setup lang="ts">
/**
 * Chart/Workspace — the full chart of /CandleChart.
 *
 * Panes, top to bottom: price (candles or line, indicators, drawings, alerts, calls in the future
 * zone), volume, RSI, MACD; shared time axis; price scale on the right.
 *
 * Interaction (mouse, touch, keyboard):
 *   wheel / pinch           zoom around the pointer        ← → / A D   pan
 *   drag (cursor tool)      pan                            + − / 0     zoom / reset
 *   double click            reset                          Delete      remove the selected drawing
 *   tools: trend line (drag), horizontal level (click), ruler (drag, not saved), note (click), alert (click)
 *
 * x is a candle INDEX (gaps such as weekends do not leave holes); times beyond the last candle map
 * to fractional indices of the current interval, so predictions and deadlines sit in the future zone.
 * Pure maths: utils/chartIndicators.ts (indicators, viewport, scales) and utils/assetChart.ts.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Candle, PriceKind } from '~/utils/assetChart'
import { fmtAxisPrice, niceTicks, timeTicks, fmtPct } from '~/utils/assetChart'
import {
  bollinger, ema, macd as macdOf, rsi as rsiOf, sma, vwap, clampView, zoomView, panView, visibleRange,
  priceScale, logTicks, measureSpan, type IndicatorId, type View, INDICATORS,
} from '~/utils/chartIndicators'
import type { Annotation } from '~/stores/assetAnnotations'

export interface WsCall { id: string; t: number; p: number; madeT: number; madeP: number; mine: boolean; name?: string; avatar?: string; status?: string }
export interface WsTrade { t: number; p: number; side: 'buy' | 'sell' }
export interface WsTrigger { id: string; p: number; kind: 'cross_above' | 'cross_below'; status: string }
export interface WsEvent { t: number; label: string }
export interface WsCompare { symbol: string; color: string; closes: (number | null)[] }
export type WsTool = 'cursor' | 'trend' | 'level' | 'ruler' | 'note' | 'alert'

const props = withDefaults(defineProps<{
  candles: Candle[]
  intervalMs: number
  kind?: PriceKind
  chartStyle?: 'line' | 'candle'
  log?: boolean
  percent?: boolean
  indicators?: IndicatorId[]
  tool?: WsTool
  calls?: WsCall[]
  trades?: WsTrade[]
  triggers?: WsTrigger[]
  annotations?: Annotation[]
  events?: WsEvent[]
  compare?: WsCompare[]
  /** change to reset the zoom (e.g. new asset or range) */
  resetKey?: string
  label?: string
}>(), {
  kind: 'money', chartStyle: 'candle', log: false, percent: false, indicators: () => [], tool: 'cursor',
  calls: () => [], trades: () => [], triggers: () => [], annotations: () => [], events: () => [], compare: () => [],
  resetKey: '', label: 'Price chart',
})

const emit = defineEmits<{
  hover: [i: number | null]
  draw: [a: Omit<Annotation, 'id' | 'created_at' | 'asset_id'>]
  note: [p: { t: number; price: number }]
  alert: [price: number]
  remove: [id: string]
  'tool-done': []
}>()

// ── Size ──────────────────────────────────────────────────────────────────
const root = ref<HTMLElement | null>(null)
const svgEl = ref<SVGSVGElement | null>(null)
const W = ref(800)
const H = ref(480)
let ro: ResizeObserver | null = null
onMounted(() => {
  if (!root.value) return
  const r = root.value.getBoundingClientRect()
  W.value = Math.max(280, Math.round(r.width))
  H.value = Math.max(240, Math.round(r.height))
  ro = new ResizeObserver(([e]) => {
    if (!e) return
    W.value = Math.max(280, Math.round(e.contentRect.width))
    H.value = Math.max(240, Math.round(e.contentRect.height))
  })
  ro.observe(root.value)
  svgEl.value?.addEventListener('wheel', onWheel, { passive: false })
})
onBeforeUnmount(() => { ro?.disconnect(); svgEl.value?.removeEventListener('wheel', onWheel) })

const has = (id: IndicatorId) => props.indicators.includes(id)
const hasVolume = computed(() => props.candles.some(c => (c.v ?? 0) > 0))
const showVol = computed(() => has('volume') && hasVolume.value)
const showRsi = computed(() => has('rsi14'))
const showMacd = computed(() => has('macd'))

const RIGHT = computed(() => (W.value < 480 ? 46 : 58))
const AXIS_H = 18
const panes = computed(() => {
  const subs = [showVol.value && 'vol', showRsi.value && 'rsi', showMacd.value && 'macd'].filter(Boolean) as string[]
  const subH = subs.length ? Math.min(90, Math.max(46, (H.value - AXIS_H) * 0.16)) : 0
  const priceH = H.value - AXIS_H - subs.length * (subH + 4) - 4
  let y = 4 + priceH + 4
  const out: Record<string, { top: number; height: number }> = { price: { top: 4, height: priceH } }
  for (const s of subs) { out[s] = { top: y, height: subH }; y += subH + 4 }
  return out
})
const plotW = computed(() => W.value - RIGHT.value - 6)

// ── Viewport ──────────────────────────────────────────────────────────────
const n = computed(() => props.candles.length)
const view = ref<View>({ from: 0, to: 0 })
/** future slots right of the last candle, only while the latest candle is on screen */
const FUTURE_FRAC = 0.14
function reset() {
  view.value = clampView({ from: 0, to: n.value - 1 }, n.value)
}
watch(() => [props.resetKey, n.value] as const, ([, len], old) => {
  // keep the user's zoom when only a new candle arrives
  if (old && old[0] === props.resetKey && Math.abs(len - old[1]) <= 2 && view.value.to > 0) {
    if (view.value.to >= old[1] - 1.5) view.value = clampView({ from: view.value.from + (len - old[1]), to: len - 1 }, len)
    return
  }
  reset()
}, { immediate: true })

const atEnd = computed(() => view.value.to >= n.value - 1.5)
const futureSlots = computed(() => (atEnd.value ? Math.max(2, (view.value.to - view.value.from) * FUTURE_FRAC / (1 - FUTURE_FRAC)) : 0))
const x0 = computed(() => view.value.from - 0.5)
const x1 = computed(() => view.value.to + 0.5 + futureSlots.value)
const xOf = (i: number) => ((i - x0.value) / (x1.value - x0.value)) * plotW.value
const iAt = (px: number) => x0.value + (px / plotW.value) * (x1.value - x0.value)
const slot = computed(() => plotW.value / (x1.value - x0.value))
const range = computed(() => visibleRange(view.value, n.value))

const tLast = computed(() => props.candles[n.value - 1]?.t ?? 0)
/** time → fractional index (binary search inside the data, linear past its ends) */
function idxOfTime(t: number): number {
  const c = props.candles
  if (!c.length) return 0
  if (t >= tLast.value) return n.value - 1 + (t - tLast.value) / props.intervalMs
  if (t <= c[0]!.t) return (t - c[0]!.t) / props.intervalMs
  let lo = 0
  let hi = c.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (c[mid]!.t <= t) lo = mid
    else hi = mid
  }
  return lo + (t - c[lo]!.t) / Math.max(1, c[hi]!.t - c[lo]!.t)
}
function timeOfIdx(i: number): number {
  const c = props.candles
  if (!c.length) return 0
  if (i >= n.value - 1) return tLast.value + (i - (n.value - 1)) * props.intervalMs
  if (i <= 0) return c[0]!.t + i * props.intervalMs
  const a = Math.floor(i)
  return c[a]!.t + (i - a) * (c[a + 1]!.t - c[a]!.t)
}

// ── Series ────────────────────────────────────────────────────────────────
const closes = computed(() => props.candles.map(c => c.c))
const ind = computed(() => {
  const c = closes.value
  return {
    sma20: has('sma20') ? sma(c, 20) : null,
    sma50: has('sma50') ? sma(c, 50) : null,
    ema20: has('ema20') ? ema(c, 20) : null,
    bb: has('bb20') ? bollinger(c, 20, 2) : null,
    vwap: has('vwap') && hasVolume.value ? vwap(props.candles) : null,
    rsi: showRsi.value ? rsiOf(c, 14) : null,
    macd: showMacd.value ? macdOf(c) : null,
  }
})

/** Percent mode: every price series is shown as % from the first visible close. */
const baseIdx = computed(() => Math.max(0, Math.min(n.value - 1, Math.ceil(view.value.from))))
const base = computed(() => props.candles[baseIdx.value]?.c || 1)
const tr = (p: number) => (props.percent ? (p / base.value - 1) * 100 : p)
const untr = (v: number) => (props.percent ? base.value * (1 + v / 100) : v)

const priceDomainV = computed<[number, number]>(() => {
  const [a, b] = range.value
  let lo = Infinity
  let hi = -Infinity
  const take = (v: number | null | undefined) => { if (v !== null && v !== undefined && Number.isFinite(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v) } }
  for (let i = a; i <= b; i++) {
    const c = props.candles[i]
    if (!c) continue
    take(tr(c.l)); take(tr(c.h))
    if (ind.value.bb) { take(ind.value.bb.upper[i] !== null ? tr(ind.value.bb.upper[i]!) : null); take(ind.value.bb.lower[i] !== null ? tr(ind.value.bb.lower[i]!) : null) }
    for (const cmp of props.compare) {
      const v = cmp.closes[i]
      const b0 = cmp.closes[baseIdx.value]
      if (v !== null && v !== undefined && b0) take((v / b0 - 1) * 100)
    }
  }
  if (atEnd.value) for (const call of props.calls) take(tr(call.p))
  if (!(hi > lo)) { const d = Math.abs(hi || 1) * 0.01; lo -= d; hi += d }
  const pad = (hi - lo) * 0.07
  lo -= pad
  hi += pad
  if (!props.percent) {
    if (props.kind === 'probability') { lo = Math.max(0, lo); hi = Math.min(1, hi) }
    else lo = Math.max(lo, props.log ? hi * 1e-6 : 0)
  }
  return [lo, hi]
})
const pScale = computed(() => priceScale(priceDomainV.value[0], priceDomainV.value[1], panes.value.price!.top, panes.value.price!.height, props.log && !props.percent))
const yP = (p: number) => pScale.value.y(tr(p))
const pAtY = (y: number) => untr(pScale.value.p(y))

const priceTicks = computed(() => {
  const [lo, hi] = priceDomainV.value
  const count = Math.max(3, Math.round(panes.value.price!.height / 60))
  let t = pScale.value.log ? logTicks(lo, hi, count) : niceTicks(lo, hi, count)
  // a narrow log range (e.g. 72k–90k) holds no 1-2-5 decade tick: label it with round linear values
  if (pScale.value.log && t.length < 3) t = niceTicks(lo, hi, count)
  return t.map(v => ({ v, y: pScale.value.y(v), label: props.percent ? `${v >= 0 ? '+' : ''}${v.toFixed(Math.abs(hi - lo) < 5 ? 1 : 0)}%` : fmtAxisPrice(v, props.kind) }))
})
const tTicks = computed(() => {
  const ta = timeOfIdx(x0.value + 0.5)
  const tb = timeOfIdx(x1.value - 0.5)
  return timeTicks(ta, tb, Math.max(2, Math.floor(plotW.value / 110))).map(k => ({ ...k, x: xOf(idxOfTime(k.t)) })).filter(k => k.x > 8 && k.x < plotW.value - 8)
})

function poly(series: (number | null)[], map: (v: number) => number = yP): string {
  const [a, b] = range.value
  let d = ''
  let pen = false
  for (let i = a; i <= b; i++) {
    const v = series[i]
    if (v === null || v === undefined || !Number.isFinite(v)) { pen = false; continue }
    d += `${pen ? 'L' : 'M'}${xOf(i).toFixed(1)},${map(v).toFixed(1)}`
    pen = true
  }
  return d
}

const bodies = computed(() => {
  const [a, b] = range.value
  const w = Math.max(1, slot.value * 0.7)
  const out: { x: number; w: number; yo: number; yc: number; yh: number; yl: number; up: boolean; sim: boolean }[] = []
  for (let i = a; i <= b; i++) {
    const c = props.candles[i]
    if (!c) continue
    out.push({ x: xOf(i), w, yo: yP(c.o), yc: yP(c.c), yh: yP(c.h), yl: yP(c.l), up: c.c >= c.o, sim: !!c.sim })
  }
  return out
})
const linePath = computed(() => poly(closes.value))
/** Bollinger band area: upper edge left → right, lower edge right → left. */
const bbFill = computed(() => {
  const bb = ind.value.bb
  if (!bb) return ''
  const [a, b] = range.value
  const up: string[] = []
  const lo: string[] = []
  for (let i = a; i <= b; i++) {
    if (bb.upper[i] === null || bb.lower[i] === null) continue
    up.push(`${xOf(i).toFixed(1)},${yP(bb.upper[i]!).toFixed(1)}`)
    lo.unshift(`${xOf(i).toFixed(1)},${yP(bb.lower[i]!).toFixed(1)}`)
  }
  return up.length > 1 ? `M${up.join('L')}L${lo.join('L')}Z` : ''
})
const areaPath = computed(() => {
  const d = linePath.value
  if (!d) return ''
  const [a, b] = range.value
  const yb = panes.value.price!.top + panes.value.price!.height
  return `${d}L${xOf(Math.min(b, n.value - 1)).toFixed(1)},${yb}L${xOf(a).toFixed(1)},${yb}Z`
})
const trendUp = computed(() => {
  const [a, b] = range.value
  return (props.candles[Math.min(b, n.value - 1)]?.c ?? 0) >= (props.candles[a]?.c ?? 0)
})
const simUntil = computed(() => {
  const k = props.candles.findIndex(c => !c.sim)
  return k === -1 ? (n.value ? n.value - 1 : -1) : k - 1
})

// Volume pane
const volBars = computed(() => {
  const p = panes.value.vol
  if (!p) return []
  const [a, b] = range.value
  let max = 0
  for (let i = a; i <= b; i++) max = Math.max(max, props.candles[i]?.v ?? 0)
  const w = Math.max(1, slot.value * 0.7)
  return props.candles.slice(a, b + 1).map((c, k) => {
    const h = max ? ((c.v ?? 0) / max) * (p.height - 2) : 0
    return { x: xOf(a + k) - w / 2, y: p.top + p.height - h, w, h, up: c.c >= c.o }
  })
})

// RSI / MACD panes
const rsiY = (v: number) => panes.value.rsi!.top + (1 - v / 100) * panes.value.rsi!.height
const macdDomain = computed<[number, number]>(() => {
  const m = ind.value.macd
  if (!m) return [-1, 1]
  const [a, b] = range.value
  let mx = 1e-12
  for (let i = a; i <= b; i++) for (const v of [m.line[i], m.signal[i], m.hist[i]]) if (v !== null && v !== undefined) mx = Math.max(mx, Math.abs(v))
  return [-mx * 1.1, mx * 1.1]
})
const macdY = (v: number) => { const p = panes.value.macd!; const [lo, hi] = macdDomain.value; return p.top + (1 - (v - lo) / (hi - lo)) * p.height }
const macdBars = computed(() => {
  const m = ind.value.macd
  if (!m || !panes.value.macd) return []
  const [a, b] = range.value
  const w = Math.max(1, slot.value * 0.6)
  const out: { x: number; y: number; h: number; w: number; up: boolean }[] = []
  for (let i = a; i <= b; i++) {
    const v = m.hist[i]
    if (v === null || v === undefined) continue
    const y0 = macdY(0)
    const y1 = macdY(v)
    out.push({ x: xOf(i) - w / 2, y: Math.min(y0, y1), h: Math.max(0.5, Math.abs(y1 - y0)), w, up: v >= 0 })
  }
  return out
})

// ── Overlays ──────────────────────────────────────────────────────────────
const nowX = computed(() => (atEnd.value ? xOf(n.value - 1 + 0.5) : null))
const callMarks = computed(() => props.calls.map(c => ({
  ...c, x: xOf(idxOfTime(c.t)), y: yP(c.p), x0: xOf(idxOfTime(c.madeT)), y0: yP(c.madeP), up: c.p >= c.madeP,
})).filter(c => c.x >= -10 && c.x <= plotW.value + 10))
const tradeMarks = computed(() => props.trades.map(t => ({ ...t, x: xOf(idxOfTime(t.t)), y: yP(t.p) })).filter(t => t.x >= 0 && t.x <= plotW.value))
const triggerLines = computed(() => props.triggers.map(t => ({ ...t, y: yP(t.p) })).filter(t => t.y >= panes.value.price!.top && t.y <= panes.value.price!.top + panes.value.price!.height))
const eventMarks = computed(() => props.events.map(e => ({ ...e, x: xOf(idxOfTime(e.t)) })).filter(e => e.x >= 0 && e.x <= plotW.value))

const selected = ref<string | null>(null)
const drawings = computed(() => props.annotations.map((a) => {
  if (a.kind === 'level' && a.price_a !== undefined) return { id: a.id, kind: 'level' as const, y: yP(a.price_a), price: a.price_a, color: a.color, label: a.label }
  if (a.kind === 'trendline' && a.price_a !== undefined && a.price_b !== undefined && a.ts_a !== undefined && a.ts_b !== undefined) {
    return { id: a.id, kind: 'trend' as const, x1: xOf(idxOfTime(a.ts_a)), y1: yP(a.price_a), x2: xOf(idxOfTime(a.ts_b)), y2: yP(a.price_b), color: a.color, label: a.label }
  }
  if (a.kind === 'note' && a.price_a !== undefined && a.ts_a !== undefined) return { id: a.id, kind: 'note' as const, x: xOf(idxOfTime(a.ts_a)), y: yP(a.price_a), label: a.label ?? '' }
  return null
}).filter(Boolean) as any[])

// ── Pointer handling ──────────────────────────────────────────────────────
const hoverI = ref<number | null>(null)
const hoverY = ref<number | null>(null)
const draft = ref<{ kind: 'trend' | 'ruler'; a: { t: number; p: number }; b: { t: number; p: number } } | null>(null)
const pointers = new Map<number, { x: number; y: number }>()
let panStart: { x: number; view: View } | null = null
let pinchStart: { d: number; view: View; mid: number } | null = null

function local(e: PointerEvent | WheelEvent | MouseEvent) {
  const r = svgEl.value!.getBoundingClientRect()
  return { x: e.clientX - r.left, y: e.clientY - r.top }
}
const inPrice = (y: number) => y >= panes.value.price!.top && y <= panes.value.price!.top + panes.value.price!.height

function onDown(e: PointerEvent) {
  const pt = local(e)
  if (pt.x > plotW.value) return
  svgEl.value?.setPointerCapture(e.pointerId)
  pointers.set(e.pointerId, pt)
  // touch has no hover: a tap shows that candle in the legend and the crosshair
  if (e.pointerType !== 'mouse') {
    const i = Math.round(iAt(pt.x))
    hoverI.value = i >= 0 && i < n.value ? i : null
    hoverY.value = pt.y
    emit('hover', hoverI.value)
  }
  if (pointers.size === 2) {
    const [p1, p2] = [...pointers.values()]
    pinchStart = { d: Math.hypot(p1!.x - p2!.x, p1!.y - p2!.y), view: { ...view.value }, mid: (p1!.x + p2!.x) / 2 }
    panStart = null
    draft.value = null
    return
  }
  const t = timeOfIdx(iAt(pt.x))
  const price = pAtY(pt.y)
  if (props.tool === 'cursor' || !inPrice(pt.y)) {
    selected.value = null
    panStart = { x: pt.x, view: { ...view.value } }
    return
  }
  if (props.tool === 'trend' || props.tool === 'ruler') draft.value = { kind: props.tool, a: { t, p: price }, b: { t, p: price } }
}

function onMove(e: PointerEvent) {
  const pt = local(e)
  if (pointers.has(e.pointerId)) pointers.set(e.pointerId, pt)
  if (pinchStart && pointers.size === 2) {
    const [p1, p2] = [...pointers.values()]
    const d = Math.hypot(p1!.x - p2!.x, p1!.y - p2!.y)
    if (d > 10) view.value = zoomView(pinchStart.view, pinchStart.d / d, pinchStart.mid / plotW.value, n.value)
    return
  }
  if (panStart) {
    const dx = pt.x - panStart.x
    view.value = panView(panStart.view, dx / slot.value, n.value)
  }
  if (draft.value) draft.value = { ...draft.value, b: { t: timeOfIdx(iAt(pt.x)), p: pAtY(pt.y) } }
  if (pt.x <= plotW.value) {
    const i = Math.round(iAt(pt.x))
    hoverI.value = i >= 0 && i < n.value ? i : null
    hoverY.value = pt.y
  } else { hoverI.value = null; hoverY.value = null }
  emit('hover', hoverI.value)
}

function onUp(e: PointerEvent) {
  const pt = local(e)
  pointers.delete(e.pointerId)
  if (pointers.size < 2) pinchStart = null
  const moved = panStart ? Math.abs(pt.x - panStart.x) > 4 : false
  panStart = null
  if (draft.value) {
    const d = draft.value
    draft.value = null
    if (d.kind === 'trend' && Math.abs(xOf(idxOfTime(d.b.t)) - xOf(idxOfTime(d.a.t))) > 6) {
      emit('draw', { kind: 'trendline', price_a: d.a.p, price_b: d.b.p, ts_a: d.a.t, ts_b: d.b.t, color: 'var(--primary-blue, #00aaff)' })
      emit('tool-done')
    }
    if (d.kind === 'ruler') rulerResult.value = d
    return
  }
  if (moved || !inPrice(pt.y) || pt.x > plotW.value) return
  const price = pAtY(pt.y)
  const t = timeOfIdx(iAt(pt.x))
  if (props.tool === 'level') { emit('draw', { kind: 'level', price_a: price, color: 'var(--warning-orange, #ffa500)' }); emit('tool-done') }
  if (props.tool === 'note') { emit('note', { t, price }); emit('tool-done') }
  if (props.tool === 'alert') { emit('alert', price); emit('tool-done') }
}
function onLeave() { if (!panStart && !draft.value) { hoverI.value = null; hoverY.value = null; emit('hover', null) } }

/** A drawing is selectable with the cursor tool only; with any other tool the click goes through
 *  to the chart (a level spans the whole width, it must not block drawing a trend line over it). */
function onDrawingDown(e: PointerEvent, id: string) {
  if (props.tool !== 'cursor') return
  e.stopPropagation()
  selected.value = id
  svgEl.value?.focus()
}

const rulerResult = ref<{ a: { t: number; p: number }; b: { t: number; p: number } } | null>(null)
watch(() => props.tool, () => { rulerResult.value = null })
const ruler = computed(() => {
  const r = draft.value?.kind === 'ruler' ? draft.value : rulerResult.value
  if (!r) return null
  const m = measureSpan(r.a, r.b, props.intervalMs)
  return { x1: xOf(idxOfTime(r.a.t)), y1: yP(r.a.p), x2: xOf(idxOfTime(r.b.t)), y2: yP(r.b.p), ...m }
})

function onWheel(e: WheelEvent) {
  const pt = local(e)
  if (pt.x > plotW.value) return
  e.preventDefault()
  const factor = Math.exp(Math.sign(e.deltaY) * Math.min(0.25, Math.abs(e.deltaY) / 400))
  view.value = zoomView(view.value, factor, pt.x / plotW.value, n.value)
}

function onKey(e: KeyboardEvent) {
  const span = view.value.to - view.value.from
  const k = e.key
  if (k === 'ArrowLeft' || k === 'a') view.value = panView(view.value, span * 0.1, n.value)
  else if (k === 'ArrowRight' || k === 'd') view.value = panView(view.value, -span * 0.1, n.value)
  else if (k === '+' || k === '=') view.value = zoomView(view.value, 0.8, 1, n.value)
  else if (k === '-' || k === '_') view.value = zoomView(view.value, 1.25, 1, n.value)
  else if (k === '0' || k === 'Home') reset()
  else if ((k === 'Delete' || k === 'Backspace') && selected.value) { emit('remove', selected.value); selected.value = null }
  else if (k === 'Escape') { selected.value = null; draft.value = null; rulerResult.value = null }
  else return
  e.preventDefault()
}

defineExpose({ reset, zoomIn: () => { view.value = zoomView(view.value, 0.8, 1, n.value) }, zoomOut: () => { view.value = zoomView(view.value, 1.25, 1, n.value) }, svg: svgEl })

// ── Legend (OHLCV + indicator values at the crosshair, else the last candle) ──
const legendI = computed(() => hoverI.value ?? n.value - 1)
const legend = computed(() => {
  const i = legendI.value
  const c = props.candles[i]
  if (!c) return null
  const prev = props.candles[i - 1]
  const chg = prev ? (c.c / prev.c - 1) * 100 : 0
  const f = (v: number) => fmtAxisPrice(v, props.kind)
  const vals: { label: string; value: string; color: string }[] = []
  const add = (id: IndicatorId, v: number | null | undefined, fmt = f) => { if (v !== null && v !== undefined) vals.push({ label: INDICATORS.find(x => x.id === id)!.label, value: fmt(v), color: INDICATORS.find(x => x.id === id)!.color }) }
  add('sma20', ind.value.sma20?.[i]); add('sma50', ind.value.sma50?.[i]); add('ema20', ind.value.ema20?.[i])
  add('vwap', ind.value.vwap?.[i]); add('rsi14', ind.value.rsi?.[i], v => v.toFixed(1))
  if (ind.value.macd) add('macd', ind.value.macd.hist[i], v => v.toPrecision(3))
  return {
    date: new Date(c.t).toLocaleString(undefined, { day: 'numeric', month: 'short', year: '2-digit', hour: props.intervalMs < 86_400_000 ? '2-digit' : undefined, minute: props.intervalMs < 86_400_000 ? '2-digit' : undefined }),
    o: f(c.o), h: f(c.h), l: f(c.l), c: f(c.c), chg, up: c.c >= c.o, v: c.v ? (c.v >= 1e6 ? `${(c.v / 1e6).toFixed(2)}M` : c.v >= 1e3 ? `${(c.v / 1e3).toFixed(1)}k` : c.v.toFixed(0)) : null, sim: !!c.sim, vals,
  }
})
const crossX = computed(() => (hoverI.value !== null ? xOf(hoverI.value) : null))
const crossPrice = computed(() => (hoverY.value !== null && inPrice(hoverY.value) ? pAtY(hoverY.value) : null))
const crossTime = computed(() => (hoverI.value !== null ? props.candles[hoverI.value]?.t ?? null : null))

const aria = computed(() => {
  const a = props.candles[range.value[0]]
  const b = props.candles[Math.min(range.value[1], n.value - 1)]
  if (!a || !b) return props.label
  return `${props.label}: ${fmtAxisPrice(a.c, props.kind)} to ${fmtAxisPrice(b.c, props.kind)} (${fmtPct((b.c / a.c - 1) * 100)}) over ${range.value[1] - range.value[0] + 1} candles`
})
const cursor = computed(() => (props.tool === 'cursor' ? (panStart ? 'grabbing' : 'crosshair') : 'copy'))
</script>

<template>
  <div ref="root" class="ws">
    <svg
      ref="svgEl" class="ws-svg" :width="W" :height="H" :viewBox="`0 0 ${W} ${H}`"
      role="img" :aria-label="aria" tabindex="0" :style="{ cursor }"
      @pointerdown="onDown" @pointermove="onMove" @pointerup="onUp" @pointercancel="onUp" @pointerleave="onLeave"
      @dblclick="reset" @keydown="onKey"
    >
      <defs>
        <clipPath id="ws-clip-price"><rect x="0" :y="panes.price!.top" :width="plotW" :height="panes.price!.height" /></clipPath>
        <linearGradient id="ws-area" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" :stop-color="trendUp ? 'var(--app-color-up, #00ff88)' : 'var(--app-color-down, #ff4444)'" stop-opacity="0.22" />
          <stop offset="100%" :stop-color="trendUp ? 'var(--app-color-up, #00ff88)' : 'var(--app-color-down, #ff4444)'" stop-opacity="0" />
        </linearGradient>
      </defs>

      <!-- grid + axes -->
      <g class="ws-grid">
        <line v-for="t in priceTicks" :key="'gy' + t.v" x1="0" :x2="plotW" :y1="t.y" :y2="t.y" />
        <line v-for="t in tTicks" :key="'gx' + t.t" :x1="t.x" :x2="t.x" :y1="panes.price!.top" :y2="H - AXIS_H" />
      </g>
      <rect v-if="nowX !== null" class="ws-future" :x="nowX" :y="panes.price!.top" :width="Math.max(0, plotW - nowX)" :height="panes.price!.height" />
      <rect v-if="simUntil >= range[0]" class="ws-sim" :x="0" :y="panes.price!.top" :width="Math.max(0, Math.min(plotW, xOf(simUntil + 0.5)))" :height="panes.price!.height" />

      <g clip-path="url(#ws-clip-price)">
        <!-- Bollinger -->
        <template v-if="ind.bb">
          <path class="ws-bb-fill" :d="bbFill" />
          <path :d="poly(ind.bb.upper)" class="ws-ind dashed" stroke="var(--text-light-gray, #ccc)" />
          <path :d="poly(ind.bb.lower)" class="ws-ind dashed" stroke="var(--text-light-gray, #ccc)" />
          <path :d="poly(ind.bb.mid)" class="ws-ind" stroke="var(--text-light-gray, #ccc)" stroke-opacity="0.5" />
        </template>

        <!-- price -->
        <template v-if="chartStyle === 'line'">
          <path v-if="!percent" :d="areaPath" fill="url(#ws-area)" />
          <path :d="linePath" class="ws-line" :class="trendUp ? 'up' : 'down'" />
        </template>
        <g v-else>
          <g v-for="(b, k) in bodies" :key="'c' + k" :class="['ws-candle', b.up ? 'up' : 'down', { sim: b.sim }]">
            <line :x1="b.x" :x2="b.x" :y1="b.yh" :y2="b.yl" />
            <rect :x="b.x - b.w / 2" :y="Math.min(b.yo, b.yc)" :width="b.w" :height="Math.max(1, Math.abs(b.yc - b.yo))" />
          </g>
        </g>

        <!-- comparison (percent mode) -->
        <path v-for="cmp in compare" :key="'cmp' + cmp.symbol" class="ws-ind" :stroke="cmp.color" stroke-width="1.6"
          :d="poly(cmp.closes.map(v => (v === null || !cmp.closes[baseIdx] ? null : (v / cmp.closes[baseIdx]! - 1) * 100)), v => pScale.y(v))" />

        <!-- moving averages -->
        <path v-if="ind.sma20" :d="poly(ind.sma20)" class="ws-ind" stroke="var(--warning-orange, #ffa500)" />
        <path v-if="ind.sma50" :d="poly(ind.sma50)" class="ws-ind" stroke="var(--domain-agent, #b388ff)" />
        <path v-if="ind.ema20" :d="poly(ind.ema20)" class="ws-ind" stroke="var(--primary-blue, #00aaff)" />
        <path v-if="ind.vwap" :d="poly(ind.vwap)" class="ws-ind dashed" stroke="var(--domain-social, #ff7eb6)" />

        <!-- market events -->
        <g v-for="(e, k) in eventMarks" :key="'ev' + k" class="ws-event">
          <line :x1="e.x" :x2="e.x" :y1="panes.price!.top" :y2="panes.price!.top + panes.price!.height" />
          <rect :x="e.x - 3" :y="panes.price!.top + 2" width="6" height="6"><title>{{ e.label }}</title></rect>
        </g>

        <!-- alerts -->
        <g v-for="t in triggerLines" :key="t.id" class="ws-trigger" :class="t.status">
          <line x1="0" :x2="plotW" :y1="t.y" :y2="t.y" />
          <text x="4" :y="t.y - 3">⚑ {{ t.kind === 'cross_above' ? 'above' : 'below' }} {{ fmtAxisPrice(t.p, kind) }}{{ t.status === 'triggered' ? ' · fired' : '' }}</text>
        </g>

        <!-- drawings -->
        <g v-for="d in drawings" :key="d.id" class="ws-draw" :class="{ sel: selected === d.id }" @pointerdown="onDrawingDown($event, d.id)">
          <template v-if="d.kind === 'level'">
            <line x1="0" :x2="plotW" :y1="d.y" :y2="d.y" :stroke="d.color" />
            <line x1="0" :x2="plotW" :y1="d.y" :y2="d.y" class="hit" />
          </template>
          <template v-else-if="d.kind === 'trend'">
            <line :x1="d.x1" :y1="d.y1" :x2="d.x2" :y2="d.y2" :stroke="d.color" />
            <line :x1="d.x1" :y1="d.y1" :x2="d.x2" :y2="d.y2" class="hit" />
            <circle :cx="d.x1" :cy="d.y1" r="3" /><circle :cx="d.x2" :cy="d.y2" r="3" />
          </template>
          <g v-else class="ws-note">
            <circle :cx="d.x" :cy="d.y" r="4" />
            <text :x="d.x + 7" :y="d.y + 3">{{ d.label.length > 28 ? d.label.slice(0, 27) + '…' : d.label }}</text>
          </g>
          <title>{{ d.kind === 'level' ? `Level ${fmtAxisPrice(d.price, kind)}` : d.label || d.kind }} — select, then Delete to remove</title>
        </g>
        <line v-if="draft && draft.kind === 'trend'" class="ws-draft" :x1="xOf(idxOfTime(draft.a.t))" :y1="yP(draft.a.p)" :x2="xOf(idxOfTime(draft.b.t))" :y2="yP(draft.b.p)" />

        <!-- paper trades -->
        <g v-for="(t, k) in tradeMarks" :key="'tr' + k" class="ws-trade" :class="t.side">
          <path :d="t.side === 'buy' ? `M${t.x},${t.y + 4} l-5,8 h10 z` : `M${t.x},${t.y - 4} l-5,-8 h10 z`"><title>Paper {{ t.side }} at {{ fmtAxisPrice(t.p, kind) }}</title></path>
        </g>

        <!-- calls: from where they were made to their target -->
        <g v-for="c in callMarks" :key="c.id" class="ws-call" :class="[c.up ? 'up' : 'down', { friend: !c.mine }]">
          <line :x1="c.x0" :y1="c.y0" :x2="c.x" :y2="c.y" />
          <circle :cx="c.x" :cy="c.y" :r="c.mine ? 5 : 4" />
          <title>{{ c.mine ? 'Your call' : `${c.name}'s call` }}: {{ fmtAxisPrice(c.p, kind) }} by {{ new Date(c.t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) }}{{ c.status && c.status !== 'pending' ? ` (${c.status})` : '' }}</title>
        </g>

        <!-- ruler -->
        <g v-if="ruler" class="ws-ruler" :class="ruler.pct >= 0 ? 'up' : 'down'">
          <rect :x="Math.min(ruler.x1, ruler.x2)" :y="Math.min(ruler.y1, ruler.y2)" :width="Math.abs(ruler.x2 - ruler.x1)" :height="Math.abs(ruler.y2 - ruler.y1)" />
          <line :x1="ruler.x1" :y1="ruler.y1" :x2="ruler.x2" :y2="ruler.y2" />
          <text :x="ruler.x2 + 6" :y="ruler.y2 - 6">{{ fmtPct(ruler.pct, 2) }} · {{ fmtAxisPrice(ruler.abs, kind) }} · {{ ruler.candles }} candles</text>
        </g>
      </g>
      <line v-if="nowX !== null" class="ws-now" :x1="nowX" :x2="nowX" :y1="panes.price!.top" :y2="panes.price!.top + panes.price!.height" />

      <!-- volume -->
      <g v-if="panes.vol" class="ws-vol">
        <rect v-for="(b, k) in volBars" :key="'v' + k" :x="b.x" :y="b.y" :width="b.w" :height="b.h" :class="b.up ? 'up' : 'down'" />
        <text x="4" :y="panes.vol.top + 10" class="ws-pane-label">Volume</text>
      </g>

      <!-- RSI -->
      <g v-if="panes.rsi && ind.rsi" class="ws-rsi">
        <rect x="0" :y="rsiY(70)" :width="plotW" :height="rsiY(30) - rsiY(70)" class="ws-band" />
        <line x1="0" :x2="plotW" :y1="rsiY(70)" :y2="rsiY(70)" class="ws-guide" />
        <line x1="0" :x2="plotW" :y1="rsiY(30)" :y2="rsiY(30)" class="ws-guide" />
        <path :d="poly(ind.rsi, rsiY)" class="ws-ind" stroke="var(--warning-orange, #ffa500)" />
        <text x="4" :y="panes.rsi.top + 10" class="ws-pane-label">RSI 14</text>
        <text :x="plotW + 6" :y="rsiY(70) + 3" class="ws-axis">70</text>
        <text :x="plotW + 6" :y="rsiY(30) + 3" class="ws-axis">30</text>
      </g>

      <!-- MACD -->
      <g v-if="panes.macd && ind.macd" class="ws-macd">
        <line x1="0" :x2="plotW" :y1="macdY(0)" :y2="macdY(0)" class="ws-guide" />
        <rect v-for="(b, k) in macdBars" :key="'m' + k" :x="b.x" :y="b.y" :width="b.w" :height="b.h" :class="b.up ? 'up' : 'down'" />
        <path :d="poly(ind.macd.line, macdY)" class="ws-ind" stroke="var(--primary-blue, #00aaff)" />
        <path :d="poly(ind.macd.signal, macdY)" class="ws-ind" stroke="var(--warning-orange, #ffa500)" />
        <text x="4" :y="panes.macd.top + 10" class="ws-pane-label">MACD 12·26·9</text>
      </g>

      <!-- price axis -->
      <rect class="ws-axis-bg" :x="plotW" y="0" :width="W - plotW" :height="H" />
      <text v-for="t in priceTicks" :key="'ty' + t.v" :x="plotW + 6" :y="t.y + 3.5" class="ws-axis">{{ t.label }}</text>
      <g v-if="candles.length" class="ws-last" :class="candles[n - 1]!.c >= candles[n - 1]!.o ? 'up' : 'down'">
        <rect :x="plotW + 1" :y="yP(candles[n - 1]!.c) - 8" :width="W - plotW - 2" height="16" rx="3" />
        <text :x="plotW + 6" :y="yP(candles[n - 1]!.c) + 4">{{ percent ? `${tr(candles[n - 1]!.c) >= 0 ? '+' : ''}${tr(candles[n - 1]!.c).toFixed(2)}%` : fmtAxisPrice(candles[n - 1]!.c, kind) }}</text>
      </g>
      <!-- time axis -->
      <text v-for="t in tTicks" :key="'tx' + t.t" :x="t.x" :y="H - 5" text-anchor="middle" class="ws-axis">{{ t.label }}</text>

      <!-- crosshair -->
      <g v-if="crossX !== null" class="ws-cross" pointer-events="none">
        <line :x1="crossX" :x2="crossX" :y1="panes.price!.top" :y2="H - AXIS_H" />
        <line v-if="hoverY !== null" x1="0" :x2="plotW" :y1="hoverY" :y2="hoverY" />
        <g v-if="crossPrice !== null && hoverY !== null">
          <rect :x="plotW + 1" :y="hoverY - 8" :width="W - plotW - 2" height="16" rx="3" />
          <text :x="plotW + 6" :y="hoverY + 4">{{ percent ? `${tr(crossPrice) >= 0 ? '+' : ''}${tr(crossPrice).toFixed(2)}%` : fmtAxisPrice(crossPrice, kind) }}</text>
        </g>
        <g v-if="crossTime !== null">
          <rect :x="Math.min(Math.max(0, crossX - 52), plotW - 104)" :y="H - AXIS_H" width="104" :height="AXIS_H" rx="3" />
          <text :x="Math.min(Math.max(52, crossX), plotW - 52)" :y="H - 5" text-anchor="middle">{{ new Date(crossTime).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) }}</text>
        </g>
      </g>
    </svg>

    <!-- OHLCV legend (HTML, so it wraps and stays readable) -->
    <div v-if="legend" class="ws-legend" aria-live="off">
      <span class="lg-date">{{ legend.date }}<i v-if="legend.sim" class="lg-sim">sim</i></span>
      <span>O <b>{{ legend.o }}</b></span><span>H <b>{{ legend.h }}</b></span><span>L <b>{{ legend.l }}</b></span>
      <span>C <b :class="legend.up ? 'up' : 'down'">{{ legend.c }}</b></span>
      <span :class="legend.chg >= 0 ? 'up' : 'down'">{{ fmtPct(legend.chg, 2) }}</span>
      <span v-if="legend.v">V <b>{{ legend.v }}</b></span>
      <span v-for="v in legend.vals" :key="v.label" class="lg-ind"><i :style="{ background: v.color }" />{{ v.label }} <b>{{ v.value }}</b></span>
    </div>
  </div>
</template>

<style scoped>
.ws { position: relative; width: 100%; height: 100%; min-height: 240px; }
.ws-svg { display: block; touch-action: none; user-select: none; font-family: var(--font-market-data, ui-monospace, monospace); outline: none; }
.ws-svg:focus-visible { outline: 2px solid var(--primary-blue, #00aaff); outline-offset: 2px; border-radius: 6px; }
.ws-grid line { stroke: rgba(255,255,255,.05); }
.ws-future { fill: rgba(0,170,255,.035); }
.ws-sim { fill: rgba(255,255,255,.025); }
.ws-now { stroke: rgba(255,255,255,.28); stroke-dasharray: 3 3; }
.ws-axis-bg { fill: transparent; }
.ws-axis { fill: var(--text-gray, #888); font-size: 10px; font-variant-numeric: tabular-nums; }
.ws-pane-label { fill: var(--text-gray, #888); font-size: 9px; letter-spacing: .05em; text-transform: uppercase; font-family: var(--font-chrome, sans-serif); }
.ws-line { fill: none; stroke-width: 1.8; stroke-linejoin: round; }
.ws-line.up { stroke: var(--app-color-up, #00ff88); }
.ws-line.down { stroke: var(--app-color-down, #ff4444); }
.ws-candle line { stroke-width: 1; }
.ws-candle.up line, .ws-candle.up rect { stroke: var(--app-color-up, #00ff88); fill: var(--app-color-up, #00ff88); }
.ws-candle.down line, .ws-candle.down rect { stroke: var(--app-color-down, #ff4444); fill: var(--app-color-down, #ff4444); }
.ws-candle.up rect { fill-opacity: .25; }
.ws-candle.sim { opacity: .45; }
.ws-ind { fill: none; stroke-width: 1.3; }
.ws-ind.dashed { stroke-dasharray: 4 3; }
.ws-bb-fill { fill: rgba(255,255,255,.035); stroke: none; }
.ws-vol rect.up { fill: color-mix(in srgb, var(--app-color-up, #00ff88) 35%, transparent); }
.ws-vol rect.down { fill: color-mix(in srgb, var(--app-color-down, #ff4444) 35%, transparent); }
.ws-macd rect.up { fill: color-mix(in srgb, var(--app-color-up, #00ff88) 55%, transparent); }
.ws-macd rect.down { fill: color-mix(in srgb, var(--app-color-down, #ff4444) 55%, transparent); }
.ws-band { fill: rgba(255,165,0,.05); }
.ws-guide { stroke: rgba(255,255,255,.14); stroke-dasharray: 2 3; }
.ws-event line { stroke: rgba(255,255,255,.1); stroke-dasharray: 1 3; }
.ws-event rect { fill: var(--text-gray, #888); }
.ws-trigger line { stroke: var(--warning-orange, #ffa500); stroke-dasharray: 6 4; stroke-opacity: .8; }
.ws-trigger.triggered line { stroke-opacity: .35; }
.ws-trigger text { fill: var(--warning-orange, #ffa500); font-size: 9.5px; }
.ws-draw line { stroke-width: 1.6; }
.ws-draw line.hit { stroke: transparent; stroke-width: 12; cursor: pointer; }
.ws-draw circle { fill: var(--primary-blue, #00aaff); }
.ws-draw.sel line:not(.hit) { stroke-width: 2.6; filter: drop-shadow(0 0 3px rgba(0,170,255,.7)); }
.ws-note circle { fill: var(--warning-orange, #ffa500); }
.ws-note text { fill: var(--text-white, #fff); font-size: 10px; paint-order: stroke; stroke: #0b0d10; stroke-width: 3px; font-family: var(--font-chrome, sans-serif); }
.ws-draft { stroke: var(--primary-blue, #00aaff); stroke-dasharray: 4 3; stroke-width: 1.5; }
.ws-trade.buy path { fill: var(--app-color-up, #00ff88); }
.ws-trade.sell path { fill: var(--app-color-down, #ff4444); }
.ws-call line { stroke-dasharray: 3 3; stroke-width: 1.2; }
.ws-call.up line, .ws-call.up circle { stroke: var(--app-color-up, #00ff88); }
.ws-call.down line, .ws-call.down circle { stroke: var(--app-color-down, #ff4444); }
.ws-call circle { fill: #0b0d10; stroke-width: 2.2; }
.ws-call.friend line { stroke-opacity: .5; }
.ws-call.friend circle { stroke-dasharray: 2 1.5; }
.ws-ruler rect { fill: rgba(0,170,255,.07); }
.ws-ruler line { stroke-width: 1.2; stroke-dasharray: 3 2; }
.ws-ruler.up line { stroke: var(--app-color-up, #00ff88); }
.ws-ruler.down line { stroke: var(--app-color-down, #ff4444); }
.ws-ruler text { font-size: 11px; font-weight: 700; paint-order: stroke; stroke: #0b0d10; stroke-width: 3px; }
.ws-ruler.up text { fill: var(--app-color-up, #00ff88); }
.ws-ruler.down text { fill: var(--app-color-down, #ff4444); }
.ws-last rect { opacity: .9; }
.ws-last.up rect { fill: var(--app-color-up, #00ff88); }
.ws-last.down rect { fill: var(--app-color-down, #ff4444); }
.ws-last text { fill: #06110b; font-size: 10px; font-weight: 800; }
.ws-cross line { stroke: rgba(255,255,255,.35); stroke-dasharray: 3 3; }
.ws-cross rect { fill: #2a2e39; }
.ws-cross text { fill: var(--text-white, #fff); font-size: 10px; }
.ws-legend {
  position: absolute; left: 8px; top: 6px; right: 70px; display: flex; flex-wrap: wrap; gap: 2px 10px; pointer-events: none;
  font-family: var(--font-market-data, ui-monospace, monospace); font-size: .72rem; color: var(--text-light-gray, #b8bcc4); font-variant-numeric: tabular-nums;
  text-shadow: 0 0 3px #08090d, 0 0 6px #08090d;
}
.ws-legend b { color: var(--text-white, #fff); font-weight: 600; }
.ws-legend .up, .ws-legend b.up { color: var(--app-color-up, #00ff88); }
.ws-legend .down, .ws-legend b.down { color: var(--app-color-down, #ff4444); }
.lg-date { color: var(--text-light-gray, #ccc); }
.lg-sim { margin-left: 5px; padding: 0 4px; border: 1px dashed currentColor; border-radius: 6px; font-style: normal; font-size: .58rem; text-transform: uppercase; }
.lg-ind i { display: inline-block; width: 8px; height: 2px; margin-right: 4px; vertical-align: middle; }
@media (prefers-reduced-motion: reduce) { .ws-draw.sel line { filter: none; } }
</style>
