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

// ── Which asset does the engine trade? ──────────────────────────────────────
// The creator's FROM is the source (what you pay with), TO the target (what you
// get). The engine prices ONE asset against USDT (`assets.entry` → "<ENTRY>USDT"),
// buys it when the entry rule holds and sells it on the exit rule. Sending FROM
// as the entry made "USD → BTC" ask for "USDUSDT" (503 "no market data").
//
// Rule: the traded asset is the non-cash side.
//   USD → BTC   trade BTC, direction buy  (IF rule = when to buy BTC)
//   BTC → USD   trade BTC, direction sell (IF rule = when to sell BTC; buys back
//               when it stops holding, so the rule becomes the engine's EXIT)
//   ETH → BTC   documented choice: trade the TARGET (BTC) against USD, direction
//               buy. The engine has no ETH/BTC pair; ETH is not used (a note says so).
//   USD → USDT  refused: cash to cash, nothing to price.
// Cash ranks: USD-like stable = 2, other fiat = 1, anything else = 0; the lower
// rank is traded; a tie of non-cash or of fiat trades the TARGET.

const USD_CASH = new Set(['USD', 'USDT', 'USDC', 'BUSD', 'DAI', 'FDUSD', 'TUSD'])
const FIAT_CASH = new Set(['EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'CNY'])

/** 2 = USD-like cash, 1 = other fiat cash, 0 = an asset with a market of its own. */
export function cashRank(asset: string | undefined): 0 | 1 | 2 {
  const a = (asset ?? '').trim().toUpperCase()
  if (USD_CASH.has(a)) return 2
  if (FIAT_CASH.has(a)) return 1
  return 0
}

export interface TradedPair {
  /** Asset the engine prices and trades (against USD). */
  traded: string
  /** The other side of the flow (kept for display; the engine ignores it). */
  counter: string
  /** buy: the IF rule opens the position. sell: the IF rule closes it. */
  direction: 'buy' | 'sell'
  note?: string
}

export function tradedPair(from: string | undefined, to: string | undefined): TradedPair | { error: string } {
  const f = (from ?? '').trim().toUpperCase()
  const t = (to ?? '').trim().toUpperCase()
  if (!f && !t) return { error: 'Pick the asset to trade.' }
  if (!t || !f) {
    const only = f || t
    if (cashRank(only)) return { error: `${only} is cash: pick the asset to buy with it (TO).` }
    return { traded: only, counter: 'USD', direction: 'buy' }
  }
  if (f === t) return { error: `FROM and TO are both ${f}: pick two different assets.` }
  const rf = cashRank(f), rt = cashRank(t)
  if (rf === 2 && rt === 2) return { error: `${f} → ${t} is cash to cash: pick an asset to trade.` }
  if (rt < rf) return { traded: t, counter: f, direction: 'buy' }
  if (rf < rt) {
    return {
      traded: f, counter: t, direction: 'sell',
      note: `${f} → ${t}: holds ${f} and sells it for ${t} when your IF rule holds; buys back when it stops holding.`,
    }
  }
  return {
    traded: t, counter: f, direction: 'buy',
    note: `${f} → ${t}: the engine prices everything in USD, so it trades ${t} against USD; your ${f} is not used.`,
  }
}

/**
 * Creator rules → the Monte Carlo engine (useBacktest), which only models the
 * PRICE of one asset. Only "Price vs a number" rules can run there; any other
 * rule (RSI, SMA…) is reported as skipped instead of being turned into
 * "price < 30" (the old mapping sent `datasource:'price'` for every rule and
 * defaulted a missing value to 50000).
 */
export function toSimulatedConditions(conditions: CreatorCondition[], traded: string, timeframe: string): {
  conditions: { datasource: 'price'; asset: string; operator: string; value: number; timeframe: string }[]
  skipped: string[]
} {
  const out: { datasource: 'price'; asset: string; operator: string; value: number; timeframe: string }[] = []
  const skipped: string[] = []
  conditions.forEach((c, i) => {
    const value = Number(c.value)
    if (c.indicator !== 'PRICE' || c.valueType === 'indicator' || !Number.isFinite(value) || !OPERATORS[c.operator]) {
      skipped.push(`Rule ${i + 1} (${INDICATOR_LABELS[c.indicator] ?? c.indicator}) can't run on simulated prices: they only model the price.`)
      return
    }
    out.push({ datasource: 'price', asset: traded, operator: c.operator, value, timeframe })
  })
  return { conditions: out, skipped }
}

export function toServerStrategy(input: CreatorStrategyInput):
  { ok: true; payload: ServerStrategyPayload; notes: string[] } | { ok: false; errors: string[] } {
  const errors: string[] = []
  const notes: string[] = []
  const timeframe = serverFrequency(input.frequency)
  if (input.frequency && timeframe !== input.frequency) notes.push(`Runs on ${timeframe} bars (the engine has no ${input.frequency} replay).`)
  const pair = tradedPair(input.assetFrom, input.assetTo)

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
  if ('error' in pair) errors.push(pair.error)
  if (errors.length || 'error' in pair) return { ok: false, errors }

  const vars = Object.fromEntries((input.variables ?? []).map(v => [v.key, v.value]))
  const num = (v: unknown) => (v === undefined || v === '' ? undefined : Number(v))
  const stop = num(vars.stop_loss)
  const take = num(vars.take_profit)
  // The engine only exits on an explicit exit rule or stop/take (an entry-only
  // strategy buys once and holds forever). The creator has no exit rules yet, so
  // the opposite side is "when the IF rule stops holding", and we say so.
  // A sell flow (BTC → USD) inverts this: the IF rule is when to sell (exit).
  const negated = conditions.map(c => ({ ...c, operator: NEGATE[c.operator] ?? c.operator }))
  const stopTake = stop !== undefined || take !== undefined ? ', or at your stop-loss / take-profit.' : '.'
  const engineConditions: ServerCondition[] = pair.direction === 'buy'
    ? [...conditions, ...negated.map(c => ({ ...c, side: 'exit' as const }))]
    : [...negated.map(c => ({ ...c, side: 'entry' as const })), ...conditions.map(c => ({ ...c, side: 'exit' as const }))]
  if (pair.note) notes.push(pair.note)
  notes.push(pair.direction === 'buy'
    ? `Buys ${pair.traded} when your IF rule holds. Exit: when it stops holding${stopTake}`
    : `Sells ${pair.traded} when your IF rule holds${stopTake === '.' ? '' : ', or at your stop-loss / take-profit'}; buys back when it stops holding.`)
  return {
    ok: true,
    notes,
    payload: {
      name: input.name.trim() || 'Untitled strategy',
      description: input.description ?? '',
      category: input.category || 'technical',
      assets: { entry: pair.traded, exit: pair.counter },
      frequency: timeframe,
      conditions: engineConditions,
      parameters: {
        ...(stop !== undefined && Number.isFinite(stop) ? { stop_loss: stop } : {}),
        ...(take !== undefined && Number.isFinite(take) ? { take_profit: take } : {}),
        position_size: Math.min(1, Math.max(0.01, (input.allocation ?? 10) / 100)),
      },
    },
  }
}
