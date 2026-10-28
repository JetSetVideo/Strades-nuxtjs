/**
 * Technical indicators and chart-viewport maths for the chart workspace (/CandleChart).
 * Pure functions over `Candle[]` (utils/assetChart.ts); `null` where an indicator is not defined yet
 * (warm-up), never a made-up value. Tested in tests/chartIndicators.test.ts.
 */
import type { Candle } from '~/utils/assetChart'

export type Series = (number | null)[]

// ── Moving averages ────────────────────────────────────────────────────────

/** Simple moving average of `values` over `n` points. */
export function sma(values: number[], n: number): Series {
  const out: Series = new Array(values.length).fill(null)
  if (n < 1) return out
  let sum = 0
  for (let i = 0; i < values.length; i++) {
    sum += values[i]!
    if (i >= n) sum -= values[i - n]!
    if (i >= n - 1) out[i] = sum / n
  }
  return out
}

/** Exponential moving average (seeded with the SMA of the first `n` points). */
export function ema(values: number[], n: number): Series {
  const out: Series = new Array(values.length).fill(null)
  if (n < 1 || values.length < n) return out
  const k = 2 / (n + 1)
  let prev = values.slice(0, n).reduce((s, v) => s + v, 0) / n
  out[n - 1] = prev
  for (let i = n; i < values.length; i++) {
    prev = values[i]! * k + prev * (1 - k)
    out[i] = prev
  }
  return out
}

/** Bollinger bands: SMA(n) ± k population standard deviations. */
export function bollinger(values: number[], n = 20, k = 2): { mid: Series; upper: Series; lower: Series } {
  const mid = sma(values, n)
  const upper: Series = new Array(values.length).fill(null)
  const lower: Series = new Array(values.length).fill(null)
  for (let i = n - 1; i < values.length; i++) {
    const m = mid[i]!
    let s = 0
    for (let j = i - n + 1; j <= i; j++) s += (values[j]! - m) ** 2
    const sd = Math.sqrt(s / n)
    upper[i] = m + k * sd
    lower[i] = m - k * sd
  }
  return { mid, upper, lower }
}

/** Relative strength index, Wilder smoothing, 0–100. */
export function rsi(values: number[], n = 14): Series {
  const out: Series = new Array(values.length).fill(null)
  if (values.length <= n) return out
  let gain = 0
  let loss = 0
  for (let i = 1; i <= n; i++) {
    const d = values[i]! - values[i - 1]!
    if (d >= 0) gain += d
    else loss -= d
  }
  gain /= n
  loss /= n
  const val = (g: number, l: number) => (l === 0 ? (g === 0 ? 50 : 100) : 100 - 100 / (1 + g / l))
  out[n] = val(gain, loss)
  for (let i = n + 1; i < values.length; i++) {
    const d = values[i]! - values[i - 1]!
    gain = (gain * (n - 1) + Math.max(d, 0)) / n
    loss = (loss * (n - 1) + Math.max(-d, 0)) / n
    out[i] = val(gain, loss)
  }
  return out
}

/** MACD(fast, slow, signal): line = EMA(fast) − EMA(slow), signal = EMA(line), histogram = line − signal. */
export function macd(values: number[], fast = 12, slow = 26, signal = 9): { line: Series; signal: Series; hist: Series } {
  const f = ema(values, fast)
  const s = ema(values, slow)
  const line: Series = values.map((_, i) => (f[i] !== null && s[i] !== null ? f[i]! - s[i]! : null))
  const firstIdx = line.findIndex(v => v !== null)
  const sig: Series = new Array(values.length).fill(null)
  if (firstIdx >= 0) {
    const tail = line.slice(firstIdx) as number[]
    const e = ema(tail, signal)
    for (let i = 0; i < e.length; i++) sig[firstIdx + i] = e[i]!
  }
  const hist: Series = line.map((v, i) => (v !== null && sig[i] !== null ? v - sig[i]! : null))
  return { line, signal: sig, hist }
}

/** Volume-weighted average price, cumulative over the window (needs real volume; null otherwise). */
export function vwap(candles: Candle[]): Series {
  let pv = 0
  let vol = 0
  return candles.map((c) => {
    if (!(c.v && c.v > 0)) return vol > 0 ? pv / vol : null
    const typical = (c.h + c.l + c.c) / 3
    pv += typical * c.v
    vol += c.v
    return pv / vol
  })
}

// ── Indicator catalogue (what the toolbar offers) ──────────────────────────

export type IndicatorId = 'sma20' | 'sma50' | 'ema20' | 'bb20' | 'vwap' | 'volume' | 'rsi14' | 'macd'

export const INDICATORS: { id: IndicatorId; label: string; pane: 'price' | 'volume' | 'rsi' | 'macd'; color: string; needsVolume?: boolean; hint: string }[] = [
  { id: 'sma20', label: 'SMA 20', pane: 'price', color: 'var(--warning-orange, #ffa500)', hint: 'Average close of the last 20 candles' },
  { id: 'sma50', label: 'SMA 50', pane: 'price', color: 'var(--domain-agent, #b388ff)', hint: 'Average close of the last 50 candles' },
  { id: 'ema20', label: 'EMA 20', pane: 'price', color: 'var(--primary-blue, #00aaff)', hint: 'Exponential average, recent candles weigh more' },
  { id: 'bb20', label: 'Bollinger 20·2', pane: 'price', color: 'var(--text-light-gray, #cccccc)', hint: 'SMA 20 ± 2 standard deviations' },
  { id: 'vwap', label: 'VWAP', pane: 'price', color: 'var(--domain-social, #ff7eb6)', needsVolume: true, hint: 'Volume-weighted average price over the window' },
  { id: 'volume', label: 'Volume', pane: 'volume', color: 'var(--text-gray, #888888)', needsVolume: true, hint: 'Traded volume per candle' },
  { id: 'rsi14', label: 'RSI 14', pane: 'rsi', color: 'var(--warning-orange, #ffa500)', hint: 'Momentum 0–100; above 70 stretched, below 30 washed out' },
  { id: 'macd', label: 'MACD 12·26·9', pane: 'macd', color: 'var(--primary-blue, #00aaff)', hint: 'Trend momentum: EMA 12 − EMA 26, signal EMA 9' },
]

export function parseIndicators(raw: unknown): IndicatorId[] {
  const ids = new Set(INDICATORS.map(i => i.id))
  return String(raw ?? '').split(',').map(s => s.trim()).filter((s): s is IndicatorId => ids.has(s as IndicatorId))
}

// ── Viewport (which candles are on screen) ─────────────────────────────────

/** A window over candle indices [from, to] (inclusive, fractional allowed). */
export interface View { from: number; to: number }

export const MIN_VISIBLE = 12

/** Everything, with room on the right for the future (predictions, alerts) as a fraction of the span. */
export function fullView(n: number): View {
  return { from: 0, to: Math.max(0, n - 1) }
}

export function clampView(v: View, n: number, min = MIN_VISIBLE): View {
  if (n <= 0) return { from: 0, to: 0 }
  let span = Math.max(Math.min(min, n - 1), Math.min(v.to - v.from, n - 1))
  if (!(span > 0)) span = Math.max(0, n - 1)
  let from = Math.max(0, Math.min(v.from, n - 1 - span))
  if (!Number.isFinite(from)) from = 0
  return { from, to: from + span }
}

/** Zoom by `factor` (< 1 = in) around `anchor` ∈ [0, 1] of the visible span. */
export function zoomView(v: View, factor: number, anchor: number, n: number): View {
  const span = v.to - v.from
  const next = span * factor
  const pivot = v.from + span * Math.min(1, Math.max(0, anchor))
  return clampView({ from: pivot - (pivot - v.from) * factor, to: pivot - (pivot - v.from) * factor + next }, n)
}

/** Pan by `delta` candles (positive = towards older). */
export function panView(v: View, delta: number, n: number): View {
  return clampView({ from: v.from - delta, to: v.to - delta }, n)
}

/** Integer index range to render (one extra candle each side so nothing pops at the edges). */
export function visibleRange(v: View, n: number): [number, number] {
  return [Math.max(0, Math.floor(v.from) - 1), Math.min(n - 1, Math.ceil(v.to) + 1)]
}

// ── Scales ─────────────────────────────────────────────────────────────────

/** Price ↔ y with a linear or logarithmic axis (log needs positive prices; falls back to linear). */
export function priceScale(lo: number, hi: number, top: number, height: number, log: boolean) {
  const useLog = log && lo > 0 && hi > lo
  const f = useLog ? Math.log : (x: number) => x
  const fi = useLog ? Math.exp : (x: number) => x
  const a = f(lo)
  const b = f(hi)
  const d = b - a || 1
  return {
    log: useLog,
    y: (p: number) => top + (1 - (f(p) - a) / d) * height,
    p: (y: number) => fi(a + (1 - (y - top) / height) * d),
  }
}

/** Log-spaced "nice" ticks: 1-2-5 per decade inside [lo, hi]. */
export function logTicks(lo: number, hi: number, max = 6): number[] {
  if (!(lo > 0 && hi > lo)) return []
  const out: number[] = []
  for (let e = Math.floor(Math.log10(lo)); e <= Math.ceil(Math.log10(hi)); e++) {
    for (const m of [1, 2, 5]) {
      const v = m * 10 ** e
      if (v >= lo && v <= hi) out.push(+v.toPrecision(12))
    }
  }
  if (out.length <= max) return out
  const step = Math.ceil(out.length / max)
  return out.filter((_, i) => i % step === 0)
}

/** % change of each close from the first visible close (comparison mode). */
export function toPercent(values: number[], baseIdx = 0): number[] {
  const base = values[baseIdx]
  return values.map(v => (base ? (v / base - 1) * 100 : 0))
}

/** Close of `other` series aligned on `times` (last close at or before each time; null before it starts). */
export function alignCloses(times: number[], other: Candle[]): (number | null)[] {
  const out: (number | null)[] = []
  let j = 0
  for (const t of times) {
    while (j + 1 < other.length && other[j + 1]!.t <= t) j++
    out.push(other.length && other[j]!.t <= t ? other[j]!.c : null)
  }
  return out
}

/** Change between two points of the ruler. */
export function measureSpan(a: { t: number; p: number }, b: { t: number; p: number }, intervalMs: number) {
  const pct = a.p ? (b.p / a.p - 1) * 100 : 0
  return { abs: b.p - a.p, pct, candles: Math.round(Math.abs(b.t - a.t) / Math.max(1, intervalMs)), ms: Math.abs(b.t - a.t) }
}
