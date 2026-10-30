import { describe, expect, it } from 'vitest'
import {
  intelAllyRows, intelAvatarRows, intelAxisNote, intelAxisOptions, intelAxisPoles, intelAxisRows, intelBiasWords, intelCalibrationRows,
  intelCellLine, intelDayLabel, intelDistanceWords, intelEntourageColumns, intelEntourageEmpty, intelErrorBars, intelFinanceQuadrant,
  intelGapRows, intelIntelligenceRows, intelOpenRows, intelPctWords, intelRadarGeometry, intelRankWords, intelScatterGeometry,
  intelShortName, intelStripGeometry, intelStripMarkers, intelTargetScaleWords, intelTiltWords, intelTruthEmpty, intelTruthWeekGeometry,
  intelTrustRows, intelWeekdayHeat, INTEL_ENTOURAGE_KINDS, INTEL_FINANCE_BLURB,
  type IntelAvatarEvaluation, type IntelCommunity, type IntelDist, type IntelEntourage, type IntelEntourageItem, type IntelSpacePoint,
  type IntelTruthWeek,
} from '~/utils/intelligenceV2'

// Fixtures trimmed from Strades-comms/qa-swarm-2026-10-30/intelligence-v2-samples.json (Kenji, seeded INTJ bot).
const dist = (p: Partial<IntelDist> = {}): IntelDist => ({
  n: 16, mean: 0, sd: 1, q: Array.from({ length: 21 }, (_, i) => -2 + i * 0.2), lo: -2, hi: 2,
  hist: [1, 0, 0, 1, 0, 0, 0, 2, 1, 0, 1, 0, 1, 1, 0, 4, 2, 0, 0, 2], ...p,
})

const COMMUNITY: IntelCommunity = {
  axes: [
    { key: 'ownership', neg: 'Collective', pos: 'Capitalist', label: 'Ownership style', how: 'Concentrated private bets vs shared.', theory: 'Hofstede', dist: dist() },
    { key: 'crowd', neg: 'Consensus', pos: 'Contrarian', label: 'Crowd', how: 'Against friends.', theory: 'Herding', dist: dist() },
    { key: 'wealth', neg: 'Modest', pos: 'Rich', label: 'Paper capital', how: 'Paper only.', theory: 'Wealth effect', dist: null },
  ],
  intelligences: [
    { key: 'forecasting', label: 'Forecasting', theory: 'Tetlock', how: 'x', dist: dist({ q: Array.from({ length: 21 }, (_, i) => i / 20), lo: 0, hi: 1 }) },
    { key: 'pattern', label: 'Pattern reading', theory: 'Gardner', how: 'y', dist: null },
  ],
  truth: {},
  map: { explained: [0.33, 0.19], axes: [{ pos: 'Social · Bold', neg: 'Solitary · Cautious', loadings: {} }, { pos: 'Diversified · Slow', neg: 'Specialist · Fast', loadings: {} }] },
  n: 16,
  computed_at: '2026-10-30T11:57:50Z',
}

const item = (p: Partial<IntelEntourageItem> & { relation_id: string }): IntelEntourageItem => ({
  kind: 'differs', tags: [], strength: 0,
  user: { id: `u-${p.relation_id}`, name: 'Samuel M.', is_bot: true, is_demo: false, mbti: 'ENFJ', code_inferred: 'ENFJ', archetype: 'Patient macro thinker' },
  label: 'acquaintances', compatibility: 48.8, agreement: 0.5, opposition: 0.5, complementarity_pts: 4.35, traits_cosine: 0.09, friends: true,
  distance: 1.58, gaps: { ownership: -3.044, crowd: -1.452, wealth: 0.006 }, closest_axes: ['wealth'], farthest_axes: ['ownership'], skill: 0.5,
  map: { x: 1.36, y: 2.73 }, ...p,
})

describe('percentile words', () => {
  it('names the pole, flips below 50, says average in the middle, never 100% of traders', () => {
    expect(intelPctWords(82, 'Consensus', 'Contrarian')).toBe('further toward Contrarian than 82% of traders')
    expect(intelPctWords(14, 'Intuitive', 'Analytical')).toBe('further toward Intuitive than 86% of traders')
    expect(intelPctWords(50, 'a', 'b')).toBe('about average')
    expect(intelPctWords(54.9, 'a', 'b')).toBe('about average')
    expect(intelPctWords(100, 'Consensus', 'Contrarian')).toBe('at the Contrarian end of the community')
    expect(intelPctWords(0, 'Steady', 'Erratic')).toBe('at the Steady end of the community')
    expect(intelRankWords(100)).toBe('among the best in the community')
    expect(intelPctWords(null, 'a', 'b')).toBe('not measured yet')
  })
  it('rank words: higher better by default, abs error is lower-better', () => {
    expect(intelRankWords(80)).toBe('better than 80% of traders')
    expect(intelRankWords(20, true)).toBe('better than 80% of traders')
    expect(intelRankWords(45.7, true)).toBe('about the community middle')
    expect(intelRankWords(null)).toBe('no community comparison yet')
  })
  it('axis notes keep the honesty promises (not politics, paper money)', () => {
    expect(intelAxisNote('ownership')).toMatch(/not about politics/)
    expect(intelAxisNote('wealth')).toMatch(/Paper capital only/)
    expect(intelAxisNote('risk')).toBe('')
  })
})

describe('axis rows and strips', () => {
  it('joins my position with community metadata in community order', () => {
    const rows = intelAxisRows({ axes: { crowd: { raw: 0.73, z: 1.19, pct: 100 }, ownership: { raw: -0.26, z: 0.65, pct: 73.8 } }, map: { x: -1.3, y: -0.65 } }, COMMUNITY)
    expect(rows.map(r => r.key)).toEqual(['ownership', 'crowd', 'wealth'])
    expect(rows[0]!.words).toBe('further toward Capitalist than 74% of traders')
    expect(rows[0]!.note).toMatch(/politics/)
    expect(rows[2]!.pct).toBeNull()
    expect(rows[2]!.words).toBe('not measured yet')
    expect(intelAxisRows(null, null)).toEqual([])
  })
  it('strip geometry: 20 bars across the width, you by raw, friends by z, empty without dist', () => {
    const g = intelStripGeometry(dist(), { raw: 1, z: 1, pct: 70 }, [{ key: 'r1', label: 'Samuel', z: -1 }], 208, 36, 4)
    expect(g.empty).toBe(false)
    expect(g.bars).toHaveLength(20)
    expect(g.bars[0]!.x).toBe(4)
    expect(Math.max(...g.bars.map(b => b.h))).toBeCloseTo(28)
    expect(g.bars[1]!.h).toBe(0)
    expect(g.you!.x).toBeCloseTo(4 + 0.75 * 200)
    expect(g.markers[0]!.x).toBeCloseTo(4 + 0.25 * 200)
    expect(g.meanX).toBeCloseTo(104)
    // raw missing → mean + z·sd; values beyond the range are clamped to the edges
    expect(intelStripGeometry(dist(), { raw: null, z: 9, pct: 100 }, [], 208, 36, 4).you!.x).toBeCloseTo(204)
    expect(intelStripGeometry(null, { raw: 1 }).empty).toBe(true)
    expect(intelStripGeometry(dist(), null).you).toBeNull()
  })
  it('friend markers come from entourage gaps added to my z', () => {
    const m = intelStripMarkers('ownership', 0.65, [item({ relation_id: 'a' }), item({ relation_id: 'b', gaps: { ownership: null } })])
    expect(m).toHaveLength(1)
    expect(m[0]!.z).toBeCloseTo(0.65 - 3.044)
    expect(intelStripMarkers('ownership', null, [item({ relation_id: 'a' })])).toEqual([])
  })
})

describe('space map', () => {
  it('axis options start with the community map and carry pole names', () => {
    const o = intelAxisOptions(COMMUNITY)
    expect(o[0]).toEqual({ key: 'map', label: 'Community map', neg: 'Solitary · Cautious', pos: 'Social · Bold' })
    expect(o).toHaveLength(4)
    expect(intelAxisPoles('map', COMMUNITY, 1).pos).toBe('Diversified · Slow')
    expect(intelAxisPoles('crowd', COMMUNITY).neg).toBe('Consensus')
    expect(intelAxisPoles('nope', COMMUNITY).neg).toBe('low')
  })
  it('scatter is symmetric, y grows upward, others first and me last', () => {
    const pts: IntelSpacePoint[] = [
      { x: -0.91, y: -0.21, kind: 'me', code: 'INTJ', id: 'me', name: 'Kenji W.' },
      { x: -4, y: 1.56, kind: 'other', code: 'INTP' },
      { x: 1.2, y: 1.74, kind: 'friend', code: 'ESTJ', id: 'f', name: 'Diego R.', pct_x: 91.6, pct_y: 100 },
      { x: Number.NaN, y: 0, kind: 'bot', code: 'X' },
    ]
    const g = intelScatterGeometry(pts, 200, 200, 20)
    expect(g.extent).toBe(4)
    expect(g.zeroX).toBe(100)
    expect(g.zeroY).toBe(100)
    expect(g.points.map(p => p.kind)).toEqual(['other', 'friend', 'me'])
    expect(g.points[0]!.sx).toBe(20)
    expect(g.points[0]!.labelled).toBe(false)
    expect(g.points[1]!.sy).toBeLessThan(100)
    expect(g.points[2]!.r).toBeGreaterThan(g.points[1]!.r)
    expect(intelScatterGeometry([]).extent).toBe(1)
    expect(intelShortName('Olivia B.')).toBe('Olivia')
    expect(intelShortName('')).toBe('?')
  })
})

describe('entourage', () => {
  const E: IntelEntourage = {
    groups: {
      completes: [item({ relation_id: 'c', kind: 'completes', strength: 0.43 })],
      mirrors: [],
      opposes: [item({ relation_id: 'o1', kind: 'opposes', strength: 0.2 }), item({ relation_id: 'o2', kind: 'opposes', strength: 0.74 })],
      differs: [item({ relation_id: 'd' })],
    },
    counts: { completes: 1, mirrors: 0, opposes: 2, differs: 1 },
    explain: { opposes: 'Mostly the other side of your calls.' },
    unmeasured_friends: 3,
    axes: COMMUNITY.axes.map(({ key, neg, pos, label }) => ({ key, neg, pos, label })),
  }
  it('columns in fixed order, sorted by strength, server explanation first', () => {
    const cols = intelEntourageColumns(E)
    expect(cols.map(c => c.kind)).toEqual(INTEL_ENTOURAGE_KINDS.map(k => k.kind))
    expect(cols[2]!.items.map(i => i.relation_id)).toEqual(['o2', 'o1'])
    expect(cols[2]!.explain).toBe('Mostly the other side of your calls.')
    expect(cols[1]!.explain).toMatch(/Same traits/)
    expect(intelEntourageColumns(null).every(c => c.items.length === 0)).toBe(true)
  })
  it('empty when every count is 0', () => {
    expect(intelEntourageEmpty(E)).toBe(false)
    expect(intelEntourageEmpty({ ...E, counts: { completes: 0, mirrors: 0, opposes: 0, differs: 0 } })).toBe(true)
    expect(intelEntourageEmpty(null)).toBe(true)
  })
  it('distance words', () => {
    expect(intelDistanceWords(0.5)).toBe('very close to you')
    expect(intelDistanceWords(1.41)).toBe('close to you')
    expect(intelDistanceWords(1.58)).toBe('some way from you')
    expect(intelDistanceWords(2.96)).toBe('far from you')
    expect(intelDistanceWords(null)).toBe('distance unknown')
  })
  it('gap rows: diverging bar around the centre, pole words, unknown gaps dropped', () => {
    const rows = intelGapRows(item({ relation_id: 'x' }), E.axes, ['wealth', 'ownership', 'crowd', 'missing'])
    expect(rows.map(r => r.key)).toEqual(['wealth', 'ownership', 'crowd'])
    expect(rows[0]!.side).toBe('same')
    expect(rows[0]!.words).toBe('about the same paper capital as you')
    expect(rows[1]!.side).toBe('neg')
    expect(rows[1]!.left).toBe(0)
    expect(rows[1]!.width).toBe(50)
    expect(rows[1]!.words).toBe('more collective than you (−3.0 sd)')
    expect(rows[2]!.left).toBeCloseTo(50 - (1.452 / 3) * 50)
    const pos = intelGapRows({ gaps: { crowd: 1.5 } }, E.axes, ['crowd'])[0]!
    expect(pos).toMatchObject({ side: 'pos', left: 50, width: 25, words: 'more contrarian than you (+1.5 sd)' })
  })
})

describe('distance from truth', () => {
  it('bias words follow predicted − realised', () => {
    expect(intelBiasWords(5.29)).toBe('targets +5.3 pts above what happened')
    expect(intelBiasWords(-0.65)).toBe('targets −0.7 pts below what happened')
    expect(intelBiasWords(0.2)).toBe('on target on average')
    expect(intelBiasWords(null)).toBe('—')
    expect(intelTruthEmpty({ n: 0, pending: 2 })).toBe(true)
    expect(intelTruthEmpty({ n: 79, pending: 48 })).toBe(false)
  })
  it('error histogram: counts = edges + 1, open-ended labels, shares', () => {
    const { bars, total } = intelErrorBars({ bins: [0.5, 1, 2, 3, 5, 8, 13], counts: [6, 6, 9, 6, 14, 12, 10, 16] }, 320, 90, 4)
    expect(total).toBe(79)
    expect(bars.map(b => b.label)).toEqual(['<0.5', '0.5–1', '1–2', '2–3', '3–5', '5–8', '8–13', '≥13'])
    expect(bars[7]!.h).toBeCloseTo(82)
    expect(bars[0]!.share).toBeCloseTo(6 / 79)
    expect(intelErrorBars(null).bars).toEqual([])
  })
  it('calibration rows: over-sure, under-claimed, calibrated, thin', () => {
    const rows = intelCalibrationRows([
      { conf: 1, expected: 0.59, n: 9, hit: 0.667 },
      { conf: 2, expected: 0.68, n: 28, hit: 0.75 },
      { conf: 4, expected: 0.86, n: 10, hit: 0.6 },
      { conf: 5, expected: 0.95, n: 2, hit: 1 },
      { conf: 3, expected: 0.77, n: 0 },
    ])
    expect(rows.map(r => r.tone)).toEqual(['under', 'calibrated', 'over', 'thin', 'thin'])
    expect(rows[2]!.words).toBe('over-sure at this level')
    expect(rows[4]!.hit).toBeNull()
    expect(rows[3]!.words).toBe('only 2 calls at this level')
  })
  it('week series: score line with gaps, past/now/future bands, pending bars in the future', () => {
    const w = (week: number, phase: IntelTruthWeek['phase'], n: number, score: number | undefined, pending = 0): IntelTruthWeek => ({ week, phase, n, score, pending })
    const g = intelTruthWeekGeometry([w(1, 'past', 3, 80), w(2, 'past', 0, undefined), w(3, 'past', 10, 50), w(4, 'now', 1, 60, 6), w(5, 'future', 0, undefined, 9)], 100, 100, 10)
    expect(g.step).toBe(20)
    expect(g.path).toBe('M10.0,26.0M50.0,50.0L70.0,42.0')
    expect(g.nowX).toBe(70)
    expect(g.pastEnd).toBe(60)
    expect(g.futureStart).toBe(80)
    expect(g.bars.find(b => b.future)!.h).toBeCloseTo((9 / 10) * 28)
    expect(g.bars.find(b => b.w.week === 3)!.h).toBeCloseTo((10 / 10) * 28)
    expect(intelTruthWeekGeometry([]).nowX).toBeNull()
  })
  it('day_index → local calendar date, without timezone drift', () => {
    expect(intelDayLabel(0)).toBe('Thu 1 Jan 1970')
    expect(intelDayLabel(20720)).toBe('Thu 24 Sep 2026')
    expect(intelDayLabel(20756, false)).toBe('Fri 30 Oct')
    expect(intelDayLabel(null)).toBe('—')
  })
  it('weekday heat: Monday first, best/worst only among days with enough calls', () => {
    const heat = intelWeekdayHeat([
      { day: 'Tue', i: 1, n: 13, score: 60, hit: 0.6 }, { day: 'Mon', i: 0, n: 5, score: 26.4, hit: 0.4 },
      { day: 'Wed', i: 2, n: 1, score: 99, hit: 1 }, { day: 'Thu', i: 3, n: 0 },
    ])
    expect(heat.map(h => h.day)).toEqual(['Mon', 'Tue', 'Wed', 'Thu'])
    expect(heat[1]!.best).toBe(true)
    expect(heat[0]!.worst).toBe(true)
    expect(heat[2]!.best).toBe(false)
    expect(heat[2]!.thin).toBe(true)
    expect(heat[3]!.level).toBeNull()
    expect(heat[0]!.level).toBeCloseTo(0.264)
  })
  it('cell line and tilt words', () => {
    expect(intelCellLine({ n: 12, hit: 0.5, score: 66.8, abs_err: 5.01 })).toBe('12 calls · direction right 50% · score 67/100 · 5.0 pts off')
    expect(intelCellLine({ n: 0 })).toBe('no resolved call')
    expect(intelTiltWords({ hit_after_miss: 0.667, hit_after_hit: 0.647, gap: -0.02, n_after_miss: 27 })).toMatch(/about as well/)
    expect(intelTiltWords({ hit_after_miss: 0.4, hit_after_hit: 0.6, gap: -0.2, n_after_miss: 10 })).toMatch(/20 pts less often/)
    expect(intelTiltWords(null)).toMatch(/Not enough misses/)
  })
})

describe('intelligences and financial personality', () => {
  const rows = intelIntelligenceRows([
    { key: 'forecasting', label: 'Forecasting', theory: 'Tetlock', how: 'x', value: 0.528, n: 79, pct: 80 },
    { key: 'pattern', label: 'Pattern reading', theory: 'Gardner', how: 'y', value: null, n: 0, pct: null },
    { key: 'creative', label: 'Independent', theory: 'Sternberg', how: 'z', value: 0.4, n: 34, pct: 53.7 },
  ], COMMUNITY)
  it('rows: bar, community median tick, honest words for missing data', () => {
    expect(rows[0]).toMatchObject({ known: true, bar: 0.528, tick: 0.5, display: '53', words: 'better than 80% of traders', edge: 'coin-flip zone' })
    expect(rows[1]).toMatchObject({ known: false, bar: 0, tick: null, display: '—', words: 'not enough data', edge: null })
    expect(rows[2]!.edge).toBe('below a coin flip')
    expect(rows[2]!.words).toBe('about the community middle')
  })
  it('radar: needs 3 spokes; community polygon only when every tick is known', () => {
    const g = intelRadarGeometry(rows, 200, 20)
    expect(g.spokes).toHaveLength(3)
    expect(g.spokes[0]!.end).toEqual({ x: 100, y: 20 })
    expect(g.you.split(' ')).toHaveLength(3)
    expect(g.you.split(' ')[1]).toBe('100.0,100.0')
    expect(g.community).toBe('')
    expect(g.rings).toHaveLength(4)
    expect(intelRadarGeometry(rows.slice(0, 2)).you).toBe('')
  })
  it('BB&K quadrant: method on x, confidence up, active cell, centre square', () => {
    const q = intelFinanceQuadrant({ type: 'Celebrity', confidence: -0.778, method: -0.527, traits: [], overconfidence: 0.08 }, 180, 14)
    expect(q.cells.find(c => c.active)!.type).toBe('Celebrity')
    expect(q.cells.find(c => c.type === 'Celebrity')).toMatchObject({ x: 14, y: 90 })
    expect(q.dot!.x).toBeLessThan(90)
    expect(q.dot!.y).toBeGreaterThan(90)
    expect(q.centre.w).toBeCloseTo(0.3 * 152)
    expect(intelFinanceQuadrant({ type: 'Straight Arrow', confidence: 0.1, method: 0, traits: [], overconfidence: null }).centre.active).toBe(true)
    expect(intelFinanceQuadrant(null).dot).toBeNull()
    expect(Object.keys(INTEL_FINANCE_BLURB)).toHaveLength(5)
  })
})

describe('avatar', () => {
  const EV: IntelAvatarEvaluation = {
    n: 79, raw_hit: 0.658, avatar_hit: 0.658, raw_brier: 0.2429, avatar_brier: 0.2408, raw_mae: 6.8, avatar_mae: 6.89,
    flips: 0, flip_hit: null, with_allies: 0.937, brier_gain: 0.0021, mae_gain: -0.09, hit_gain: 0,
  }
  it('raw vs avatar: Brier and MAE are lower-is-better', () => {
    const rows = intelAvatarRows(EV)
    expect(rows.map(r => [r.key, r.tone])).toEqual([['hit', 'same'], ['brier', 'better'], ['mae', 'worse']])
    expect(rows[0]!.raw).toBe('65.8%')
    expect(rows[1]!.avatar).toBe('0.241')
    expect(rows[2]!.raw).toBe('6.80 pts')
    expect(intelAvatarRows({ ...EV, n: 0 })).toEqual([])
    expect(intelAvatarRows(null)).toEqual([])
  })
  it('target scale, trust and ally records', () => {
    expect(intelTargetScaleWords(0.708)).toBe('Shrinks your targets to 71% of what you call: your moves tend to overshoot.')
    expect(intelTargetScaleWords(1.02)).toMatch(/Keeps your targets/)
    expect(intelTargetScaleWords(1.3)).toMatch(/Stretches your targets to 130%/)
    expect(intelTargetScaleWords(null)).toMatch(/Not enough/)
    const trust = intelTrustRows([{ cls: 'crypto', horizon: 'intraday', n: 15, trust: 0.654 }, { cls: 'crypto', horizon: 'swing', n: 47, trust: 0.5 }])
    expect(trust.map(t => t.label)).toEqual(['crypto · swing', 'crypto · intraday'])
    expect(trust.map(t => t.words)).toEqual(['about a coin flip', 'trusted'])
    const allies = intelAllyRows([
      { id: 'a', name: 'Noah F.', compatibility: 51.4, record: { n: 1, hit: 0 }, when_disagreeing: { n: 4, hit: 0 }, when_agreeing: { n: 0, hit: null } },
      { id: 'b', name: 'Amara O.', compatibility: 50.1, record: { n: 10, hit: 0.5 }, when_disagreeing: { n: 3, hit: 0.667 }, when_agreeing: { n: 2, hit: 1 } },
    ])
    expect(allies[0]).toMatchObject({ record: '0% of 1', disagreeing: '0% of 4', agreeing: 'none yet', useful: false })
    expect(allies[1]!.useful).toBe(true)
  })
  it('open forecasts: sides, agreement, adjusted target', () => {
    const rows = intelOpenRows([
      { asset: 'GBP', target_day: 20756, made_day: 20755, dir: -1, conf: 2, p_user: 0.68, p_avatar: 0.675, avatar_dir: -1, chg: -0.19, adj_chg: -0.13, ref: 1.18, adj_price: 1.178443, allies_for: ['Olivia B.'], allies_against: [] },
      { asset: 'V', target_day: 20756, made_day: 20755, dir: 1, conf: 3, p_user: 0.77, p_avatar: 0.45, avatar_dir: -1, chg: 2, adj_chg: 1.4, ref: 310, adj_price: null, allies_for: [], allies_against: ['Samuel M.'] },
    ])
    expect(rows[0]).toMatchObject({ asset: 'GBP', side: 'down', agrees: true, chg: '−0.19%', adjChg: '−0.13%', adjPrice: '1.17844', target: 'Fri 30 Oct' })
    expect(rows[1]).toMatchObject({ side: 'up', agrees: false, adjPrice: '—', chg: '+2.00%' })
    expect(intelOpenRows(null)).toEqual([])
  })
})
