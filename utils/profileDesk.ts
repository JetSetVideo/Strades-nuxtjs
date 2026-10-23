/**
 * Profile desk math. The signed-in demo id is not a row in the user book,
 * so the face is the demo account and the numbers come from the catalog book.
 * Days are only colored when a wallet snapshot, a trade, or the monthly
 * calendar actually records them.
 */

export const BOOK_USER_ID = 'user_001'
export const FREE_WALLET_CAP = 2
export const FREE_BOT_CAP = 2

export type DayTone = 'green' | 'orange' | 'red' | 'idle' | 'ahead'
export type Audience = 'public' | 'friends_only' | 'private'

export interface HistoryRow {
  total_value?: number
  assets?: Record<string, { value?: number }>
}

export interface Snap {
  date: string
  value: number
}

export interface TradeMark {
  date: string
  symbol: string
  walletId: string
}

export interface SeedDay {
  day: number
  pnl_eur: number
  pnl_pct: number
  trades_total: number
  trades_won: number
  is_upcoming: boolean
}

export interface DeskDay {
  date: string
  pnlPct: number | null
  pnlUsd: number | null
  /** Book value that day, when a snapshot covers it. */
  level: number | null
  trades: number
  tone: DayTone
  scheduled: boolean
  /** Trades, bots, wallets, and marks that land on this day. */
  marks: string[]
}

/** Whole years and months between two calendar dates. */
export function ageOf(fromIso: string, today: string): string {
  const [fy, fm, fd] = fromIso.slice(0, 10).split('-').map(Number)
  const [ty, tm, td] = today.slice(0, 10).split('-').map(Number)
  if (!fy || !fm || !fd || !ty || !tm || !td) return ''
  let months = (ty - fy) * 12 + (tm - fm)
  if (td < fd) months -= 1
  if (months < 0) months = 0
  const years = Math.floor(months / 12)
  const rest = months % 12
  if (years && rest) return `${years} yr ${rest} mo`
  if (years) return `${years} yr`
  return `${rest} mo`
}

export function isPaidRole(role?: string | null): boolean {
  return role === 'premium' || role === 'admin'
}

/** A visitor sees a block only when its setting is public. The owner always sees the desk. */
export function visitorSees(setting: Audience | undefined): boolean {
  return setting === 'public'
}

export function dayTone(pct: number | null, trades: number, scheduled: boolean): DayTone {
  if (scheduled) return 'ahead'
  if (pct == null && trades === 0) return 'idle'
  const p = pct ?? 0
  if (p >= 0.35) return 'green'
  if (p <= -0.35) return 'red'
  if (trades > 0 || Math.abs(p) >= 0.05) return 'orange'
  return 'idle'
}

export function addDays(iso: string, n: number): string {
  const t = Date.parse(`${iso}T12:00:00Z`) + n * 86_400_000
  return new Date(t).toISOString().slice(0, 10)
}

export function snapsFromHistory(history: Record<string, HistoryRow> | undefined, asset?: string): Snap[] {
  if (!history) return []
  return Object.entries(history)
    .map(([date, row]) => ({
      date,
      value: asset ? Number(row.assets?.[asset]?.value ?? 0) : Number(row.total_value ?? 0),
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

/** Linear value between snapshots. Outside the first and last snapshot there is no day. */
export function valueAt(snaps: Snap[], day: string): number | null {
  if (!snaps.length || day < snaps[0].date || day > snaps[snaps.length - 1].date) return null
  for (let i = 0; i < snaps.length; i++) {
    const snap = snaps[i]!
    if (snap.date === day) return snap.value
    if (snap.date > day) {
      const prev = snaps[i - 1]!
      const span = Date.parse(`${snap.date}T12:00:00Z`) - Date.parse(`${prev.date}T12:00:00Z`)
      const along = Date.parse(`${day}T12:00:00Z`) - Date.parse(`${prev.date}T12:00:00Z`)
      if (span <= 0) return prev.value
      return prev.value + (snap.value - prev.value) * (along / span)
    }
  }
  return snaps[snaps.length - 1]!.value
}

export function combineMove(groups: Snap[][], day: string): { pct: number; usd: number } | null {
  let now = 0
  let prev = 0
  let anyNow = false
  let anyPrev = false
  const yesterday = addDays(day, -1)
  for (const snaps of groups) {
    const n = valueAt(snaps, day)
    const p = valueAt(snaps, yesterday)
    if (n != null) { now += n; anyNow = true }
    if (p != null) { prev += p; anyPrev = true }
  }
  if (!anyNow || !anyPrev || prev === 0) return null
  return { pct: ((now - prev) / prev) * 100, usd: now - prev }
}

function seedDate(today: string, day: number): string | null {
  const [y, m] = today.split('-')
  if (!y || !m || day < 1 || day > 31) return null
  const iso = `${y}-${m}-${String(day).padStart(2, '0')}`
  const dt = new Date(`${iso}T12:00:00Z`)
  if (Number.isNaN(dt.getTime()) || dt.getUTCMonth() + 1 !== Number(m)) return null
  return iso
}

function startSunday(iso: string): string {
  const wd = new Date(`${iso}T12:00:00Z`).getUTCDay()
  return addDays(iso, -wd)
}

function endSaturday(iso: string): string {
  const wd = new Date(`${iso}T12:00:00Z`).getUTCDay()
  return addDays(iso, 6 - wd)
}

export function buildDeskCalendar(input: {
  histories: Record<string, Record<string, HistoryRow> | undefined>
  walletIds: string[]
  trades: TradeMark[]
  seed: SeedDay[]
  today: string
  walletId?: string | null
  asset?: string | null
  events?: { date: string; label: string }[]
}): { weeks: DeskDay[][]; best: DeskDay | null; worst: DeskDay | null; active: boolean } {
  const ids = input.walletId ? input.walletIds.filter(id => id === input.walletId) : input.walletIds
  const asset = input.asset || undefined
  const groups = ids.map(id => snapsFromHistory(input.histories[id], asset))
  const trades = input.trades.filter(t =>
    ids.includes(t.walletId) && (!asset || t.symbol.toUpperCase() === asset.toUpperCase()),
  )
  const useSeed = !input.walletId && !asset
  const seedMap = new Map<string, SeedDay>()
  if (useSeed) {
    for (const s of input.seed) {
      const date = seedDate(input.today, s.day)
      if (date) seedMap.set(date, s)
    }
  }

  const marks = [
    ...groups.flatMap(g => g.map(s => s.date)),
    ...trades.map(t => t.date),
    ...seedMap.keys(),
    input.today,
  ].sort()
  const start = marks[0] || input.today
  const lastMark = marks[marks.length - 1] || input.today
  // Room after today so the open week can sit in the middle, with later days beside it.
  const horizon = addDays(input.today, 40 * 7)
  const last = lastMark > horizon ? lastMark : horizon

  const days: DeskDay[] = []
  for (let d = startSunday(start); d <= endSaturday(last); d = addDays(d, 1)) {
    const move = combineMove(groups, d)
    const seed = seedMap.get(d)
    const tx = trades.filter(t => t.date === d).length
    const scheduled = !!seed?.is_upcoming
    const tradeCount = tx + (seed ? seed.trades_total : 0)
    const pct = seed && !scheduled ? seed.pnl_pct : (move?.pct ?? null)
    const usd = seed && !scheduled ? seed.pnl_eur : (move?.usd ?? null)
    let levelSum = 0
    let levelKnown = false
    for (const snaps of groups) {
      const n = valueAt(snaps, d)
      if (n != null) { levelSum += n; levelKnown = true }
    }
    const marks = (input.events ?? [])
      .filter(event => event.date.slice(0, 10) === d)
      .map(event => event.label)
    days.push({
      date: d,
      pnlPct: pct,
      pnlUsd: usd,
      level: levelKnown ? levelSum : null,
      trades: tradeCount,
      scheduled,
      marks,
      tone: dayTone(pct, tradeCount, scheduled),
    })
  }

  const scored = days.filter(d => !d.scheduled && d.pnlPct != null && d.tone !== 'idle')
  const best = scored.reduce<DeskDay | null>((a, b) => (!a || (b.pnlPct ?? 0) > (a.pnlPct ?? 0) ? b : a), null)
  const worst = scored.reduce<DeskDay | null>((a, b) => (!a || (b.pnlPct ?? 0) < (a.pnlPct ?? 0) ? b : a), null)
  const recent = addDays(input.today, -13)
  const active = days.some(d => d.date >= recent && d.date <= input.today && (d.tone === 'green' || d.tone === 'orange' || d.tone === 'red'))

  const weeks: DeskDay[][] = []
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7))
  return { weeks, best, worst, active }
}

export function monthStamp(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return ''
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })
}

export type ActivitySpan = 'week' | 'month' | 'quarter' | 'year'

export interface ActivityRange {
  start: string
  end: string
  /** Sunday that opens the painted grid. */
  gridStart: string
  /** Saturday that closes the painted grid. */
  gridEnd: string
  label: string
}

function utcParts(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return { y: y || 1970, m: m || 1, d: d || 1 }
}

function utcIso(y: number, m: number, d: number): string {
  return new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10)
}

function monthEnd(y: number, m: number): string {
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
}

function pretty(iso: string, withYear: boolean): string {
  const { y, m, d } = utcParts(iso)
  const month = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })
  return withYear ? `${month} ${d}, ${y}` : `${month} ${d}`
}

/** The week, month, quarter, or year that contains `anchor`. */
export function activityRange(anchor: string, span: ActivitySpan): ActivityRange {
  const { y, m } = utcParts(anchor)
  if (span === 'week') {
    const start = startSunday(anchor)
    const end = addDays(start, 6)
    const sameMonth = start.slice(0, 7) === end.slice(0, 7)
    const label = sameMonth
      ? `${pretty(start, false)} – ${utcParts(end).d}, ${utcParts(end).y}`
      : `${pretty(start, false)} – ${pretty(end, true)}`
    return { start, end, gridStart: start, gridEnd: end, label }
  }
  if (span === 'month') {
    const start = utcIso(y, m, 1)
    const end = monthEnd(y, m)
    const label = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    return { start, end, gridStart: startSunday(start), gridEnd: endSaturday(end), label }
  }
  if (span === 'quarter') {
    const q = Math.floor((m - 1) / 3)
    const startMonth = q * 3 + 1
    const start = utcIso(y, startMonth, 1)
    const end = monthEnd(y, startMonth + 2)
    return { start, end, gridStart: startSunday(start), gridEnd: endSaturday(end), label: `Q${q + 1} ${y}` }
  }
  const start = utcIso(y, 1, 1)
  const end = utcIso(y, 12, 31)
  return { start, end, gridStart: startSunday(start), gridEnd: endSaturday(end), label: String(y) }
}

/** Move the anchor by one window. Month and quarter land on the first of that unit. */
export function shiftActivity(anchor: string, span: ActivitySpan, direction: -1 | 1): string {
  const { y, m, d } = utcParts(anchor)
  if (span === 'week') return addDays(anchor, direction * 7)
  if (span === 'month') return utcIso(y, m + direction, 1)
  if (span === 'quarter') return utcIso(y, m + direction * 3, 1)
  return utcIso(y + direction, m, Math.min(d, 28))
}
