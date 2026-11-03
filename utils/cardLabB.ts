/**
 * Card lab variant B ("glyph / visual encoding", swarm 2026-11-02 "cards").
 * Pure mappings from a catalog strategy record to the shapes the card draws. Every glyph is computed from a real
 * field of the record; nothing here invents a series. All exports are prefixed `cardLabB` (Nuxt auto-imports utils).
 */

export type CardLabBStyleKey = 'reversion' | 'pair' | 'vol' | 'momentum' | 'event' | 'systematic'

export interface CardLabBStyle {
  key: CardLabBStyleKey
  label: string
  /** The words in the record that decided the style (shown in the glyph tooltip). */
  evidence: string[]
}

interface StyleSource {
  name?: string
  tags?: string[] | null
  indicators?: string[] | null
}

const low = (v: unknown) => String(v ?? '').toLowerCase()

/**
 * Trading style read from the record's own tags, indicators and name. Order matters: a pair trade is also a
 * reversion, an earnings play also watches IV, so the most specific archetype wins.
 */
export function cardLabBStyle(s: StyleSource): CardLabBStyle {
  const tags = (s.tags ?? []).map(low)
  const inds = (s.indicators ?? []).map(low)
  const name = low(s.name)
  const hit = (words: string[]) => [
    ...tags.filter(t => words.some(w => t.includes(w))).map(t => `#${t}`),
    ...inds.filter(i => words.some(w => i.includes(w))),
    ...words.filter(w => name.includes(w)).map(w => `"${w}" in name`),
  ]
  const rules: Array<[CardLabBStyleKey, string, string[]]> = [
    ['pair', 'Pair / stat-arb', ['pair', 'stat-arb', 'cointegration', 'spread']],
    ['event', 'Event drift', ['earnings', 'event', 'drift']],
    ['vol', 'Volatility selling', ['volatility', 'options', 'vol crush', 'theta']],
    ['reversion', 'Mean reversion', ['mean-reversion', 'mean_reversion', 'reversion']],
    ['momentum', 'Momentum', ['momentum', 'trend', 'breakout']],
  ]
  for (const [key, label, words] of rules) {
    const ev = hit(words)
    if (ev.length) {
      const macro = key === 'momentum' && tags.includes('macro')
      return { key, label: macro ? 'Macro momentum' : label, evidence: [...new Set(ev)] }
    }
  }
  if (inds.includes('rsi')) return { key: 'reversion', label: 'Mean reversion', evidence: ['RSI'] }
  return { key: 'systematic', label: 'Systematic', evidence: [] }
}

/** "8h" · "2d" · "12d" · "1w" · "3mo" → hours; null when unreadable (never a default). */
export function cardLabBDurationHours(raw: unknown): number | null {
  const m = String(raw ?? '').trim().toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(mo|m|h|d|w|y)$/)
  if (!m) return null
  const n = Number(m[1])
  const unit = { m: 1 / 60, h: 1, d: 24, w: 168, mo: 720, y: 8760 }[m[2] as 'm' | 'h' | 'd' | 'w' | 'mo' | 'y']
  return n * unit
}

/** Log time scale 1 hour (0) → 1 month = 30 days (1). Ticks at 1h, 1d, 1w, 1mo. */
export const CARD_LAB_B_HOLD_TICKS = [
  { label: '1h', hours: 1 },
  { label: '1d', hours: 24 },
  { label: '1w', hours: 168 },
  { label: '1mo', hours: 720 },
] as const

export function cardLabBHoldPos(hours: number | null): number | null {
  if (hours == null || !(hours > 0)) return null
  const p = Math.log(hours) / Math.log(720)
  return Math.max(0, Math.min(1, p))
}

/** Plain-words holding bucket for the time scale. */
export function cardLabBHoldBucket(hours: number | null): string {
  if (hours == null) return 'unknown'
  if (hours < 24) return 'intraday'
  if (hours <= 7 * 24) return 'swing (days)'
  return 'position (weeks)'
}

export interface CardLabBRisk { level: 0 | 1 | 2 | 3; label: string; key: string }

/** Catalog risk_level low/medium/high → 1..3 bars. Missing → 0 (\"not rated\"), never a default 5/10. */
export function cardLabBRisk(level: unknown): CardLabBRisk {
  const v = low(level)
  if (v === 'low') return { level: 1, label: 'Low', key: 'low' }
  if (v === 'medium') return { level: 2, label: 'Medium', key: 'medium' }
  if (v === 'high') return { level: 3, label: 'High', key: 'high' }
  return { level: 0, label: 'Not rated', key: 'none' }
}

export interface CardLabBSharpe { key: 'losing' | 'weak' | 'good' | 'strong' | 'none'; label: string; pos: number | null }

/** Sharpe quality band on a −1 … 3 axis: < 0 losing · 0–1 weak · 1–2 good · ≥ 2 strong. */
export const CARD_LAB_B_SHARPE_MIN = -1
export const CARD_LAB_B_SHARPE_MAX = 3
export function cardLabBSharpe(v: unknown): CardLabBSharpe {
  const n = Number(v)
  if (v == null || v === '' || !Number.isFinite(n)) return { key: 'none', label: 'not given', pos: null }
  const pos = Math.max(0, Math.min(1, (n - CARD_LAB_B_SHARPE_MIN) / (CARD_LAB_B_SHARPE_MAX - CARD_LAB_B_SHARPE_MIN)))
  if (n < 0) return { key: 'losing', label: 'losing', pos }
  if (n < 1) return { key: 'weak', label: 'weak', pos }
  if (n < 2) return { key: 'good', label: 'good', pos }
  return { key: 'strong', label: 'strong', pos }
}

/**
 * Return-vs-drawdown balance: both bars on one shared scale (half-width = `scale` %), so cards compare.
 * Returns fractions 0..1 of the half-width.
 */
export const CARD_LAB_B_BALANCE_SCALE = 25
export function cardLabBBalance(totalReturnPct: unknown, maxDrawdownPct: unknown, scale = CARD_LAB_B_BALANCE_SCALE) {
  const r = Number(totalReturnPct)
  const d = Math.abs(Number(maxDrawdownPct))
  const s = Math.max(scale, Number.isFinite(r) ? Math.abs(r) : 0, Number.isFinite(d) ? d : 0)
  return {
    scale: s,
    ret: Number.isFinite(r) ? Math.abs(r) / s : null,
    retSign: Number.isFinite(r) ? (r < 0 ? -1 : 1) : 0,
    dd: Number.isFinite(d) ? d / s : null,
    /** Return earned per unit of worst drawdown (whole backtest); null when either side is missing or dd = 0. */
    ratio: Number.isFinite(r) && Number.isFinite(d) && d > 0 ? r / d : null,
  }
}

/** Wins / losses from successful_trades and total_trades (real counts, not the rounded win_rate). */
export function cardLabBWinLoss(total: unknown, wins: unknown, winRatePct?: unknown) {
  const t = Number(total)
  const w = Number(wins)
  if (!Number.isFinite(t) || t <= 0) return null
  if (Number.isFinite(w) && w >= 0 && w <= t) return { total: t, wins: w, losses: t - w, frac: w / t }
  const wr = Number(winRatePct)
  if (Number.isFinite(wr)) return { total: t, wins: null, losses: null, frac: wr / 100 }
  return null
}

/** Fewer trades than this and a win rate / Sharpe says little: the card flags "small sample". */
export const CARD_LAB_B_SMALL_SAMPLE = 30
export function cardLabBSmallSample(total: unknown): boolean {
  const t = Number(total)
  return Number.isFinite(t) && t > 0 && t < CARD_LAB_B_SMALL_SAMPLE
}

/** The catalog's stated win_rate when it disagrees (> 1 point) with wins ÷ trades; else null. */
export function cardLabBWinRateMismatch(statedPct: unknown, wl: { frac: number; wins: number | null } | null): number | null {
  const s = Number(statedPct)
  if (!wl || wl.wins == null || statedPct == null || !Number.isFinite(s)) return null
  return Math.abs(s - wl.frac * 100) > 1 ? s : null
}

/** Popularity bar: log10 scale 0 → 1,000 followers. */
export function cardLabBPopularity(n: unknown): number {
  const v = Number(n)
  if (!Number.isFinite(v) || v <= 0) return 0
  return Math.min(1, Math.log10(1 + v) / 3)
}

export function cardLabBAutomation(type: unknown): { key: 'auto' | 'semi' | 'manual' | 'none'; label: string } {
  const v = low(type)
  if (v === 'automated') return { key: 'auto', label: 'Automated' }
  if (v === 'semi_automated' || v === 'semi-automated') return { key: 'semi', label: 'Semi-automated' }
  if (v === 'manual') return { key: 'manual', label: 'Manual' }
  return { key: 'none', label: 'Automation not given' }
}

/**
 * A backtest window counts only when both ends exist and start < end: the store fills a missing window with
 * {start: today, end: today} (stores/strategies.ts normalizeStrategy), which must read as "not given".
 */
export function cardLabBWindowKnown(b: unknown): b is { start: string; end: string } {
  const w = b as { start?: unknown; end?: unknown } | null | undefined
  if (!w?.start || !w?.end) return false
  const s = Date.parse(String(w.start))
  const e = Date.parse(String(w.end))
  return Number.isFinite(s) && Number.isFinite(e) && s < e
}

/** performance_metrics, or {} when all four are 0 (the store's filler for a record without them). */
export function cardLabBPerf(pm: unknown): Record<string, unknown> {
  const m = (pm ?? {}) as Record<string, unknown>
  return ['annual_return', 'volatility', 'beta', 'alpha'].every(k => m[k] === 0 || m[k] == null) ? {} : m
}
