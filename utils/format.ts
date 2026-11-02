/**
 * One formatter for every number and date the UI prints.
 *
 * Rules (DESIGN-AUDIT.md §1 rows 4–8, board-design D1–D4, board-users U7):
 *  - Unknown is never a number: null / undefined / NaN / ±Infinity / bad dates → "—".
 *  - Sign goes BEFORE the currency symbol, with a real minus (U+2212): "−$1,234.56", "+$12.00".
 *    Never "$-12", never "-0.00": a value that rounds to zero prints unsigned.
 *  - `signed: true` adds "+" to positive deltas; negatives always carry "−".
 *  - Percent: the caller says what it holds. `fmtPctFromFraction(0.123)` and
 *    `fmtPctFromPercent(12.3)` both print "12.3%". Nothing guesses.
 *  - Suffixes are lower-case k / M / B / T (compact option): "$230.9k".
 *  - Locale: APP_LOCALE (en-US, utils/locale.ts) on server and client, so SSR and the
 *    browser render the same string (no French "3 janv." in the English UI).
 *  - Time zone: UTC by default (Settings › Appearance › Time zone defaults to UTC and the
 *    top-bar clock reads GMT). Pass `timeZone` from the appearance store to follow the user.
 *    24-hour clock, like the top-bar clock.
 *
 * Default decimals, one per kind:
 *  | kind                     | default                                        |
 *  |--------------------------|------------------------------------------------|
 *  | money (fmtMoney)         | 2 dp ("$1,234.56")                             |
 *  | money, compact           | 1 dp above $1k ("$230.9k"); 2 dp below         |
 *  | percent                  | 1 dp; 2 dp when 0 < |x| < 1 % ("0.42%")         |
 *  | probability              | 0 dp ("63%")                                   |
 *  | plain number (fmtNumber) | 2 dp                                           |
 *  | count (fmtCount)         | 0 dp, grouped ("1,234")                        |
 *  | stat tile (fmtStatValue) | see fmtStatValue: integers bare, else 2 dp,    |
 *  |                          | 0 dp from 1,000; USD as money; % as percent    |
 */
import { APP_LOCALE } from './locale'

export const DASH = '—'
export const MINUS = '\u2212'
export const FORMAT_LOCALE = APP_LOCALE
export const DEFAULT_TIME_ZONE = 'UTC'

export type Maybe<T> = T | null | undefined

/** A finite number (rejects null, undefined, NaN, ±Infinity, strings). */
export function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

// ── Numbers ──────────────────────────────────────────────────────────────

const numberFormats = new Map<string, Intl.NumberFormat>()
function grouped(abs: number, decimals: number): string {
  const d = Math.max(0, Math.min(20, Math.floor(decimals)))
  let f = numberFormats.get(String(d))
  if (!f) {
    f = new Intl.NumberFormat(FORMAT_LOCALE, { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: true })
    numberFormats.set(String(d), f)
  }
  return f.format(abs)
}

/** Sign for a value printed at `decimals`: "" when it rounds to zero (kills "−0.00"). */
function signOf(v: number, decimals: number, signed: boolean): string {
  const roundsToZero = Number(Math.abs(v).toFixed(Math.max(0, Math.min(20, Math.floor(decimals))))) === 0
  if (roundsToZero) return ''
  if (v < 0) return MINUS
  return signed ? '+' : ''
}

const COMPACT_STEPS: Array<[number, string]> = [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'k']]

/** abs value → { body, unit } with k/M/B/T; promotes 999.95k → 1.0M. */
function compactParts(abs: number, decimals: number): { scaled: number; unit: string } | null {
  // COMPACT_STEPS runs largest → smallest; take the first unit the value reaches.
  for (let i = 0; i < COMPACT_STEPS.length; i++) {
    const [size, unit] = COMPACT_STEPS[i]!
    if (abs < size) continue
    const scaled = abs / size
    const bigger = COMPACT_STEPS[i - 1]
    // 999.96k at 1 dp would print "1000.0k": hand it to the next unit up ("1.0M").
    if (bigger && Number(scaled.toFixed(decimals)) >= 1000) return { scaled: abs / bigger[0], unit: bigger[1] }
    return { scaled, unit }
  }
  return null
}

export interface NumberOptions {
  /** Fraction digits. Default 2 for fmtNumber. */
  decimals?: number
  /** "+" on positive values. Negatives always get "−". */
  signed?: boolean
  /** k / M / B / T from 1,000 up, with `compactDecimals` (default 1). */
  compact?: boolean
  compactDecimals?: number
}

/** "1,234.57" · "−0.50" · "+3.00" (signed) · "12.3k" (compact) · "—" */
export function fmtNumber(v: Maybe<number>, opts: NumberOptions = {}): string {
  if (!isNum(v)) return DASH
  const abs = Math.abs(v)
  if (opts.compact) {
    const cd = opts.compactDecimals ?? 1
    const parts = compactParts(abs, cd)
    if (parts) return `${signOf(v, 6, !!opts.signed)}${grouped(parts.scaled, cd)}${parts.unit}`
  }
  const d = opts.decimals ?? 2
  return `${signOf(v, d, !!opts.signed)}${grouped(abs, d)}`
}

/**
 * fmtNumber with signed: true — for deltas. "+1.50" · "−1.50" · "0.00"
 * (Named fmtSignedNumber: utils/notifications.ts already exports fmtSigned and Nuxt auto-imports both.)
 */
export function fmtSignedNumber(v: Maybe<number>, opts: Omit<NumberOptions, 'signed'> = {}): string {
  return fmtNumber(v, { ...opts, signed: true })
}

/** Whole things (trades, followers, markets): "1,234" · "12.3k" (compact) · "—". */
export function fmtCount(v: Maybe<number>, opts: { compact?: boolean } = {}): string {
  if (!isNum(v)) return DASH
  return fmtNumber(Math.round(v), { decimals: 0, compact: opts.compact })
}

// ── Money ────────────────────────────────────────────────────────────────

const CURRENCY_SYMBOL: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', JPY: '¥' }

export interface MoneyOptions extends NumberOptions {
  /** ISO code; USD prints "$". Unknown codes print as a prefix: "CHF 12.00". */
  currency?: string
}

/** "$1,234.56" · "−$1,234.56" · "+$12.00" (signed) · "$230.9k" (compact) · "—" */
export function fmtMoney(v: Maybe<number>, opts: MoneyOptions = {}): string {
  if (!isNum(v)) return DASH
  const code = (opts.currency ?? 'USD').toUpperCase()
  const symbol = CURRENCY_SYMBOL[code] ?? `${code}\u00a0`
  const abs = Math.abs(v)
  if (opts.compact) {
    const cd = opts.compactDecimals ?? 1
    const parts = compactParts(abs, cd)
    if (parts) return `${signOf(v, 6, !!opts.signed)}${symbol}${grouped(parts.scaled, cd)}${parts.unit}`
  }
  const d = opts.decimals ?? 2
  return `${signOf(v, d, !!opts.signed)}${symbol}${grouped(abs, d)}`
}

/** fmtMoney with "+" on gains — for P&L and other deltas. */
export function fmtSignedMoney(v: Maybe<number>, opts: Omit<MoneyOptions, 'signed'> = {}): string {
  return fmtMoney(v, { ...opts, signed: true })
}

// ── Percent ──────────────────────────────────────────────────────────────

export interface PctOptions {
  /** Fixed decimals. Default: 1, or 2 when 0 < |x| < 1 %. */
  decimals?: number
  signed?: boolean
}

/** Default percent decimals for a value already in percent units. */
export function pctDecimals(percent: number): number {
  const a = Math.abs(percent)
  return a > 0 && a < 1 ? 2 : 1
}

/** Input in PERCENT units (12.3 means 12.3 %). "12.3%" · "−0.42%" · "+4.0%" (signed) */
export function fmtPctFromPercent(percent: Maybe<number>, opts: PctOptions = {}): string {
  if (!isNum(percent)) return DASH
  const d = opts.decimals ?? pctDecimals(percent)
  return `${fmtNumber(percent, { decimals: d, signed: opts.signed })}%`
}

/** Input as a FRACTION (0.123 means 12.3 %). Stores hold fractions; only this multiplies. */
export function fmtPctFromFraction(fraction: Maybe<number>, opts: PctOptions = {}): string {
  if (!isNum(fraction)) return DASH
  return fmtPctFromPercent(fraction * 100, opts)
}

/** Probability or share as a FRACTION, 0 dp: 0.634 → "63%". */
export function fmtProbability(fraction: Maybe<number>): string {
  return fmtPctFromFraction(fraction, { decimals: 0 })
}

// ── Stat tiles (UIStat, UIKpiStrip) ──────────────────────────────────────

export interface StatValueOptions {
  /** The tile's suffix prop: "USD" → money, "%" → percent (value in percent units). */
  suffix?: string
  /** The tile's precision prop; undefined → the documented default for the kind. */
  precision?: number
  /** "+" on positive values (UIStat tone="auto": the value is a delta). */
  signed?: boolean
}

/**
 * What a stat tile prints. Same rule for UIStat and UIKpiStrip:
 *  - string → printed as given (callers that pre-format keep their text); null/NaN → "—"
 *  - suffix "USD" → money, "$" before the number, suffix dropped: 2 dp below $1,000, 0 dp from $1,000
 *  - suffix "%"   → percent units: 1 dp, 2 dp when 0 < |x| < 1; suffix kept
 *  - otherwise    → integers bare, other values 2 dp; 0 dp from 1,000 (grouped)
 * An explicit `precision` always wins over the default.
 * When the text is "—" the suffix is dropped ("—", not "— USD").
 */
export function fmtStatValue(v: Maybe<string | number>, opts: StatValueOptions = {}): { text: string; suffix: string } {
  const suffix = opts.suffix ?? ''
  if (typeof v === 'string') return { text: v, suffix: v === DASH ? '' : suffix }
  if (!isNum(v)) return { text: DASH, suffix: '' }
  const kind = suffix.trim().toUpperCase()
  if (kind === 'USD' || kind === '$') {
    // the app-wide money rule (utils/valueTree.ts fmtMoneyKpi): cents below $1M, compact from $1M
    const d = opts.precision ?? 2
    return { text: fmtMoney(v, { decimals: d, signed: opts.signed, compact: opts.precision === undefined && Math.abs(v) >= 1e6 }), suffix: '' }
  }
  if (kind === '%') {
    const d = opts.precision ?? pctDecimals(v)
    return { text: fmtNumber(v, { decimals: d, signed: opts.signed }), suffix }
  }
  const d = opts.precision ?? (Math.abs(v) >= 1000 || Number.isInteger(v) ? 0 : 2)
  return { text: fmtNumber(v, { decimals: d, signed: opts.signed }), suffix }
}

// ── Dates and times ──────────────────────────────────────────────────────

export type DateInput = Maybe<Date | string | number>

export interface DateOptions {
  /** IANA zone or "UTC". Default UTC (see header). */
  timeZone?: string
}

/** Date | ISO string | epoch ms → Date, or null when missing/invalid. */
export function toDate(v: DateInput): Date | null {
  if (v === null || v === undefined || v === '') return null
  const d = v instanceof Date ? v : new Date(v)
  return Number.isFinite(d.getTime()) ? d : null
}

const dateFormats = new Map<string, Intl.DateTimeFormat>()
function dtf(key: string, timeZone: string, opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const k = `${key}|${timeZone}`
  let f = dateFormats.get(k)
  if (!f) {
    f = new Intl.DateTimeFormat(FORMAT_LOCALE, { ...opts, timeZone })
    dateFormats.set(k, f)
  }
  return f
}

const tz = (o: DateOptions) => o.timeZone ?? DEFAULT_TIME_ZONE

/** "Nov 2, 2026" */
export function fmtDate(v: DateInput, opts: DateOptions = {}): string {
  const d = toDate(v)
  if (!d) return DASH
  return dtf('date', tz(opts), { year: 'numeric', month: 'short', day: 'numeric' }).format(d)
}

/** "Nov 2" — for axes and lists where the year is obvious. */
export function fmtShortDate(v: DateInput, opts: DateOptions = {}): string {
  const d = toDate(v)
  if (!d) return DASH
  return dtf('short', tz(opts), { month: 'short', day: 'numeric' }).format(d)
}

/** "15:41" (24-hour, like the top-bar GMT clock) */
export function fmtTime(v: DateInput, opts: DateOptions = {}): string {
  const d = toDate(v)
  if (!d) return DASH
  return dtf('time', tz(opts), { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d)
}

/** "Nov 2, 2026, 15:41" */
export function fmtDateTime(v: DateInput, opts: DateOptions = {}): string {
  const d = toDate(v)
  if (!d) return DASH
  return `${fmtDate(d, opts)}, ${fmtTime(d, opts)}`
}

/** "Fri, Nov 6, 15:41" — a future target always shows the date, never the weekday alone. */
export function fmtDayTime(v: DateInput, opts: DateOptions = {}): string {
  const d = toDate(v)
  if (!d) return DASH
  const day = dtf('day', tz(opts), { weekday: 'short', month: 'short', day: 'numeric' }).format(d)
  return `${day}, ${fmtTime(d, opts)}`
}

/**
 * "just now" · "5 min ago" · "in 3 h" · "2 d ago"; beyond 7 days the plain date.
 * `now` is a parameter so server and client agree when they pass the same instant.
 */
export function fmtRelative(v: DateInput, now: DateInput = Date.now(), opts: DateOptions = {}): string {
  const d = toDate(v)
  const n = toDate(now)
  if (!d || !n) return DASH
  const diff = d.getTime() - n.getTime()
  const abs = Math.abs(diff)
  const MIN = 60_000, HOUR = 60 * MIN, DAY = 24 * HOUR
  if (abs < MIN) return 'just now'
  let text: string
  if (abs < HOUR) text = `${Math.floor(abs / MIN)} min`
  else if (abs < DAY) text = `${Math.floor(abs / HOUR)} h`
  else if (abs < 7 * DAY) text = `${Math.floor(abs / DAY)} d`
  else return fmtDate(d, opts)
  return diff < 0 ? `${text} ago` : `in ${text}`
}
