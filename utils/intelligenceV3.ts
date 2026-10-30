/**
 * Insights v3 ("Your factors" in the profile mirror) — types and pure helpers for the eigen analysis.
 *
 * The 11 behaviour axes are correlated; the backend takes their correlation matrix, finds its eigenvectors
 * (independent directions = "factors") and eigenvalues (how much of the differences between traders each one
 * explains), keeps the factors with eigenvalue ≥ 1 (Kaiser rule) and scores everybody on them. On top of that:
 * how typical a whole profile is (Mahalanobis distance → chi-square percentile), influence (PageRank over the
 * endorsement graph), people who behave like you (/similar/) and a room's consensus spectrum (eigenvalues of
 * its agreement matrix).
 *
 * Data: GET /api/v1/intelligence/me/ (community.eigen, profile.space.factors/typicality, profile.influence),
 * /similar/?k=8, /relations/<group id>/ (operators.spectral) — fetched in composables/useIntelligence.ts.
 * Pure (no stores, no clock), unit-tested in tests/intelligenceV3.test.ts. Names are prefixed intel* / Intel*.
 *
 * Copy rules: behavioural reads ("reads as"), paper calls, never politics, never money.
 */
import type { GroupOperators, IntelMember } from '~/utils/intelligence'
import { intelPctWords, type IntelCommunity, type IntelProfileV2, type IntelSpace } from '~/utils/intelligenceV2'

// ── Types (coded from Strades-comms/qa-swarm-2026-10-30/intelligence-v3-samples.json) ──

/** One retained factor: an eigenvector of the 11-axis correlation matrix, named by its strongest poles. */
export interface IntelFactor {
  i: number
  eigenvalue: number
  /** share of all differences (0..1) */
  explained: number
  pos: string
  neg: string
  /** axis key → -1..1 (eigenvector component) */
  loadings: Record<string, number>
}
export interface IntelEigen {
  /** descending, sum = number of axes */
  eigenvalues: number[]
  explained: number[]
  cumulative: number[]
  /** factors retained (λ ≥ 1) */
  keep: number
  /** traders in the analysis */
  sample: number
  keys: string[]
  factors: IntelFactor[]
}
/** score in the factor's units (sd = √eigenvalue); pct = 0..100, 50 = middle of the community. */
export interface IntelFactorScore { i: number; score: number; pct: number | null }
/** d2 = Mahalanobis distance²; unusual_pct = more unusual than X% of profiles. */
export interface IntelTypicality { d2: number; unusual_pct: number | null }
/** rank = PageRank × users (1.0 = average); pct = 0..100. */
export interface IntelInfluence { rank: number | null; pct: number | null }

export interface IntelSpaceV3 extends IntelSpace { factors?: IntelFactorScore[]; typicality?: IntelTypicality | null }
export interface IntelProfileV3 extends Omit<IntelProfileV2, 'space'> { space?: IntelSpaceV3 | null; influence?: IntelInfluence | null }
export interface IntelCommunityV3 extends IntelCommunity { eigen?: IntelEigen | null }

export type IntelSimilarKind = 'friend' | 'mate' | 'bot' | 'other'
export interface IntelSharedFactor { i: number; pos: string | null; neg: string | null; side: 'pos' | 'neg' }
export interface IntelSimilarItem {
  kind: IntelSimilarKind
  /** Mahalanobis distance (whitened units) */
  distance: number
  archetype: string
  shared_factors: IntelSharedFactor[]
  id?: string; name?: string; avatar_url?: string | null; is_bot?: boolean; is_demo?: boolean; mbti?: string; code_inferred?: string
}
export interface IntelSimilarPayload { results: IntelSimilarItem[]; metric?: string; detail?: string }

export type IntelSpectral = NonNullable<GroupOperators['spectral']>

// ── small helpers ──

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const pct0 = (v: number) => `${Math.round(v * 100)}%`
const signed = (v: number, d = 2) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(d)}`

/** "F1" for factor index 0. */
export const intelFactorKey = (i: number) => `F${i + 1}`
/** "Social · Bold / Solitary · Cautious" (positive pole first). */
export const intelFactorName = (f: { pos?: string | null; neg?: string | null } | null | undefined) =>
  `${f?.pos || 'high'} / ${f?.neg || 'low'}`

/** True when there is no usable eigen analysis yet (before the first full run, or empty). */
export const intelEigenEmpty = (e: IntelEigen | null | undefined): boolean =>
  !e || !e.eigenvalues?.length || !e.factors?.length

/** "4 factors explain 78% of the differences between 16 traders." ('' when empty) */
export function intelEigenSentence(e: IntelEigen | null | undefined): string {
  if (intelEigenEmpty(e)) return ''
  const keep = clamp(Math.round(e!.keep || e!.factors.length), 1, e!.eigenvalues.length)
  const cum = e!.cumulative?.[keep - 1]
  const share = finite(cum) ? cum : e!.explained.slice(0, keep).reduce((s, v) => s + (v || 0), 0)
  return `${keep} factor${keep === 1 ? '' : 's'} explain${keep === 1 ? 's' : ''} ${pct0(share)} of the differences between ${e!.sample} traders.`
}

// ── Scree chart ──

export interface IntelScreeBar { i: number; key: string; value: number; explained: number; cumulative: number; retained: boolean; x: number; y: number; w: number; h: number; cx: number }
export interface IntelScreeGeom {
  width: number; height: number; empty: boolean
  bars: IntelScreeBar[]
  /** cumulative share line (0..100% on the full plot height) */
  path: string
  dots: { i: number; x: number; y: number }[]
  /** y of the λ = 1 rule line (null when off scale) */
  kaiserY: number | null
  top: number; bottom: number; left: number; right: number
  maxValue: number
}

/** Bars of the eigenvalues (retained = λ ≥ 1 / first `keep`), the cumulative-share line and the λ = 1 rule. */
export function intelScreeGeometry(e: IntelEigen | null | undefined, width = 320, height = 160, pad = { t: 10, r: 8, b: 18, l: 8 }): IntelScreeGeom {
  const top = pad.t, bottom = height - pad.b, left = pad.l, right = width - pad.r
  const vals = (e?.eigenvalues ?? []).filter(finite)
  if (!vals.length) return { width, height, empty: true, bars: [], path: '', dots: [], kaiserY: null, top, bottom, left, right, maxValue: 0 }
  const maxValue = Math.max(1, Math.ceil(Math.max(...vals)))
  const yOf = (v: number) => bottom - (clamp(v, 0, maxValue) / maxValue) * (bottom - top)
  const yCum = (c: number) => bottom - clamp(c, 0, 1) * (bottom - top)
  const step = (right - left) / vals.length
  const keep = finite(e!.keep) ? e!.keep : vals.filter(v => v >= 1).length
  let run = 0
  const total = vals.reduce((s, v) => s + v, 0) || 1
  const bars = vals.map((value, i) => {
    run += value
    const explained = finite(e!.explained?.[i]) ? e!.explained[i]! : value / total
    const cumulative = finite(e!.cumulative?.[i]) ? e!.cumulative[i]! : run / total
    const y = yOf(value)
    const x = left + i * step + step * 0.15
    return { i, key: intelFactorKey(i), value, explained, cumulative, retained: i < keep, x, y, w: step * 0.7, h: bottom - y, cx: left + i * step + step / 2 }
  })
  const dots = bars.map(b => ({ i: b.i, x: b.cx, y: yCum(b.cumulative) }))
  const path = dots.map((d, k) => `${k ? 'L' : 'M'}${d.x.toFixed(1)},${d.y.toFixed(1)}`).join('')
  return { width, height, empty: false, bars, path, dots, kaiserY: yOf(1), top, bottom, left, right, maxValue }
}

/** Readout for one scree bar (shown on click). */
export function intelScreeLine(b: Pick<IntelScreeBar, 'key' | 'value' | 'explained' | 'cumulative' | 'retained'>): string {
  const head = `${b.key} explains ${pct0(b.explained)} of the differences (worth ${b.value.toFixed(2)} axes); with the ones before it, ${pct0(b.cumulative)}.`
  return b.retained ? `${head} Kept: it carries more than one axis' worth.` : `${head} Not kept: it carries less than one axis' worth (below the dashed keep line).`
}

// ── Loadings: which axes make a factor ──

export interface IntelLoadingRow { key: string; label: string; loading: number; left: number; width: number; side: 'pos' | 'neg'; pole: string; strong: boolean; words: string }

/**
 * One row per axis, strongest first. A positive loading means the axis' positive pole goes with the factor's
 * positive pole; `pole` is the axis end that goes with the factor's positive name. Bars: centre = 0, ±1 fills half.
 */
export function intelLoadingRows(f: IntelFactor | null | undefined, axes: { key: string; label: string; neg: string; pos: string }[] = [], strong = 0.3): IntelLoadingRow[] {
  if (!f?.loadings) return []
  const meta = new Map(axes.map(a => [a.key, a]))
  return Object.entries(f.loadings)
    .filter(([, v]) => finite(v))
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .map(([key, loading]) => {
      const a = meta.get(key)
      const c = clamp(loading, -1, 1)
      const side: 'pos' | 'neg' = c >= 0 ? 'pos' : 'neg'
      const pole = a ? (side === 'pos' ? a.pos : a.neg) : side === 'pos' ? 'high' : 'low'
      const isStrong = Math.abs(c) >= strong
      const words = Math.abs(c) < 0.1 ? `${a?.label ?? key}: barely part of it` : `${f.pos} goes with ${pole.toLowerCase()} (${a?.label ?? key}, ${signed(c)})`
      return { key, label: a?.label ?? key, loading: c, left: c >= 0 ? 50 : 50 + c * 50, width: Math.abs(c) * 50, side, pole, strong: isStrong, words }
    })
}

// ── Your factors ──

export interface IntelFactorRow {
  i: number; key: string; name: string; pos: string; neg: string; explained: number; eigenvalue: number; sd: number
  score: number | null; z: number | null; pct: number | null
  /** your marker on a -3..+3 sd track, 0..1 (null when not scored) */
  at: number | null
  words: string
  factor: IntelFactor
}

/** Retained factors joined with your score; z = score / √eigenvalue, drawn on a ±`cap` sd track. */
export function intelFactorRows(e: IntelEigen | null | undefined, scores: IntelFactorScore[] | null | undefined, cap = 3): IntelFactorRow[] {
  if (intelEigenEmpty(e)) return []
  const mine = new Map((scores ?? []).map(s => [s.i, s]))
  return e!.factors.map((f) => {
    const s = mine.get(f.i)
    const sd = Math.sqrt(Math.max(f.eigenvalue, 1e-6))
    const score = finite(s?.score) ? s!.score : null
    const z = score === null ? null : score / sd
    const pct = finite(s?.pct) ? s!.pct : null
    return {
      i: f.i, key: intelFactorKey(f.i), name: intelFactorName(f), pos: f.pos, neg: f.neg, explained: f.explained, eigenvalue: f.eigenvalue, sd,
      score, z, pct, at: z === null ? null : (clamp(z, -cap, cap) + cap) / (2 * cap),
      words: score === null ? 'not placed yet: make a few calls first' : intelPctWords(pct, f.neg, f.pos),
      factor: f,
    }
  })
}

// ── How typical / influence ──

export type IntelLevel = 'typical' | 'ordinary' | 'distinctive' | 'rare' | 'unknown'
export interface IntelWords { level: string; title: string; line: string; pct: number | null }

/** unusual_pct (more unusual than X% of profiles; low = typical) → words. */
export function intelTypicalityWords(t: IntelTypicality | null | undefined): IntelWords & { level: IntelLevel } {
  if (!t || !finite(t.unusual_pct)) return { level: 'unknown', title: 'Not placed yet', line: 'Your profile is placed once a few of your calls and reads are measured.', pct: null }
  const p = clamp(t.unusual_pct, 0, 100)
  const r = Math.round(p)
  if (p < 25) return { level: 'typical', title: 'A typical profile', line: `Close to the community's centre: more unusual than only ${r}% of profiles.`, pct: p }
  if (p < 75) return { level: 'ordinary', title: 'An ordinary profile', line: `Neither central nor rare: more unusual than ${r}% of profiles.`, pct: p }
  if (p <= 95) return { level: 'distinctive', title: 'A distinctive profile', line: `Your mix of habits stands out: more unusual than ${r}% of profiles.`, pct: p }
  return { level: 'rare', title: 'A rare profile', line: `Few traders combine habits like yours: more unusual than ${r}% of profiles.`, pct: p }
}

/** PageRank influence: pct (0..100) drives the words, rank (× the average) is shown alongside. */
export function intelInfluenceWords(inf: IntelInfluence | null | undefined): IntelWords & { level: 'high' | 'middle' | 'low' | 'unknown'; rank: string } {
  if (!inf || !finite(inf.pct)) return { level: 'unknown', title: 'Not measured yet', line: 'Influence appears once others have endorsed or followed some of your calls.', pct: null, rank: '—' }
  const p = clamp(inf.pct, 0, 100)
  const rank = finite(inf.rank) ? `${inf.rank.toFixed(2)}× the average` : '—'
  const r = Math.round(p)
  if (p >= 75) return { level: 'high', title: 'Others often end up on your side', line: `After you call, others come round to your side more than for ${r}% of traders.`, pct: p, rank }
  if (p >= 25) return { level: 'middle', title: 'Some pull on others', line: `Others come round to your side about as often as for most traders (above ${r}% of them).`, pct: p, rank }
  return { level: 'low', title: 'Little pull on others so far', line: `Others rarely end up on your side after you call (above only ${r}% of traders).`, pct: p, rank }
}

// ── People who behave like you ──

export interface IntelSimilarRow {
  key: string; kind: IntelSimilarKind; kindLabel: string; named: boolean; title: string; archetype: string
  bot: boolean; demo: boolean; code: string; distance: number | null; closeness: string; shared: string; href: string | null
  /** one readable sentence: archetype (named only), closeness, distance, shared leanings */
  line: string
}

const KIND_LABEL: Record<IntelSimilarKind, string> = { friend: 'Friend', mate: 'Room mate', bot: 'Bot', other: 'Trader' }

/** Whitened (Mahalanobis) distance → words. Two random profiles sit about 4–5 apart on 11 axes. */
export function intelClosenessWords(d: number | null | undefined): string {
  if (!finite(d)) return 'distance unknown'
  if (d < 1.5) return 'behaves very much like you'
  if (d < 3) return 'behaves a lot like you'
  if (d < 4.5) return 'alike in parts'
  return 'quite different from you'
}

/** "Both lean Steady · Early bird and Contrarian · Intuitive." */
export function intelSharedWords(shared: IntelSharedFactor[] | null | undefined): string {
  const poles = (shared ?? []).map(s => (s.side === 'pos' ? s.pos : s.neg)).filter((x): x is string => !!x)
  if (!poles.length) return ''
  return `Both lean ${poles.length === 1 ? poles[0] : `${poles.slice(0, -1).join(', ')} and ${poles[poles.length - 1]}`}.`
}

/** Rows for the "People who behave like you" list; anonymous ("other") rows have no name and no link. */
export function intelSimilarRows(p: IntelSimilarPayload | null | undefined): IntelSimilarRow[] {
  return (p?.results ?? []).map((r, k) => {
    const named = r.kind !== 'other' && !!r.id && !!r.name
    const archetype = r.archetype || ''
    const closeness = intelClosenessWords(r.distance)
    const shared = intelSharedWords(r.shared_factors)
    const line = [
      named && archetype ? `Reads as ${archetype.toLowerCase()}.` : '',
      `${closeness.charAt(0).toUpperCase()}${closeness.slice(1)}${finite(r.distance) ? ` (distance ${r.distance.toFixed(2)})` : ''}.`,
      shared,
    ].filter(Boolean).join(' ')
    return {
      key: r.id ?? `anon-${k}`, kind: r.kind, kindLabel: KIND_LABEL[r.kind] ?? 'Trader', named,
      title: named ? r.name! : `A trader${archetype ? ` (${archetype.toLowerCase()})` : ''}`,
      archetype, bot: !!r.is_bot || (r.kind === 'bot'), demo: !!r.is_demo, code: r.code_inferred || r.mbti || '',
      distance: finite(r.distance) ? r.distance : null, closeness, shared, line,
      href: named ? `/insights?compare=${encodeURIComponent(r.id!)}` : null,
    }
  })
}

// ── Map axes from factors (SpaceMap) ──

export interface IntelFactorOption { i: number; key: string; label: string; pos: string; neg: string; explained: number | null }

/** Retained factors as map-axis choices (falls back to community.map.axes before the first eigen run). */
export function intelFactorOptions(c: IntelCommunityV3 | null | undefined): IntelFactorOption[] {
  const e = c?.eigen
  const src: { i?: number; pos: string; neg: string; explained?: number }[] = !intelEmptyFactors(e) ? e!.factors : (c?.map?.axes ?? [])
  return src.map((f, k) => {
    const i = finite(f.i) ? f.i : k
    const explained = finite(f.explained) ? f.explained : finite(c?.map?.explained?.[i]) ? c!.map!.explained[i]! : null
    return { i, key: intelFactorKey(i), label: `${intelFactorKey(i)} · ${f.pos}${explained !== null ? ` (${pct0(explained)})` : ''}`, pos: f.pos, neg: f.neg, explained }
  })
}
const intelEmptyFactors = (e: IntelEigen | null | undefined) => !e?.factors?.length

/** "F1 — 32% of the differences" for an axis caption. */
export const intelFactorCaption = (o: IntelFactorOption | null | undefined) =>
  !o ? '' : `${o.key}${o.explained !== null ? ` — ${pct0(o.explained)} of the differences` : ''}`

export interface IntelFactorPairGeom { size: number; zero: number; extent: number; rings: number[]; me: { x: number; y: number; sx: number; sy: number } | null }

/** Your dot on any two factors, in community sd (score / √eigenvalue), on a ±`extent` square with 1 and 2 sd rings. */
export function intelFactorPairGeometry(scores: IntelFactorScore[] | null | undefined, e: IntelEigen | null | undefined, fx: number, fy: number, size = 320, pad = 22, extent = 3): IntelFactorPairGeom {
  const half = (size - 2 * pad) / 2
  const zero = size / 2
  const rings = [1, 2].map(r => (r / extent) * half)
  const sdOf = (i: number) => Math.sqrt(Math.max(e?.factors?.find(f => f.i === i)?.eigenvalue ?? e?.eigenvalues?.[i] ?? 1, 1e-6))
  const sx = (scores ?? []).find(s => s.i === fx)
  const sy = (scores ?? []).find(s => s.i === fy)
  if (!finite(sx?.score) || !finite(sy?.score)) return { size, zero, extent, rings, me: null }
  const x = sx!.score / sdOf(fx)
  const y = sy!.score / sdOf(fy)
  return { size, zero, extent, rings, me: { x, y, sx: zero + (clamp(x, -extent, extent) / extent) * half, sy: zero - (clamp(y, -extent, extent) / extent) * half } }
}

// ── Room consensus spectrum ──

export interface IntelAlignRow { id: string; name: string; bot: boolean; role: string; me: boolean; value: number | null; left: number; width: number; side: 'with' | 'against' | 'apart'; dissident: boolean; words: string }
export interface IntelSpectrum {
  empty: boolean; members: number; linked: number
  consensus: { value: number; width: number; words: string; line: string } | null
  second: { value: number; width: number; words: string; line: string } | null
  rows: IntelAlignRow[]
}

/** Consensus (λ1/m) → words relative to the room size (1/m = no common view at all). */
export function intelConsensusWords(v: number | null | undefined, m: number): string {
  if (!finite(v)) return 'not measured'
  const chance = 1 / Math.max(1, m)
  if (v >= 0.5) return 'most of the room moves as one'
  if (v >= 0.25) return 'a clear main view'
  if (v >= 1.5 * chance) return 'a loose main view'
  return 'no common view'
}

/** Second camp (λ2/m) compared with the main view. */
export function intelSecondCampWords(v: number | null | undefined, consensus: number | null | undefined, m: number): string {
  if (!finite(v) || v <= 0) return 'no second camp'
  const chance = 1 / Math.max(1, m)
  if (finite(consensus) && consensus > 0 && v >= 0.6 * consensus && v >= 1.2 * chance) return 'a real competing camp'
  if (v >= chance) return 'a small second camp'
  return 'no real second camp'
}

/** Alignment (leading eigenvector × √m; ≈1 = with the main view, < 0 = other side) → words. */
export function intelAlignWords(a: number | null | undefined): string {
  if (!finite(a)) return 'not linked: too few calls shared with the others'
  if (Math.abs(a) < 0.2) return 'no clear side (few calls shared with the others)'
  if (a >= 0.8) return 'moves with the room'
  if (a > 0) return 'mostly with the room'
  if (a <= -0.8) return 'takes the other side'
  return 'leans to the other side'
}

/** Two bars (consensus, second camp) and per-member alignment bars, most aligned first (dissidents marked). */
export function intelSpectrum(s: IntelSpectral | null | undefined, members: Pick<IntelMember, 'id' | 'name' | 'is_bot' | 'role'>[] = [], meId: string | null = null, cap = 2): IntelSpectrum {
  if (!s || !finite(s.consensus)) return { empty: true, members: 0, linked: 0, consensus: null, second: null, rows: [] }
  const m = finite(s.members) && s.members > 0 ? s.members : Object.keys(s.alignment ?? {}).length
  const byId = new Map(members.map(x => [x.id, x]))
  const c = clamp(s.consensus, 0, 1)
  const two = finite(s.second_camp) ? clamp(s.second_camp, 0, 1) : null
  const rows = Object.entries(s.alignment ?? {}).map(([id, raw]) => {
    const who = byId.get(id)
    const value = finite(raw) ? (Object.is(raw, -0) ? 0 : raw) : null
    const k = value === null ? 0 : clamp(value / cap, -1, 1)
    const side: IntelAlignRow['side'] = value === null || Math.abs(value) < 0.2 ? 'apart' : value > 0 ? 'with' : 'against'
    return {
      id, name: who?.name || 'A member', bot: !!who?.is_bot, role: who?.role || '', me: id === meId, value,
      left: k >= 0 ? 50 : 50 + k * 50, width: Math.abs(k) * 50, side, dissident: who?.role === 'dissident', words: intelAlignWords(value),
    }
  }).sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity))
  return {
    empty: false, members: m, linked: finite(s.linked_pairs) ? s.linked_pairs : 0,
    consensus: { value: c, width: c * 100, words: intelConsensusWords(c, m), line: `${pct0(c)} of the room's agreement follows one main view (1/${m} = no common view at all).` },
    second: two === null ? null : { value: two, width: two * 100, words: intelSecondCampWords(two, c, m), line: `${pct0(two)} follows a second, competing view.` },
    rows,
  }
}
