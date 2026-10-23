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

export function hashSeed(str: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed
  let h2 = 0x41c6ce57 ^ seed
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return 4294967296 * (2097151 & h2) + (h1 >>> 0)
}

export function mulberry32(seed: number) {
  let t = seed >>> 0
  return () => {
    t = (t + 0x6D2B79F5) >>> 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

/** Daily (or hourly) equity path. The last sample is the current value. */
export function equityPath(seedKey: string, points: number, endValue: number, changePct: number): number[] {
  const n = Math.max(2, points)
  const start = endValue / (1 + changePct / 100)
  const rand = mulberry32(hashSeed(seedKey))
  const rawSteps: number[] = []
  let acc = 0
  for (let i = 0; i < n; i++) {
    const step = rand() - 0.45
    rawSteps.push(step)
    acc += step
  }
  const target = (endValue - start) / Math.max(1, start)
  const factor = acc === 0 ? 0 : target / acc
  const out: number[] = []
  let v = start
  for (let i = 0; i < n; i++) {
    v = Math.max(0.01, v * (1 + rawSteps[i] * factor + (rand() - 0.5) * 0.005))
    out.push(v)
  }
  out[n - 1] = endValue
  return out
}

/**
 * Share of the book at each sample. Columns sum to 1. The last column is the
 * current share, so the right edge of the chart matches the rows.
 */
export function sharePaths(
  layers: { id: string; share: number }[],
  points: number,
  seedKey: string,
): number[][] {
  const n = Math.max(2, points)
  const count = layers.length
  if (!count) return Array.from({ length: n }, () => [])

  const raw = layers.map(layer => {
    const rand = mulberry32(hashSeed(`${seedKey}::${layer.id}`))
    const end = Math.max(0, layer.share)
    let w = Math.max(0.01, end > 0 ? end * (0.55 + rand() * 0.7) : 0.2)
    const path: number[] = []
    for (let i = 0; i < n; i++) {
      const pull = (end - w) * (0.08 + 0.22 * (i / (n - 1)))
      const noise = (rand() - 0.48) * Math.max(end, 0.05) * 0.12
      w = Math.max(0.004, w + pull + noise)
      path.push(w)
    }
    return path
  })

  const out: number[][] = []
  for (let i = 0; i < n; i++) {
    const sum = raw.reduce((s, path) => s + path[i], 0)
    out.push(raw.map(path => (sum > 0 ? path[i] / sum : 1 / count)))
  }
  const endSum = layers.reduce((s, layer) => s + Math.max(0, layer.share), 0)
  out[n - 1] = layers.map(layer => (endSum > 0 ? Math.max(0, layer.share) / endSum : 1 / count))
  return out
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
      bands[k].points.push({
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
      color: WALLET_COLORS[index % WALLET_COLORS.length],
      share: (Number(wallet.total_value) || 0) / sum,
    }))
    .sort((a, b) => a.share - b.share)
}

export interface RiskProfile {
  sharpe: number
  winRate: number
  concentration: number
  riskLevel: 'low' | 'medium' | 'high'
  riskScore: number
  exposure: Record<PieClass, number>
}

export function riskProfile(
  positions: { symbol: string; allocation_percentage?: number; return_percentage?: number; current_value?: number }[],
  history?: Record<string, { change_percentage?: number }>,
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
      exposure[pieClassOf(position.symbol)] += sum > 0 ? (values[index] / sum) * 100 : 0
    })
  }

  const periods = ['1d', '7d', '30d', '90d', '1y']
  const returns = periods.map(period => history?.[period]?.change_percentage ?? 0)
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length
  const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / returns.length
  const std = Math.sqrt(variance)
  const sharpe = std === 0 ? 0 : mean / std
  const winRate = positions.length
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
  return { sharpe, winRate, concentration, riskLevel, riskScore, exposure }
}

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
