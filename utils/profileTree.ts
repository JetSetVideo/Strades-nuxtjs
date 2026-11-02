/**
 * Value trees for the metric rows of "You, as your behaviour reads" (/insights, ProfileCard):
 * each metric opens to its real formula (Strades-backend apps/intelligence/profiles.py `compute` /
 * `raw_signals`) and the evidence counts from profile.stats (calls, resolved, hits, revisions…).
 * Community-relative scores (risk appetite, independence, sociability, research depth) are
 * sigmoid(z): z = (your raw signal − community mean) ÷ community spread, capped at ±4, against the
 * active users of the last full analysis (or a fixed reference when there are fewer than 12).
 * Pure: no Nuxt, no store. Unknown inputs stay listed with "—" and a reason; ids are `profile.<metric>[.<input>]`.
 */
import { DASH, fmtNumber, isNum } from '~/utils/format'
import type { ValueNode, ValueUnit } from '~/utils/valueTree'

export type ProfMetricKey =
  | 'skill' | 'discipline' | 'risk_appetite' | 'contrarianism' | 'sociability' | 'research_depth' | 'regularity'
  | 'calibration_bias' | 'minutes_per_day' | 'sessions_per_day' | 'peak_hour_utc' | 'horizon_days'

export interface ProfProfileLike {
  metrics?: Partial<Record<ProfMetricKey, number | null>> | null
  stats?: Record<string, any> | null
}

export interface ProfMetricRow { key: ProfMetricKey; node: ValueNode; bar: number | null }

const SRC_PROFILE = { kind: 'api' as const, name: 'GET /api/v1/intelligence/me/ · profile' }
const SRC_STATS = (k: string) => ({ kind: 'api' as const, name: `profile.stats.${k}` })
const NOT_IN_READ = 'Not in this read (re-analyse, or not shared on a public profile).'

const val = (v: unknown): number | null => (isNum(v) ? v : null)
const clip01 = (x: number) => Math.max(0, Math.min(1, x))

/** sigmoid, as profiles.py */
export const profSigmoid = (z: number) => 1 / (1 + Math.exp(-z))

/** "+2.1 pts over-optimistic" · "on target" · "−1.0 pts too cautious" */
export function profCalibrationText(cb: number | null | undefined): string {
  if (!isNum(cb)) return DASH
  if (Math.abs(cb) < 0.5) return 'on target'
  return `${fmtNumber(cb, { decimals: 1, signed: true })} pts ${cb > 0 ? 'over-optimistic' : 'too cautious'}`
}

/** 14.5 → "14:30 UTC" */
export function profHour(h: number | null | undefined, zone = 'UTC'): string {
  if (!isNum(h)) return DASH
  const m = Math.round((((h % 24) + 24) % 24) * 60)
  return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}${zone ? ` ${zone}` : ''}`
}

/** 12 → "12 min/day" · 95 → "1.6 h/day" */
export function profMinutesText(min: number | null | undefined): string {
  if (!isNum(min)) return DASH
  return min < 60 ? `${fmtNumber(min, { decimals: 0 })} min/day` : `${fmtNumber(min / 60, { decimals: 1 })} h/day`
}

/** 0.5 → "12 h" · 3.25 → "3.3 d" */
export function profHorizonText(d: number | null | undefined): string {
  if (!isNum(d)) return DASH
  return d < 1 ? `${fmtNumber(d * 24, { decimals: 0 })} h` : `${fmtNumber(d, { decimals: 1 })} d`
}

function leaf(id: string, label: string, value: number | string | null, unit: ValueUnit, extra: Partial<ValueNode> = {}): ValueNode {
  return { id, label, value, unit, ...(value === null && !extra.reason ? { reason: NOT_IN_READ } : {}), ...extra }
}

const META: { key: ProfMetricKey; label: string }[] = [
  { key: 'skill', label: 'Call accuracy' },
  { key: 'discipline', label: 'Discipline' },
  { key: 'risk_appetite', label: 'Risk appetite' },
  { key: 'contrarianism', label: 'Independence' },
  { key: 'sociability', label: 'Sociability' },
  { key: 'research_depth', label: 'Research depth' },
  { key: 'regularity', label: 'Regularity' },
  { key: 'calibration_bias', label: 'Target calibration' },
  { key: 'minutes_per_day', label: 'Time on Strades' },
  { key: 'sessions_per_day', label: 'Sessions' },
  { key: 'peak_hour_utc', label: 'Peak hour' },
  { key: 'horizon_days', label: 'Typical horizon' },
]
export const PROF_METRIC_KEYS = META.map(m => m.key)

/** The 0–1 scores shown with a bar. */
const SCORE_KEYS = new Set<ProfMetricKey>(['skill', 'discipline', 'risk_appetite', 'contrarianism', 'sociability', 'research_depth', 'regularity'])

/** Every metric row as a value tree (same order as before). Empty list without a profile. */
export function profMetricRows(profile: ProfProfileLike | null | undefined): ProfMetricRow[] {
  if (!profile) return []
  const m = profile.metrics ?? {}
  const s = profile.stats ?? {}
  const z = (s.z ?? {}) as Record<string, number>
  const raw = (s.raw ?? {}) as Record<string, number>
  const popN = val(s.population_n)

  const calls = val(s.calls)
  const resolved = val(s.resolved)
  const hits = val(s.hits)
  const pending = val(s.pending)
  const revisions = val(s.revisions)
  const withdrawn = val(s.withdrawn)
  const span = val(s.span_days)
  const sessions = val(s.sessions)
  const friends = val(s.friends)

  const id = (key: string, part?: string) => `profile.${key}${part ? `.${part}` : ''}`
  const n = {
    calls: (k: string) => leaf(id(k, 'calls'), 'Calls in the window', calls, 'count', { source: SRC_STATS('calls') }),
    resolved: (k: string) => leaf(id(k, 'resolved'), 'Resolved calls', resolved, 'count', { source: SRC_STATS('resolved') }),
    span: (k: string) => leaf(id(k, 'span_days'), 'Days in the window', span, 'days', { source: SRC_STATS('span_days') }),
    sessions: (k: string) => leaf(id(k, 'sessions'), 'Sessions', sessions, 'count', { source: SRC_STATS('sessions') }),
    friends: (k: string) => leaf(id(k, 'friends'), 'Friends', friends, 'count', { source: SRC_STATS('friends') }),
    z: (k: string, sig: string) => leaf(id(k, 'z'), 'Your z-score vs the community', val(z[sig]), 'ratio', {
      signed: true, source: SRC_STATS(`z.${sig}`),
      formula: 'z = (your raw signal − community mean) ÷ community spread, capped at ±4',
    }),
    raw: (k: string, sig: string, formula: string) => leaf(id(k, 'raw'), 'Your raw signal', val(raw[sig]), 'ratio', {
      source: SRC_STATS(`raw.${sig}`), formula,
    }),
    pop: (k: string) => leaf(id(k, 'population'), 'Compared with (active users)', popN, 'count', {
      source: SRC_STATS('population_n'),
      ...(popN === null ? { reason: 'A fixed reference: fewer than 12 active users in the last full analysis.' } : {}),
    }),
  }
  const calib = val(m.calibration_bias)

  const build: Record<ProfMetricKey, () => Partial<ValueNode>> = {
    skill: () => ({
      formula: 'accuracy = (hits + 2) ÷ (resolved calls + 4)',
      explain: 'Share of your resolved paper calls with the direction right, pulled toward 50 % while there are few '
        + '(as if you started with 2 hits and 2 misses). With no resolved call yet it is your running hit average, which starts at 50 %. Never money.',
      ...(resolved === 0 ? { status: 'empty' as const, reason: 'No resolved call yet: a starting estimate, not a score.' } : {}),
      inputs: [
        leaf(id('skill', 'hits'), 'Hits (direction right)', hits, 'count', { source: SRC_STATS('hits') }),
        n.resolved('skill'),
        n.calls('skill'),
        leaf(id('skill', 'pending'), 'Pending calls (not scored yet)', pending, 'count', { source: SRC_STATS('pending') }),
      ],
    }),
    discipline: () => {
      const revRate = calls === null ? null : calls === 0 ? 0 : clip01(((revisions ?? 0) + (withdrawn ?? 0)) / calls)
      return {
        formula: 'discipline = 1 − 0.7 × revision rate − 0.3 × min(1, |calibration bias| ÷ 6 pts), kept within 0–100 %',
        explain: 'You keep to your calls: few revisions or withdrawals, and targets close to what happens.',
        inputs: [
          leaf(id('discipline', 'revision_rate'), 'Revision rate', revRate, 'frac', {
            source: { kind: 'computed', name: 'from profile.stats' },
            formula: 'revision rate = (revisions + withdrawals) ÷ calls',
            inputs: [
              leaf(id('discipline', 'revisions'), 'Revisions', revisions, 'count', { source: SRC_STATS('revisions') }),
              leaf(id('discipline', 'withdrawn'), 'Withdrawn calls', withdrawn, 'count', { source: SRC_STATS('withdrawn') }),
              n.calls('discipline'),
            ],
          }),
          leaf(id('discipline', 'calibration_bias'), 'Calibration bias', calib === null ? null : profCalibrationText(calib), 'text', {
            source: SRC_PROFILE, reason: calib === null ? NOT_IN_READ : undefined,
          }),
        ],
      }
    },
    risk_appetite: () => ({
      formula: 'risk appetite = sigmoid(z) of your risk signal',
      explain: 'Bigger moves per unit of time, bolder targets and more volatile assets than most Strades users read as more risk.',
      inputs: [
        n.raw('risk_appetite', 'risk', 'risk signal = 0.45 × ln(1 + move per √day) + 0.25 × boldness + 0.3 × volatile share'),
        leaf(id('risk_appetite', 'move'), 'Average move you call', val(s.move_abs_pct), 'pct', { source: SRC_STATS('move_abs_pct') }),
        leaf(id('risk_appetite', 'boldness'), 'Boldness (target position in your range)', val(s.boldness), 'ratio', { source: SRC_STATS('boldness') }),
        leaf(id('risk_appetite', 'volatile'), 'Volatile share (crypto, bets)', val(s.volatile_share), 'frac', { source: SRC_STATS('volatile_share') }),
        n.z('risk_appetite', 'risk'),
        n.pop('risk_appetite'),
      ],
    }),
    contrarianism: () => ({
      formula: friends === 0 ? 'independence = 50 % until you have friends; then sigmoid(z) of your independence signal'
        : 'independence = sigmoid(z) of your independence signal',
      explain: 'How little you follow your friends: agreeing with them less and looking at their calls first less often.',
      inputs: [
        n.raw('contrarianism', 'contra', 'independence signal = 0.6 × (1 − herding) + 0.4 × (1 − friends first)'),
        leaf(id('contrarianism', 'herding'), 'Herding (agreeing with friends)', val(s.herding), 'frac', { source: SRC_STATS('herding') }),
        leaf(id('contrarianism', 'friends_first'), 'Looked at friends first', val(s.friends_first), 'frac', { source: SRC_STATS('friends_first') }),
        n.friends('contrarianism'),
        n.z('contrarianism', 'contra'),
        n.pop('contrarianism'),
      ],
    }),
    sociability: () => ({
      formula: 'sociability = sigmoid(z) of ln(1 + messages per day + social actions per day)',
      explain: 'Social actions: posts, friend requests, comments and shares.',
      inputs: [
        leaf(id('sociability', 'messages'), 'Messages', val(s.messages), 'count', { source: SRC_STATS('messages') }),
        leaf(id('sociability', 'comments'), 'Comments', val(s.comments), 'count', { source: SRC_STATS('comments') }),
        leaf(id('sociability', 'shares'), 'Shares', val(s.shares), 'count', { source: SRC_STATS('shares') }),
        n.friends('sociability'),
        n.span('sociability'),
        n.z('sociability', 'social'),
        n.pop('sociability'),
      ],
    }),
    research_depth: () => ({
      formula: 'research depth = sigmoid(z) of ln(1 + (asset views + searches + backtests + news read) ÷ calls)',
      explain: 'How much you look before you call.',
      inputs: [
        leaf(id('research_depth', 'news'), 'News read', val(s.news_reads), 'count', { source: SRC_STATS('news_reads') }),
        leaf(id('research_depth', 'data'), 'Asset views, searches, backtests', dataActions(s.actions), 'count', {
          source: SRC_STATS('actions'), explain: 'From your 12 most frequent actions.',
        }),
        n.calls('research_depth'),
        n.z('research_depth', 'research'),
        n.pop('research_depth'),
      ],
    }),
    regularity: () => ({
      formula: 'regularity = 1 − (spread of daily activity ÷ its mean) ÷ 1.5, kept within 0–100 %',
      explain: 'How steady your daily activity is across the window; 0 with no activity.',
      inputs: [n.span('regularity'), n.sessions('regularity')],
    }),
    calibration_bias: () => ({
      formula: 'bias = running average of (move you targeted − move that happened), in percentage points, over resolved calls',
      explain: '+ means your targets overshoot. It also lowers discipline when it passes 6 points.',
      inputs: [n.resolved('calibration_bias')],
      ...(resolved === 0 ? { status: 'empty' as const, reason: 'No resolved call yet: nothing to compare.' } : {}),
    }),
    minutes_per_day: () => ({
      formula: 'time per day = active minutes in the window ÷ days in the window',
      inputs: [n.sessions('minutes_per_day'), n.span('minutes_per_day')],
    }),
    sessions_per_day: () => ({
      formula: 'sessions per day = sessions ÷ days in the window',
      explain: 'Separate visits per day.',
      inputs: [n.sessions('sessions_per_day'), n.span('sessions_per_day')],
    }),
    peak_hour_utc: () => ({
      formula: 'peak hour = circular average of your activity by hour (23:00 and 01:00 average to 00:00)',
      inputs: [leaf(id('peak_hour_utc', 'local'), 'Same hour, your time zone', isNum(s.peak_hour_local) ? profHour(s.peak_hour_local, 'local') : null, 'text', {
        source: SRC_STATS('peak_hour_local'), ...(isNum(s.peak_hour_local) ? {} : { reason: 'Your time zone is not known.' }),
      })],
    }),
    horizon_days: () => ({
      formula: 'typical horizon = geometric mean of your call horizons (each at least 1 hour)',
      explain: 'Time between making a call and its target date.',
      inputs: [n.calls('horizon_days')],
    }),
  }

  // every row, always (a metric the server did not send stays listed with "—" and a reason)
  return META.map(({ key, label }) => {
    const v = val(m[key])
    const extra = build[key]()
    const shown: number | string | null = v === null ? null
      : key === 'calibration_bias' ? profCalibrationText(v)
        : key === 'minutes_per_day' ? profMinutesText(v)
          : key === 'sessions_per_day' ? `${fmtNumber(v, { decimals: 1 })}/day`
            : key === 'peak_hour_utc' ? profHour(v)
              : key === 'horizon_days' ? profHorizonText(v)
                : v
    const node: ValueNode = {
      id: id(key), label, value: shown, unit: SCORE_KEYS.has(key) ? 'frac' : 'text', source: SRC_PROFILE,
      ...extra,
      ...(v === null ? { reason: (extra.reason as string | undefined) ?? (key === 'skill' || key === 'calibration_bias' ? 'Private: only you see this.' : NOT_IN_READ) } : {}),
    }
    return { key, node, bar: SCORE_KEYS.has(key) && v !== null ? clip01(v) : null }
  })
}

/** Data-work actions (profiles.py DATA_ACTIONS) from stats.actions; null when not in this read. */
function dataActions(actions: unknown): number | null {
  if (!actions || typeof actions !== 'object') return null
  const a = actions as Record<string, unknown>
  return ['asset_view', 'search', 'strategy_backtest'].reduce((t, k) => t + (isNum(a[k]) ? (a[k] as number) : 0), 0)
}
