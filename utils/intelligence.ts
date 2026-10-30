/**
 * Insights (behaviour intelligence) — types and pure helpers for /insights.
 *
 * Data comes from the Django app `apps/intelligence` (GET /api/v1/intelligence/*); the fetch lives in
 * composables/useIntelligence.ts. Everything here is pure (no stores, no clock) so it is unit-tested in
 * tests/intelligence.test.ts.
 *
 * Copy rules: these are behavioural reads, not psychology diagnoses ("reads as", never "is"); scores are
 * paper call accuracy, never money.
 */

// ── Types (coded from real responses: Strades-comms/qa-swarm-2026-10-30/intelligence-api-samples.json) ──

export interface IntelAxis {
  key: string
  /** -1..1, positive = the `pos` letter (E, S, T, J) */
  value: number
  pos: string
  neg: string
  pos_label: string
  neg_label: string
}

export interface IntelMetrics {
  risk_appetite: number
  skill: number
  discipline: number
  contrarianism: number
  sociability: number
  research_depth: number
  regularity: number
  /** percentage points, + = targets over-optimistic */
  calibration_bias: number
  minutes_per_day: number
  sessions_per_day: number
  peak_hour_utc: number
  horizon_days: number
}

export type IntelSeverity = 'info' | 'success' | 'warning' | 'danger' | string

export interface IntelAdvice {
  key: string
  severity: IntelSeverity
  title: string
  body: string
}

export interface IntelProfile {
  user_id: string
  computed_at: string
  window_days: number
  code_inferred: string
  code_declared: string
  code_confidence: number
  axes: IntelAxis[]
  archetype: string
  metrics: IntelMetrics
  asset_mix: Record<string, number>
  hours: number[]
  strengths: string[]
  /** own profile only */
  weaknesses?: string[]
  advice?: IntelAdvice[]
  stats?: Record<string, any> & { calls?: number; resolved?: number; hits?: number; pending?: number; span_days?: number }
}

export type StrategyKey = 'momentum' | 'mean_reversion' | 'breakout' | 'grid_dca' | 'chain_propagation' | string

export interface IntelDirectiveSource {
  source: 'own profile' | 'allies' | 'swarm' | string
  share: number
  why: string
}

export interface IntelDirective {
  weights: Record<StrategyKey, number>
  max_position_pct: number
  stop_loss_pct: number
  take_profit_pct: number
  sources: IntelDirectiveSource[]
  components: Record<string, Record<StrategyKey, number>> | null
  computed_at: string
}

export interface IntelMember {
  id: string
  name: string
  avatar_url: string | null
  is_bot: boolean
  is_demo: boolean
  mbti: string
  role?: string
  influence_out?: number
}

export type PairLabel = 'allies' | 'sparring partners' | 'echo chamber' | 'opposites' | 'acquaintances' | 'strangers' | 'unknown'
export type GroupLabel = 'collective edge' | 'cohesive' | 'groupthink risk' | 'loose circle'
export type RelationLabel = PairLabel | GroupLabel | string

export interface IntelRelation {
  id: string
  kind: 'pair' | 'group'
  name: string
  size: number
  label: RelationLabel
  /** 0..100 or null */
  compatibility: number | null
  agreement: number | null
  opposition: number | null
  /** gain in percentage points (null = not enough shared questions) */
  complementarity: number | null
  computed_at: string
  members: IntelMember[]
  conversation_id: string | null
}

export interface SetOps { and: number; or: number; xor: number; jaccard: number | null }
export interface LetterOps { and: number; xor: number; shared: string; differs: string }
export interface PlaceInfo { city: string | null; country: string | null; tz: string | null }
export interface InfluenceOps { n: number; follow_rate: number | null; expected: number | null; influence: number | null }

export interface PairOperators {
  direction?: { shared: number; and: number; xor: number; agreement: number | null; opposition: number | null }
  assets?: SetOps
  news?: SetOps
  letters?: LetterOps
  declared_letters?: LetterOps
  traits_cosine?: number | null
  lead_lag?: { lag_days: number; lag_r: number | null; n?: number; r0?: number | null } | null
  copresence?: number | null
  space?: { km: number | null; tz_gap_h: number | null; same_country: boolean | null; a: PlaceInfo; b: PlaceInfo } | null
  complementarity?: { n: number; acc_a: number | null; acc_b: number | null; acc_pair: number | null; gain: number | null } | null
  influence_ab?: InfluenceOps | null
  influence_ba?: InfluenceOps | null
  interaction?: number | null
  shared_conversations?: number
  friends?: boolean
  parts?: Record<string, number | null>
}

export interface GroupOperators {
  cohesion_min?: number | null
  pairs?: number
  crowd?: { n: number; acc_majority: number | null; acc_mean: number | null; gain: number | null } | null
  diversity?: number | null
  letter_diversity?: number | null
  codes?: string[]
  influence?: Record<string, number>
  /**
   * Eigen-structure of the room's agreement matrix (v3): consensus = λ1/m (share of the room moving as one),
   * second_camp = λ2/m, alignment = each member on the leading eigenvector (1 ≈ with the main view, < 0 = other side).
   */
  spectral?: {
    consensus: number; second_camp: number | null; eigenvalues: number[]; members: number; linked_pairs: number
    alignment: Record<string, number | null>
  } | null
}

export interface TimelineWeek {
  week: number
  phase: 'past' | 'now' | 'future'
  shared: number
  agreement: number | null
  assets: string[]
}

export interface IntelRelationDetail extends IntelRelation {
  members_all: IntelMember[]
  operators: PairOperators & GroupOperators
  timeline: TimelineWeek[]
  advice: IntelAdvice[]
}

export interface IntelLastRun { cycle: string; at: string | null; users: number; pairs: number; groups: number }

export interface IntelMePayload {
  profile: IntelProfile | null
  directive: IntelDirective | null
  relations: IntelRelation[]
  last_run: IntelLastRun | null
}

export interface IntelUserPayload { user: IntelMember; profile: IntelProfile }

export interface IntelRefreshPayload {
  run: { users: number; pairs: number; groups: number; ms: number }
  profile: IntelProfile | null
  directive: IntelDirective | null
}

export interface HierarchyStyle {
  dimension: 'archetype' | 'asset_class' | 'style' | string
  name: string
  calls: number
  users: number
  hit_rate: number
  mean_score: number
  score_sd: number
  blowup_share: number
  move_pct: number
  benefit: number
  risk: number
  ratio: number | null
  risk_rank: number
  benefit_rank: number
}

export interface HierarchyPayload {
  styles: HierarchyStyle[]
  strategies: any[]
  swarm_prior: Record<StrategyKey, number> | null
  window_days?: number
  computed_at: string | null
}

// ── Formatting ──

const DASH = '—'
export const INTEL_DASH = DASH
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/** 0..1 → "65%". null/NaN → "—". */
export function intelPct(v: number | null | undefined, digits = 0): string {
  return finite(v) ? `${(v * 100).toFixed(digits)}%` : DASH
}

/** Signed number with a real minus sign: +4.4 / −4.6 / 0.0 */
export function intelSigned(v: number | null | undefined, digits = 1, unit = ''): string {
  if (!finite(v)) return DASH
  const r = Number(v.toFixed(digits))
  const sign = r > 0 ? '+' : r < 0 ? '−' : ''
  return `${sign}${Math.abs(r).toFixed(digits)}${unit}`
}

/** Compatibility 0..100 → "52" (one decimal under 10 is noise; round). */
export function intelScore(v: number | null | undefined): string {
  return finite(v) ? String(Math.round(v)) : DASH
}

/** Clamp to [0,1] for meters/bars. */
export const intelUnit = (v: number | null | undefined) => (finite(v) ? Math.max(0, Math.min(1, v)) : 0)

export function intelKm(km: number | null | undefined): string {
  if (!finite(km)) return DASH
  if (km < 1) return '< 1 km'
  return `${Math.round(km).toLocaleString('en-US')} km`
}

export function intelHour(h: number | null | undefined): string {
  if (!finite(h)) return DASH
  const m = Math.round((((h % 24) + 24) % 24) * 60)
  return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')} UTC`
}

export function intelMinutes(min: number | null | undefined): string {
  if (!finite(min)) return DASH
  if (min < 60) return `${Math.round(min)} min`
  const h = Math.floor(min / 60)
  const m = Math.round(min - h * 60)
  return m ? `${h} h ${m} min` : `${h} h`
}

// ── Axes & codes ──

export type AxisStrength = 'balanced' | 'slight' | 'moderate' | 'clear'

export function axisStrength(v: number): AxisStrength {
  const a = Math.abs(v)
  if (a < 0.1) return 'balanced'
  if (a < 0.3) return 'slight'
  if (a < 0.6) return 'moderate'
  return 'clear'
}

/** Which letter the behaviour leans to, how strongly, and a sentence that says "reads as". */
export function axisRead(axis: IntelAxis) {
  const pos = axis.value >= 0
  const letter = pos ? axis.pos : axis.neg
  const label = pos ? axis.pos_label : axis.neg_label
  const strength = axisStrength(axis.value)
  const pct = Math.round(Math.abs(axis.value) * 100)
  const words = strength === 'balanced'
    ? `Reads as balanced between ${axis.neg_label} and ${axis.pos_label}`
    : `Reads as ${strength} ${label} (${pct}%)`
  return { letter: strength === 'balanced' ? '·' : letter, label, strength, pct, words }
}

/** Centre-anchored bar: left/width in % of the track (0 sits at 50%). */
export function axisBar(v: number): { left: number; width: number } {
  const c = Math.max(-1, Math.min(1, finite(v) ? v : 0))
  return c >= 0 ? { left: 50, width: c * 50 } : { left: 50 + c * 50, width: -c * 50 }
}

/** Letter-by-letter comparison of the declared code and the behaviour read. */
export function codeAgreement(declared: string | null | undefined, inferred: string | null | undefined) {
  const d = (declared || '').toUpperCase()
  const i = (inferred || '').toUpperCase()
  if (d.length !== 4 || i.length !== 4) return { known: false, matches: 0, letters: [] as { declared: string; inferred: string; same: boolean }[] }
  const letters = [...i].map((ch, k) => ({ declared: d[k]!, inferred: ch, same: d[k] === ch }))
  return { known: true, matches: letters.filter(l => l.same).length, letters }
}

export function isNewcomer(p: IntelProfile | null | undefined): boolean {
  return !p || p.archetype === 'Newcomer' || !p.code_confidence
}

// ── Metrics ──

export interface MetricRow { key: keyof IntelMetrics; label: string; display: string; bar: number | null; explain: string }

const METRIC_META: { key: keyof IntelMetrics; label: string; explain: string }[] = [
  { key: 'skill', label: 'Call accuracy', explain: 'How often your paper calls got the direction right and how well they scored, weighted to recent calls. Not money.' },
  { key: 'discipline', label: 'Discipline', explain: 'You keep to your calls: few revisions or withdrawals, sizes stay consistent.' },
  { key: 'risk_appetite', label: 'Risk appetite', explain: 'Size of the moves you call, how bold your targets are and how much you pick volatile assets.' },
  { key: 'contrarianism', label: 'Independence', explain: 'How often you call against the crowd instead of following the majority.' },
  { key: 'sociability', label: 'Sociability', explain: 'Messages, comments, shares and friends compared with other users.' },
  { key: 'research_depth', label: 'Research depth', explain: 'News read and assets studied per call.' },
  { key: 'regularity', label: 'Regularity', explain: 'How steady your daily activity is across the window.' },
]

export function metricRows(m: IntelMetrics | null | undefined): MetricRow[] {
  if (!m) return []
  const rows: MetricRow[] = METRIC_META.map(x => ({ ...x, display: intelPct(m[x.key]), bar: intelUnit(m[x.key]) }))
  const cb = m.calibration_bias
  rows.push({
    key: 'calibration_bias', label: 'Target calibration', bar: null,
    display: !finite(cb) ? DASH : Math.abs(cb) < 0.5 ? 'on target' : `${intelSigned(cb, 1, ' pts')} ${cb > 0 ? 'over-optimistic' : 'too cautious'}`,
    explain: 'Average gap between the move you target and the move that happened, in percentage points. + means your targets overshoot.',
  })
  rows.push({ key: 'minutes_per_day', label: 'Time on Strades', bar: null, display: `${intelMinutes(m.minutes_per_day)}/day`, explain: 'Average active minutes per day in the window.' })
  rows.push({ key: 'sessions_per_day', label: 'Sessions', bar: null, display: finite(m.sessions_per_day) ? `${m.sessions_per_day.toFixed(1)}/day` : DASH, explain: 'Separate visits per day.' })
  rows.push({ key: 'peak_hour_utc', label: 'Peak hour', bar: null, display: intelHour(m.peak_hour_utc), explain: 'The hour (UTC) you are most active.' })
  rows.push({ key: 'horizon_days', label: 'Typical horizon', bar: null, display: finite(m.horizon_days) ? (m.horizon_days < 1 ? `${Math.round(m.horizon_days * 24)} h` : `${m.horizon_days.toFixed(1)} d`) : DASH, explain: 'Median time between making a call and its target date.' })
  return rows
}

export function severityTone(s: IntelSeverity): 'info' | 'up' | 'warn' | 'down' {
  if (s === 'success') return 'up'
  if (s === 'warning') return 'warn'
  if (s === 'danger' || s === 'error') return 'down'
  return 'info'
}

// ── Directive ──

export const STRATEGY_LABEL: Record<string, string> = {
  momentum: 'Momentum', mean_reversion: 'Mean reversion', breakout: 'Breakout', grid_dca: 'Grid / DCA', chain_propagation: 'Chain propagation',
}
export const STRATEGY_EXPLAIN: Record<string, string> = {
  momentum: 'Ride a move that is already under way.',
  mean_reversion: 'Bet that a stretched price comes back toward its average.',
  breakout: 'Enter when price leaves a range.',
  grid_dca: 'Buy and sell in steps on a grid; average in over time.',
  chain_propagation: 'Follow a move as it spreads from one asset to related ones.',
}
export const strategyLabel = (k: string) => STRATEGY_LABEL[k] ?? k.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase())

export function weightRows(w: Record<string, number> | null | undefined) {
  const entries = Object.entries(w ?? {}).filter(([, v]) => finite(v))
  const total = entries.reduce((s, [, v]) => s + Math.max(0, v), 0) || 1
  return entries
    .map(([key, v]) => ({ key, label: strategyLabel(key), share: Math.max(0, v) / total, explain: STRATEGY_EXPLAIN[key] ?? '' }))
    .sort((a, b) => b.share - a.share)
}

export const SOURCE_TONE: Record<string, string> = { 'own profile': 'var(--primary-blue)', allies: 'var(--primary-green)', swarm: 'var(--domain-agent)' }
export const sourceColor = (s: string) => SOURCE_TONE[s] ?? 'var(--text-gray)'

// ── Relations ──

export interface LabelTone { tone: 'up' | 'info' | 'warn' | 'down' | 'neutral'; color: string; blurb: string }

export const LABEL_TONE: Record<string, LabelTone> = {
  allies: { tone: 'up', color: 'var(--primary-green)', blurb: 'High compatibility: you read markets in compatible ways and it works.' },
  'sparring partners': { tone: 'info', color: 'var(--primary-blue)', blurb: 'You often disagree, and together you call better than either alone.' },
  'echo chamber': { tone: 'warn', color: 'var(--warning-orange)', blurb: 'You agree a lot, one of you follows the other, and agreeing adds no accuracy.' },
  opposites: { tone: 'down', color: 'var(--domain-social)', blurb: 'You usually take opposite sides of the same question.' },
  acquaintances: { tone: 'neutral', color: 'var(--text-light-gray)', blurb: 'Some overlap, no strong pattern yet.' },
  strangers: { tone: 'neutral', color: 'var(--text-gray)', blurb: 'Little in common so far.' },
  unknown: { tone: 'neutral', color: 'var(--status-draft)', blurb: 'Not enough shared activity to read this relation yet.' },
  'collective edge': { tone: 'up', color: 'var(--primary-green)', blurb: "The room's majority calls better than its average member." },
  cohesive: { tone: 'info', color: 'var(--primary-blue)', blurb: 'Members are broadly compatible with each other.' },
  'groupthink risk': { tone: 'warn', color: 'var(--warning-orange)', blurb: 'High agreement, low diversity and no accuracy gain from the majority.' },
  'loose circle': { tone: 'neutral', color: 'var(--text-gray)', blurb: 'A loose set of people with no strong collective pattern yet.' },
}
export const labelTone = (label: string | null | undefined): LabelTone => LABEL_TONE[label ?? 'unknown'] ?? LABEL_TONE.unknown!

export const ROLE_EXPLAIN: Record<string, string> = {
  leader: 'Others tend to follow their calls.',
  follower: 'Tends to echo the other side after a delay.',
  bridge: 'Connects members who otherwise rarely agree.',
  contrarian: 'Often takes the other side of the room.',
  dissident: 'Sits against the room\'s main view: when most members lean one way on a call, they tend to lean the other.',
  member: 'Takes part without a distinct pattern.',
}

export function memberChip(m: Pick<IntelMember, 'is_bot' | 'is_demo'>): 'bot' | 'demo' | null {
  return m.is_bot ? 'bot' : m.is_demo ? 'demo' : null
}

export function intelInitials(name: string | null | undefined): string {
  const parts = (name || '?').replace(/[^\p{L}\p{N} ]/gu, ' ').trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '')).toUpperCase()
}

/**
 * Pair names carry " (INFP×INTJ)" — the title shows names only; codes are shown as chips. The API drops the
 * viewer from a pair's `members`, so a single member means "You × them".
 */
export function relationTitle(r: Pick<IntelRelation, 'name' | 'kind' | 'members'>): string {
  if (r.kind === 'pair' && r.members?.length === 1) return `You × ${r.members[0]!.name}`
  if (r.kind === 'pair' && r.members?.length) return r.members.map(m => m.name).join(' × ')
  return (r.name || '').replace(/\s*\([A-Z·×x]+\)\s*$/, '')
}

/** Pairs before rooms, each by compatibility (unknown last). */
export function splitRelations(list: IntelRelation[]) {
  const by = (a: IntelRelation, b: IntelRelation) => (b.compatibility ?? -1) - (a.compatibility ?? -1)
  return {
    pairs: list.filter(r => r.kind === 'pair').sort(by),
    groups: list.filter(r => r.kind === 'group').sort(by),
  }
}

export interface OperatorExplain { title: string; explain: string }

/** Plain-English meaning of every operator key the API emits. */
export const OPERATOR_EXPLAIN: Record<string, OperatorExplain> = {
  'direction.shared': { title: 'Shared questions', explain: 'Questions (same asset, overlapping dates) you both made a call on.' },
  'direction.and': { title: 'AND — same side', explain: 'Shared questions where you both called the same direction.' },
  'direction.xor': { title: 'XOR — opposite sides', explain: 'Shared questions where one called up and the other down.' },
  'direction.agreement': { title: 'Agreement', explain: 'Share of shared questions on the same side (AND ÷ shared).' },
  'direction.opposition': { title: 'Opposition', explain: 'Share of shared questions on opposite sides (XOR ÷ shared).' },
  'assets.jaccard': { title: 'Assets in common', explain: 'Jaccard overlap of the assets you call: in both (AND) ÷ in either (OR). 1 = same watchlist.' },
  'news.jaccard': { title: 'News in common', explain: 'Jaccard overlap of the articles you read: read by both ÷ read by either.' },
  letters: { title: 'Behaviour letters', explain: 'Letters of the behaviour-read codes that match (shared) and differ. Read from behaviour, not a test.' },
  declared_letters: { title: 'Declared letters', explain: 'The same comparison on the codes you each declared on your profile.' },
  traits_cosine: { title: 'Trait similarity', explain: 'Cosine of your behaviour vectors: +1 alike, 0 unrelated, −1 mirror images.' },
  lead_lag: { title: 'Lead / lag', explain: "Whose daily call mood moves first and how many days later the other's echoes it (r = strength of the echo)." },
  copresence: { title: 'Co-presence', explain: 'Overlap of your active hours of the day (UTC): 1 = online at the same times.' },
  space: { title: 'Distance', explain: 'Distance between your cities and the gap between your time zones.' },
  complementarity: { title: 'Two heads', explain: 'On questions you both answered: accuracy of each of you, and of the pair when you agree. Gain = pair minus the better one.' },
  influence_ab: { title: 'Influence →', explain: 'How often the second person follows the first one\'s call within days, minus what chance would give.' },
  influence_ba: { title: 'Influence ←', explain: 'Same measure in the other direction.' },
  interaction: { title: 'Direct interaction', explain: 'Messages, comments and reactions between you, scaled 0–1.' },
  parts: { title: 'Compatibility inputs', explain: 'The 0–1 parts averaged into the compatibility score; unknown parts drop out.' },
  'crowd.gain': { title: 'Room vs members', explain: "Accuracy of the room's majority call minus the average member's accuracy, on questions several members answered." },
  diversity: { title: 'Diversity', explain: 'How different members behave (0 = clones, 1 = all different).' },
  letter_diversity: { title: 'Letter diversity', explain: 'How mixed the members\' behaviour letters are.' },
  cohesion_min: { title: 'Weakest link', explain: 'Lowest compatibility between any two measured members (0–100).' },
  codes: { title: 'Codes in the room', explain: 'Behaviour-read codes of the measured members.' },
  influence: { title: 'Influence in the room', explain: 'How much each member\'s calls are followed by the others, above chance.' },
}
export const explainOperator = (key: string): OperatorExplain =>
  OPERATOR_EXPLAIN[key] ?? { title: key.replace(/[._]/g, ' '), explain: 'Measured from both members\' calls, reads and activity.' }

export const PART_LABEL: Record<string, string> = {
  traits: 'Traits', agreement: 'Agreement', copresence: 'Co-presence', interaction: 'Interaction', assets: 'Assets', proximity: 'Proximity',
}

export function describeLeadLag(ll: PairOperators['lead_lag'], a: string, b: string): string {
  if (!ll || !finite(ll.lag_days) || !finite(ll.lag_r)) return 'Not enough daily overlap to tell who moves first.'
  if (ll.lag_days === 0 || Math.abs(ll.lag_r) < 0.3) return 'Neither of you reliably moves first.'
  const [lead, follow] = ll.lag_days > 0 ? [a, b] : [b, a]
  return `${lead} moves first; ${follow}'s mood echoes it about ${Math.abs(ll.lag_days)} day${Math.abs(ll.lag_days) === 1 ? '' : 's'} later (r = ${intelSigned(ll.lag_r, 2)}).`
}

export function describeInfluence(inf: InfluenceOps | null | undefined, from: string, to: string): string {
  if (!inf || !inf.n || !finite(inf.follow_rate)) return `No calls by ${to} following ${from} yet.`
  const base = `${to} followed ${from} on ${intelPct(inf.follow_rate)} of ${inf.n} chances (chance: ${intelPct(inf.expected)})`
  if (!finite(inf.influence) || Math.abs(inf.influence) < 0.05) return `${base} — no real pull.`
  return `${base} — ${inf.influence > 0 ? 'a pull' : 'a push away'} of ${intelSigned(inf.influence * 100, 0, ' pts')}.`
}

export function describeComplementarity(c: PairOperators['complementarity'], a: string, b: string): string {
  if (!c || !c.n) return 'You have not both answered the same resolved question yet.'
  const g = c.gain
  const head = `On ${c.n} resolved question${c.n === 1 ? '' : 's'}: ${a} ${intelPct(c.acc_a)}, ${b} ${intelPct(c.acc_b)}, together when agreeing ${intelPct(c.acc_pair)}.`
  if (!finite(g)) return head
  return `${head} ${g > 0 ? `Two heads beat the better one by ${intelSigned(g * 100, 0, ' pts')}.` : g < 0 ? 'Agreeing did not improve on the better caller.' : 'No gain from agreeing.'}`
}

export function describeSpace(s: PairOperators['space']): string {
  if (!s) return 'Location unknown.'
  const place = (p: PlaceInfo) => [p.city, p.country].filter(Boolean).join(', ') || 'unknown place'
  const tz = finite(s.tz_gap_h) ? (s.tz_gap_h === 0 ? 'same time zone' : `${Math.abs(s.tz_gap_h)} h apart`) : 'time gap unknown'
  return `${place(s.a)} ↔ ${place(s.b)} · ${intelKm(s.km)} · ${tz}${s.same_country ? ' · same country' : ''}`
}

// ── Week timeline (SVG) ──

export interface TimelineGeom {
  points: { x: number; y: number | null; w: TimelineWeek; i: number }[]
  path: string
  bars: { x: number; y: number; h: number; w: TimelineWeek }[]
  step: number
  nowX: number | null
  pastEnd: number | null
  futureStart: number | null
}

/** Agreement line (gaps where a week has no shared call), shared-count bars, past/now/future bands. */
export function timelineGeometry(weeks: TimelineWeek[], width = 320, height = 120, pad = 10): TimelineGeom {
  const n = weeks.length
  const step = n > 1 ? (width - 2 * pad) / (n - 1) : 0
  const xOf = (i: number) => (n > 1 ? pad + i * step : width / 2)
  const yOf = (a: number) => pad + (1 - Math.max(0, Math.min(1, a))) * (height - 2 * pad)
  const maxShared = Math.max(1, ...weeks.map(w => w.shared || 0))
  const points = weeks.map((w, i) => ({ x: xOf(i), y: finite(w.agreement) ? yOf(w.agreement) : null, w, i }))
  let path = ''
  let pen = false
  for (const p of points) {
    if (p.y === null) { pen = false; continue }
    path += `${pen ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`
    pen = true
  }
  const barMax = (height - 2 * pad) * 0.35
  const bars = weeks.map((w, i) => {
    const h = (w.shared / maxShared) * barMax
    return { x: xOf(i), y: height - pad - h, h, w }
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

/** Week offset relative to the "now" week: "now", "−3 w", "+2 w". */
export function weekOffsetLabel(week: number, nowWeek: number | null | undefined): string {
  if (!finite(nowWeek)) return `week ${week}`
  const d = week - nowWeek
  return d === 0 ? 'this week' : d < 0 ? `${-d} w ago` : `in ${d} w`
}

/** Epoch-week index → ISO date (yyyy-mm-dd) of its first day. */
export const weekDate = (week: number) => new Date(week * 7 * 86_400_000).toISOString().slice(0, 10)

export function timelineSummary(weeks: TimelineWeek[]): string {
  const past = weeks.filter(w => w.phase !== 'future' && finite(w.agreement))
  const fut = weeks.filter(w => w.phase === 'future' && w.shared > 0)
  const mean = past.length ? past.reduce((s, w) => s + (w.agreement as number), 0) / past.length : null
  return `Agreement per week. ${past.length} week${past.length === 1 ? '' : 's'} with shared calls so far${mean !== null ? `, average agreement ${intelPct(mean)}` : ''}; ${fut.length} upcoming week${fut.length === 1 ? '' : 's'} with open calls on the same assets.`
}

// ── Hierarchy ──

export const DIMENSION_LABEL: Record<string, string> = { archetype: 'Archetype', style: 'Horizon × boldness', asset_class: 'Asset class' }
const DIM_ORDER = ['archetype', 'style', 'asset_class']
export const dimensionLabel = (d: string) => DIMENSION_LABEL[d] ?? d.replace(/_/g, ' ')

export interface HierarchyGroup { dimension: string; label: string; riskiest: HierarchyStyle[]; beneficial: HierarchyStyle[]; styles: HierarchyStyle[] }

export function groupHierarchy(styles: HierarchyStyle[] | null | undefined): HierarchyGroup[] {
  const dims = [...new Set((styles ?? []).map(s => s.dimension))]
    .sort((a, b) => (DIM_ORDER.indexOf(a) + 1 || 99) - (DIM_ORDER.indexOf(b) + 1 || 99) || a.localeCompare(b))
  return dims.map((dimension) => {
    const sub = (styles ?? []).filter(s => s.dimension === dimension)
    return {
      dimension, label: dimensionLabel(dimension), styles: sub,
      riskiest: [...sub].sort((a, b) => a.risk_rank - b.risk_rank || b.risk - a.risk),
      beneficial: [...sub].sort((a, b) => a.benefit_rank - b.benefit_rank || b.benefit - a.benefit),
    }
  })
}

/** Risk (x, 0..max) vs benefit (y, symmetric around 0) scatter. */
export function scatterGeometry(styles: HierarchyStyle[], width = 260, height = 160, pad = 18) {
  const maxRisk = Math.max(0.1, ...styles.map(s => s.risk))
  const maxB = Math.max(0.05, ...styles.map(s => Math.abs(s.benefit)))
  const x = (r: number) => pad + (r / maxRisk) * (width - 2 * pad)
  const y = (b: number) => height / 2 - (b / maxB) * (height / 2 - pad)
  const maxCalls = Math.max(1, ...styles.map(s => s.calls))
  return {
    zeroY: height / 2,
    maxRisk, maxB,
    points: styles.map(s => ({ s, x: x(s.risk), y: y(s.benefit), r: 3 + 5 * Math.sqrt(s.calls / maxCalls) })),
  }
}

export function describeStyle(s: HierarchyStyle): string {
  return `${s.calls} calls by ${s.users} user${s.users === 1 ? '' : 's'}: direction right ${intelPct(s.hit_rate)}, mean score ${Math.round(s.mean_score)}/100 (spread ±${Math.round(s.score_sd)}), ${intelPct(s.blowup_share)} of calls scored 0, typical called move ${s.move_pct.toFixed(1)}%.`
}
