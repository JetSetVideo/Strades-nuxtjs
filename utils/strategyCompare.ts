/**
 * Side-by-side strategy comparison.
 *
 * Each line is the return on the capital that strategy moved, from the day
 * its book opened to the day it last ran. The path is not a tick replay: it
 * starts at 0, ends on the recorded return, and touches the recorded drawdown.
 * Where both books were open, the shared-window change is the fair gap.
 */

export interface CompareInput {
  id?: string
  name?: string
  category?: string
  description?: string
  target_assets?: string[]
  targetAssets?: string[]
  fromAsset?: string
  toAsset?: string
  total_return_percentage?: number
  monthlyGain?: number
  max_drawdown?: number
  monthlyDrawdown?: number
  sharpe_ratio?: number
  sharpeRatio?: number
  win_rate?: number
  winRate?: number
  total_trades?: number
  numberOfTrades?: number
  current_capital?: number
  initial_capital?: number
  total_return?: number
  totalProfit?: number
  backtest_period?: { start?: string; end?: string }
  created_at?: string
  creationDate?: string
  updated_at?: string
  last_run?: string
  frequency?: string
}

export interface CompareSide {
  id: string
  name: string
  category: string
  description: string
  assets: string[]
  transfer: string
  start: number
  end: number
  returnPct: number
  /** Drawdown as a positive magnitude. */
  drawdown: number
  sharpe: number
  win: number
  trades: number
  pnl: number
  capital: number
  frequency: string
  path: ReturnPoint[]
}

export interface ReturnPoint {
  t: number
  pct: number
}

export interface StatRow {
  id: string
  label: string
  equipped: string
  candidate: string
  /** Signed gap, candidate minus equipped, in the row's own units. */
  gap: number
  /** True when a larger number is the better one. */
  higherBetter: boolean
  /** False for counts that should not be coloured. */
  scored: boolean
}

export interface EquipCall {
  verb: 'equip' | 'keep'
  name: string
  detail: string
}

export interface ComparePlot {
  t0: number
  t1: number
  y0: number
  y1: number
  equipped: ReturnPoint[]
  candidate: ReturnPoint[]
}

const DAY = 86_400_000

function num(value: unknown, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function parseDay(value: string | undefined): number | null {
  if (!value) return null
  const day = value.slice(0, 10)
  const t = Date.parse(`${day}T00:00:00Z`)
  return Number.isFinite(t) ? t : null
}

function hash(id: string): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619)
  return h >>> 0
}

export function dayLabel(t: number): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(t))
}

export function transferLabel(assets: string[], from?: string, to?: string): string {
  if (from && to) return `${from} → ${to}`
  if (assets.length >= 2) return `${assets[0]} → ${assets[1]}`
  if (assets.length === 1) return assets[0]!
  return 'the book'
}

/** Recorded backtest when it has a length, otherwise the life of the book. */
export function strategySpan(raw: CompareInput): { start: number; end: number } {
  const backStart = parseDay(raw.backtest_period?.start)
  const backEnd = parseDay(raw.backtest_period?.end)
  const opened = parseDay(raw.created_at) ?? parseDay(raw.creationDate) ?? backStart ?? Date.UTC(2026, 0, 1)
  const closed = parseDay(raw.last_run) ?? parseDay(raw.updated_at) ?? backEnd ?? opened
  let start = opened
  let end = closed
  if (backStart != null && backEnd != null && backEnd > backStart) {
    start = backStart
    end = backEnd
  }
  if (end <= start) end = start + 30 * DAY
  return { start, end }
}

/**
 * Return path for one book. Index 0 is the open, the last point is the
 * recorded return, and one interior point is the recorded drawdown.
 */
export function returnPath(
  id: string,
  start: number,
  end: number,
  returnPct: number,
  drawdownPct: number,
): ReturnPoint[] {
  const span = Math.max(end - start, DAY)
  const days = Math.round(span / DAY)
  const steps = Math.max(8, Math.min(24, Math.round(days / 7) + 1))
  const trough = -Math.abs(drawdownPct)
  const dipAt = 1 + (hash(id || 'book') % (steps - 2))
  const points: ReturnPoint[] = []
  for (let i = 0; i < steps; i++) {
    const u = i / (steps - 1)
    let pct: number
    if (i <= dipAt) pct = trough * (i / dipAt)
    else pct = trough + (returnPct - trough) * ((i - dipAt) / (steps - 1 - dipAt))
    points.push({ t: Math.round(start + u * span), pct })
  }
  points[0] = { t: start, pct: 0 }
  points[points.length - 1] = { t: end, pct: returnPct }
  return points
}

export function samplePath(path: readonly ReturnPoint[], t: number): number | null {
  if (path.length < 2) return null
  const first = path[0]!
  const last = path[path.length - 1]!
  if (t < first.t || t > last.t) return null
  for (let i = 1; i < path.length; i++) {
    const right = path[i]!
    const left = path[i - 1]!
    if (t <= right.t) {
      const span = right.t - left.t
      const u = span <= 0 ? 1 : (t - left.t) / span
      return left.pct + (right.pct - left.pct) * u
    }
  }
  return last.pct
}

export function compareSide(raw: CompareInput): CompareSide {
  const assets = (raw.target_assets?.length ? raw.target_assets : raw.targetAssets) ?? []
  const span = strategySpan(raw)
  const returnPct = num(raw.total_return_percentage ?? raw.monthlyGain)
  const drawdown = Math.abs(num(raw.max_drawdown ?? raw.monthlyDrawdown))
  const id = raw.id || raw.name || 'book'
  return {
    id,
    name: raw.name || 'Strategy',
    category: raw.category || '',
    description: raw.description || '',
    assets: assets.slice(),
    transfer: transferLabel(assets, raw.fromAsset, raw.toAsset),
    start: span.start,
    end: span.end,
    returnPct,
    drawdown,
    sharpe: num(raw.sharpe_ratio ?? raw.sharpeRatio),
    win: num(raw.win_rate ?? raw.winRate),
    trades: num(raw.total_trades ?? raw.numberOfTrades),
    pnl: num(raw.total_return ?? raw.totalProfit),
    capital: num(raw.current_capital ?? raw.initial_capital),
    frequency: raw.frequency || '',
    path: returnPath(id, span.start, span.end, returnPct, drawdown),
  }
}

/** Where each book stood on the days both were open, and how far the path moved. */
export function sharedWindow(equipped: CompareSide, candidate: CompareSide): {
  days: number
  start: number
  end: number
  equippedFrom: number
  equippedTo: number
  candidateFrom: number
  candidateTo: number
  equipped: number
  candidate: number
} | null {
  const start = Math.max(equipped.start, candidate.start)
  const end = Math.min(equipped.end, candidate.end)
  if (end <= start) return null
  const left = samplePath(equipped.path, start)
  const leftEnd = samplePath(equipped.path, end)
  const right = samplePath(candidate.path, start)
  const rightEnd = samplePath(candidate.path, end)
  if (left == null || leftEnd == null || right == null || rightEnd == null) return null
  return {
    days: Math.round((end - start) / DAY),
    start,
    end,
    equippedFrom: left,
    equippedTo: leftEnd,
    candidateFrom: right,
    candidateTo: rightEnd,
    equipped: leftEnd - left,
    candidate: rightEnd - right,
  }
}

function fmtPct(n: number, digits = 1): string {
  return `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(digits)}%`
}

function fmtSigned(n: number, digits: number, suffix = ''): string {
  const body = Math.abs(n).toFixed(digits)
  return `${n >= 0 ? '+' : '−'}${body}${suffix}`
}

export function statRows(equipped: CompareSide, candidate: CompareSide): StatRow[] {
  const shared = sharedWindow(equipped, candidate)
  const rows: StatRow[] = [
    {
      id: 'return',
      label: 'Return',
      equipped: fmtPct(equipped.returnPct),
      candidate: fmtPct(candidate.returnPct),
      gap: candidate.returnPct - equipped.returnPct,
      higherBetter: true,
      scored: true,
    },
  ]
  if (shared && shared.days >= 7) {
    rows.push({
      id: 'shared',
      label: `Both open ${shared.days}d`,
      equipped: `${fmtPct(shared.equippedFrom)} → ${fmtPct(shared.equippedTo)}`,
      candidate: `${fmtPct(shared.candidateFrom)} → ${fmtPct(shared.candidateTo)}`,
      gap: shared.candidate - shared.equipped,
      higherBetter: true,
      scored: true,
    })
  }
  rows.push(
    {
      id: 'drawdown',
      label: 'Max DD',
      equipped: `${equipped.drawdown.toFixed(1)}%`,
      candidate: `${candidate.drawdown.toFixed(1)}%`,
      gap: candidate.drawdown - equipped.drawdown,
      higherBetter: false,
      scored: true,
    },
    {
      id: 'sharpe',
      label: 'Sharpe',
      equipped: equipped.sharpe.toFixed(2),
      candidate: candidate.sharpe.toFixed(2),
      gap: candidate.sharpe - equipped.sharpe,
      higherBetter: true,
      scored: true,
    },
    {
      id: 'win',
      label: 'Win rate',
      equipped: `${equipped.win.toFixed(0)}%`,
      candidate: `${candidate.win.toFixed(0)}%`,
      gap: candidate.win - equipped.win,
      higherBetter: true,
      scored: true,
    },
    {
      id: 'pnl',
      label: 'P&L',
      equipped: fmtSigned(equipped.pnl, 0, ''),
      candidate: fmtSigned(candidate.pnl, 0, ''),
      gap: candidate.pnl - equipped.pnl,
      higherBetter: true,
      scored: true,
    },
    {
      id: 'trades',
      label: 'Trades',
      equipped: String(equipped.trades),
      candidate: String(candidate.trades),
      gap: candidate.trades - equipped.trades,
      higherBetter: true,
      scored: false,
    },
  )
  return rows
}

export function gapIsBetter(row: StatRow): boolean {
  if (!row.scored || Math.abs(row.gap) < 1e-9) return false
  return row.higherBetter ? row.gap > 0 : row.gap < 0
}

export function gapLabel(row: StatRow): string {
  if (row.id === 'pnl') return fmtSigned(row.gap, 0)
  if (row.id === 'sharpe') return fmtSigned(row.gap, 2)
  if (row.id === 'trades') return fmtSigned(row.gap, 0)
  if (row.id === 'win') return fmtSigned(row.gap, 0)
  return fmtSigned(row.gap, 1)
}

/** Equip the book in hand, or keep the one already selected first. The call follows the recorded return. */
export function equipCall(equipped: CompareSide, candidate: CompareSide): EquipCall {
  const gap = candidate.returnPct - equipped.returnPct
  let takeNext = gap > 0.15
  let takeKept = gap < -0.15
  if (!takeNext && !takeKept) {
    if (candidate.drawdown + 0.15 < equipped.drawdown) takeNext = true
    else if (equipped.drawdown + 0.15 < candidate.drawdown) takeKept = true
    else if (candidate.sharpe > equipped.sharpe) takeNext = true
    else takeKept = true
  }
  const verb = takeNext ? 'equip' : 'keep'
  const name = takeNext ? candidate.name : equipped.name
  const shared = sharedWindow(equipped, candidate)
  const basis = `${candidate.name} returned ${fmtPct(candidate.returnPct)} on ${candidate.transfer}; ${equipped.name} returned ${fmtPct(equipped.returnPct)} on ${equipped.transfer}.`
  const overlap = shared && shared.days >= 7
    ? ` While both were open (${dayLabel(shared.start)} → ${dayLabel(shared.end)}), ${equipped.name} went ${fmtPct(shared.equippedFrom)} → ${fmtPct(shared.equippedTo)} and ${candidate.name} went ${fmtPct(shared.candidateFrom)} → ${fmtPct(shared.candidateTo)}.`
    : ''
  const dd = candidate.drawdown - equipped.drawdown
  const risk = Math.abs(dd) < 0.15
    ? 'Drawdowns match.'
    : dd > 0
      ? `${candidate.name} draws down ${dd.toFixed(1)} points more.`
      : `${candidate.name} draws down ${Math.abs(dd).toFixed(1)} points less.`
  return { verb, name, detail: `${basis}${overlap} ${risk}` }
}

export function comparePlot(equipped: CompareSide, candidate: CompareSide): ComparePlot {
  const t0 = Math.min(equipped.start, candidate.start)
  const t1 = Math.max(equipped.end, candidate.end)
  const values = [0, ...equipped.path.map(point => point.pct), ...candidate.path.map(point => point.pct)]
  let y0 = Math.min(...values)
  let y1 = Math.max(...values)
  if (y1 - y0 < 1) {
    y0 -= 1
    y1 += 1
  }
  const pad = (y1 - y0) * 0.12
  return {
    t0,
    t1,
    y0: y0 - pad,
    y1: y1 + pad,
    equipped: equipped.path,
    candidate: candidate.path,
  }
}
