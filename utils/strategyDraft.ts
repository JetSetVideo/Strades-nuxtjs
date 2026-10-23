import type { AllocationPie } from '~/types/allocation'

/** One parameter model for the card, the blueprint, and the JSON. */

export type AssetClass = 'crypto' | 'stocks' | 'forex' | 'commodities' | 'fiat'
export type PoolOp = 'include' | 'exclude'
export type SourceBasis = 'price' | 'calendar' | 'map' | 'both' | 'signal'
export type FormulaOp = 'if' | 'elif' | 'else' | 'add' | 'sub' | 'mul' | 'div' | 'exchange'
export type BlockType = 'condition' | 'action' | 'formula'

export interface PoolMember {
  id: string
  op: PoolOp
}

export interface FormulaData {
  op: FormulaOp
  left: string
  right: string
  into: string
}

export interface DraftBlock {
  type: BlockType
  id: number
  data: Record<string, unknown>
}

export interface MixShare {
  key: AssetClass
  label: string
  share: number
  color: string
}

export interface StructureMark {
  on: boolean
  tone: string
}

export const CLASS_META: Record<AssetClass, { label: string; color: string }> = {
  crypto: { label: 'Crypto', color: '#f7931a' },
  stocks: { label: 'Stocks', color: '#5b9cff' },
  forex: { label: 'Forex', color: '#3dd68c' },
  commodities: { label: 'Commodities', color: '#e6c15a' },
  fiat: { label: 'Fiat', color: '#7dcea0' },
}

export const BASIS_META: Record<SourceBasis, { label: string; color: string }> = {
  price: { label: 'Price', color: '#3dd68c' },
  calendar: { label: 'Calendar', color: '#ffb020' },
  map: { label: 'Map', color: '#3ec6e0' },
  both: { label: 'Map + calendar', color: '#c084fc' },
  signal: { label: 'Signal', color: '#9aa4b2' },
}

export const FORMULA_OPS: { id: FormulaOp; label: string; hint: string }[] = [
  { id: 'if', label: 'if', hint: 'Run the next step only when the test holds' },
  { id: 'elif', label: 'elif', hint: 'Next branch, when the previous if did not hold' },
  { id: 'else', label: 'else', hint: 'Fallback branch' },
  { id: 'add', label: '+', hint: 'Add two values' },
  { id: 'sub', label: '−', hint: 'Subtract' },
  { id: 'mul', label: '×', hint: 'Multiply' },
  { id: 'div', label: '÷', hint: 'Divide' },
  { id: 'exchange', label: 'exchange', hint: 'Move capital from one asset to another' },
]

export const SECTION_TONE: Record<string, string> = {
  identity: '#5b9cff',
  assets: '#3dd68c',
  sources: '#3ec6e0',
  logic: '#ffb020',
  avatars: '#c084fc',
  swarm: '#f472b6',
  variables: '#e6c15a',
  preview: '#d6d3d1',
}

const CLASS_OF: Record<string, AssetClass> = {
  BTC: 'crypto', ETH: 'crypto', SOL: 'crypto', BNB: 'crypto', ADA: 'crypto', DOGE: 'crypto',
  AAPL: 'stocks', TSLA: 'stocks', NVDA: 'stocks', MSFT: 'stocks', AMZN: 'stocks', GOOGL: 'stocks', SPY: 'stocks',
  'EUR/USD': 'forex', 'GBP/USD': 'forex', 'USD/JPY': 'forex',
  XAU: 'commodities', XAG: 'commodities', WTI: 'commodities',
  USD: 'fiat', EUR: 'fiat', USDT: 'fiat',
}

const CLASS_ASSET: Record<AssetClass, string> = {
  crypto: 'BTC', stocks: 'AAPL', forex: 'EUR/USD', commodities: 'XAU', fiat: 'USD',
}

const BASIS_BY_ID: Record<string, SourceBasis> = {
  ds_price_ohlcv: 'price',
  ds_order_flow: 'price',
  ds_options_flow: 'price',
  ds_defi_metrics: 'price',
  ds_econ_calendar: 'calendar',
  ds_forward_outlook: 'calendar',
  ds_news_events: 'calendar',
  ds_arena_community: 'calendar',
  ds_region_map: 'map',
  ds_geopolitical: 'map',
  ds_lane_weather: 'both',
  ds_macro_indicators: 'both',
}

export function assetClass(id: string): AssetClass {
  return CLASS_OF[id] ?? 'crypto'
}

export function classAsset(cls: AssetClass): string {
  return CLASS_ASSET[cls]
}

export interface SourceLike {
  id?: string
  name?: string
  category?: string
  tags?: string[]
  basis?: string
}

export function sourceBasis(src: SourceLike): SourceBasis {
  const explicit = src.basis
  if (explicit === 'price' || explicit === 'calendar' || explicit === 'map' || explicit === 'both' || explicit === 'signal') {
    return explicit
  }
  if (src.id && BASIS_BY_ID[src.id]) return BASIS_BY_ID[src.id]
  const blob = `${src.id ?? ''} ${src.name ?? ''} ${src.category ?? ''} ${(src.tags ?? []).join(' ')}`.toLowerCase()
  const calendar = /calendar|earnings|event|predict|forecast|forward|schedule/.test(blob)
  const map = /geo|map|region|zone|shipping|lane|conflict/.test(blob)
  const price = /price|ohlcv|order|volume|options|yield|market/.test(blob)
  if ((calendar && map) || (calendar && price && map)) return 'both'
  if (calendar && price) return 'both'
  if (calendar) return 'calendar'
  if (map) return 'map'
  if (price) return 'price'
  return 'signal'
}

function sharesFromWeights(weights: Partial<Record<AssetClass, number>>): MixShare[] {
  const raw = (Object.keys(CLASS_META) as AssetClass[]).filter(k => (weights[k] ?? 0) > 0)
  const sum = raw.reduce((s, k) => s + (weights[k] ?? 0), 0) || 1
  const keys = raw.filter(k => (weights[k] ?? 0) / sum >= 0.01)
  const kept = keys.reduce((s, k) => s + (weights[k] ?? 0), 0) || 1
  return keys.map(key => ({
    key,
    label: CLASS_META[key].label,
    share: (weights[key] ?? 0) / kept,
    color: CLASS_META[key].color,
  }))
}

export function startWeights(input: {
  pool: PoolMember[]
  assetFrom: string
  wallet?: AllocationPie | null
}): Partial<Record<AssetClass, number>> {
  const included = input.pool.filter(p => p.op === 'include')
  if (included.length) {
    const weights: Partial<Record<AssetClass, number>> = {}
    for (const member of included) {
      const cls = assetClass(member.id)
      weights[cls] = (weights[cls] ?? 0) + 1
    }
    return weights
  }
  if (input.wallet) {
    const weights: Partial<Record<AssetClass, number>> = {
      crypto: input.wallet.crypto,
      stocks: input.wallet.stocks,
      commodities: input.wallet.commodities,
      fiat: input.wallet.fiat,
    }
    if (input.assetFrom) {
      const cls = assetClass(input.assetFrom)
      if ((weights[cls] ?? 0) < 1) weights[cls] = 8
    }
    return weights
  }
  if (input.assetFrom) return { [assetClass(input.assetFrom)]: 100 }
  return { crypto: 25, stocks: 25, commodities: 25, fiat: 25 }
}

export function targetWeights(input: {
  start: Partial<Record<AssetClass, number>>
  assetFrom: string
  assetTo: string
  allocation: number
  exchangePct: number
}): Partial<Record<AssetClass, number>> {
  const weights: Partial<Record<AssetClass, number>> = { ...input.start }
  const total = Object.values(weights).reduce((s, n) => s + (n ?? 0), 0) || 100
  const shift = Math.min(total, Math.max(0, input.allocation + input.exchangePct) / 100 * total)
  const from = input.assetFrom ? assetClass(input.assetFrom) : largestClass(weights)
  const to = input.assetTo ? assetClass(input.assetTo) : from
  if (!from || from === to || shift <= 0) return weights
  const available = weights[from] ?? 0
  const moved = Math.min(available, shift)
  weights[from] = available - moved
  weights[to] = (weights[to] ?? 0) + moved
  return weights
}

function largestClass(weights: Partial<Record<AssetClass, number>>): AssetClass {
  let best: AssetClass = 'crypto'
  let n = -1
  for (const key of Object.keys(CLASS_META) as AssetClass[]) {
    const v = weights[key] ?? 0
    if (v > n) { best = key; n = v }
  }
  return best
}

export function exchangePct(blocks: DraftBlock[]): number {
  return blocks.reduce((sum, block) => {
    if (block.type !== 'formula') return sum
    if (block.data.op !== 'exchange') return sum
    const n = Number(block.data.into)
    return sum + (Number.isFinite(n) ? n : 0)
  }, 0)
}

export interface WheelModel {
  start: MixShare[]
  end: MixShare[]
  marks: StructureMark[]
}

const MARKS = 28

export function wheelModel(input: {
  pool: PoolMember[]
  assetFrom: string
  assetTo: string
  allocation: number
  wallet?: AllocationPie | null
  blocks: DraftBlock[]
  sourceBases: SourceBasis[]
  frequency: string
}): WheelModel {
  const startW = startWeights(input)
  const endW = targetWeights({
    start: startW,
    assetFrom: input.assetFrom,
    assetTo: input.assetTo,
    allocation: input.allocation,
    exchangePct: exchangePct(input.blocks),
  })
  return {
    start: sharesFromWeights(startW),
    end: sharesFromWeights(endW),
    marks: structureMarks(input),
  }
}

const BLOCK_TONE: Record<BlockType, string> = {
  condition: '#5b9cff',
  action: '#ffb020',
  formula: '#c084fc',
}

export function structureMarks(input: {
  pool: PoolMember[]
  blocks: DraftBlock[]
  sourceBases: SourceBasis[]
  frequency: string
}): StructureMark[] {
  const marks: StructureMark[] = Array.from({ length: MARKS }, () => ({ on: false, tone: 'rgba(255,255,255,0.14)' }))
  input.blocks.forEach((block, i) => {
    if (i >= MARKS) return
    marks[i] = { on: true, tone: BLOCK_TONE[block.type] ?? '#d6d3d1' }
  })
  const signals = [
    ...input.pool.map(p => `${p.op}:${p.id}`),
    ...input.sourceBases,
    input.frequency,
    ...input.blocks.map(b => `${b.type}:${String(b.data.op ?? b.data.operator ?? b.data.type ?? '')}`),
  ]
  let cursor = Math.min(MARKS - 1, input.blocks.length)
  for (const signal of signals) {
    if (cursor >= MARKS) break
    const basis = (['price', 'calendar', 'map', 'both', 'signal'] as const).find(b => signal === b)
    const tone = signal.startsWith('exclude')
      ? '#ff5a6a'
      : signal.startsWith('include')
        ? '#3dd68c'
        : basis
          ? BASIS_META[basis].color
          : '#d6d3d1'
    marks[cursor] = { on: true, tone }
    cursor += 1
  }
  return marks
}

export interface DraftShape {
  name: string
  description: string
  category: string
  assetFrom: string
  assetTo: string
  allocation: number
  frequency: string
  dataSources: string[]
  pool: PoolMember[]
  variables: { key: string; value: string }[]
  blocks: DraftBlock[]
  selectedProfiles: string[]
  period: { start: string | null; end: string | null }
}

/** The parameter object the card, the blueprint, and the JSON all read. */
export function strategyParameters(draft: DraftShape, sourceBases: SourceBasis[] = []) {
  const wheel = wheelModel({ ...draft, wallet: null, sourceBases })
  return {
    name: draft.name,
    description: draft.description,
    category: draft.category,
    universe: {
      from: draft.assetFrom,
      to: draft.assetTo,
      allocation: draft.allocation,
      pool: draft.pool,
    },
    frequency: draft.frequency,
    period: draft.period,
    sources: draft.dataSources.map((id, i) => ({ id, basis: sourceBases[i] ?? 'signal' })),
    logic: draft.blocks.map(b => ({ id: b.id, type: b.type, data: b.data })),
    variables: Object.fromEntries(draft.variables.filter(v => v.key).map(v => [v.key, v.value])),
    profiles: draft.selectedProfiles,
    mix: {
      start: wheel.start.map(s => ({ class: s.key, pct: Math.round(s.share * 1000) / 10 })),
      leadsTo: wheel.end.map(s => ({ class: s.key, pct: Math.round(s.share * 1000) / 10 })),
    },
  }
}

export function patchFromParameters(raw: unknown): Partial<DraftShape> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  const patch: Partial<DraftShape> = {}
  if (typeof o.name === 'string') patch.name = o.name
  if (typeof o.description === 'string') patch.description = o.description
  if (typeof o.category === 'string') patch.category = o.category
  if (typeof o.frequency === 'string') patch.frequency = o.frequency
  const universe = o.universe
  if (universe && typeof universe === 'object') {
    const u = universe as Record<string, unknown>
    if (typeof u.from === 'string') patch.assetFrom = u.from
    if (typeof u.to === 'string') patch.assetTo = u.to
    if (typeof u.allocation === 'number' && Number.isFinite(u.allocation)) patch.allocation = u.allocation
    if (Array.isArray(u.pool)) {
      patch.pool = u.pool.flatMap(item => {
        if (!item || typeof item !== 'object') return []
        const row = item as Record<string, unknown>
        if (typeof row.id !== 'string') return []
        const op: PoolOp = row.op === 'exclude' ? 'exclude' : 'include'
        return [{ id: row.id, op }]
      })
    }
  }
  if (Array.isArray(o.sources)) {
    patch.dataSources = o.sources.flatMap(item => {
      if (typeof item === 'string') return [item]
      if (item && typeof item === 'object' && typeof (item as { id?: string }).id === 'string') return [(item as { id: string }).id]
      return []
    })
  }
  if (Array.isArray(o.logic)) {
    patch.blocks = o.logic.flatMap((item, index) => {
      if (!item || typeof item !== 'object') return []
      const row = item as Record<string, unknown>
      const type = row.type
      if (type !== 'condition' && type !== 'action' && type !== 'formula') return []
      const id = typeof row.id === 'number' ? row.id : index + 1
      if (row.data && typeof row.data === 'object' && !Array.isArray(row.data)) {
        return [{ type, id, data: row.data as Record<string, unknown> }]
      }
      const { type: _t, id: _id, ...data } = row
      return [{ type, id, data }]
    })
  }
  if (o.variables && typeof o.variables === 'object' && !Array.isArray(o.variables)) {
    patch.variables = Object.entries(o.variables as Record<string, unknown>).map(([key, value]) => ({
      key, value: String(value ?? ''),
    }))
  }
  if (Array.isArray(o.profiles)) {
    patch.selectedProfiles = o.profiles.filter((id): id is string => typeof id === 'string')
  }
  if (o.period && typeof o.period === 'object') {
    const p = o.period as Record<string, unknown>
    patch.period = {
      start: typeof p.start === 'string' ? p.start : null,
      end: typeof p.end === 'string' ? p.end : null,
    }
  }
  return patch
}

function frequencyForPeriod(periodS: number): string {
  if (periodS <= 900) return '15m'
  if (periodS <= 3600) return '1h'
  if (periodS <= 14400) return '4h'
  return '1D'
}

/** Fill a draft from the wallet mix, the swarm the user follows, and their trading prefs. */
export function suggestFromProfile(input: {
  pie: AllocationPie
  swarm: AllocationPie
  periodS: number
  bars: number
  now?: number
}): Partial<DraftShape> {
  const pieWeights: Partial<Record<AssetClass, number>> = {
    crypto: input.pie.crypto,
    stocks: input.pie.stocks,
    commodities: input.pie.commodities,
    fiat: input.pie.fiat,
    forex: 0,
  }
  const swarmWeights: Partial<Record<AssetClass, number>> = {
    crypto: input.swarm.crypto,
    stocks: input.swarm.stocks,
    commodities: input.swarm.commodities,
    fiat: input.swarm.fiat,
  }
  const ranked = (Object.keys(CLASS_META) as AssetClass[])
    .map(cls => ({ cls, w: pieWeights[cls] ?? 0 }))
    .sort((a, b) => b.w - a.w)
  const fromCls = ranked[0]?.cls ?? 'crypto'
  const swarmRanked = (Object.keys(swarmWeights) as AssetClass[])
    .filter(cls => cls !== 'forex')
    .sort((a, b) => (swarmWeights[b] ?? 0) - (swarmWeights[a] ?? 0))
  const toCls = swarmRanked.find(cls => cls !== fromCls) ?? ranked[1]?.cls ?? 'fiat'
  const from = classAsset(fromCls)
  const to = classAsset(toCls)
  const pool: PoolMember[] = []
  for (const { cls, w } of ranked) {
    if (cls === 'forex') continue
    const id = classAsset(cls)
    if (w >= 8 || cls === toCls) pool.push({ id, op: 'include' })
    else if (w < 4) pool.push({ id, op: 'exclude' })
  }
  if (!pool.some(p => p.id === from)) pool.unshift({ id: from, op: 'include' })
  if (!pool.some(p => p.id === to)) pool.push({ id: to, op: 'include' })

  const allocation = Math.min(80, Math.max(10, Math.round(Math.abs((pieWeights[fromCls] ?? 0) - (swarmWeights[toCls] ?? 0)) || 25)))
  const now = input.now ?? Date.now()
  const end = new Date(now)
  const start = new Date(end.getTime() - Math.max(7, input.bars) * 86400000)
  const sources = ['ds_price_ohlcv']
  if ((pieWeights.stocks ?? 0) >= 12 || (pieWeights.fiat ?? 0) >= 12) sources.push('ds_econ_calendar')
  if ((pieWeights.commodities ?? 0) >= 8) sources.push('ds_region_map')
  if ((pieWeights.stocks ?? 0) >= 8 && (pieWeights.commodities ?? 0) >= 8) sources.push('ds_lane_weather')
  if ((pieWeights.crypto ?? 0) >= 30) sources.push('ds_onchain')

  const blocks: DraftBlock[] = [
    { type: 'condition', id: now, data: { indicator: 'RSI', indicatorParam: 14, timeframe: frequencyForPeriod(input.periodS), operator: 'lt', valueType: 'static', value: 35 } },
    { type: 'formula', id: now + 1, data: { op: 'if', left: 'RSI(14)', right: '35', into: 'dip' } },
    { type: 'formula', id: now + 2, data: { op: 'div', left: String(allocation), right: 'risk', into: 'size' } },
    { type: 'formula', id: now + 3, data: { op: 'exchange', left: from, right: to, into: String(allocation) } },
    { type: 'action', id: now + 4, data: { type: 'shift', allocation, fromAsset: from, toAsset: to, timing: 'next_candle', slippage: 0.1 } },
  ]

  return {
    name: `${from} → ${to} profile`,
    description: `Starts from the current mix and exchanges ${allocation}% toward ${to} when RSI(14) is below 35. Included assets follow the profile; thin classes stay out.`,
    category: pool.filter(p => p.op === 'include').length > 2 ? 'multi-asset' : fromCls === 'fiat' ? 'multi-asset' : fromCls,
    assetFrom: from,
    assetTo: to,
    allocation,
    frequency: frequencyForPeriod(input.periodS),
    dataSources: sources,
    pool,
    variables: [
      { key: 'RSI_THRESHOLD', value: '35' },
      { key: 'stop_loss', value: '6' },
    ],
    blocks,
    period: {
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
    },
  }
}
