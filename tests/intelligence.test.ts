import { describe, expect, it } from 'vitest'
import {
  axisBar, axisRead, axisStrength, codeAgreement, describeComplementarity, describeInfluence, describeLeadLag, describeSpace,
  describeStyle, explainOperator, groupHierarchy, intelHour, intelInitials, intelKm, intelMinutes, intelPct, intelScore, intelSigned,
  intelUnit, isNewcomer, labelTone, memberChip, metricRows, relationTitle, scatterGeometry, severityTone, splitRelations,
  timelineGeometry, timelineSummary, weekOffsetLabel, weightRows, INTEL_DASH, OPERATOR_EXPLAIN,
  type HierarchyStyle, type IntelAxis, type IntelMetrics, type IntelProfile, type IntelRelation, type TimelineWeek,
} from '~/utils/intelligence'

const axis = (value: number): IntelAxis => ({ key: 'axis_ei', value, pos: 'E', neg: 'I', pos_label: 'Extraversion', neg_label: 'Introversion' })

const METRICS: IntelMetrics = {
  risk_appetite: 0.2858, skill: 0.6548, discipline: 0.7246, contrarianism: 0.7661, sociability: 0.2877, research_depth: 0.2638,
  regularity: 0.6943, calibration_bias: 5.29, minutes_per_day: 232.9, sessions_per_day: 5.51, peak_hour_utc: 12.75, horizon_days: 13.18,
}

const rel = (p: Partial<IntelRelation> & { id: string }): IntelRelation => ({
  kind: 'pair', name: 'A × B (INFP×INTJ)', size: 2, label: 'acquaintances', compatibility: 50, agreement: 0.5, opposition: 0.5,
  complementarity: null, computed_at: '2026-10-30T10:00:00Z', members: [], conversation_id: null, ...p,
})

const wk = (week: number, phase: TimelineWeek['phase'], shared: number, agreement: number | null): TimelineWeek =>
  ({ week, phase, shared, agreement, assets: shared ? ['BTC'] : [] })

const style = (p: Partial<HierarchyStyle> & { name: string }): HierarchyStyle => ({
  dimension: 'archetype', calls: 10, users: 1, hit_rate: 0.5, mean_score: 50, score_sd: 30, blowup_share: 0.1, move_pct: 3,
  benefit: 0, risk: 0.4, ratio: 0, risk_rank: 1, benefit_rank: 1, ...p,
})

describe('formatting', () => {
  it('percent, signed, score, km, hours, minutes; null is a dash, never 0', () => {
    expect(intelPct(0.6548)).toBe('65%')
    expect(intelPct(0.6548, 1)).toBe('65.5%')
    expect(intelPct(null)).toBe(INTEL_DASH)
    expect(intelPct(Number.NaN)).toBe(INTEL_DASH)
    expect(intelSigned(4.36)).toBe('+4.4')
    expect(intelSigned(-4.55)).toBe('−4.5')
    expect(intelSigned(0)).toBe('0.0')
    expect(intelSigned(null)).toBe(INTEL_DASH)
    expect(intelScore(51.5)).toBe('52')
    expect(intelScore(null)).toBe(INTEL_DASH)
    expect(intelKm(9575)).toBe('9,575 km')
    expect(intelKm(0.2)).toBe('< 1 km')
    expect(intelHour(12.75)).toBe('12:45 UTC')
    expect(intelHour(-1)).toBe('23:00 UTC')
    expect(intelMinutes(232.9)).toBe('3 h 53 min')
    expect(intelMinutes(45)).toBe('45 min')
    expect(intelUnit(1.4)).toBe(1)
    expect(intelUnit(null)).toBe(0)
  })
})

describe('axes and codes', () => {
  it('reads the letter and strength, and says "reads as"', () => {
    expect(axisStrength(0.05)).toBe('balanced')
    expect(axisStrength(-0.25)).toBe('slight')
    expect(axisStrength(0.5)).toBe('moderate')
    expect(axisStrength(-0.9)).toBe('clear')
    const r = axisRead(axis(-0.542))
    expect(r).toMatchObject({ letter: 'I', label: 'Introversion', strength: 'moderate', pct: 54 })
    expect(r.words).toBe('Reads as moderate Introversion (54%)')
    expect(axisRead(axis(0.02)).letter).toBe('·')
    expect(axisRead(axis(0.02)).words).toMatch(/^Reads as balanced/)
  })
  it('centre-anchored bar', () => {
    expect(axisBar(0.5)).toEqual({ left: 50, width: 25 })
    expect(axisBar(-1)).toEqual({ left: 0, width: 50 })
    expect(axisBar(3)).toEqual({ left: 50, width: 50 })
  })
  it('declared vs inferred letter by letter', () => {
    const a = codeAgreement('INTJ', 'INFJ')
    expect(a.known).toBe(true)
    expect(a.matches).toBe(3)
    expect(a.letters[2]).toEqual({ declared: 'T', inferred: 'F', same: false })
    expect(codeAgreement('', 'INTJ').known).toBe(false)
  })
  it('newcomer = no profile, Newcomer archetype or zero confidence', () => {
    expect(isNewcomer(null)).toBe(true)
    expect(isNewcomer({ archetype: 'Newcomer', code_confidence: 0 } as IntelProfile)).toBe(true)
    expect(isNewcomer({ archetype: 'Contrarian analyst', code_confidence: 0.72 } as IntelProfile)).toBe(false)
  })
})

describe('metrics and directive', () => {
  it('metric rows: 0..1 metrics get bars, calibration reads over-optimistic', () => {
    const rows = metricRows(METRICS)
    expect(rows.find(r => r.key === 'skill')).toMatchObject({ display: '65%', bar: 0.6548 })
    expect(rows.find(r => r.key === 'calibration_bias')).toMatchObject({ display: '+5.3 pts over-optimistic', bar: null })
    expect(rows.find(r => r.key === 'peak_hour_utc')!.display).toBe('12:45 UTC')
    expect(rows.find(r => r.key === 'horizon_days')!.display).toBe('13.2 d')
    expect(metricRows({ ...METRICS, calibration_bias: -0.2 }).find(r => r.key === 'calibration_bias')!.display).toBe('on target')
    expect(metricRows(null)).toEqual([])
    // never money
    expect(rows.find(r => r.key === 'skill')!.explain).toMatch(/Not money/)
  })
  it('weights normalised and sorted, with labels', () => {
    const w = weightRows({ momentum: 0.0834, mean_reversion: 0.3371, breakout: 0.1691, grid_dca: 0.2335, chain_propagation: 0.177 })
    expect(w[0]).toMatchObject({ key: 'mean_reversion', label: 'Mean reversion' })
    expect(w.reduce((s, r) => s + r.share, 0)).toBeCloseTo(1, 6)
    expect(weightRows({ new_thing: 1 })[0]!.label).toBe('New thing')
    expect(weightRows(null)).toEqual([])
  })
  it('severity tones', () => {
    expect(severityTone('warning')).toBe('warn')
    expect(severityTone('success')).toBe('up')
    expect(severityTone('info')).toBe('info')
  })
})

describe('relations', () => {
  it('every label has a tone; unknown labels fall back', () => {
    for (const l of ['allies', 'sparring partners', 'echo chamber', 'opposites', 'acquaintances', 'strangers', 'unknown', 'collective edge', 'cohesive', 'groupthink risk', 'loose circle'])
      expect(labelTone(l).blurb.length).toBeGreaterThan(10)
    expect(labelTone('allies').tone).toBe('up')
    expect(labelTone('echo chamber').tone).toBe('warn')
    expect(labelTone('???')).toEqual(labelTone('unknown'))
  })
  it('bot/demo chips, initials, titles', () => {
    expect(memberChip({ is_bot: true, is_demo: false })).toBe('bot')
    expect(memberChip({ is_bot: false, is_demo: true })).toBe('demo')
    expect(memberChip({ is_bot: false, is_demo: false })).toBeNull()
    expect(intelInitials('Noah F.')).toBe('NF')
    expect(intelInitials('')).toBe('?')
    const m = { id: 'x', name: 'Noah F.', avatar_url: null, is_bot: true, is_demo: false, mbti: 'INFP' }
    expect(relationTitle(rel({ id: '1', members: [m] }))).toBe('You × Noah F.')
    expect(relationTitle(rel({ id: '3', members: [m, { ...m, id: 'y', name: 'Kenji W.' }] }))).toBe('Noah F. × Kenji W.')
    expect(relationTitle(rel({ id: '2', kind: 'group', name: 'Macro & Coffee — Mixed circle' }))).toBe('Macro & Coffee — Mixed circle')
  })
  it('splits pairs and rooms, sorted by compatibility, unknown last', () => {
    const s = splitRelations([rel({ id: 'a', compatibility: 40 }), rel({ id: 'b', compatibility: null }), rel({ id: 'c', compatibility: 60 }), rel({ id: 'g', kind: 'group' })])
    expect(s.pairs.map(r => r.id)).toEqual(['c', 'a', 'b'])
    expect(s.groups.map(r => r.id)).toEqual(['g'])
  })
  it('explains every operator key the API emits', () => {
    for (const k of ['direction.and', 'direction.xor', 'assets.jaccard', 'news.jaccard', 'letters', 'traits_cosine', 'lead_lag', 'copresence', 'space', 'complementarity', 'influence_ab', 'influence_ba', 'crowd.gain', 'diversity', 'cohesion_min'])
      expect(OPERATOR_EXPLAIN[k], k).toBeTruthy()
    expect(explainOperator('mystery_op').title).toBe('mystery op')
  })
  it('lead-lag: positive lag means the first member leads', () => {
    expect(describeLeadLag({ lag_days: 2, lag_r: 0.7941 }, 'Noah F.', 'Kenji W.')).toBe("Noah F. moves first; Kenji W.'s mood echoes it about 2 days later (r = +0.79).")
    expect(describeLeadLag({ lag_days: -1, lag_r: 0.6 }, 'A', 'B')).toMatch(/^B moves first/)
    expect(describeLeadLag({ lag_days: 3, lag_r: 0.1 }, 'A', 'B')).toMatch(/Neither/)
    expect(describeLeadLag(null, 'A', 'B')).toMatch(/Not enough/)
  })
  it('influence, two heads and space read in plain English', () => {
    expect(describeInfluence({ n: 9, follow_rate: 0.4444, expected: 0.5056, influence: -0.0611 }, 'Noah F.', 'Kenji W.'))
      .toBe('Kenji W. followed Noah F. on 44% of 9 chances (chance: 51%) — a push away of −6 pts.')
    expect(describeInfluence({ n: 4, follow_rate: 0.5, expected: 0.5056, influence: -0.0056 }, 'A', 'B')).toMatch(/no real pull/)
    expect(describeInfluence(null, 'A', 'B')).toMatch(/No calls/)
    expect(describeComplementarity({ n: 1, acc_a: 0, acc_b: 1, acc_pair: 0, gain: -1 }, 'A', 'B')).toMatch(/did not improve/)
    expect(describeComplementarity({ n: 5, acc_a: 0.6, acc_b: 0.5, acc_pair: 0.8, gain: 0.2 }, 'A', 'B')).toMatch(/\+20 pts/)
    expect(describeComplementarity(null, 'A', 'B')).toMatch(/not both answered/)
    expect(describeSpace({ km: 9575, tz_gap_h: 8, same_country: false, a: { city: 'Zürich', country: 'CH', tz: null }, b: { city: 'Tokyo', country: 'JP', tz: null } }))
      .toBe('Zürich, CH ↔ Tokyo, JP · 9,575 km · 8 h apart')
  })
})

describe('week timeline', () => {
  const weeks = [wk(1, 'past', 0, null), wk(2, 'past', 1, 0), wk(3, 'past', 2, 0.5), wk(4, 'now', 1, 1), wk(5, 'future', 0, null), wk(6, 'future', 2, 1)]
  it('breaks the line on weeks without shared calls and maps agreement to y', () => {
    const g = timelineGeometry(weeks, 120, 100, 10)
    expect(g.step).toBe(20)
    expect(g.points[0]!.y).toBeNull()
    expect(g.points[1]!.y).toBe(90)          // agreement 0 → bottom
    expect(g.points[3]!.y).toBe(10)          // agreement 1 → top
    expect(g.path.match(/M/g)!.length).toBe(2) // gap at week 5 starts a new segment
    expect(g.path.startsWith('M30.0,90.0L50.0,50.0L70.0,10.0')).toBe(true)
    expect(g.nowX).toBe(70)
    expect(g.pastEnd).toBe(60)
    expect(g.futureStart).toBe(80)
    expect(g.bars).toHaveLength(4)
    expect(Math.max(...g.bars.map(b => b.h))).toBeCloseTo(80 * 0.35)
  })
  it('handles empty and single-week timelines', () => {
    expect(timelineGeometry([]).path).toBe('')
    expect(timelineGeometry([wk(1, 'now', 1, 1)], 100, 100, 10).points[0]!.x).toBe(50)
  })
  it('labels and summary', () => {
    expect(weekOffsetLabel(2962, 2965)).toBe('3 w ago')
    expect(weekOffsetLabel(2965, 2965)).toBe('this week')
    expect(weekOffsetLabel(2967, 2965)).toBe('in 2 w')
    expect(timelineSummary(weeks)).toMatch(/3 weeks with shared calls so far, average agreement 50%; 1 upcoming week/)
  })
})

describe('hierarchy', () => {
  const styles = [
    style({ name: 'crypto', dimension: 'asset_class' }),
    style({ name: 'B', risk: 0.46, benefit: -0.1, risk_rank: 1, benefit_rank: 2, calls: 100 }),
    style({ name: 'A', risk: 0.43, benefit: 0.25, risk_rank: 2, benefit_rank: 1, calls: 25 }),
    style({ name: 'swing · bold', dimension: 'style' }),
  ]
  it('groups by dimension in a fixed order with two rankings', () => {
    const g = groupHierarchy(styles)
    expect(g.map(x => x.dimension)).toEqual(['archetype', 'style', 'asset_class'])
    expect(g[0]!.riskiest.map(s => s.name)).toEqual(['B', 'A'])
    expect(g[0]!.beneficial.map(s => s.name)).toEqual(['A', 'B'])
    expect(groupHierarchy(null)).toEqual([])
  })
  it('scatter: benefit 0 on the middle line, bigger dots for more calls', () => {
    const sc = scatterGeometry(styles.filter(s => s.dimension === 'archetype'), 200, 100, 10)
    expect(sc.zeroY).toBe(50)
    const [b, a] = sc.points
    expect(a!.y).toBeLessThan(50)   // positive benefit above the line
    expect(b!.y).toBeGreaterThan(50)
    expect(b!.x).toBe(190)          // max risk at the right edge
    expect(b!.r).toBeGreaterThan(a!.r)
  })
  it('describes a style as call accuracy, never profit', () => {
    const d = describeStyle(style({ name: 'x', calls: 24, users: 1, hit_rate: 0.7083, mean_score: 54.53, score_sd: 32.5, blowup_share: 0.1667, move_pct: 2.747 }))
    expect(d).toBe('24 calls by 1 user: direction right 71%, mean score 55/100 (spread ±33), 17% of calls scored 0, typical called move 2.7%.')
    expect(d).not.toMatch(/profit|\$/i)
  })
})
