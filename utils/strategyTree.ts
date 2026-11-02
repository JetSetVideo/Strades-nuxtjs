/**
 * Value tree for the real-price backtest card on /strategy/[id]: "Strategy return", opened top-down:
 *   Strategy return -> (final equity − capital) / capital
 *                   -> starting capital, final equity, closed trades, fees paid, slippage, buy & hold
 *                   -> the Settings primary values the run read (starting capital, fee, slippage, benchmark).
 * Same numbers as the backend rules engine (Strades-backend apps/trading/chainbot/rules_backtest.py):
 *   return_pct = (final / capital − 1) × 100; fees = Σ |notional| × fee_bps / 10,000 on every fill;
 *   buy fill = price × (1 + slippage_bps / 10,000), sell fill = price × (1 − slippage_bps / 10,000);
 *   buy & hold = (last close / first close − 1) × 100 of the same market and window.
 * Pure: no Nuxt, no store. Zero and unknown still open (formula, inputs at 0 or "—" with a reason, settings).
 */
import { DASH, fmtNumber, pctDecimals } from '~/utils/format'
import { fmtMoneyKpi, formatValue, type ValueNode, type ValueSetting } from '~/utils/valueTree'

export interface StratRunLike {
  capital?: number | string | null
  equity?: number | string | null
  metrics?: { return_pct?: number | null; trades?: number | null; win_rate?: number | null; fees?: number | null } | null
  benchmark?: { buy_hold_pct?: number | null } | null
  window?: { symbol?: string | null; bars?: number | null } | null
  assumptions?: { capital_usd?: number | string | null; fee_bps?: number | string | null; slippage_bps?: number | string | null; source?: string | null } | null
  trades?: { pnl?: number | null }[] | null
  equity_curve?: unknown[] | null
}

type Primary = Record<string, unknown>

export const STRAT_RETURN_FORMULA = 'return = (final equity − capital) / capital'

export const STRAT_IDS = {
  root: 'strategy.return',
  capital: 'strategy.return.capital',
  equity: 'strategy.return.final_equity',
  trades: 'strategy.return.trades',
  winRate: 'strategy.return.trades.win_rate',
  closedPnl: 'strategy.return.trades.closed_pnl',
  fees: 'strategy.return.fees',
  feeBps: 'strategy.return.fees.fee_bps',
  slippage: 'strategy.return.slippage',
  buyHold: 'strategy.return.buy_hold',
} as const

const SRC_RUN = (field: string) => ({ kind: 'api' as const, name: `POST /api/strategies/{id}/backtest/ · ${field}` })

/** A finite number from a number or numeric string, else null. */
function stratNum(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

function current(key: string, values: Primary, defaults: Primary): unknown {
  const v = values[key]
  return v === null || v === undefined ? defaults[key] : v
}

/** The four Settings links of the card, with the CURRENT setting (the run may have used an older one). */
export function stratSettings(values: Primary = {}, defaults: Primary = {}): ValueSetting[] {
  const cap = stratNum(current('starting_capital', values, defaults))
  const fee = stratNum(current('fee_bps', values, defaults))
  const slip = stratNum(current('slippage_bps', values, defaults))
  const bench = current('benchmark', values, defaults)
  const read = Object.keys(values).length > 0 || Object.keys(defaults).length > 0
  const show = (v: string | null) => (read ? v : DASH)
  return [
    { key: 'starting_capital', label: 'Paper starting capital', value: show(cap === null ? null : fmtMoneyKpi(cap)), href: '/settings#set-starting_capital' },
    { key: 'fee_bps', label: 'Fee per side', value: show(fee === null ? null : formatValue(fee, 'bps')), href: '/settings#set-fee_bps' },
    { key: 'slippage_bps', label: 'Slippage', value: show(slip === null ? null : formatValue(slip, 'bps')), href: '/settings#set-slippage_bps' },
    { key: 'benchmark', label: 'Benchmark', value: show(typeof bench === 'string' && bench ? bench : null), href: '/settings#set-benchmark' },
  ]
}

const pick = (all: ValueSetting[], key: string) => all.filter(s => s.key === key)

/**
 * "Strategy return" as a value tree.
 *  - run: the backtest result (full run, or the saved summary GET /api/strategies/ keeps);
 *  - null run: not run yet / failed / running — every input still listed, "—" with the reason.
 */
export function strategyReturnTree(input: {
  run: StratRunLike | null
  error?: string | null
  running?: boolean
  settings?: Primary
  settingsDefaults?: Primary
}): ValueNode {
  const values = input.settings ?? {}
  const defaults = input.settingsDefaults ?? {}
  const settings = stratSettings(values, defaults)
  const run = input.run
  const base = {
    id: STRAT_IDS.root,
    label: 'Strategy return',
    unit: 'pct' as const,
    signed: true,
    formula: STRAT_RETURN_FORMULA,
    settings,
    source: SRC_RUN('metrics.return_pct'),
    explain: 'The backend replays the strategy\'s rules on real past candles of one market, starting from your '
      + 'paper starting capital, paying the fee on every entry and exit and filling every order with the slippage.',
  }

  if (!run) {
    const reason = input.running ? 'Replaying real candles on the server…'
      : input.error ? `The backtest failed: ${input.error}` : 'Not run yet: press Run on real prices.'
    const blank = (id: string, label: string, unit: ValueNode['unit'], extra: Partial<ValueNode> = {}): ValueNode =>
      ({ id, label, value: null, unit, reason, ...extra })
    return {
      ...base,
      value: null,
      status: input.running ? 'loading' : input.error ? 'error' : 'empty',
      reason,
      inputs: [
        blank(STRAT_IDS.capital, 'Starting capital', 'usd', { settings: pick(settings, 'starting_capital') }),
        blank(STRAT_IDS.equity, 'Final equity', 'usd'),
        blank(STRAT_IDS.trades, 'Closed trades', 'count'),
        blank(STRAT_IDS.fees, 'Fees paid', 'usd', { settings: pick(settings, 'fee_bps') }),
        blank(STRAT_IDS.slippage, 'Slippage assumption', 'bps', { settings: pick(settings, 'slippage_bps') }),
        blank(STRAT_IDS.buyHold, 'Buy & hold (same market)', 'pct', { signed: true, settings: pick(settings, 'benchmark') }),
      ],
    }
  }

  const a = run.assumptions ?? {}
  const m = run.metrics ?? {}
  const symbol = (run.window?.symbol ?? '').toString()
  const market = symbol.replace(/USDT$/, '') || 'this market'
  const bars = stratNum(run.window?.bars)
  const ret = stratNum(m.return_pct)
  const trades = stratNum(m.trades)
  const fees = stratNum(m.fees)
  const feeBps = stratNum(a.fee_bps)
  const slipBps = stratNum(a.slippage_bps)
  const buyHold = stratNum(run.benchmark?.buy_hold_pct)
  const runCapital = stratNum(run.capital)
  const runEquity = stratNum(run.equity)
  const capital = stratNum(a.capital_usd) ?? (runCapital !== null && runCapital > 0 ? runCapital : null)
  const SUMMARY = 'Not kept in the saved summary of the last run: re-run the backtest to see it.'

  // ── starting capital ──
  const capSetting = stratNum(current('starting_capital', values, defaults))
  const capStale = capital !== null && capSetting !== null && Math.abs(capSetting - capital) >= 0.005
  const capitalNode: ValueNode = {
    id: STRAT_IDS.capital, label: 'Starting capital', value: capital, unit: 'usd',
    source: SRC_RUN('assumptions.capital_usd'),
    settings: pick(settings, 'starting_capital'),
    explain: 'The paper cash the replay starts with: your Settings › Paper starting capital when it ran.',
    ...(capital === null ? { reason: SUMMARY } : capStale
      ? { status: 'stale' as const, reason: `Your setting is now ${fmtMoneyKpi(capSetting)}: re-run to use it.` }
      : {}),
  }

  // ── final equity: the API value, else derived from capital and the return ──
  let equity: number | null = runEquity !== null && runEquity > 0 ? runEquity : null
  let equitySrc: ValueNode['source'] = SRC_RUN('equity')
  if (equity === null && capital !== null && ret !== null) {
    equity = capital * (1 + ret / 100)
    equitySrc = { kind: 'computed', name: 'capital × (1 + return), from the saved summary' }
  }
  const equityNode: ValueNode = {
    id: STRAT_IDS.equity, label: 'Final equity', value: equity, unit: 'usd', source: equitySrc,
    formula: 'final equity = cash + open position × last close',
    explain: 'Equity on the last bar: cash after every fill and fee, plus a position still open valued at the last close.',
    ...(equity === null ? { reason: SUMMARY } : {}),
  }

  // ── closed trades ──
  const fullRun = Array.isArray(run.equity_curve) && run.equity_curve.length > 0
  const tradeRows = Array.isArray(run.trades) ? run.trades : []
  const closedPnl = trades === 0 ? 0
    : tradeRows.length ? tradeRows.reduce((s, t) => s + (stratNum(t.pnl) ?? 0), 0)
      : null
  const winRate = trades ? stratNum(m.win_rate) : null
  const tradesNode: ValueNode = {
    id: STRAT_IDS.trades, label: 'Closed trades', value: trades, unit: 'count', source: SRC_RUN('metrics.trades'),
    explain: 'A trade closes on your exit rule, the stop loss or the take profit. A position still open at the end is not counted here; it is inside final equity.',
    ...(trades === null ? { reason: SUMMARY } : trades === 0 ? { status: 'empty' as const, reason: 'Your entry rule never held in this window: nothing was tested.' } : {}),
    inputs: [
      {
        id: STRAT_IDS.winRate, label: 'Win rate', value: winRate, unit: 'pct', source: SRC_RUN('metrics.win_rate'),
        formula: 'win rate = trades with P&L > 0 ÷ closed trades',
        ...(winRate === null ? { reason: trades === 0 ? 'No closed trade: nothing to score.' : SUMMARY } : {}),
      },
      {
        id: STRAT_IDS.closedPnl, label: 'P&L of closed trades', value: closedPnl, unit: 'usd', signed: true,
        source: { kind: 'computed', name: 'Σ trades[].pnl' },
        formula: 'P&L = (exit fill − entry fill) × quantity − exit fee, summed over closed trades',
        explain: 'The entry fee is paid in cash when the position opens, so it is in final equity but not in a trade\'s P&L.',
        ...(closedPnl === null ? { reason: fullRun ? 'No trade list in this result.' : SUMMARY } : {}),
      },
    ],
  }

  // ── fees ──
  const feesNode: ValueNode = {
    id: STRAT_IDS.fees, label: trades === 0 && fees ? 'Fees on open position' : 'Fees paid', value: fees, unit: 'usd',
    source: SRC_RUN('metrics.fees'),
    formula: 'fees = Σ fill price × quantity × fee per side ÷ 10,000, on every entry and exit',
    explain: 'Already taken out of final equity.',
    settings: pick(settings, 'fee_bps'),
    ...(fees === null ? { reason: SUMMARY } : {}),
    inputs: [{
      id: STRAT_IDS.feeBps, label: 'Fee per side', value: feeBps, unit: 'bps', source: SRC_RUN('assumptions.fee_bps'),
      settings: pick(settings, 'fee_bps'),
      ...(feeBps === null ? { reason: SUMMARY } : {}),
    }],
  }

  // ── slippage ──
  const slippageNode: ValueNode = {
    id: STRAT_IDS.slippage, label: 'Slippage assumption', value: slipBps, unit: 'bps', source: SRC_RUN('assumptions.slippage_bps'),
    formula: 'buy fill = price × (1 + slippage ÷ 10,000) · sell fill = price × (1 − slippage ÷ 10,000)',
    explain: 'Every order fills a little worse than the quoted price. It is inside each fill price, so it shows in the trades and final equity, not as a separate cost.',
    settings: pick(settings, 'slippage_bps'),
    ...(slipBps === null ? { reason: SUMMARY } : {}),
  }

  // ── buy & hold, for comparison ──
  const bench = current('benchmark', values, defaults)
  const benchText = typeof bench === 'string' && bench ? bench : null
  const buyHoldNode: ValueNode = {
    id: STRAT_IDS.buyHold, label: `Buy & hold ${market} (comparison)`, value: buyHold, unit: 'pct', signed: true,
    source: SRC_RUN('benchmark.buy_hold_pct'),
    formula: 'buy & hold = (last close − first close) / first close',
    explain: `For comparison only, not part of the return: buying ${market} on the first bar and holding it to the last`
      + `${bars !== null ? ` (${formatValue(bars, 'count')} bars)` : ''}, no fees.`
      + (ret === null || buyHold === null ? ''
        : trades === 0 ? ' The strategy never traded here (it stayed in cash), so this window tested nothing.'
          : ` The strategy did ${ret >= buyHold ? 'better' : 'worse'} by ${fmtNumber(Math.abs(ret - buyHold), { decimals: pctDecimals(Math.abs(ret - buyHold)) })} points.`)
      + ` Your Benchmark setting${benchText ? ` (${benchText})` : ''} is not used here yet: the comparison is always the strategy's own market.`,
    settings: pick(settings, 'benchmark'),
    ...(buyHold === null ? { reason: SUMMARY } : {}),
  }

  return {
    ...base,
    value: ret,
    ...(ret === null ? { reason: SUMMARY } : {}),
    inputs: [capitalNode, equityNode, tradesNode, feesNode, slippageNode, buyHoldNode],
  }
}
