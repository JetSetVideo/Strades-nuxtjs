/**
 * Card lab variant C — "rule-forward trade ticket" (swarm 2026-11-02 "cards").
 * Pure helpers: they turn a catalog strategy record into the ticket's rule rows and honest evidence labels.
 * Every helper says "unknown" instead of guessing: an empty rule, a fabricated backtest window
 * (stores/strategies.ts normalizeStrategy fills start = end = today when the catalog has none) or a win rate
 * that disagrees with its own trade counts are surfaced, never smoothed over.
 * All exports are prefixed `cardLabC` (Nuxt auto-imports utils; names must stay unique).
 */

export type CardLabCSide = 'buy' | 'sell'

export interface CardLabCClause {
  side: CardLabCSide
  /** The verb as written ("Buys", "short", "Adds"). */
  verb: string
  /** The action part, verb included, condition removed: "Buys BTC dips". */
  action: string
  /** "when …" / "if …" part of the clause, without the keyword; null when none. */
  condition: string | null
  /** "when" | "if" | null */
  keyword: string | null
}

export interface CardLabCRule {
  /** Words before the first action verb ("Stat-arb pair trade"); null when none. */
  lead: string | null
  /** Entry legs (two for a long/short pair). Empty when the description holds no action verb. */
  entry: CardLabCClause[]
  /** The first later clause on the opposite side ("sells rebounds", "buys back at Mon open …"); null = not stated. */
  exit: CardLabCClause | null
  /** True when the entry is a simultaneous long + short pair. */
  pair: boolean
  /** Trigger shared by both legs of a pair ("the spread widens beyond 2σ"). */
  pairCondition: string | null
  /** The other sentences of the description, verbatim (context, regime notes). */
  context: string[]
}

const BUY_RE = /^(buy|buys|buying|bought|long|longs|add|adds|adding|accumulate|accumulates|enter|enters)$/i
const VERB_RE = /\b(buys?|buying|bought|sells?|selling|sold|long|longs|shorts?|adds?|adding|accumulates?|trims|cuts|exits|closes)\b(?!-)/gi
const POSITION_WORD = /^(long|longs|short|shorts)$/i

function sideOf(verb: string): CardLabCSide {
  return BUY_RE.test(verb) ? 'buy' : 'sell'
}

function tidy(s: string): string {
  return s.replace(/^[\s,;:—–-]+/, '').replace(/[\s,;:—–-]+$/, '').replace(/\s+(and|then)$/i, '').replace(/[.\s]+$/, '').trim()
}

function capital(s: string): string {
  return s ? s[0]!.toUpperCase() + s.slice(1) : s
}

function splitCondition(text: string): { action: string; condition: string | null; keyword: string | null } {
  const m = /\b(when|if|once|unless)\b/i.exec(text)
  if (!m) return { action: tidy(text), condition: null, keyword: null }
  return {
    action: tidy(text.slice(0, m.index)),
    condition: tidy(text.slice(m.index + m[0].length)) || null,
    keyword: m[1]!.toLowerCase(),
  }
}

/** Split the description into its sentences (keeps "2σ." / "> 10%." intact). */
export function cardLabCSentences(description: string | null | undefined): string[] {
  return String(description ?? '')
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(Boolean)
}

/**
 * Read the creator's own description as a trade rule: entry leg(s), exit, trigger, context.
 * Heuristic but conservative: only action verbs that are written in the text become rows.
 */
export function cardLabCRule(description: string | null | undefined): CardLabCRule {
  const sentences = cardLabCSentences(description)
  const ruleIdx = sentences.findIndex(s => new RegExp(VERB_RE.source, 'i').test(s))
  if (ruleIdx < 0) return { lead: null, entry: [], exit: null, pair: false, pairCondition: null, context: sentences }

  const sentence = sentences[ruleIdx]!
  const matches = [...sentence.matchAll(new RegExp(VERB_RE.source, 'gi'))]
  const lead = tidy(sentence.slice(0, matches[0]!.index)) || null
  const clauses: CardLabCClause[] = matches.map((m, i) => {
    const end = i + 1 < matches.length ? matches[i + 1]!.index : sentence.length
    const raw = sentence.slice(m.index, end)
    const { action, condition, keyword } = splitCondition(raw)
    return { side: sideOf(m[1]!), verb: m[1]!, action: capital(action), condition, keyword }
  })

  const first = clauses[0]!
  const second = clauses[1]
  const pair = !!second && POSITION_WORD.test(first.verb) && POSITION_WORD.test(second.verb) && first.side !== second.side
  const context = sentences.filter((_, i) => i !== ruleIdx)

  if (pair) {
    const legs = [first, second!]
    const cond = [...legs].reverse().find(l => l.condition)
    return {
      lead,
      entry: legs.map(l => (l === cond ? { ...l, condition: null, keyword: null } : l)),
      exit: clauses.slice(2).find(c => c.side !== first.side) ?? null,
      pair: true,
      pairCondition: cond?.condition ?? null,
      context,
    }
  }
  const exitAt = clauses.findIndex((c, i) => i > 0 && c.side !== first.side)
  return {
    lead,
    entry: clauses.slice(0, exitAt < 0 ? clauses.length : exitAt),
    exit: exitAt < 0 ? null : clauses[exitAt]!,
    pair: false,
    pairCondition: null,
    context,
  }
}

export interface CardLabCSegment { text: string; kind: 'text' | 'ticker' | 'num' }

/** Split a rule text so tickers and thresholds ("2σ", "> 10%", "60", "3 days") can be styled. */
export function cardLabCSegments(text: string, tickers: string[] = []): CardLabCSegment[] {
  const tick = tickers.filter(Boolean).map(t => t.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&'))
  const parts = [
    ...(tick.length ? [`\\b(?:${tick.join('|')})\\b`] : []),
    '[<>≥≤]=?\\s?\\d+(?:\\.\\d+)?(?:\\s?[%σ])?',
    '\\b\\d+(?:\\.\\d+)?(?:%|σ|\\s?(?:days?|hours?|weeks?)|[dhw])?(?![\\w-])',
  ]
  const re = new RegExp(parts.join('|'), 'gi')
  const out: CardLabCSegment[] = []
  let last = 0
  for (const m of text.matchAll(re)) {
    if (m.index! > last) out.push({ text: text.slice(last, m.index), kind: 'text' })
    const isTicker = tick.length > 0 && new RegExp(`^(?:${tick.join('|')})$`, 'i').test(m[0])
    out.push({ text: m[0], kind: isTicker ? 'ticker' : 'num' })
    last = m.index! + m[0].length
  }
  if (last < text.length) out.push({ text: text.slice(last), kind: 'text' })
  return out
}

/** "2d" → "2 days", "8h" → "8 hours", "12d" → "12 days", "30m" → "30 min"; null when unknown or zero. */
export function cardLabCDuration(raw: string | number | null | undefined): string | null {
  const m = /^\s*(\d+(?:\.\d+)?)\s*(mo|m|h|d|w|y)?\s*$/i.exec(String(raw ?? ''))
  if (!m) return null
  const n = Number(m[1])
  if (!(n > 0)) return null
  const unit = (m[2] ?? 'd').toLowerCase()
  const word: Record<string, [string, string]> = {
    m: ['min', 'min'], h: ['hour', 'hours'], d: ['day', 'days'], w: ['week', 'weeks'], mo: ['month', 'months'], y: ['year', 'years'],
  }
  const [one, many] = word[unit]!
  return `${n} ${n === 1 ? one : many}`
}

export interface CardLabCWindow {
  /** False when the record has no real window (missing, invalid, or the store's start = end placeholder). */
  known: boolean
  start: string | null
  end: string | null
  /** Whole months between start and end (rounded), null when unknown. */
  months: number | null
}

export function cardLabCWindow(period: { start?: string | null; end?: string | null } | null | undefined): CardLabCWindow {
  const s = period?.start ? new Date(period.start) : null
  const e = period?.end ? new Date(period.end) : null
  if (!s || !e || !Number.isFinite(s.getTime()) || !Number.isFinite(e.getTime()) || e.getTime() <= s.getTime()) {
    return { known: false, start: null, end: null, months: null }
  }
  const months = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24 * 30.4375))
  return { known: true, start: period!.start!, end: period!.end!, months }
}

export interface CardLabCWinLoss {
  /** Catalog win rate in percent (as stored), null when missing. */
  pct: number | null
  wins: number | null
  losses: number | null
  total: number | null
  /** wins / total in percent, null when counts are missing. */
  countedPct: number | null
  /** False when the stored win rate and the trade counts disagree by more than 1 point. */
  consistent: boolean
}

export function cardLabCWinLoss(winRate: unknown, total: unknown, successful: unknown): CardLabCWinLoss {
  const pct = typeof winRate === 'number' && Number.isFinite(winRate) ? winRate : null
  const n = typeof total === 'number' && Number.isFinite(total) && total > 0 ? Math.round(total) : null
  const w = n !== null && typeof successful === 'number' && Number.isFinite(successful) && successful >= 0 && successful <= n
    ? Math.round(successful) : null
  const countedPct = n !== null && w !== null ? (w / n) * 100 : null
  return {
    pct, total: n, wins: w, losses: n !== null && w !== null ? n - w : null, countedPct,
    consistent: pct === null || countedPct === null || Math.abs(pct - countedPct) <= 1,
  }
}

/** Catalog `type` → automation label. */
export function cardLabCAutomation(type: unknown): { id: string; label: string } {
  const t = String(type ?? '').toLowerCase()
  if (t === 'automated') return { id: 'automated', label: 'Automated' }
  if (t === 'semi_automated' || t === 'semi-automated') return { id: 'semi_automated', label: 'Semi-automated' }
  if (t === 'manual') return { id: 'manual', label: 'Manual' }
  return { id: 'unknown', label: 'Automation not set' }
}

/** risk_level → 1..3 filled bars; 0 = not set (never a default). */
export function cardLabCRisk(level: unknown): { id: string; label: string; filled: 0 | 1 | 2 | 3 } {
  const l = String(level ?? '').toLowerCase()
  if (l === 'low') return { id: 'low', label: 'Low', filled: 1 }
  if (l === 'medium') return { id: 'medium', label: 'Medium', filled: 2 }
  if (l === 'high') return { id: 'high', label: 'High', filled: 3 }
  return { id: 'unset', label: 'Not set', filled: 0 }
}

/** Below this many trades a win rate / Sharpe is a small sample (flagged on the card). */
export const CARD_LAB_C_SMALL_SAMPLE = 30

const STYLE_WORDS: Array<[RegExp, string]> = [
  [/\bmean[- ]?reversion\b|\breversion\b|\brevert/i, 'Mean reversion'],
  [/\bpairs?\b/i, 'Pair trade'],
  [/\bstat[- ]?arb\b/i, 'Stat-arb'],
  [/\bmomentum\b/i, 'Momentum'],
  [/\btrend\b/i, 'Trend following'],
  [/\bbreakout\b/i, 'Breakout'],
  [/\bmacro\b/i, 'Macro'],
  [/\bhedge\b/i, 'Hedge'],
  [/\bearnings\b/i, 'Earnings event'],
  [/\bdrift\b/i, 'Drift'],
  [/\boptions?\b/i, 'Options'],
  [/\bdca\b/i, 'DCA'],
  [/\bscalp/i, 'Scalping'],
]

/**
 * Style words read from the strategy NAME and TAGS only (never from the agent: its trading style is not the strategy's).
 * Volatility + a sell entry reads as "Short volatility". Max 3 words; [] when nothing matches.
 */
export function cardLabCStyle(name: string | null | undefined, tags: string[] = [], entrySide: CardLabCSide | null = null): string[] {
  const hay = [String(name ?? ''), ...tags].join(' | ')
  const out: string[] = []
  if (/\bvol(atility)?\b/i.test(hay)) out.push(entrySide === 'sell' ? 'Short volatility' : 'Volatility')
  for (const [re, label] of STYLE_WORDS) if (re.test(hay) && !out.includes(label)) out.push(label)
  return out.slice(0, 3)
}
