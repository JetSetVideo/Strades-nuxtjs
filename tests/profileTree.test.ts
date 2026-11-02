import { describe, expect, it } from 'vitest'
import { drillable, findPath, headline } from '~/utils/valueTree'
import { PROF_METRIC_KEYS, profCalibrationText, profHour, profMetricRows, profSigmoid } from '~/utils/profileTree'

// Shaped like profile_dict (own profile) from apps/intelligence/profiles.py compute().
const PROFILE = {
  metrics: {
    risk_appetite: profSigmoid(0.6), skill: (11 + 2) / (17 + 4), discipline: 1 - 0.7 * (3 / 20) - 0.3 * Math.min(1, 2.4 / 6),
    contrarianism: profSigmoid(-0.4), sociability: 0.41, research_depth: 0.66, regularity: 0.52,
    calibration_bias: 2.4, minutes_per_day: 18.4, sessions_per_day: 40 / 30, peak_hour_utc: 14.5, horizon_days: 3.25,
  },
  stats: {
    calls: 20, resolved: 17, hits: 11, pending: 3, revisions: 2, withdrawn: 1, move_abs_pct: 3.2, boldness: 0.4,
    herding: 0.55, friends_first: 0.2, messages: 30, comments: 4, shares: 1, news_reads: 12, sessions: 40,
    span_days: 30, friends: 5, volatile_share: 0.6, population_n: 140, peak_hour_local: 15.5,
    actions: { asset_view: 50, search: 6, message_send: 30 },
    z: { risk: 0.6, contra: -0.4, social: 0.1, research: 0.7 }, raw: { risk: 1.2, contra: 0.59 },
  },
}

const byKey = (rows: ReturnType<typeof profMetricRows>) => Object.fromEntries(rows.map(r => [r.key, r.node]))
const allIds = (n: any): string[] => [n.id, ...(n.inputs ?? []).flatMap(allIds)]

describe('profileTree — metric rows as value trees', () => {
  it('every metric, in the card order, each drillable with a formula', () => {
    const rows = profMetricRows(PROFILE)
    expect(rows.map(r => r.key)).toEqual(PROF_METRIC_KEYS)
    expect(rows.every(r => drillable(r.node) && !!r.node.formula)).toBe(true)
    expect(rows.find(r => r.key === 'skill')!.bar).toBeCloseTo(13 / 21, 6)
    expect(rows.find(r => r.key === 'peak_hour_utc')!.bar).toBeNull()
  })

  it('skill = (hits + 2) ÷ (resolved + 4), from the evidence counts shown as inputs', () => {
    const skill = byKey(profMetricRows(PROFILE)).skill
    const v = (id: string) => findPath(skill, id).at(-1)!.value as number
    expect((v('profile.skill.hits') + 2) / (v('profile.skill.resolved') + 4)).toBeCloseTo(skill.value as number, 9)
    expect(headline(skill).text).toBe('61.9%')
    expect(skill.inputs!.map(i => i.label)).toEqual(['Hits (direction right)', 'Resolved calls', 'Calls in the window', 'Pending calls (not scored yet)'])
  })

  it('discipline recomputes from revisions, withdrawals, calls and the calibration bias', () => {
    const d = byKey(profMetricRows(PROFILE)).discipline
    const rate = findPath(d, 'profile.discipline.revision_rate').at(-1)!
    expect(rate.value).toBeCloseTo(3 / 20, 9)
    expect(rate.inputs!.map(i => i.value)).toEqual([2, 1, 20])
    expect(1 - 0.7 * (rate.value as number) - 0.3 * Math.min(1, 2.4 / 6)).toBeCloseTo(d.value as number, 9)
    expect(d.inputs![1].value).toBe('+2.4 pts over-optimistic')
  })

  it('community scores are sigmoid(z) of the z shown as an input, with the population', () => {
    const rows = byKey(profMetricRows(PROFILE))
    for (const k of ['risk_appetite', 'contrarianism'] as const) {
      const z = findPath(rows[k], `profile.${k}.z`).at(-1)!.value as number
      expect(profSigmoid(z)).toBeCloseTo(rows[k].value as number, 9)
      expect(findPath(rows[k], `profile.${k}.population`).at(-1)!.value).toBe(140)
    }
    expect(findPath(rows.research_depth, 'profile.research_depth.data').at(-1)!.value).toBe(56)
  })

  it('text metrics print through utils/format', () => {
    const r = byKey(profMetricRows(PROFILE))
    expect(headline(r.calibration_bias).text).toBe('+2.4 pts over-optimistic')
    expect(headline(r.minutes_per_day).text).toBe('18 min/day')
    expect(headline(r.sessions_per_day).text).toBe('1.3/day')
    expect(headline(r.peak_hour_utc).text).toBe('14:30 UTC')
    expect(headline(r.horizon_days).text).toBe('3.3 d')
    expect(r.peak_hour_utc.inputs![0].value).toBe('15:30 local')
    expect(profCalibrationText(-0.2)).toBe('on target')
    expect(profCalibrationText(-1)).toBe('−1.0 pts too cautious')
    expect(profHour(23.999)).toBe('00:00 UTC')
  })

  it('zero evidence (newcomer): still drillable, inputs at 0, honest reasons', () => {
    const rows = byKey(profMetricRows({
      metrics: { ...PROFILE.metrics, skill: 0.5, calibration_bias: 0, discipline: 1, contrarianism: 0.5 },
      stats: { calls: 0, resolved: 0, hits: 0, pending: 0, revisions: 0, withdrawn: 0, friends: 0, span_days: 30, sessions: 0 },
    }))
    expect(headline(rows.skill)).toEqual({ text: '50.0%', muted: 'No resolved call yet: a starting estimate, not a score.' })
    expect(rows.skill.inputs!.map(i => i.value)).toEqual([0, 0, 0, 0])
    expect(headline(rows.calibration_bias).muted).toMatch(/No resolved call/)
    expect(findPath(rows.discipline, 'profile.discipline.revision_rate').at(-1)!.value).toBe(0)
    expect(rows.contrarianism.formula).toMatch(/50 % until you have friends/)
    expect(headline(findPath(rows.risk_appetite, 'profile.risk_appetite.population').at(-1)!).muted).toMatch(/fixed reference/)
    expect(Object.values(rows).every(drillable)).toBe(true)
  })

  it('unknown (public profile: no skill, few stats): rows stay listed with "—" and a reason', () => {
    const { skill: _s, calibration_bias: _c, ...pub } = PROFILE.metrics
    const rows = profMetricRows({ metrics: pub, stats: { calls: 20, span_days: 30, pending: 3 } })
    expect(rows.map(r => r.key)).toEqual(PROF_METRIC_KEYS)
    const skill = rows[0].node
    expect(headline(skill)).toEqual({ text: '—', muted: 'Private: only you see this.' })
    expect(drillable(skill)).toBe(true)
    expect(headline(skill.inputs![0]).text).toBe('—')
    expect(skill.inputs![0].reason).toMatch(/Not in this read/)
    expect(rows[0].bar).toBeNull()
    expect(profMetricRows(null)).toEqual([])
  })

  it('ids are stable (profile.<metric>[.<input>]) and unique per row', () => {
    const a = profMetricRows(PROFILE).map(r => allIds(r.node))
    const b = profMetricRows({ metrics: {}, stats: {} }).map(r => allIds(r.node))
    expect(a).toEqual(b)
    for (const ids of a) expect(new Set(ids).size).toBe(ids.length)
    expect(a[0][0]).toBe('profile.skill')
  })
})
