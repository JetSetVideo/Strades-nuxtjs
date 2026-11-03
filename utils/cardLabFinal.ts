/**
 * Card lab — FINAL strategy card view model (swarm 2026-11-02 "cards", lane combine).
 * One pure function turns what production has into what the card draws:
 *   - `strategy` alone (StrategySummary row from Carousel: own server strategies + catalog samples), or
 *   - `strategy` + `full` (canonical StoredStrategy) + `code` (strategyToCodeView) when the caller has them.
 * Rules: a field the inputs lack is `null` (the card prints "—" / "not recorded"); the store's fillers are detected
 * and dropped (all-zero performance_metrics, today→today backtest window, zero-trade records of a new strategy).
 * Encodings are reused from the three lab designs (credited per helper): B = glyphs/scales, C = rule rows/honesty lines,
 * A = fixed-scale bars and aligned grid. All exports are prefixed `cardLabFinal` (Nuxt auto-imports utils).
 */
import {
  cardLabBAutomation, cardLabBBalance, cardLabBDurationHours, cardLabBHoldBucket, cardLabBHoldPos, cardLabBPerf,
  cardLabBPopularity, cardLabBRisk, cardLabBSharpe, cardLabBSmallSample, cardLabBStyle, cardLabBWinLoss,
  cardLabBWinRateMismatch, CARD_LAB_B_SMALL_SAMPLE,
  type CardLabBRisk, type CardLabBSharpe, type CardLabBStyle,
} from '~/utils/cardLabB'
import { cardLabCRule, cardLabCWindow, type CardLabCRule, type CardLabCWindow } from '~/utils/cardLabC'

type Rec = Record<string, any>

const isN = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
/** First finite number among the candidates (strings like "12" count), else null. */
export function cardLabFinalNum(...vals: unknown[]): number | null {
  for (const v of vals) {
    if (v == null || v === '' || typeof v === 'boolean') continue
    const n = Number(v)
    if (Number.isFinite(n)) return n
  }
  return null
}
const str = (...vals: unknown[]): string => {
  for (const v of vals) if (v != null && String(v).trim()) return String(v)
  return ''
}
const list = (...vals: unknown[]): string[] => {
  for (const v of vals) if (Array.isArray(v) && v.length) return v.map(String).filter(Boolean)
  return []
}

export type CardLabFinalStatusKey = 'active' | 'paused' | 'stopped' | 'backtesting' | 'none'
const STATUS: Record<Exclude<CardLabFinalStatusKey, 'none'>, { label: string; title: string }> = {
  active: { label: 'Active', title: 'Status: active — the strategy is switched on' },
  paused: { label: 'Paused', title: 'Status: paused — kept, not trading now; can be resumed' },
  stopped: { label: 'Stopped', title: 'Status: stopped — not running' },
  backtesting: { label: 'Backtesting', title: 'Status: backtesting — being tested on past data' },
}

export interface CardLabFinalFlag { key: string; short: string; long: string }

export interface CardLabFinalModel {
  id: string
  name: string
  description: string
  sample: boolean
  status: { key: CardLabFinalStatusKey; label: string; title: string }
  automation: { key: 'auto' | 'semi' | 'manual' | 'none'; label: string }
  risk: CardLabBRisk
  category: string
  classLabel: string
  style: CardLabBStyle
  assets: string[]
  indicators: string[]
  tags: string[]
  rule: CardLabCRule
  /** Coded conditions (creator-built strategies) when the description holds no rule. */
  conditions: string[]
  /** True when the record carries a track record (at least one trade or a non-zero return). */
  hasRecord: boolean
  /** The record's own tags call it experimental (surfaced as a head chip, not left behind Details). */
  experimental: boolean
  window: CardLabCWindow
  ret: number | null
  retUsd: number | null
  capStart: number | null
  capNow: number | null
  dd: number | null
  balance: ReturnType<typeof cardLabBBalance>
  trades: number | null
  win: ReturnType<typeof cardLabBWinLoss>
  winStated: number | null
  /** The win rate to print: the record's own figure when it has one, else wins ÷ trades. */
  winShown: number | null
  /** Record length implied by total vs annual return when no window is published (months), else null. */
  impliedMonths: number | null
  smallSample: boolean
  sharpeValue: number | null
  sharpe: CardLabBSharpe
  holdRaw: string | null
  holdHours: number | null
  holdPos: number | null
  holdBucket: string
  perf: { annual: number | null; vol: number | null; beta: number | null; alpha: number | null }
  flags: CardLabFinalFlag[]
  followers: number | null
  popularity: number
  likes: number | null
  comments: number | null
  creator: string
  agentId: string | null
  created: string | null
  lastRun: string | null
  isPublic: boolean | null
  premium: boolean
  price: number | null
}

/** "2d" → "2 d", "8h" → "8 h", "12d" → "12 d"; null when unreadable or zero (the store's '0' filler). */
export function cardLabFinalHoldText(raw: unknown): string | null {
  const m = String(raw ?? '').trim().toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(mo|m|h|d|w|y)$/)
  if (!m || !(Number(m[1]) > 0)) return null
  return `${m[1]} ${m[2] === 'm' ? 'min' : m[2]}`
}

/**
 * Sharpe vs annual return ÷ volatility (judge F3). With rf = 0, Sharpe = annual / vol; a real Sharpe implies
 * rf = annual − Sharpe × vol. Implied rf below −1 pp (Sharpe overstated) or above 6 pp (implausible rate) → flag.
 * Returns the implied rf in percentage points, or null when consistent / not computable.
 */
export function cardLabFinalSharpeGap(sharpe: number | null, annual: number | null, vol: number | null): number | null {
  if (!isN(sharpe) || !isN(annual) || !isN(vol) || vol <= 0) return null
  if (sharpe !== 0 && annual !== 0 && Math.sign(sharpe) !== Math.sign(annual)) return null // the sign flag says it better
  const rf = annual - sharpe * vol
  return rf < -1 || rf > 6 ? rf : null
}

/**
 * Months of history implied by the record's own total and annual returns: 12·ln(1+total)/ln(1+annual).
 * Only when both share a sign and |annual| ≥ 1 % (else the ratio is noise). Null otherwise.
 */
export function cardLabFinalImpliedMonths(totalPct: number | null, annualPct: number | null): number | null {
  if (!isN(totalPct) || !isN(annualPct) || totalPct === 0 || Math.abs(annualPct) < 1 || Math.sign(totalPct) !== Math.sign(annualPct)) return null
  const mo = (12 * Math.log(1 + totalPct / 100)) / Math.log(1 + annualPct / 100)
  return Number.isFinite(mo) && mo > 0 ? mo : null
}

/** Annual return implied by a total return over `months` (compounded). */
export function cardLabFinalImpliedAnnual(totalPct: number | null, months: number | null): number | null {
  if (!isN(totalPct) || !isN(months) || months <= 0) return null
  return (Math.pow(1 + totalPct / 100, 12 / months) - 1) * 100
}

const fmtP = (v: number, d = 1, signed = false) => `${signed && v > 0 ? '+' : ''}${v < 0 ? '−' : ''}${Math.abs(v).toFixed(d)}%`
const fmtR = (v: number) => `${v < 0 ? '−' : ''}${Math.abs(v).toFixed(2)}`

/** Honesty lines: inconsistencies inside the record are shown, never fixed (judge §3, designs B/C). */
export function cardLabFinalFlags(m: Pick<CardLabFinalModel, 'win' | 'winStated' | 'smallSample' | 'trades' | 'sharpeValue' | 'perf' | 'window' | 'ret'> & { pair?: boolean }): CardLabFinalFlag[] {
  const out: CardLabFinalFlag[] = []
  if (m.winStated != null && m.win?.wins != null) {
    out.push({
      key: 'win',
      short: `counts give ${fmtP(m.win.frac * 100)}`,
      long: `The record states a ${fmtP(m.winStated, 1)} win rate, but ${m.win.wins} of ${m.win.total} trades won = ${fmtP(m.win.frac * 100)}. The ring shows the counts.`,
    })
  }
  const wr = m.winStated ?? (m.win ? m.win.frac * 100 : null)
  if (isN(wr) && wr > 50 && isN(m.ret) && m.ret < 0) {
    out.push({
      key: 'win-loss',
      short: `won ${Math.round(wr)}%, lost money`,
      long: `${fmtP(wr, 0)} of trades won, yet the total return is ${fmtP(m.ret, 1, true)}: the losing trades were larger than the winning ones.`,
    })
  }
  if (m.smallSample && m.trades != null) {
    out.push({
      key: 'sample',
      short: 'thin sample',
      long: `Only ${m.trades} trades (fewer than ${CARD_LAB_B_SMALL_SAMPLE}): win rate and Sharpe rest on a small sample.`,
    })
  }
  const a = m.perf.annual
  const s = m.sharpeValue
  if (isN(s) && isN(a) && s !== 0 && a !== 0 && Math.sign(s) !== Math.sign(a)) {
    out.push({
      key: 'sharpe-sign',
      short: `Sharpe ${fmtR(s)} yet annual ${fmtP(a, 1, true)}`,
      long: `Sharpe ${fmtR(s)} and annual return ${fmtP(a, 1, true)} have opposite signs: one of them is inconsistent.`,
    })
  } else {
    const rf = cardLabFinalSharpeGap(s, a, m.perf.vol)
    if (rf != null && isN(a) && isN(m.perf.vol) && isN(s)) {
      out.push({
        key: 'sharpe-gap',
        short: `ret/vol is ${fmtR(a / m.perf.vol)}`,
        long: `Sharpe ${fmtR(s)} vs annual return ÷ volatility = ${fmtR(a / m.perf.vol)}: it would need a ${fmtP(rf)} risk-free rate. One of the three figures is inconsistent.`,
      })
    }
  }
  const implied = cardLabFinalImpliedAnnual(m.ret, m.window.known ? m.window.months : null)
  if (implied != null && isN(a) && Math.abs(a - implied) > 2) {
    out.push({
      key: 'annual',
      short: `dates imply ${fmtP(implied, 1, true)}/yr`,
      long: `The backtest window's total return ${fmtP(m.ret as number, 1, true)} over ${m.window.months} months implies ${fmtP(implied, 1, true)}/yr; the record says ${fmtP(a, 1, true)}/yr.`,
    })
  }
  // A long/short pair is meant to be market-neutral: a sizeable beta contradicts the style (judge W3-3, blind B/C asked).
  const b = m.perf.beta
  if (m.pair && isN(b) && Math.abs(b) >= 0.3) {
    out.push({
      key: 'beta-pair',
      short: `beta ${fmtR(b)} on a pair`,
      long: `A long/short pair trade is meant to be market-neutral (beta ≈ 0); the record says beta ${fmtR(b)}.`,
    })
  }
  return out
}

/**
 * The short object of a rule clause ("Buys BTC dips" → "BTC dips", "buys back at Mon open …" → "back"): words after the verb up
 * to a preposition / number / condition, max 4 words and 18 characters; '' when none fits (the sentence is on the card anyway).
 */
export function cardLabFinalObject(action: string, verb: string): string {
  const words = action.slice(verb.length).trim().split(/\s+/).filter(Boolean)
  const out: string[] = []
  for (const w of words) {
    if (/^(on|in|before|after|when|if|once|by|for|and|then|with|beyond)$/i.test(w) || /^\d/.test(w)) break
    out.push(w)
    if (out.length === 4) break
  }
  const txt = out.join(' ').replace(/[,.;:]+$/, '')
  return txt.length <= 18 ? txt : ''
}

/** Coded conditions → readable rows ("RSI < 30 · 1D"); empty when none. */
export function cardLabFinalConditions(code: Rec | null | undefined): string[] {
  const cs = (code?.conditions ?? []) as Array<{ indicator?: string; operator?: string; value?: unknown; timeframe?: string }>
  return cs
    .filter(c => c && str(c.indicator))
    .map(c => [str(c.indicator), str(c.operator), c.value == null ? '' : String(c.value)].filter(Boolean).join(' ') + (c.timeframe ? ` · ${c.timeframe}` : ''))
}

/**
 * Build the card model. `strategy` = summary row (always given), `full` = canonical record (optional),
 * `code` = strategyToCodeView(full) (optional). `full` wins over the summary field by field.
 */
export function cardLabFinalModel(strategy: Rec | null | undefined, full?: Rec | null, code?: Rec | null): CardLabFinalModel {
  const s = strategy ?? {}
  const f = full ?? {}
  const name = str(f.name, s.name) || 'Untitled strategy'
  const description = str(f.description, s.description, code?.description)
  const statusRaw = str(f.status, s.status).toLowerCase()
  const statusKey = (statusRaw in STATUS ? statusRaw : 'none') as CardLabFinalStatusKey
  const status = statusKey === 'none'
    ? { key: statusKey, label: 'Status not recorded', title: 'No status in the record' }
    : { key: statusKey, ...STATUS[statusKey] }
  const category = str(f.category, s.category, code?.category)
  const assets = list(f.target_assets, s.target_assets, s.targetAssets)
  const indicators = list(f.indicators, code?.dataSources, s.indicators)
  const tags = list(f.tags, s.tags)

  const trades = cardLabFinalNum(f.total_trades, s.numberOfTrades, s.total_trades)
  const ret = cardLabFinalNum(f.total_return_percentage, s.total_return_percentage)
  const hasRecord = (isN(trades) && trades > 0) || (isN(ret) && ret !== 0)
  // Without a track record every metric is the store's 0 filler: show none of them.
  const rec = <T>(v: T) => (hasRecord ? v : null)

  const dd = rec(cardLabFinalNum(f.max_drawdown, s.max_drawdown, s.monthlyDrawdown))
  const win = hasRecord ? cardLabBWinLoss(trades, f.successful_trades ?? s.successful_trades, f.win_rate ?? s.win_rate ?? s.winRate) : null
  const sharpeValue = rec(cardLabFinalNum(f.sharpe_ratio, s.sharpe_ratio, s.sharpeRatio))
  const pmRaw = cardLabBPerf(f.performance_metrics ?? s.performance_metrics)
  const perf = {
    annual: cardLabFinalNum(pmRaw.annual_return),
    vol: cardLabFinalNum(pmRaw.volatility),
    beta: cardLabFinalNum(pmRaw.beta),
    alpha: cardLabFinalNum(pmRaw.alpha),
  }
  const holdRaw = cardLabFinalHoldText(f.average_trade_duration ?? s.average_trade_duration)
  const holdHours = holdRaw ? cardLabBDurationHours(String(f.average_trade_duration ?? s.average_trade_duration)) : null
  const window = cardLabCWindow(f.backtest_period ?? s.backtest_period)
  const smallSample = hasRecord && cardLabBSmallSample(trades)
  const winStated = cardLabBWinRateMismatch(f.win_rate ?? s.win_rate, win)
  const rule = cardLabCRule(description)
  const followers = cardLabFinalNum(f.followers_count, s.followers_count, s.subscriberCount)

  const base = {
    win, winStated, smallSample, trades: rec(trades), sharpeValue, perf, window, ret: rec(ret),
    pair: rule.pair || cardLabBStyle({ name, tags, indicators }).key === 'pair',
  }
  return {
    id: str(f.id, s.id),
    name,
    description,
    sample: !!(s.sample ?? f.sample),
    status,
    automation: cardLabBAutomation(f.type ?? s.type),
    risk: cardLabBRisk(f.risk_level ?? s.risk_level),
    category,
    classLabel: category ? category.charAt(0).toUpperCase() + category.slice(1) : 'Class not recorded',
    style: cardLabBStyle({ name, tags, indicators }),
    assets,
    indicators,
    tags,
    rule,
    conditions: rule.entry.length ? [] : cardLabFinalConditions(code),
    hasRecord,
    experimental: tags.some(t => /^(experimental|beta|test(ing)?)$/i.test(t)),
    ...base,
    retUsd: rec(cardLabFinalNum(f.total_return, s.totalProfit, s.total_return)),
    capStart: rec(cardLabFinalNum(f.initial_capital, s.initial_capital)),
    capNow: rec(cardLabFinalNum(f.current_capital, s.current_capital)),
    dd,
    balance: cardLabBBalance(rec(ret), dd),
    sharpe: cardLabBSharpe(sharpeValue),
    holdRaw,
    holdHours,
    holdPos: cardLabBHoldPos(holdHours),
    holdBucket: holdHours == null ? 'not recorded' : cardLabBHoldBucket(holdHours).replace(/ \(.*\)$/, ''),
    flags: hasRecord ? cardLabFinalFlags(base) : [],
    winShown: !hasRecord ? null : cardLabFinalNum(f.win_rate, s.win_rate, s.winRate) ?? (win ? win.frac * 100 : null),
    impliedMonths: hasRecord && !window.known ? cardLabFinalImpliedMonths(ret, perf.annual) : null,
    followers,
    popularity: cardLabBPopularity(followers),
    likes: cardLabFinalNum(f.likes_count, s.likes_count),
    comments: cardLabFinalNum(f.comments_count, s.comments_count),
    creator: str(s.creator, f.creator, f.creator_id, s.creator_id) || 'unknown',
    agentId: str(f.agent_id, s.agent_id) || null,
    created: str(f.created_at, s.created_at, s.creationDate) || null,
    lastRun: str(f.last_run, s.last_run) || null,
    isPublic: typeof (f.is_public ?? s.is_public) === 'boolean' ? (f.is_public ?? s.is_public) : null,
    premium: !!(f.is_premium ?? s.is_premium),
    price: cardLabFinalNum(f.price, s.price),
  }
}
