/**
 * The strategies page board: every book's return on one chart, the same
 * books spread on two axes, and a calendar of the window each book was open.
 * Paths come from strategyCompare, so the line still ends on the recorded return.
 */
import { compareSide, dayLabel, type CompareInput, type CompareSide } from '~/utils/strategyCompare'

export const BOARD_AXES = [
  { id: 'return', label: 'Return' },
  { id: 'drawdown', label: 'Drawdown' },
  { id: 'sharpe', label: 'Sharpe' },
  { id: 'win', label: 'Win rate' },
  { id: 'trades', label: 'Trades' },
  { id: 'risk', label: 'Risk' },
] as const

export type BoardAxis = (typeof BOARD_AXES)[number]['id']

export interface BoardSeries {
  id: string
  name: string
  color: string
  side: CompareSide
}

export interface BoardFrame {
  t0: number
  t1: number
  y0: number
  y1: number
  series: BoardSeries[]
}

export interface SpreadPoint {
  id: string
  name: string
  color: string
  /** 0…1 across the plot. */
  x: number
  y: number
  xValue: number
  yValue: number
}

export interface CalendarMark {
  /** 0…1 on the shared calendar. */
  u: number
  /** 0…1 inside this book's own window. */
  along: number
  up: boolean
}

export interface CalendarLane {
  id: string
  name: string
  color: string
  /** 0…1 across the shared calendar. */
  start: number
  end: number
  marks: CalendarMark[]
  returnPct: number
  startAt: number
  endAt: number
}

export function axisText(axis: BoardAxis, value: number): string {
  if (axis === 'sharpe') return value.toFixed(2)
  if (axis === 'trades') return String(Math.round(value))
  if (axis === 'risk') return value >= 0.7 ? 'High' : value <= 0.35 ? 'Low' : 'Mid'
  const digits = Math.abs(value) >= 10 ? 0 : 1
  const body = Math.abs(value).toFixed(digits)
  if (axis === 'return') return `${value > 0 ? '+' : value < 0 ? '−' : ''}${body}%`
  return `${body}%`
}

const CAT: Record<string, string> = {
  crypto: '#f7931a',
  stocks: '#64b5f6',
  commodities: '#ffd56a',
  forex: '#4caf50',
}

const FALLBACK = ['#7dffb3', '#d2a8ff', '#ff7b8a', '#9ad7ff', '#ef6c9a']

export function strategyColor(category: string, index = 0, used?: Set<string>): string {
  const preferred = CAT[category]
  if (preferred && !used?.has(preferred)) {
    used?.add(preferred)
    return preferred
  }
  const next = FALLBACK.find(color => !used?.has(color)) || FALLBACK[index % FALLBACK.length]!
  used?.add(next)
  return next
}

function riskOf(raw: CompareInput): number {
  const level = (raw as CompareInput & { risk_level?: string }).risk_level
  if (level === 'high') return 0.85
  if (level === 'low') return 0.2
  if (level === 'medium') return 0.55
  const score = Number((raw as CompareInput & { riskScore?: number }).riskScore)
  if (Number.isFinite(score) && score > 0) return Math.max(0, Math.min(1, score / 10))
  return 0.5
}

function axisOf(side: CompareSide, raw: CompareInput, axis: BoardAxis): number {
  if (axis === 'return') return side.returnPct
  if (axis === 'drawdown') return side.drawdown
  if (axis === 'sharpe') return side.sharpe
  if (axis === 'win') return side.win
  if (axis === 'trades') return side.trades
  return riskOf(raw)
}

export function boardSeries(list: readonly CompareInput[]): BoardSeries[] {
  const used = new Set<string>()
  return list.map((raw, index) => {
    const side = compareSide(raw)
    return {
      id: side.id,
      name: side.name,
      color: strategyColor(side.category, index, used),
      side,
    }
  })
}

export function boardFrame(series: readonly BoardSeries[]): BoardFrame | null {
  if (!series.length) return null
  const t0 = Math.min(...series.map(row => row.side.start))
  const t1 = Math.max(...series.map(row => row.side.end))
  const values = [0, ...series.flatMap(row => row.side.path.map(point => point.pct))]
  let y0 = Math.min(...values)
  let y1 = Math.max(...values)
  if (y1 - y0 < 1) {
    y0 -= 1
    y1 += 1
  }
  const pad = (y1 - y0) * 0.12
  return { t0, t1: Math.max(t1, t0 + 86_400_000), y0: y0 - pad, y1: y1 + pad, series: series.slice() }
}

export function spreadPoints(list: readonly CompareInput[], xAxis: BoardAxis, yAxis: BoardAxis): SpreadPoint[] {
  const series = boardSeries(list)
  if (!series.length) return []
  const xs = series.map((row, i) => axisOf(row.side, list[i]!, xAxis))
  const ys = series.map((row, i) => axisOf(row.side, list[i]!, yAxis))
  const loX = Math.min(...xs)
  const hiX = Math.max(...xs)
  const loY = Math.min(...ys)
  const hiY = Math.max(...ys)
  const dx = hiX - loX
  const dy = hiY - loY
  return series.map((row, i) => ({
    id: row.id,
    name: row.name,
    color: row.color,
    x: dx < 1e-9 ? 0.5 : (xs[i]! - loX) / dx,
    y: dy < 1e-9 ? 0.5 : (ys[i]! - loY) / dy,
    xValue: xs[i]!,
    yValue: ys[i]!,
  }))
}

/** Turns in the path: the first move, each change of direction, and the close. */
function laneMarks(
  path: { t: number; pct: number }[],
  t0: number,
  span: number,
  start: number,
  end: number,
): CalendarMark[] {
  const own = end - start || 1
  const marks: CalendarMark[] = []
  for (let i = 1; i < path.length; i++) {
    const point = path[i]!
    const up = point.pct >= path[i - 1]!.pct
    const prevUp = i === 1 ? null : path[i - 1]!.pct >= path[i - 2]!.pct
    if (prevUp === null || up !== prevUp || i === path.length - 1) {
      marks.push({
        u: (point.t - t0) / span,
        along: Math.min(1, Math.max(0, (point.t - start) / own)),
        up,
      })
    }
  }
  return marks
}

/** One lane per book, on the shared span from the earliest open to the latest close. */
export function calendarLanes(series: readonly BoardSeries[]): { t0: number; t1: number; lanes: CalendarLane[] } | null {
  const frame = boardFrame(series)
  if (!frame) return null
  const span = frame.t1 - frame.t0 || 1
  const lanes = frame.series.map(row => ({
    id: row.id,
    name: row.name,
    color: row.color,
    start: (row.side.start - frame.t0) / span,
    end: (row.side.end - frame.t0) / span,
    marks: laneMarks(row.side.path, frame.t0, span, row.side.start, row.side.end),
    returnPct: row.side.returnPct,
    startAt: row.side.start,
    endAt: row.side.end,
  }))
  return { t0: frame.t0, t1: frame.t1, lanes }
}

export function monthTicks(t0: number, t1: number): { t: number; label: string }[] {
  const start = new Date(t0)
  const first = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1)
  const months: number[] = []
  for (let t = first; t <= t1 + 86_400_000; t = Date.UTC(new Date(t).getUTCFullYear(), new Date(t).getUTCMonth() + 1, 1)) {
    if (t >= t0 - 86_400_000) months.push(t)
  }
  if (!months.length) return [{ t: t0, label: dayLabel(t0) }]
  const step = months.length > 16 ? 6 : months.length > 10 ? 3 : months.length > 7 ? 2 : 1
  const picked = months.filter((_, index) => index % step === 0)
  const last = months[months.length - 1]!
  if (picked[picked.length - 1] !== last) picked.push(last)
  return picked.map((t, index) => {
    const date = new Date(t)
    const month = dayLabel(t).replace(/\s+\d+$/, '') || dayLabel(t)
    const year = date.getUTCFullYear()
    const previous = index > 0 ? new Date(picked[index - 1]!) : null
    const showYear = index === 0 || date.getUTCMonth() === 0 || previous?.getUTCFullYear() !== year
    return { t, label: showYear ? `${month} ’${String(year).slice(2)}` : month }
  })
}
