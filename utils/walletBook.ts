/**
 * One book for the wallet page: the equity path, the bands under it, and the
 * risk figures that used to live in a second card. A selected wallet splits
 * the path by holding. The total selection splits it by wallet.
 */

import { resolveAssetClass } from '~/utils/assetClass'

export const ALL_WALLETS = 'all'

export const POINTS_FOR: Record<string, number> = {
  '1d': 24,
  '7d': 28,
  '30d': 30,
  '90d': 30,
  '1y': 52,
}

export type PieClass = 'fiat' | 'crypto' | 'stocks' | 'commodities'

export const CLASS_ORDER: PieClass[] = ['fiat', 'commodities', 'stocks', 'crypto']

export const CLASS_LABELS: Record<PieClass, string> = {
  fiat: 'Fiat',
  crypto: 'Crypto',
  stocks: 'Stocks',
  commodities: 'Commodities',
}

/** Same swatches the allocation rows already use, so a band matches its row. */
export const CLASS_COLORS: Record<PieClass, string> = {
  fiat: '#4A90E2',
  crypto: '#F5A623',
  stocks: '#7ED321',
  commodities: '#F8E71C',
}

export const WALLET_COLORS = ['#5b9cff', '#3dd68c', '#e6c15a', '#c084fc', '#f472b6', '#3ec6e0']

const CLASS_RANK: Record<PieClass, number> = {
  fiat: 0,
  commodities: 1,
  stocks: 2,
  crypto: 3,
}

export interface BookAsset {
  asset_id: string
  symbol: string
  amount?: number
  average_price?: number
  current_price?: number
  current_value?: number
  return_amount?: number
  return_percentage?: number
  allocation_percentage?: number
}

export interface BookWallet {
  id: string
  name: string
  total_value: number
  available_balance?: number
  invested_amount?: number
  daily_change?: number
  daily_change_percentage?: number
  assets?: BookAsset[]
  transactions?: unknown[]
  performance_history?: Record<string, { change: number; change_percentage: number }>
}

export interface BookLayer {
  id: string
  /** Eye toggle key. A class for holdings, the wallet id when the total is selected. */
  group: string
  label: string
  color: string
  /** Ending share of the drawn book, 0–1. */
  share: number
}

export function pieClassOf(symbol: string): PieClass {
  const id = resolveAssetClass({ symbol })
  if (id === 'precious_metals') return 'commodities'
  if (id === 'fiat' || id === 'crypto' || id === 'stocks' || id === 'commodities') return id
  return 'stocks'
}

/**
 * Equity path drawn under the wallet chart. The last sample is the current value.
 *
 * Honest data (swarm 2026-10-30b, board-finance F2b): no daily valuation history is
 * recorded yet, so this is a STRAIGHT LINE from the stored period start
 * (endValue / (1 + changePct)) to today's value. It used to be a seeded random walk
 * pinned to both ends, and its Best / Worst / Max DD were read off that noise.
 * Nothing here is random any more; `seedKey` is kept so callers do not change.
 * Read Best / Worst / Max DD through `equityStats`, which reports them as pending.
 */
export function equityPath(_seedKey: string, points: number, endValue: number, changePct: number): number[] {
  const n = Math.max(2, points)
  const growth = 1 + (Number(changePct) || 0) / 100
  const start = growth > 0 ? endValue / growth : endValue
  const out: number[] = []
  for (let i = 0; i < n; i++) out.push(start + ((endValue - start) * i) / (n - 1))
  out[n - 1] = endValue
  return out
}

/** One-line reason shown with every figure that needs a recorded daily equity series. */
export const NO_EQUITY_HISTORY = 'Needs a daily equity history: not recorded yet.'

/**
 * A figure that cannot be computed yet. It formats as '—' through the same
 * `toFixed()` call a number takes, so a template that prints `x.toFixed(1)` shows
 * '—' instead of an invented value. It is not a number: never do maths on it.
 */
export interface PendingFigure {
  readonly pending: true
  readonly note: string
  toFixed(digits?: number): string
  toString(): string
}

export function pendingFigure(note: string): PendingFigure {
  return Object.freeze({
    pending: true as const,
    note,
    toFixed: () => '—',
    toString: () => '—',
  })
}

export function isPending(value: unknown): value is PendingFigure {
  return !!value && typeof value === 'object' && (value as { pending?: unknown }).pending === true
}

/** Largest peak-to-trough fall of a value series, in % (≤ 0). 0 for fewer than 2 points. */
export function maxDrawdownPct(values: number[]): number {
  let peak = -Infinity
  let worst = 0
  for (const v of values) {
    if (!Number.isFinite(v)) continue
    if (v > peak) peak = v
    if (peak > 0) worst = Math.min(worst, ((v - peak) / peak) * 100)
  }
  return worst
}

/**
 * Best step, worst step and max drawdown of a RECORDED equity series. Without a
 * recorded series (`recorded` false: the line from `equityPath`) all three are
 * pending: a straight line has no drawdown to report and its steps are not days.
 */
export function equityStats(values: number[], recorded: boolean): {
  best: number | PendingFigure
  worst: number | PendingFigure
  maxDrawdown: number | PendingFigure
} {
  if (!recorded || values.length < 2) {
    const p = pendingFigure(NO_EQUITY_HISTORY)
    return { best: p, worst: p, maxDrawdown: p }
  }
  let best = -Infinity
  let worst = Infinity
  for (let i = 1; i < values.length; i++) {
    const prev = values[i - 1]!
    if (!(prev > 0)) continue
    const pct = ((values[i]! - prev) / prev) * 100
    if (pct > best) best = pct
    if (pct < worst) worst = pct
  }
  return {
    best: best === -Infinity ? 0 : best,
    worst: worst === Infinity ? 0 : worst,
    maxDrawdown: maxDrawdownPct(values),
  }
}

/**
 * Share of the book at each sample. Columns sum to 1. The composition history is
 * not recorded either, so every column is today's mix (it used to be a seeded
 * random wander, which put invented $ amounts in the chart read-out).
 */
export function sharePaths(
  layers: { id: string; share: number }[],
  points: number,
  _seedKey: string,
): number[][] {
  const n = Math.max(2, points)
  const count = layers.length
  if (!count) return Array.from({ length: n }, () => [])
  const endSum = layers.reduce((s, layer) => s + Math.max(0, layer.share), 0)
  const column = layers.map(layer => (endSum > 0 ? Math.max(0, layer.share) / endSum : 1 / count))
  return Array.from({ length: n }, () => [...column])
}

export interface StackPoint {
  x: number
  top: number
  bottom: number
}

export interface StackBand {
  id: string
  hidden: boolean
  points: StackPoint[]
}

/**
 * Split the area under the total line. `projected.y` is the total line.
 * A hidden layer keeps its share, so the others do not swell to fill the gap.
 */
export function stackBands(
  projected: { x: number; y: number }[],
  sharesByPoint: number[][],
  layers: { id: string; hidden?: boolean }[],
  yBase: number,
): StackBand[] {
  const bands: StackBand[] = layers.map(layer => ({
    id: layer.id,
    hidden: !!layer.hidden,
    points: [],
  }))

  projected.forEach((point, i) => {
    const shares = sharesByPoint[i] ?? []
    let acc = 0
    const span = yBase - point.y
    layers.forEach((layer, k) => {
      const share = shares[k] ?? 0
      const bottomF = acc
      acc += share
      const topF = Math.min(1, acc)
      bands[k]!.points.push({
        x: point.x,
        bottom: yBase - span * bottomF,
        top: yBase - span * topF,
      })
    })
  })

  return bands
}

export function areaPath(points: StackPoint[]): string {
  if (!points.length) return ''
  const forward = points.map((p, i) => `${i ? 'L' : 'M'} ${p.x.toFixed(2)} ${p.top.toFixed(2)}`).join(' ')
  const back = [...points].reverse().map(p => `L ${p.x.toFixed(2)} ${p.bottom.toFixed(2)}`).join(' ')
  return `${forward} ${back} Z`
}

export function linePath(points: { x: number; y: number }[]): string {
  return points.map((p, i) => `${i ? 'L' : 'M'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ')
}

function mixTowardWhite(hex: string, t: number): string {
  const h = hex.replace('#', '')
  const channels = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16))
  const lift = (c: number) => Math.round(c + (255 - c) * t)
  return `#${channels.map(c => lift(c).toString(16).padStart(2, '0')).join('')}`
}

/** Largest holding keeps the class color. Smaller ones step lighter so they separate. */
function shades(hex: string, count: number): string[] {
  if (count <= 1) return [hex]
  return Array.from({ length: count }, (_, i) => (i === 0 ? hex : mixTowardWhite(hex, 0.28 + ((i - 1) / count) * 0.4)))
}

/** One band per holding. Stacked fiat → crypto, smallest sleeve of a class at the bottom. */
export function assetLayers(assets: BookAsset[]): BookLayer[] {
  const valued = assets
    .map(asset => ({ asset, value: Number(asset.current_value) || 0, cls: pieClassOf(asset.symbol) }))
    .filter(row => row.value > 0)
  const sum = valued.reduce((total, row) => total + row.value, 0)
  if (!sum) return []

  const byClass = new Map<PieClass, typeof valued>()
  for (const row of valued) {
    const list = byClass.get(row.cls) ?? []
    list.push(row)
    byClass.set(row.cls, list)
  }

  const layers: BookLayer[] = []
  for (const cls of CLASS_ORDER) {
    const list = (byClass.get(cls) ?? []).sort((a, b) => b.value - a.value)
    const colors = shades(CLASS_COLORS[cls], list.length)
    list.forEach((row, index) => {
      layers.push({
        id: row.asset.asset_id || row.asset.symbol,
        group: cls,
        label: row.asset.symbol,
        color: colors[index] ?? CLASS_COLORS[cls],
        share: row.value / sum,
      })
    })
  }

  return layers.sort((a, b) => CLASS_RANK[a.group as PieClass] - CLASS_RANK[b.group as PieClass] || a.share - b.share)
}

/** One band per wallet. Color follows wallet list order so the row swatch matches. */
export function walletLayers(wallets: { id: string; name: string; total_value: number }[]): BookLayer[] {
  const sum = wallets.reduce((total, wallet) => total + (Number(wallet.total_value) || 0), 0)
  if (!sum) return []
  return wallets
    .map((wallet, index) => ({
      id: wallet.id,
      group: wallet.id,
      label: wallet.name,
      color: WALLET_COLORS[index % WALLET_COLORS.length]!,
      share: (Number(wallet.total_value) || 0) / sum,
    }))
    .sort((a, b) => a.share - b.share)
}

export interface RiskProfile {
  /**
   * Pending until a daily return series exists. The old figure was mean/std of the
   * five OVERLAPPING horizon returns (1d, 7d, 30d, 90d, 1y), which is not a Sharpe
   * ratio (Sharpe = mean(daily r − rf) / std(daily r − rf) · √252, √365 for crypto).
   */
  sharpe: PendingFigure
  sharpeNote: string
  /** null = not measured: the book has no closed (sell) trade, so there is no win to count (REVIEW-7). */
  winRate: number | null
  concentration: number
  riskLevel: 'low' | 'medium' | 'high'
  riskScore: number
  exposure: Record<PieClass, number>
}

export const SHARPE_PENDING_NOTE = 'Needs a daily equity history (daily returns): not recorded yet.'

export const WIN_RATE_PENDING_NOTE = 'No closed (sell) trade in this book yet: a win rate needs closed trades.'

export function riskProfile(
  positions: { symbol: string; allocation_percentage?: number; return_percentage?: number; current_value?: number }[],
  _history?: Record<string, { change_percentage?: number }>,
  /** Closed (sell) trades in the book; 0 → winRate null. Omitted → the old positions-in-profit share. */
  closedTrades?: number,
): RiskProfile {
  const exposure: Record<PieClass, number> = { fiat: 0, crypto: 0, stocks: 0, commodities: 0 }
  let weightSum = 0
  for (const position of positions) {
    const weight = Number(position.allocation_percentage) || 0
    exposure[pieClassOf(position.symbol)] += weight
    weightSum += weight
  }
  if (weightSum < 1) {
    const values = positions.map(position => Number(position.current_value) || 0)
    const sum = values.reduce((a, b) => a + b, 0)
    positions.forEach((position, index) => {
      exposure[pieClassOf(position.symbol)] += sum > 0 ? (values[index]! / sum) * 100 : 0
    })
  }

  const sharpe = pendingFigure(SHARPE_PENDING_NOTE)
  const winRate = closedTrades === 0
    ? null
    : positions.length
      ? (positions.filter(position => (position.return_percentage ?? 0) > 0).length / positions.length) * 100
      : 0
  const concentration = positions.reduce((acc, position) => acc + ((position.allocation_percentage ?? 0) / 100) ** 2, 0)
  const crypto = exposure.crypto
  const riskLevel: RiskProfile['riskLevel'] = crypto > 60 || concentration > 0.5
    ? 'high'
    : crypto > 30 || concentration > 0.3
      ? 'medium'
      : 'low'
  const riskScore = Math.min(100, Math.round(crypto * 0.6 + concentration * 100 * 0.4))
  return { sharpe, sharpeNote: SHARPE_PENDING_NOTE, winRate, concentration, riskLevel, riskScore, exposure }
}

/** Where a holding's "Today %" comes from: a live quote with a timestamp, or nothing. */
export interface QuoteLike {
  symbol: string
  change_24h_pct?: number
  live?: { at?: string } | null
}

export const TODAY_PENDING_NOTE = 'Needs a live quote with a 24h change: none for this asset yet.'

/**
 * Holdings "Today %" keyed by asset_id. Only assets with a live quote get a value:
 * the asset's real 24h price move, which is the holding's own move for a position
 * held through the day. Unknown stays absent (shown as '—'), never a made-up number.
 * (It used to be a hash of the asset id: board-finance F2a.)
 */
export function holdingTodayPct(
  positions: { asset_id: string; symbol: string }[],
  quoteBySymbol: (symbol: string) => QuoteLike | undefined,
): Record<string, number> {
  const out: Record<string, number> = {}
  for (const position of positions) {
    const quote = quoteBySymbol(String(position.symbol || '').toUpperCase())
    const pct = quote?.change_24h_pct
    if (quote?.live && typeof pct === 'number' && Number.isFinite(pct)) out[position.asset_id] = pct
  }
  return out
}

/**
 * The bundled platform wallets (public/data/core/wallets.json) are a demo book
 * (owner user_001). They are never the signed-in account's money, whoever is signed in.
 */
export const SAMPLE_WALLETS_NOTE = 'Sample wallets from the demo account: not your money. Your own paper wallets and bots are in Trade.'

function mergeAssets(wallets: BookWallet[], total: number): BookAsset[] {
  const byId = new Map<string, BookAsset & { cost: number }>()
  for (const wallet of wallets) {
    for (const asset of wallet.assets ?? []) {
      const value = Number(asset.current_value) || 0
      const amount = Number(asset.amount) || 0
      const cost = amount * (Number(asset.average_price) || 0)
      const prev = byId.get(asset.asset_id)
      if (!prev) {
        byId.set(asset.asset_id, { ...asset, current_value: value, amount, cost })
        continue
      }
      prev.amount = (prev.amount ?? 0) + amount
      prev.cost += cost
      prev.current_value = (prev.current_value ?? 0) + value
      prev.current_price = asset.current_price
    }
  }

  const assets: BookAsset[] = []
  for (const row of byId.values()) {
    const amount = row.amount ?? 0
    const value = row.current_value ?? 0
    const average = amount > 0 ? row.cost / amount : 0
    assets.push({
      asset_id: row.asset_id,
      symbol: row.symbol,
      amount,
      average_price: average,
      current_price: row.current_price,
      current_value: value,
      return_amount: value - row.cost,
      return_percentage: row.cost > 0 ? ((value - row.cost) / row.cost) * 100 : 0,
      allocation_percentage: total > 0 ? (value / total) * 100 : 0,
    })
  }
  return assets
}

/** Sum of every wallet. Same id the total chip selects. */
export function aggregateWallets(wallets: BookWallet[]): BookWallet | null {
  if (!wallets.length) return null
  const total = wallets.reduce((sum, wallet) => sum + (Number(wallet.total_value) || 0), 0)
  const available = wallets.reduce((sum, wallet) => sum + (Number(wallet.available_balance) || 0), 0)
  const invested = wallets.reduce((sum, wallet) => sum + (Number(wallet.invested_amount) || 0), 0)
  const daily = wallets.reduce((sum, wallet) => sum + (Number(wallet.daily_change) || 0), 0)
  const prior = total - daily
  const performance_history: NonNullable<BookWallet['performance_history']> = {}
  for (const period of ['1d', '7d', '30d', '90d', '1y']) {
    const change = wallets.reduce((sum, wallet) => sum + (wallet.performance_history?.[period]?.change ?? 0), 0)
    const start = total - change
    performance_history[period] = {
      change,
      change_percentage: start !== 0 ? (change / start) * 100 : 0,
    }
  }
  return {
    id: ALL_WALLETS,
    name: 'All wallets',
    total_value: total,
    available_balance: available,
    invested_amount: invested,
    daily_change: daily,
    daily_change_percentage: prior !== 0 ? (daily / prior) * 100 : 0,
    assets: mergeAssets(wallets, total),
    transactions: wallets
      .flatMap(wallet => (wallet.transactions ?? []) as { timestamp?: string }[])
      .sort((a, b) => String(b.timestamp ?? '').localeCompare(String(a.timestamp ?? ''))),
    performance_history,
  }
}


// ─── /risk exposure from the account's OWN holdings (Wave 2 review, REVIEW-6) ─────────────────────
// The old card listed a fixed set of 9 assets (BTC…CNY) at their class vol and then SUMMED those vols per
// type (3 × 82 % = 246 %). Now: one row per asset the book actually holds, weighted by its share of the
// book; a class row is Σ weight × class vol, so it can never exceed the class vol (≤ 100 %).

export interface HeldExposureRow {
  symbol: string
  cls: PieClass
  /** USD value held (bot + portfolio legs merged). */
  value: number
  /** % of the book total. */
  weightPct: number
  /** Annual class volatility as a fraction (0.7 = 70 %). */
  vol: number
  /** Vol-weighted exposure in %: weightPct × vol, capped at 100. */
  risk: number
}

const clampPct = (v: number) => Math.max(0, Math.min(100, Number.isFinite(v) ? v : 0))

/**
 * Rows ⊆ held assets (positions with a symbol and a positive value). `total` is the book total (cash
 * included), so weights add up to ≤ 100 %. Empty when nothing is held or the total is not positive.
 */
export function heldExposureRows(
  positions: { symbol: string; cls: PieClass; value: number }[],
  total: number,
  volByClass: Partial<Record<PieClass, number>> | null | undefined,
): HeldExposureRow[] {
  if (!(total > 0)) return []
  const merged = new Map<string, { symbol: string; cls: PieClass; value: number }>()
  for (const p of positions ?? []) {
    const symbol = String(p?.symbol ?? '').toUpperCase().trim()
    const value = Number(p?.value)
    if (!symbol || !(value > 0)) continue
    const row = merged.get(symbol)
    if (row) row.value += value
    else merged.set(symbol, { symbol, cls: p.cls, value })
  }
  return [...merged.values()].map(row => {
    const weightPct = clampPct((row.value / total) * 100)
    const vol = Math.max(0, Math.min(1, Number(volByClass?.[row.cls]) || 0))
    return { ...row, weightPct, vol, risk: clampPct(weightPct * vol) }
  }).sort((a, b) => b.risk - a.risk || b.value - a.value)
}

/** Σ vol-weighted exposure per class of the held rows; each ≤ 100 % by construction (clamped anyway). */
export function heldExposureByClass(rows: HeldExposureRow[]): { cls: PieClass; weightPct: number; risk: number }[] {
  const by = new Map<PieClass, { cls: PieClass; weightPct: number; risk: number }>()
  for (const r of rows) {
    const acc = by.get(r.cls) ?? { cls: r.cls, weightPct: 0, risk: 0 }
    acc.weightPct += r.weightPct
    acc.risk += r.risk
    by.set(r.cls, acc)
  }
  return [...by.values()]
    .map(r => ({ cls: r.cls, weightPct: clampPct(r.weightPct), risk: clampPct(r.risk) }))
    .sort((a, b) => b.risk - a.risk)
}

/**
 * Calendar days between `ts` and `now`, in UTC (REVIEW-17): yesterday 23:50 is 1 day ago at 00:10 today,
 * where a 24 h window said 0 and printed a bare time under today's fills.
 */
export function utcCalendarDaysAgo(ts: number, now: number = Date.now()): number {
  const day = (t: number) => Math.floor(t / 86_400_000)
  return day(now) - day(ts)
}
