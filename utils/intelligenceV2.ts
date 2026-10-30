/**
 * Insights v2 ("the mirror" on /profile) — types and pure helpers.
 *
 * Where you stand against everybody else on 11 behaviour axes and on the community map, how far your calls
 * were from the truth, who in your entourage completes / mirrors / opposes you, your forms of intelligence,
 * your financial personality and what your avatar does better than you.
 *
 * Data: GET /api/v1/intelligence/me/ (profile.space / intelligences / finance / truth / avatar + top-level
 * community), /space/?x=&y=, /entourage/ — fetched in composables/useIntelligence.ts. Everything here is pure
 * (no stores, no clock) and unit-tested in tests/intelligenceV2.test.ts. Names are prefixed intel* / Intel*.
 *
 * Copy rules: behavioural reads ("reads as"), never diagnoses; Capitalist/Collective is how you trade, not
 * politics; wealth is PAPER capital; scores are paper call accuracy.
 */
import type { IntelMePayload, IntelProfile } from '~/utils/intelligence'

// ── Types (coded from Strades-comms/qa-swarm-2026-10-30/intelligence-v2-samples.json) ──

/** Community distribution of one measure: 21 quantiles (q[0]=lo … q[20]=hi) and a 20-bin histogram lo..hi. */
export interface IntelDist { n: number; mean: number; sd: number; q: number[]; lo: number; hi: number; hist: number[] }

/** raw = measured value, z = community standard deviations, pct = 0..100 share of the community below you. */
export interface IntelAxisPos { raw: number | null; z: number | null; pct: number | null }
export interface IntelSpace { axes: Record<string, IntelAxisPos>; map: { x: number | null; y: number | null } | null }

export interface IntelIntelligence { key: string; label: string; theory: string; how: string; value: number | null; n: number; pct: number | null }

export type IntelFinanceType = 'Adventurer' | 'Celebrity' | 'Individualist' | 'Guardian' | 'Straight Arrow' | ''
export interface IntelFinance {
  type: IntelFinanceType | string
  /** + confident … − anxious */
  confidence: number | null
  /** + careful … − impetuous */
  method: number | null
  traits: { key: string; label: string; theory: string }[]
  overconfidence: number | null
  theory?: string
}

/** One cell of the truth report. n = 0 cells carry no other field. */
export interface IntelTruthCell { n: number; hit?: number; hit_shrunk?: number; score?: number; abs_err?: number; bias?: number }
export interface IntelTruthSummary extends IntelTruthCell {
  median_abs_err?: number; within_1pt?: number; brier?: number; brier_skill?: number; overconfidence?: number; p10_err?: number; p90_err?: number
}
export interface IntelTruthWeek extends IntelTruthCell { week: number; phase: 'past' | 'now' | 'future'; pending: number }
export interface IntelTruth {
  n: number
  pending: number
  tz_offset?: number
  summary?: IntelTruthSummary | null
  error_hist?: { bins: number[]; counts: number[] } | null
  calibration?: (IntelTruthCell & { conf: number; expected: number })[]
  weekdays?: (IntelTruthCell & { day: string; i: number })[]
  dayparts?: (IntelTruthCell & { part: string })[]
  best_days?: (IntelTruthCell & { day_index: number })[]
  worst_days?: (IntelTruthCell & { day_index: number })[]
  best_assets?: (IntelTruthCell & { asset: string })[]
  worst_assets?: (IntelTruthCell & { asset: string })[]
  classes?: (IntelTruthCell & { cls: string })[]
  horizons?: (IntelTruthCell & { horizon: string })[]
  weeks?: IntelTruthWeek[]
  streaks?: { best: number; current: number } | null
  tilt?: { hit_after_miss: number | null; hit_after_hit: number | null; gap: number | null; n_after_miss: number } | null
  learning?: { first_half_score: number; second_half_score: number; delta: number } | null
  /** percentiles 0..100 vs the community (abs_err: LOWER is better) */
  community?: { hit: number | null; score: number | null; abs_err: number | null; brier_skill: number | null } | null
}

export interface IntelRecord { n: number; hit: number | null }
export interface IntelAvatarAlly { id: string; name: string; compatibility: number | null; record: IntelRecord; when_disagreeing: IntelRecord; when_agreeing: IntelRecord }
export interface IntelAvatarEvaluation {
  n: number; raw_hit: number | null; avatar_hit: number | null; raw_brier: number | null; avatar_brier: number | null
  raw_mae: number | null; avatar_mae: number | null; flips: number; flip_hit: number | null; with_allies: number | null
  brier_gain: number | null; mae_gain: number | null; hit_gain: number | null
}
export interface IntelAvatarOpen {
  asset: string; target_day: number; made_day: number; dir: number; conf: number; p_user: number; p_avatar: number; avatar_dir: number
  chg: number; adj_chg: number; ref: number | null; adj_price: number | null; allies_for: string[]; allies_against: string[]
}
export interface IntelAvatar {
  allies: IntelAvatarAlly[]
  method: string
  evaluation: IntelAvatarEvaluation | null
  params: { own_record: IntelRecord; by_class_horizon: { cls: string; horizon: string; n: number; trust: number }[]; bias_pts: number | null; target_scale: number | null } | null
  open: IntelAvatarOpen[]
}

export interface IntelCommunityAxis { key: string; neg: string; pos: string; label: string; how: string; theory: string; dist: IntelDist | null }
export interface IntelCommunity {
  axes: IntelCommunityAxis[]
  intelligences: { key: string; label: string; theory: string; how: string; dist: IntelDist | null }[]
  truth: Record<string, IntelDist | null>
  map: { explained: number[]; axes: { pos: string; neg: string; loadings: Record<string, number> }[] } | null
  n: number
  computed_at: string | null
}

export interface IntelProfileV2 extends IntelProfile {
  version?: number
  space?: IntelSpace | null
  intelligences?: IntelIntelligence[]
  finance?: IntelFinance | null
  truth?: IntelTruth | null
  avatar?: IntelAvatar | null
}
export interface IntelMePayloadV2 extends Omit<IntelMePayload, 'profile'> { profile: IntelProfileV2 | null; community?: IntelCommunity | null }

export type IntelPointKind = 'me' | 'friend' | 'mate' | 'bot' | 'other'
export interface IntelSpacePoint {
  x: number; y: number; kind: IntelPointKind; code: string
  id?: string; name?: string; archetype?: string; bot?: boolean; pct_x?: number | null; pct_y?: number | null
}
export interface IntelSpacePayload { x: string; y: string; points: IntelSpacePoint[]; n: number; community?: IntelCommunity | null }

export type IntelEntourageKind = 'completes' | 'mirrors' | 'opposes' | 'differs'
export interface IntelEntourageItem {
  relation_id: string; kind: IntelEntourageKind; tags: string[]; strength: number
  user: { id: string; name: string; is_bot: boolean; is_demo: boolean; mbti: string; code_inferred: string; archetype: string }
  label: string; compatibility: number | null; agreement: number | null; opposition: number | null; complementarity_pts: number | null
  traits_cosine: number | null; friends: boolean; distance: number | null; distance_pct?: number | null
  /** other − me, in community standard deviations; null = one side not measured */
  gaps: Record<string, number | null>
  closest_axes: string[]; farthest_axes: string[]; skill: number | null; map: { x: number; y: number } | null
}
export interface IntelEntourage {
  groups: Record<IntelEntourageKind, IntelEntourageItem[]>
  counts: Record<IntelEntourageKind, number>
  explain: Partial<Record<IntelEntourageKind, string>>
  unmeasured_friends: number
  axes: { key: string; neg: string; pos: string; label: string }[]
}

// ── Formatting ──

const DASH = '—'
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`
const signed = (v: number, d = 1) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(d)}`

/** pct 0..100 → "further toward Contrarian than 82% of traders" / "about average" (45–55) / "not measured yet". */
export function intelPctWords(pct: number | null | undefined, neg: string, pos: string): string {
  if (!finite(pct)) return 'not measured yet'
  const p = clamp(pct, 0, 100)
  if (p >= 45 && p <= 55) return 'about average'
  const [pole, share] = p > 50 ? [pos, p] : [neg, 100 - p]
  const s = Math.round(share)
  // "further toward Slow" reads right for every pole name ("more slow", "more night owl" did not)
  if (s >= 99) return `at the ${pole} end of the community`
  return `further toward ${pole} than ${s}% of traders`
}

/** Percentile where higher is better → "better than 80% of traders"; lowerIsBetter flips it (errors). */
export function intelRankWords(pct: number | null | undefined, lowerIsBetter = false): string {
  if (!finite(pct)) return 'no community comparison yet'
  const better = Math.round(clamp(lowerIsBetter ? 100 - pct : pct, 0, 100))
  if (better >= 45 && better <= 55) return 'about the community middle'
  if (better >= 99) return 'among the best in the community'
  return `better than ${better}% of traders`
}

/** Plain axis explanation, with the honesty notes the product promised. */
export function intelAxisNote(key: string): string {
  if (key === 'ownership') return 'About how you trade (concentrated private bets vs shared, pooled views), not about politics.'
  if (key === 'wealth') return 'Paper capital only, never real money.'
  if (key === 'clock') return 'From your local peak hour of activity.'
  return ''
}

// ── You vs everyone: 11 axis strips ──

export interface IntelAxisRow {
  key: string; label: string; neg: string; pos: string; how: string; theory: string; note: string
  raw: number | null; z: number | null; pct: number | null; words: string; dist: IntelDist | null
}

/** Joins your position (profile.space.axes) with the community axis metadata, in community order. */
export function intelAxisRows(space: IntelSpace | null | undefined, community: IntelCommunity | null | undefined): IntelAxisRow[] {
  return (community?.axes ?? []).map((a) => {
    const me = space?.axes?.[a.key]
    const pct = finite(me?.pct) ? me!.pct! : null
    return {
      key: a.key, label: a.label, neg: a.neg, pos: a.pos, how: a.how, theory: a.theory, note: intelAxisNote(a.key),
      raw: finite(me?.raw) ? me!.raw! : null, z: finite(me?.z) ? me!.z! : null, pct, words: intelPctWords(pct, a.neg, a.pos), dist: a.dist ?? null,
    }
  })
}

export interface IntelStripMarker { key: string; label: string; z: number }
export interface IntelStripGeom {
  width: number; height: number; empty: boolean
  bars: { x: number; y: number; w: number; h: number; count: number }[]
  you: { x: number } | null
  markers: { key: string; label: string; x: number }[]
  meanX: number | null
}

/**
 * Community histogram (dist.hist over lo..hi) with your marker and friend markers. Your x uses raw when known
 * (same scale as the histogram), else z (raw = mean + z·sd). Friends are given as z (your z + their gap).
 */
export function intelStripGeometry(dist: IntelDist | null | undefined, you: Partial<IntelAxisPos> | null | undefined, markers: IntelStripMarker[] = [], width = 300, height = 36, pad = 4): IntelStripGeom {
  if (!dist || !dist.hist?.length || !finite(dist.lo) || !finite(dist.hi)) return { width, height, empty: true, bars: [], you: null, markers: [], meanX: null }
  const span = dist.hi - dist.lo
  const inner = width - 2 * pad
  const xOf = (v: number) => pad + (span > 0 ? clamp((v - dist.lo) / span, 0, 1) : 0.5) * inner
  const fromZ = (z: number) => dist.mean + z * dist.sd
  const max = Math.max(1, ...dist.hist)
  const bw = inner / dist.hist.length
  const barH = height - 2 * pad
  const bars = dist.hist.map((count, i) => {
    const h = count > 0 ? Math.max(1.5, (count / max) * barH) : 0
    return { x: pad + i * bw, y: height - pad - h, w: Math.max(0.5, bw - 1), h, count }
  })
  const yv = finite(you?.raw) ? you!.raw! : finite(you?.z) ? fromZ(you!.z!) : null
  return {
    width, height, empty: false, bars,
    you: yv === null ? null : { x: xOf(yv) },
    markers: markers.filter(m => finite(m.z)).map(m => ({ key: m.key, label: m.label, x: xOf(fromZ(m.z)) })),
    meanX: finite(dist.mean) ? xOf(dist.mean) : null,
  }
}

/** Friend markers for one axis strip from entourage items: their z = your z + gap (other − me). */
export function intelStripMarkers(axis: string, myZ: number | null | undefined, items: IntelEntourageItem[], limit = 6): IntelStripMarker[] {
  if (!finite(myZ)) return []
  return items
    .filter(it => finite(it.gaps?.[axis]))
    .slice(0, limit)
    .map(it => ({ key: it.relation_id, label: it.user.name, z: myZ + (it.gaps[axis] as number) }))
}

// ── Community map / any two axes (scatter) ──

export interface IntelAxisOption { key: string; label: string; neg: string; pos: string }

/** Choices for the X/Y pickers: the community map first, then the 11 axes. */
export function intelAxisOptions(community: IntelCommunity | null | undefined, which: 0 | 1 = 0): IntelAxisOption[] {
  const m = community?.map?.axes?.[which]
  const map: IntelAxisOption = { key: 'map', label: 'Community map', neg: m?.neg ?? 'low', pos: m?.pos ?? 'high' }
  return [map, ...(community?.axes ?? []).map(a => ({ key: a.key, label: a.label, neg: a.neg, pos: a.pos }))]
}

/** Pole words of a picker value; for the map the 1st (x) or 2nd (y) principal axis. */
export function intelAxisPoles(key: string, community: IntelCommunity | null | undefined, which: 0 | 1 = 0): IntelAxisOption {
  return intelAxisOptions(community, which).find(o => o.key === key) ?? { key, label: key, neg: 'low', pos: 'high' }
}

export interface IntelScatterPoint extends IntelSpacePoint { sx: number; sy: number; r: number; labelled: boolean; key: string }
export interface IntelScatterGeom { width: number; height: number; zeroX: number; zeroY: number; extent: number; points: IntelScatterPoint[] }

const KIND_ORDER: Record<string, number> = { other: 0, bot: 1, mate: 2, friend: 3, me: 4 }

/**
 * Symmetric scatter (0 at the centre, extent = max |coord| rounded up, at least 1). Anonymous "other" points
 * are drawn first and faint; "me" last. y grows upward.
 */
export function intelScatterGeometry(points: IntelSpacePoint[], width = 320, height = 320, pad = 18): IntelScatterGeom {
  const ok = points.filter(p => finite(p.x) && finite(p.y))
  const extent = Math.max(1, Math.ceil(Math.max(0, ...ok.map(p => Math.max(Math.abs(p.x), Math.abs(p.y)))) * 2) / 2)
  const sx = (v: number) => pad + ((v + extent) / (2 * extent)) * (width - 2 * pad)
  const sy = (v: number) => height - pad - ((v + extent) / (2 * extent)) * (height - 2 * pad)
  const sorted = [...ok].sort((a, b) => (KIND_ORDER[a.kind] ?? 0) - (KIND_ORDER[b.kind] ?? 0))
  return {
    width, height, extent, zeroX: sx(0), zeroY: sy(0),
    points: sorted.map((p, i) => ({
      ...p, sx: sx(p.x), sy: sy(p.y),
      r: p.kind === 'me' ? 6 : p.kind === 'other' ? 2.5 : 4,
      labelled: p.kind !== 'other' && !!p.name,
      key: p.id ?? `o${i}`,
    })),
  }
}

/** Short first-name label for crowded maps: "Olivia B." → "Olivia". */
export const intelShortName = (name: string | null | undefined) => (name || '').trim().split(/\s+/)[0] || '?'

// ── Entourage ──

export const INTEL_ENTOURAGE_KINDS: { kind: IntelEntourageKind; title: string; blurb: string }[] = [
  { kind: 'completes', title: 'Completes you', blurb: 'Together you are right more often than either of you alone.' },
  { kind: 'mirrors', title: 'Mirrors you', blurb: 'Same traits and mostly the same calls: comfortable, rarely new.' },
  { kind: 'opposes', title: 'Opposes you', blurb: 'Mostly on the other side of your calls: the best test of your reasoning.' },
  { kind: 'differs', title: 'No strong pattern', blurb: 'Measured, without a strong pattern yet.' },
]

export function intelEntourageColumns(e: IntelEntourage | null | undefined) {
  return INTEL_ENTOURAGE_KINDS.map(k => ({
    ...k,
    explain: e?.explain?.[k.kind] || k.blurb,
    items: [...(e?.groups?.[k.kind] ?? [])].sort((a, b) => b.strength - a.strength),
  }))
}

/** True when nobody is classified yet (newcomer or no measured friend). */
export const intelEntourageEmpty = (e: IntelEntourage | null | undefined) =>
  !e || Object.values(e.counts ?? {}).every(c => !c)

/** RMS z gap → words. */
export function intelDistanceWords(d: number | null | undefined): string {
  if (!finite(d)) return 'distance unknown'
  if (d < 0.8) return 'very close to you'
  if (d < 1.5) return 'close to you'
  if (d < 2.5) return 'some way from you'
  return 'far from you'
}

export interface IntelGapRow { key: string; label: string; gap: number; left: number; width: number; words: string; side: 'neg' | 'pos' | 'same' }

/**
 * Diverging gap bars (centre = you) for the given axis keys; scale ±`cap` sd fills half the track.
 * gap = other − me: + means they sit further toward the axis' positive pole.
 */
export function intelGapRows(item: Pick<IntelEntourageItem, 'gaps'>, axes: { key: string; neg: string; pos: string; label: string }[], keys: string[], cap = 3): IntelGapRow[] {
  const meta = new Map(axes.map(a => [a.key, a]))
  return keys.flatMap((key) => {
    const g = item.gaps?.[key]
    const a = meta.get(key)
    if (!finite(g) || !a) return []
    const c = clamp(g / cap, -1, 1)
    const side = Math.abs(g) < 0.25 ? 'same' : g > 0 ? 'pos' : 'neg'
    const words = side === 'same' ? `about the same ${a.label.toLowerCase()} as you`
      : `more ${(side === 'pos' ? a.pos : a.neg).toLowerCase()} than you (${signed(g)} sd)`
    return [{ key, label: a.label, gap: g, left: c >= 0 ? 50 : 50 + c * 50, width: Math.abs(c) * 50, words, side } as IntelGapRow]
  })
}

// ── Distance from truth ──

/** "distance" = predicted move − realised move (pts). + = targets too far up. */
export function intelBiasWords(bias: number | null | undefined): string {
  if (!finite(bias)) return DASH
  if (Math.abs(bias) < 0.5) return 'on target on average'
  return `targets ${signed(bias)} pts ${bias > 0 ? 'above' : 'below'} what happened`
}

export const intelTruthEmpty = (t: IntelTruth | null | undefined) => !t || !t.n

/** Bin edges [0.5,1,2,…,13] + counts (len+1) → labelled bars: "<0.5", "0.5–1", …, "≥13". */
export function intelErrorBars(h: IntelTruth['error_hist'], width = 320, height = 90, pad = 4) {
  const bins = h?.bins ?? []
  const counts = h?.counts ?? []
  if (!counts.length) return { bars: [], total: 0 }
  const total = counts.reduce((s, c) => s + (c || 0), 0)
  const max = Math.max(1, ...counts)
  const bw = (width - 2 * pad) / counts.length
  const label = (i: number) => (i === 0 ? `<${bins[0]}` : i >= bins.length ? `≥${bins[bins.length - 1]}` : `${bins[i - 1]}–${bins[i]}`)
  const bars = counts.map((count, i) => {
    const h2 = ((count || 0) / max) * (height - 2 * pad)
    return { i, x: pad + i * bw + 1, w: Math.max(1, bw - 2), y: height - pad - h2, h: h2, count: count || 0, label: label(i), share: total ? (count || 0) / total : 0 }
  })
  return { bars, total }
}

export type IntelCalTone = 'calibrated' | 'over' | 'under' | 'thin'

/** Calibration per confidence level: your hit rate vs the hit rate that confidence promises. */
export function intelCalibrationRows(cal: IntelTruth['calibration'], minN = 3, tol = 0.07) {
  return (cal ?? []).map((c) => {
    const hit = c.n && finite(c.hit) ? c.hit : null
    const gap = hit === null ? null : hit - c.expected
    const tone: IntelCalTone = hit === null || c.n < minN ? 'thin' : gap! < -tol ? 'over' : gap! > tol ? 'under' : 'calibrated'
    const words = tone === 'thin' ? `only ${plural(c.n, 'call')} at this level`
      : tone === 'over' ? 'over-sure at this level' : tone === 'under' ? 'more right than you claimed' : 'well calibrated'
    return { conf: c.conf, n: c.n, expected: c.expected, hit, gap, tone, words }
  })
}

export interface IntelTruthWeekGeom {
  points: { x: number; y: number | null; w: IntelTruthWeek }[]
  path: string
  bars: { x: number; y: number; h: number; w: IntelTruthWeek; future: boolean }[]
  step: number; nowX: number | null; pastEnd: number | null; futureStart: number | null
}

/** Weekly score line (0..100, gaps where nothing resolved) + bars: resolved calls (past) / pending (future). */
export function intelTruthWeekGeometry(weeks: IntelTruthWeek[], width = 440, height = 120, pad = 10): IntelTruthWeekGeom {
  const n = weeks.length
  const step = n > 1 ? (width - 2 * pad) / (n - 1) : 0
  const xOf = (i: number) => (n > 1 ? pad + i * step : width / 2)
  const yOf = (s: number) => pad + (1 - clamp(s / 100, 0, 1)) * (height - 2 * pad)
  const points = weeks.map((w, i) => ({ x: xOf(i), y: w.n && finite(w.score) ? yOf(w.score) : null, w }))
  let path = ''
  let pen = false
  for (const p of points) {
    if (p.y === null) { pen = false; continue }
    path += `${pen ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`
    pen = true
  }
  const vol = (w: IntelTruthWeek) => (w.phase === 'future' ? w.pending || 0 : w.n || 0)
  const maxV = Math.max(1, ...weeks.map(vol))
  const barMax = (height - 2 * pad) * 0.35
  const bars = weeks.map((w, i) => {
    const h = (vol(w) / maxV) * barMax
    return { x: xOf(i), y: height - pad - h, h, w, future: w.phase === 'future' }
  }).filter(b => b.h > 0)
  const nowI = weeks.findIndex(w => w.phase === 'now')
  const lastPast = weeks.map(w => w.phase).lastIndexOf('past')
  const firstFuture = weeks.findIndex(w => w.phase === 'future')
  return {
    points, path, bars, step,
    nowX: nowI >= 0 ? xOf(nowI) : null,
    pastEnd: lastPast >= 0 ? xOf(lastPast) + step / 2 : null,
    futureStart: firstFuture >= 0 ? xOf(firstFuture) - step / 2 : null,
  }
}

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** day_index (days since 1970-01-01, already in the user's local calendar) → "Thu 29 Oct 2026". */
export function intelDayLabel(dayIndex: number | null | undefined, withYear = true): string {
  if (!finite(dayIndex)) return DASH
  const d = new Date(Math.round(dayIndex) * 86_400_000)
  return `${WD[d.getUTCDay()]} ${d.getUTCDate()} ${MON[d.getUTCMonth()]}${withYear ? ` ${d.getUTCFullYear()}` : ''}`
}

/** Mon..Sun heat row: level = mean score / 100 (null when no call), best/worst among days with ≥ minN calls. */
export function intelWeekdayHeat(weekdays: IntelTruth['weekdays'], minN = 3) {
  const rows = [...(weekdays ?? [])].sort((a, b) => a.i - b.i)
  const ok = rows.filter(r => r.n >= minN && finite(r.score))
  const best = ok.length > 1 ? ok.reduce((a, b) => (b.score! > a.score! ? b : a)) : null
  const worst = ok.length > 1 ? ok.reduce((a, b) => (b.score! < a.score! ? b : a)) : null
  return rows.map(r => ({
    day: r.day, i: r.i, n: r.n, hit: finite(r.hit) ? r.hit : null, score: finite(r.score) ? r.score : null,
    abs_err: finite(r.abs_err) ? r.abs_err : null, bias: finite(r.bias) ? r.bias : null,
    level: r.n && finite(r.score) ? clamp(r.score / 100, 0, 1) : null,
    best: !!best && best.i === r.i, worst: !!worst && worst.i === r.i && best?.i !== r.i, thin: r.n < minN,
  }))
}

export const INTEL_DAYPART_LABEL: Record<string, string> = { night: 'Night (0–6 h)', morning: 'Morning (6–12 h)', afternoon: 'Afternoon (12–18 h)', evening: 'Evening (18–24 h)' }
export const INTEL_HORIZON_LABEL: Record<string, string> = { intraday: 'Intraday (≤ 1 day)', swing: 'Swing (days)', position: 'Position (weeks+)' }

/** One readable line per truth cell (day, asset, daypart…). */
export function intelCellLine(c: { n: number; hit?: number | null; score?: number | null; abs_err?: number | null } | null | undefined): string {
  if (!c || !c.n) return 'no resolved call'
  return `${plural(c.n, 'call')} · direction right ${finite(c.hit) ? Math.round(c.hit * 100) : DASH}% · score ${finite(c.score) ? Math.round(c.score) : DASH}/100 · ${finite(c.abs_err) ? c.abs_err.toFixed(1) : DASH} pts off`
}

/** Composure after a miss (tilt): gap = hit after miss − hit after hit. */
export function intelTiltWords(t: IntelTruth['tilt']): string {
  if (!t || !t.n_after_miss || !finite(t.gap)) return 'Not enough misses yet to read how you call after one.'
  if (Math.abs(t.gap) < 0.05) return `You call about as well right after a miss as after a hit (${plural(t.n_after_miss, 'call')} after a miss).`
  return t.gap < 0
    ? `Right after a miss you are right ${Math.round(Math.abs(t.gap) * 100)} pts less often: a pause may help.`
    : `Right after a miss you are right ${Math.round(t.gap * 100)} pts more often: you regroup well.`
}

// ── Intelligences & financial personality ──

const median = (d: IntelDist | null | undefined) => (d?.q?.length ? d.q[Math.floor(d.q.length / 2)]! : null)

export function intelIntelligenceRows(list: IntelIntelligence[] | null | undefined, community: IntelCommunity | null | undefined) {
  const dists = new Map((community?.intelligences ?? []).map(i => [i.key, i.dist]))
  return (list ?? []).map((it) => {
    const known = finite(it.value)
    const mid = median(dists.get(it.key))
    return {
      ...it, known,
      bar: known ? clamp(it.value!, 0, 1) : 0,
      tick: finite(mid) ? clamp(mid, 0, 1) : null,
      display: known ? `${Math.round(it.value! * 100)}` : DASH,
      words: !known ? 'not enough data' : finite(it.pct) ? intelRankWords(it.pct) : 'no community comparison yet',
      edge: known ? (it.value! > 0.55 ? 'edge' : it.value! < 0.45 ? 'below a coin flip' : 'coin-flip zone') : null,
    }
  })
}

/** Radar polygon (values 0..1, null drawn at 0) and the community median polygon. */
export function intelRadarGeometry(rows: { key: string; label: string; bar: number; known: boolean; tick: number | null }[], size = 220, pad = 30) {
  const c = size / 2
  const R = c - pad
  const n = rows.length
  const at = (i: number, v: number) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / Math.max(1, n)
    return { x: c + Math.cos(a) * R * v, y: c + Math.sin(a) * R * v }
  }
  const poly = (vals: number[]) => vals.map((v, i) => { const p = at(i, v); return `${p.x.toFixed(1)},${p.y.toFixed(1)}` }).join(' ')
  return {
    size, c, R,
    you: n >= 3 ? poly(rows.map(r => (r.known ? r.bar : 0))) : '',
    community: n >= 3 && rows.every(r => r.tick !== null) ? poly(rows.map(r => r.tick as number)) : '',
    rings: [0.25, 0.5, 0.75, 1].map(v => poly(rows.map(() => v))),
    spokes: rows.map((r, i) => ({ key: r.key, label: r.label, end: at(i, 1), lab: at(i, 1.17) })),
  }
}

export const INTEL_FINANCE_BLURB: Record<string, string> = {
  Adventurer: 'Confident and impetuous: big personal bets on your own read.',
  Individualist: 'Confident and careful: your own analysis, done methodically.',
  Celebrity: 'Less sure and impetuous: drawn to what is hot and to what others call.',
  Guardian: 'Less sure and careful: protecting what you have comes first.',
  'Straight Arrow': 'Balanced on both: no strong pull either way.',
}

/** BB&K 2×2: x = method (− impetuous … + careful), y = confidence (+ up). Centre square = Straight Arrow. */
export function intelFinanceQuadrant(f: IntelFinance | null | undefined, size = 180, pad = 14, range = 1.5, centre = 0.45) {
  const inner = size - 2 * pad
  const pos = (v: number) => pad + ((clamp(v, -range, range) + range) / (2 * range)) * inner
  const h = inner / 2
  const cw = (centre / range) * h * 2
  const type = f?.type || ''
  const cell = (t: string, x: number, y: number) => ({ type: t, x, y, w: h, h, active: type === t })
  return {
    size,
    cells: [cell('Adventurer', pad, pad), cell('Individualist', pad + h, pad), cell('Celebrity', pad, pad + h), cell('Guardian', pad + h, pad + h)],
    centre: { type: 'Straight Arrow', x: size / 2 - cw / 2, y: size / 2 - cw / 2, w: cw, h: cw, active: type === 'Straight Arrow' },
    dot: f && finite(f.method) && finite(f.confidence) ? { x: pos(f.method), y: size - pos(f.confidence) } : null,
  }
}

// ── Your avatar ──

export type IntelTone = 'better' | 'worse' | 'same'

/** Raw (you) vs avatar on the same resolved calls. Hit: higher is better; Brier and MAE: lower is better. */
export function intelAvatarRows(e: IntelAvatarEvaluation | null | undefined) {
  if (!e || !e.n) return []
  const row = (key: string, label: string, raw: number | null, av: number | null, lowerBetter: boolean, eps: number, fmt: (v: number) => string, explain: string) => {
    const d = finite(raw) && finite(av) ? av - raw : null
    const tone: IntelTone = d === null || Math.abs(d) < eps ? 'same' : (lowerBetter ? d < 0 : d > 0) ? 'better' : 'worse'
    return { key, label, raw: finite(raw) ? fmt(raw) : DASH, avatar: finite(av) ? fmt(av) : DASH, tone, lowerBetter, explain }
  }
  return [
    row('hit', 'Direction right', e.raw_hit, e.avatar_hit, false, 0.005, v => `${(v * 100).toFixed(1)}%`, 'Share of calls on the right side. Higher is better.'),
    row('brier', 'Brier score', e.raw_brier, e.avatar_brier, true, 0.0005, v => v.toFixed(3), 'Confidence-weighted error (0 perfect, 0.25 = coin flip). Lower is better.'),
    row('mae', 'Target error', e.raw_mae, e.avatar_mae, true, 0.05, v => `${v.toFixed(2)} pts`, 'Average distance between target and the realised move. Lower is better.'),
  ]
}

export function intelTargetScaleWords(scale: number | null | undefined): string {
  if (!finite(scale)) return 'Not enough resolved targets to rescale them yet.'
  const p = Math.round(scale * 100)
  if (Math.abs(scale - 1) < 0.05) return 'Keeps your targets as they are: they match what happens.'
  return scale < 1 ? `Shrinks your targets to ${p}% of what you call: your moves tend to overshoot.` : `Stretches your targets to ${p}%: your moves tend to undershoot.`
}

export function intelTrustRows(rows: NonNullable<IntelAvatar['params']>['by_class_horizon'] | null | undefined) {
  return [...(rows ?? [])].sort((a, b) => b.n - a.n).map(r => ({
    ...r, label: `${r.cls} · ${r.horizon}`, bar: clamp(r.trust, 0, 1),
    words: r.trust > 0.55 ? 'trusted' : r.trust < 0.45 ? 'leans against you' : 'about a coin flip',
  }))
}

export function intelAllyRows(allies: IntelAvatarAlly[] | null | undefined) {
  const rate = (r: IntelRecord) => (r?.n && finite(r.hit) ? `${Math.round(r.hit * 100)}% of ${r.n}` : 'none yet')
  return (allies ?? []).map(a => ({
    id: a.id, name: a.name, compatibility: a.compatibility, record: rate(a.record), disagreeing: rate(a.when_disagreeing), agreeing: rate(a.when_agreeing),
    useful: (a.when_disagreeing?.n ?? 0) >= 3 && finite(a.when_disagreeing.hit) && a.when_disagreeing.hit >= 0.5,
  }))
}

/** Open forecasts: your side & confidence vs the avatar's probability and its rescaled target. */
export function intelOpenRows(open: IntelAvatarOpen[] | null | undefined) {
  return (open ?? []).map((o, i) => ({
    key: `${o.asset}-${o.target_day}-${i}`, asset: o.asset, target: intelDayLabel(o.target_day, false), made: intelDayLabel(o.made_day, false),
    side: o.dir > 0 ? 'up' : 'down', pUser: clamp(o.p_user, 0, 1), pAvatar: clamp(o.p_avatar, 0, 1),
    agrees: o.avatar_dir === o.dir, chg: `${signed(o.chg, 2)}%`, adjChg: `${signed(o.adj_chg, 2)}%`,
    adjPrice: finite(o.adj_price) ? Number(o.adj_price.toPrecision(6)).toString() : DASH,
    allies_for: o.allies_for ?? [], allies_against: o.allies_against ?? [],
  }))
}
