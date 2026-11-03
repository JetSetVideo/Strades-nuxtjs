/**
 * Card lab variant A — "trading terminal" view model (swarm 2026-11-02 "cards").
 * Pure: catalog record in, labelled + formatted cells out. Every cell names its real meaning and period;
 * a field the record lacks prints "—" or "not recorded", never a default.
 *
 * Fixed scales (so bar length compares ACROSS cards, not within one):
 *   return ±25 % · max drawdown 0–25 % · Sharpe −1…3 · volatility 0–50 % · win rate 0–100 %.
 */
import { DASH, fmtCount, fmtDate, fmtMoney, fmtNumber, fmtPctFromPercent, fmtSignedMoney, isNum } from '~/utils/format'

export type CardLabATone = 'up' | 'down' | 'warn' | 'flat'

export interface CardLabABar {
  /** 0..1 share of the track */
  fill: number
  /** diverging bars: where 0 sits on the track (0..1) */
  zero?: number
  tone: CardLabATone
}

export interface CardLabACell {
  key: string
  label: string
  value: string
  sub?: string
  tone: CardLabATone
  bar?: CardLabABar
  /** one plain sentence: field meaning + scale */
  hint: string
}

export interface CardLabAModel {
  name: string
  category: string
  assets: string[]
  indicators: string[]
  tags: string[]
  status: { key: 'active' | 'paused' | 'stopped' | 'unknown'; label: string; tone: CardLabATone }
  automation: { key: string; label: string }
  risk: { level: 0 | 1 | 2 | 3; label: string; tone: CardLabATone }
  visibility: string
  price: { label: string; premium: boolean }
  rule: string
  ret: { pct: string; usd: string; capital: string; period: string; periodKnown: boolean; tone: CardLabATone; bar: CardLabABar }
  cells: CardLabACell[]
  winCheck: string | null
  smallSample: boolean
  hold: string
  style: string | null
  creator: string
  agent: string
  social: { followers: string; likes: string; comments: string }
  dates: { created: string; lastRun: string }
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))

export function cardLabATone(v: unknown, warnBelow?: number): CardLabATone {
  if (!isNum(v)) return 'flat'
  if (v < 0) return 'down'
  if (warnBelow !== undefined && v < warnBelow) return 'warn'
  return v > 0 ? 'up' : 'flat'
}

/** Diverging bar on a symmetric ±scale: zero in the middle. */
export function cardLabADiverging(v: unknown, scale: number): CardLabABar {
  if (!isNum(v)) return { fill: 0, zero: 0.5, tone: 'flat' }
  return { fill: clamp01(Math.abs(v) / scale) / 2, zero: 0.5, tone: v < 0 ? 'down' : v > 0 ? 'up' : 'flat' }
}

/** Plain bar from `min` to `max` (values outside are clamped). */
export function cardLabALinear(v: unknown, min: number, max: number, tone: CardLabATone): CardLabABar {
  if (!isNum(v)) return { fill: 0, tone: 'flat' }
  return { fill: clamp01((v - min) / (max - min)), tone }
}

const pct = (v: unknown, signed = false) => (isNum(v) ? fmtPctFromPercent(v, { decimals: 1, signed }) : DASH)

export function cardLabAStatus(s: unknown): CardLabAModel['status'] {
  if (s === 'active') return { key: 'active', label: 'ACTIVE', tone: 'up' }
  if (s === 'paused') return { key: 'paused', label: 'PAUSED', tone: 'warn' }
  if (s === 'stopped') return { key: 'stopped', label: 'STOPPED', tone: 'down' }
  return { key: 'unknown', label: DASH, tone: 'flat' }
}

export function cardLabAAutomation(t: unknown): CardLabAModel['automation'] {
  if (t === 'automated') return { key: 'automated', label: 'AUTOMATED' }
  if (t === 'semi_automated') return { key: 'semi_automated', label: 'SEMI-AUTO' }
  if (t === 'manual') return { key: 'manual', label: 'MANUAL' }
  return { key: 'unknown', label: DASH }
}

export function cardLabARisk(r: unknown): CardLabAModel['risk'] {
  if (r === 'low') return { level: 1, label: 'LOW', tone: 'up' }
  if (r === 'medium') return { level: 2, label: 'MEDIUM', tone: 'warn' }
  if (r === 'high') return { level: 3, label: 'HIGH', tone: 'down' }
  return { level: 0, label: DASH, tone: 'flat' }
}

/** "2d" → "2 d", "8h" → "8 h"; anything else printed as given, missing → "—". */
export function cardLabAHold(raw: unknown): string {
  const s = String(raw ?? '').trim()
  if (!s) return DASH
  const m = s.match(/^(\d+(?:\.\d+)?)\s*([a-z]+)$/i)
  return m ? `${m[1]} ${m[2]}` : s
}

/** Wins/losses from the record; flags a win rate that disagrees with successful/total by > 1 point. */
export function cardLabAWinCheck(winRate: unknown, wins: unknown, total: unknown): string | null {
  if (!isNum(winRate) || !isNum(wins) || !isNum(total) || total <= 0) return null
  const implied = (wins / total) * 100
  return Math.abs(implied - winRate) > 1
    ? `Record says win rate ${fmtNumber(winRate, { decimals: 1 })}% but ${wins}/${total} trades won = ${fmtNumber(implied, { decimals: 1 })}%.`
    : null
}

/** A real backtest window: both dates parse and start is before end (start === end is the store's filler). */
export function cardLabAWindowKnown(bp: { start?: string; end?: string } | null | undefined): boolean {
  if (!bp?.start || !bp?.end) return false
  const a = Date.parse(bp.start), b = Date.parse(bp.end)
  return Number.isFinite(a) && Number.isFinite(b) && a < b
}

/** Fewer recorded trades than this → the win rate / Sharpe are flagged as a small sample. */
export const cardLabASmallSample = 30

/**
 * Trading style named from the record's own words (tags first, then name/description). Returns null when nothing
 * matches — never a catch-all like "Systematic".
 */
export function cardLabAStyle(full: Record<string, any>): string | null {
  const tags = ((full.tags ?? []) as string[]).map(t => String(t).toLowerCase())
  const text = `${full.name ?? ''} ${full.description ?? ''}`.toLowerCase()
  const has = (...k: string[]) => k.some(x => tags.includes(x))
  const shortVol = /\bsells?\b|\bshort\b|crush/.test(text)
  // 1) the record's own tags win
  if (has('pair', 'pairs', 'stat-arb')) return 'PAIR TRADE · STAT-ARB'
  if (has('earnings', 'event')) return 'EVENT DRIFT · EARNINGS'
  if (has('mean-reversion', 'mean_reversion')) return 'MEAN REVERSION'
  if (has('volatility', 'options')) return shortVol ? 'SHORT VOLATILITY' : 'VOLATILITY'
  const momentum = has('momentum') || /momentum/.test(text)
  if (has('macro')) return momentum ? 'MACRO MOMENTUM' : 'MACRO'
  // 2) then its name / description (a word like "volatility" in a description is context, not the style)
  if (/\bpair\b|stat-arb/.test(text)) return 'PAIR TRADE · STAT-ARB'
  if (/earnings/.test(text)) return 'EVENT DRIFT · EARNINGS'
  if (/mean reversion|reversion/.test(text)) return 'MEAN REVERSION'
  if (/\bvol\b/.test(text) && shortVol) return 'SHORT VOLATILITY'
  if (/\bmacro\b/.test(text)) return momentum ? 'MACRO MOMENTUM' : 'MACRO'
  if (momentum || has('momentum')) return 'MOMENTUM'
  if (has('trend', 'trend-following') || /trend.follow/.test(text)) return 'TREND FOLLOWING'
  if (has('breakout') || /breakout/.test(text)) return 'BREAKOUT'
  return null
}

export function cardLabAModel(full: Record<string, any>): CardLabAModel {
  const rawPm = (full.performance_metrics ?? {}) as Record<string, unknown>
  // all-zero metrics = the store's filler for a record without them, not four real zeros
  const pm: Record<string, unknown> = ['annual_return', 'volatility', 'beta', 'alpha'].every(k => rawPm[k] === 0) ? {} : rawPm
  const bp = full.backtest_period as { start?: string; end?: string } | undefined
  // The store fills a missing window with {start: today, end: today} (stores/strategies.ts normalizeStrategy):
  // a window counts only when both ends exist and start < end.
  const periodKnown = cardLabAWindowKnown(bp)
  const total = full.total_trades
  const wins = full.successful_trades
  const losses = isNum(total) && isNum(wins) ? total - wins : null
  const ddTone: CardLabATone = isNum(full.max_drawdown) ? (full.max_drawdown >= 10 ? 'down' : full.max_drawdown >= 5 ? 'warn' : 'flat') : 'flat'
  const sharpeTone: CardLabATone = isNum(full.sharpe_ratio) ? (full.sharpe_ratio < 0 ? 'down' : full.sharpe_ratio < 1 ? 'warn' : 'up') : 'flat'
  const winTone: CardLabATone = isNum(full.win_rate) ? (full.win_rate < 50 ? 'down' : 'up') : 'flat'

  const cells: CardLabACell[] = [
    {
      key: 'win', label: 'WIN RATE', value: pct(full.win_rate),
      sub: isNum(wins) && isNum(losses) ? `${wins}W ${losses}L` : DASH, tone: winTone,
      bar: cardLabALinear(full.win_rate, 0, 100, winTone),
      hint: 'Share of winning trades over the recorded trades. Bar: 0–100 %.',
    },
    {
      key: 'dd', label: 'MAX DD', value: isNum(full.max_drawdown) ? `${fmtNumber(-Math.abs(full.max_drawdown), { decimals: 1 })}%` : DASH,
      sub: 'peak→trough', tone: ddTone, bar: cardLabALinear(full.max_drawdown, 0, 25, ddTone),
      hint: 'Largest peak-to-trough loss of the record. Amber from 5 %, red from 10 %. Bar: 0–25 %.',
    },
    {
      key: 'sharpe', label: 'SHARPE', value: isNum(full.sharpe_ratio) ? fmtNumber(full.sharpe_ratio, { decimals: 2 }) : DASH,
      sub: 'risk-adj.', tone: sharpeTone, bar: cardLabALinear(full.sharpe_ratio, -1, 3, sharpeTone),
      hint: 'Sharpe ratio of the record. Red below 0, amber below 1, green from 1. Bar: −1 to 3.',
    },
    {
      key: 'trades', label: 'TRADES', value: fmtCount(total), sub: isNum(total) && total < cardLabASmallSample ? 'small n<30' : 'recorded', tone: 'flat',
      hint: 'Number of trades in the record.',
    },
    {
      key: 'ann', label: 'ANN. RET', value: pct(pm.annual_return, true), sub: 'per year', tone: cardLabATone(pm.annual_return),
      bar: cardLabADiverging(pm.annual_return, 25),
      hint: 'Annualised return (performance_metrics.annual_return). Bar: ±25 %, zero in the middle.',
    },
    {
      key: 'vol', label: 'VOL', value: pct(pm.volatility), sub: 'annualised', tone: 'flat',
      bar: cardLabALinear(pm.volatility, 0, 50, 'flat'),
      hint: 'Annualised volatility. Bar: 0–50 %.',
    },
    {
      key: 'beta', label: 'BETA β', value: isNum(pm.beta) ? fmtNumber(pm.beta as number, { decimals: 2 }) : DASH, sub: 'vs market', tone: 'flat',
      hint: 'Beta: sensitivity to its market (1 = moves with it).',
    },
    {
      key: 'alpha', label: 'ALPHA α', value: isNum(pm.alpha) ? fmtNumber(pm.alpha as number, { decimals: 2, signed: true }) : DASH,
      sub: 'excess', tone: cardLabATone(pm.alpha), hint: 'Alpha: return not explained by the market, as recorded.',
    },
  ]

  const creator = String(full.creator ?? full.creator_id ?? '') || DASH
  return {
    name: String(full.name ?? ''),
    category: String(full.category ?? '') || DASH,
    assets: (full.target_assets ?? []) as string[],
    indicators: (full.indicators ?? []) as string[],
    tags: (full.tags ?? []) as string[],
    status: cardLabAStatus(full.status),
    automation: cardLabAAutomation(full.type),
    risk: cardLabARisk(full.risk_level),
    visibility: full.is_public === true ? 'PUBLIC' : full.is_public === false ? 'PRIVATE' : DASH,
    price: full.is_premium
      ? { label: isNum(full.price) && full.price > 0 ? `PREMIUM ${fmtMoney(full.price, { decimals: 0 })}` : 'PREMIUM', premium: true }
      : { label: 'FREE', premium: false },
    rule: String(full.description ?? '') || DASH,
    ret: {
      pct: pct(full.total_return_percentage, true),
      usd: isNum(full.total_return) ? fmtSignedMoney(full.total_return, { decimals: 0 }) : DASH,
      capital: isNum(full.initial_capital) && isNum(full.current_capital)
        ? `${fmtMoney(full.initial_capital, { decimals: 0 })} → ${fmtMoney(full.current_capital, { decimals: 0 })}`
        : DASH,
      period: periodKnown ? `${fmtDate(bp!.start)} → ${fmtDate(bp!.end)}` : 'no backtest dates',
      periodKnown,
      tone: cardLabATone(full.total_return_percentage),
      bar: cardLabADiverging(full.total_return_percentage, 25),
    },
    cells,
    winCheck: cardLabAWinCheck(full.win_rate, wins, total),
    hold: cardLabAHold(full.average_trade_duration),
    smallSample: isNum(total) && total < cardLabASmallSample,
    style: cardLabAStyle(full),
    creator,
    agent: full.agent_id ? String(full.agent_id) : 'none',
    social: { followers: fmtCount(full.followers_count), likes: fmtCount(full.likes_count), comments: fmtCount(full.comments_count) },
    dates: { created: fmtDate(full.created_at), lastRun: fmtDate(full.last_run) },
  }
}
