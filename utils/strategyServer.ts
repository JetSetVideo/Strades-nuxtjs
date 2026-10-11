/**
 * Creator → server strategy (POST /api/strategies/, executed by the backend
 * rules engine on real Binance candles).
 *
 * The engine refuses any condition it can't execute (400) rather than ignore
 * it, so this mapper reports unsupported pieces by name up front — the user
 * sees "MACD isn't supported yet" instead of a backtest that silently skipped
 * their rule.
 *
 * Engine vocabulary (Hermes, CHANNEL MSG-50):
 *   indicator  price | sma | ema | rsi | volume   (period via `period`)
 *   operator   > >= < <= == != cross_over cross_under
 *   value      number, or a reference "sma:50" | "ema:20" | "rsi:14" | "price"
 *   timeframe  15m | 1h | 4h | 1D
 */

export interface CreatorCondition {
  indicator: string
  indicatorParam?: number
  timeframe?: string
  operator: string
  valueType?: 'static' | 'indicator'
  value: number
  valueIndicator?: string
  valueIndicatorParam?: number
}

export interface CreatorStrategyInput {
  name: string
  description?: string
  category?: string
  assetFrom: string
  assetTo?: string
  frequency?: string
  allocation?: number               // % of equity per position
  variables?: { key: string; value: string }[]
  conditions: CreatorCondition[]
}

export interface ServerCondition {
  indicator: string
  period?: number
  operator: string
  value: number | string
  timeframe: string
  side: 'entry' | 'exit'
}

export interface ServerStrategyPayload {
  name: string
  description: string
  category: string
  assets: { entry: string; exit: string }
  frequency: string
  conditions: ServerCondition[]
  parameters: { stop_loss?: number; take_profit?: number; position_size: number }
}

const INDICATORS: Record<string, { name: string; period?: number }> = {
  PRICE: { name: 'price' },
  SMA: { name: 'sma', period: 20 },
  EMA: { name: 'ema', period: 20 },
  RSI: { name: 'rsi', period: 14 },
  VOLUME: { name: 'volume' },
}

const OPERATORS: Record<string, string> = {
  gt: '>', lt: '<', gte: '>=', lte: '<=', eq: '==', crosses_up: 'cross_over', crosses_dn: 'cross_under',
  '>': '>', '<': '<', '>=': '>=', '<=': '<=', '==': '==',
}

const NEGATE: Record<string, string> = {
  '>': '<=', '>=': '<', '<': '>=', '<=': '>', '==': '!=', '!=': '==', cross_over: 'cross_under', cross_under: 'cross_over',
}

/** Creator frequencies the engine can replay; coarser/finer ones are mapped to the nearest supported. */
export function serverFrequency(f: string | undefined): string {
  switch (f) {
    case '1m': case '5m': case '15m': return '15m'
    case '1h': return '1h'
    case '4h': return '4h'
    default: return '1D' // 1D, 1W, 1M → daily bars
  }
}

const INDICATOR_LABELS: Record<string, string> = {
  MACD: 'MACD', BOLL: 'Bollinger Bands', SENTIMENT: 'Social Sentiment', FEAR_GREED: 'Fear & Greed',
  VOLATILITY: 'Volatility (ATR)', ONCHAIN: 'On-chain Flow', SPREAD: 'Bid-Ask Spread',
}

export function toServerStrategy(input: CreatorStrategyInput):
  { ok: true; payload: ServerStrategyPayload; notes: string[] } | { ok: false; errors: string[] } {
  const errors: string[] = []
  const notes: string[] = []
  const timeframe = serverFrequency(input.frequency)
  if (input.frequency && timeframe !== input.frequency) notes.push(`Runs on ${timeframe} bars (the engine has no ${input.frequency} replay).`)

  const conditions: ServerCondition[] = []
  input.conditions.forEach((c, i) => {
    const ind = INDICATORS[c.indicator]
    const op = OPERATORS[c.operator]
    if (!ind) errors.push(`Rule ${i + 1}: "${INDICATOR_LABELS[c.indicator] ?? c.indicator}" can't be backtested yet. Use Price, SMA, EMA, RSI or Volume.`)
    if (!op) errors.push(`Rule ${i + 1}: comparison "${c.operator}" isn't supported.`)
    if (!ind || !op) return
    let value: number | string = Number(c.value)
    if (c.valueType === 'indicator') {
      const ref = c.valueIndicator ? INDICATORS[c.valueIndicator] : undefined
      if (!ref) { errors.push(`Rule ${i + 1}: can't compare against "${c.valueIndicator ?? '?'}".`); return }
      value = ref.period ? `${ref.name}:${c.valueIndicatorParam ?? ref.period}` : ref.name
    } else if (!Number.isFinite(value)) {
      errors.push(`Rule ${i + 1}: the value must be a number.`); return
    }
    conditions.push({
      indicator: ind.name,
      ...(ind.period ? { period: c.indicatorParam ?? ind.period } : {}),
      operator: op,
      value,
      timeframe,
      side: 'entry',
    })
  })
  if (!input.conditions.length) errors.push('Add at least one IF rule: it decides when the strategy buys.')
  if (!input.assetFrom) errors.push('Pick the asset to trade.')
  if (errors.length) return { ok: false, errors }

  const vars = Object.fromEntries((input.variables ?? []).map(v => [v.key, v.value]))
  const num = (v: unknown) => (v === undefined || v === '' ? undefined : Number(v))
  const stop = num(vars.stop_loss)
  const take = num(vars.take_profit)
  // The engine only exits on an explicit exit rule or stop/take (an entry-only
  // strategy buys once and holds forever). The creator has no exit rules yet, so
  // exit when the entry rule stops holding, and say so.
  const exits = conditions.map(c => ({ ...c, operator: NEGATE[c.operator] ?? c.operator, side: 'exit' as const }))
  conditions.push(...exits)
  notes.push('Exit: when your IF rule stops holding' + (stop !== undefined || take !== undefined ? ', or at your stop-loss / take-profit.' : '.'))
  return {
    ok: true,
    notes,
    payload: {
      name: input.name.trim() || 'Untitled strategy',
      description: input.description ?? '',
      category: input.category || 'technical',
      assets: { entry: input.assetFrom.toUpperCase(), exit: (input.assetTo || 'USD').toUpperCase() },
      frequency: timeframe,
      conditions,
      parameters: {
        ...(stop !== undefined && Number.isFinite(stop) ? { stop_loss: stop } : {}),
        ...(take !== undefined && Number.isFinite(take) ? { take_profit: take } : {}),
        position_size: Math.min(1, Math.max(0.01, (input.allocation ?? 10) / 100)),
      },
    },
  }
}
