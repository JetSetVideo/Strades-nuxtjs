/**
 * Pure rules for the strategy and bot pages (wave 2 "trading honesty").
 *
 *  - strategyTopStats: the 4 header numbers of /strategy/<id> and where they come
 *    from. A strategy with no backtest and no trades shows "—" + a pending chip
 *    (was 0.00 %, read as a real result); a sample (catalog) strategy keeps its
 *    numbers but is chipped Sample.
 *  - backtestFailureText: the server's error, in one sentence the user can act on
 *    (the creator used to record it and then navigate away).
 *  - assumptionsLine: "Assumes $10,000 · fee 10 bps · slippage 5 bps · from Settings"
 *    from the backtest result's `assumptions` (backend primary values).
 *  - tagSampleStrategies: rows loaded from the bundled catalog are not the user's.
 *  - botFillsView / botStatusText: catalog bots are never LIVE and never print a
 *    fill at an impossible price.
 */

export type SourceKind = 'account' | 'paper' | 'sample' | 'simulated' | 'pending'

// ── Strategy header ─────────────────────────────────────────────────────────

export interface TopStatsInput {
  sample?: boolean
  total_trades?: number | null
  total_return_percentage?: number | null
  current_capital?: number | null
  win_rate?: number | null
  sharpe_ratio?: number | null
}

export interface RealRunSummary {
  equity?: number | null
  metrics: { return_pct: number; win_rate: number | null; trades: number }
  window?: { bars: number } | null
}

export interface TopStats {
  returnPct: number | null
  capital: number | null
  winRate: number | null
  sharpe: number | null
  source: SourceKind
  note: string
}

const finiteOrNull = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

export function strategyTopStats(s: TopStatsInput, real: RealRunSummary | null, error?: string | null): TopStats {
  if (s.sample) {
    return {
      returnPct: finiteOrNull(s.total_return_percentage), capital: finiteOrNull(s.current_capital),
      winRate: finiteOrNull(s.win_rate), sharpe: finiteOrNull(s.sharpe_ratio),
      source: 'sample', note: 'Sample strategy from the catalog: these numbers are not yours.',
    }
  }
  if (real) {
    const equity = finiteOrNull(real.equity)
    return {
      returnPct: finiteOrNull(real.metrics.return_pct),
      capital: equity && equity > 0 ? equity : null,
      winRate: real.metrics.trades > 0 ? finiteOrNull(real.metrics.win_rate) : null,
      sharpe: null,
      source: 'simulated',
      note: `Backtest on past prices${real.window?.bars ? ` (${real.window.bars} bars)` : ''}, not live trading. Sharpe is not computed by the engine yet.`,
    }
  }
  if ((s.total_trades ?? 0) > 0) {
    return {
      returnPct: finiteOrNull(s.total_return_percentage), capital: finiteOrNull(s.current_capital),
      winRate: finiteOrNull(s.win_rate), sharpe: finiteOrNull(s.sharpe_ratio), source: 'account', note: '',
    }
  }
  return {
    returnPct: null, capital: null, winRate: null, sharpe: null, source: 'pending',
    note: error ? `Backtest failed: ${error}` : 'No backtest yet: press ↺ Backtest to run one on real prices.',
  }
}

// ── Backtest errors ─────────────────────────────────────────────────────────

export function backtestFailureText(status: number | undefined, message: string | undefined): string {
  const msg = (message ?? '').trim()
  if (status === 401) return 'Sign in to backtest on real prices.'
  if (status === 404) return 'This strategy is not saved on the server (it lives only in this browser or is a sample). Open it in the Creator and press Backtest to save and run it.'
  if (status === 503) return msg ? `No market data: ${msg}.` : 'No market data for this asset right now.'
  if (status === 400) return msg ? `The engine refused this strategy: ${msg}.` : 'The engine refused this strategy.'
  return msg && msg !== 'Request failed' ? msg : 'The backtest request failed. Try again in a minute.'
}

// ── Assumptions line ────────────────────────────────────────────────────────

export interface BacktestAssumptions {
  capital_usd?: number | string | null
  fee_bps?: number | string | null
  slippage_bps?: number | string | null
  source?: string | null
}

export function assumptionsLine(a: BacktestAssumptions | null | undefined): string | null {
  if (!a) return null
  const cap = Number(a.capital_usd)
  const fee = Number(a.fee_bps)
  const slip = Number(a.slippage_bps)
  const parts: string[] = []
  if (a.capital_usd !== null && a.capital_usd !== undefined && Number.isFinite(cap)) {
    parts.push(`$${Math.round(cap).toLocaleString('en-US')}`)
  }
  if (a.fee_bps !== null && a.fee_bps !== undefined && Number.isFinite(fee)) parts.push(`fee ${fee} bps`)
  if (a.slippage_bps !== null && a.slippage_bps !== undefined && Number.isFinite(slip)) parts.push(`slippage ${slip} bps`)
  if (!parts.length) return null
  const src = (a.source ?? '').toLowerCase()
  const from = !src ? '' : src.includes('setting') || src.includes('primary') || src === 'user'
    ? 'from Settings'
    : src.includes('default') || src.includes('platform') ? 'platform default' : `from ${a.source}`
  return `Assumes ${parts.join(' · ')}${from ? ` · ${from}` : ''}`
}

// ── Sample strategies ───────────────────────────────────────────────────────

/** Rows from the bundled catalog (public/data/core/strategies.json) are samples, not the user's. */
export function tagSampleStrategies<T extends object>(rows: T[]): (T & { sample: true })[] {
  return rows.map(r => ({ ...r, sample: true as const }))
}

// ── Bots ────────────────────────────────────────────────────────────────────

export interface BotFill {
  id: string; ts: number; side: 'buy' | 'sell'
  asset: string; price: number; size: number; pnl: number
}

/**
 * Fills shown for a catalog (non-server) bot. They are never observed, so they are
 * only drawn around a REAL current price (±2 %), and a DCA bot only buys. With no
 * real price for any target asset the list is empty and the page shows a notice.
 */
export function botFillsView(args: {
  botId: string
  botName: string
  count: number
  assets: string[]
  priceOf: (asset: string) => number | null
  rand: () => number
  now?: number
}): { fills: BotFill[]; hidden: boolean; reason: string } {
  const priced = args.assets.map(a => ({ a, p: args.priceOf(a) })).filter((x): x is { a: string; p: number } => x.p !== null && x.p > 0)
  if (!priced.length) {
    return { fills: [], hidden: true, reason: 'No live price for this bot\'s assets, so no simulated fills are drawn.' }
  }
  const n = Math.max(0, Math.min(12, Math.floor(args.count)))
  const dca = /\bdca\b/i.test(args.botName)
  const now = args.now ?? Date.now()
  const out: BotFill[] = []
  for (let i = 0; i < n; i++) {
    const pick = priced[Math.floor(args.rand() * priced.length)] ?? priced[0]!
    const side: 'buy' | 'sell' = dca || args.rand() < 0.6 ? 'buy' : 'sell'
    const price = pick.p * (1 + (args.rand() - 0.5) * 0.04)
    const notional = 50 + args.rand() * 450
    out.push({
      id: `f_${args.botId}_${i}`,
      ts: now - (i + 1) * 3_600_000 * (1 + args.rand() * 4),
      side, asset: pick.a, price, size: Number((notional / price).toPrecision(3)),
      pnl: (args.rand() - 0.5) * notional * 0.04,
    })
  }
  return { fills: out, hidden: false, reason: 'Simulated fills around the current real price: this bot is a sample, it does not trade.' }
}

/** Status text for a bot. A catalog bot is never "live". */
export function botStatusText(status: string, isServerBot: boolean): string {
  if (isServerBot) return status
  if (status === 'live') return 'running (simulated)'
  return `${status} (simulated)`
}

/** A next action in the past is not "now": unknown. */
export function nextActionTs(iso: string | null | undefined, now = Date.now()): number | null {
  if (!iso) return null
  const t = Date.parse(iso)
  return Number.isFinite(t) && t >= now ? t : null
}
