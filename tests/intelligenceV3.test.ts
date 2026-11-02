import { describe, expect, it } from 'vitest'
import {
  intelAlignWords, intelClosenessWords, intelConsensusWords, intelEigenEmpty, intelEigenSentence, intelFactorCaption, intelFactorKey,
  intelFactorName, intelFactorOptions, intelFactorPairGeometry, intelFactorRows, intelInfluenceWords, intelLoadingRows, intelScreeGeometry,
  intelScreeLine, intelSecondCampWords, intelSharedWords, intelSimilarRows, intelSpectrum, intelTypicalityWords,
  type IntelCommunityV3, type IntelEigen, type IntelFactorScore, type IntelSimilarPayload, type IntelSpectral,
} from '~/utils/intelligenceV3'

// Fixtures trimmed from Strades-comms/qa-swarm-2026-10-30/intelligence-v3-samples.json (Kenji, seeded bot).
const F0 = {
  i: 0, eigenvalue: 3.552431, explained: 0.3229, pos: 'Social · Bold', neg: 'Solitary · Cautious',
  loadings: { ownership: -0.381063, tempo: 0.336822, wealth: 0.420966, risk: 0.423582, crowd: -0.285406, scope: -0.035184, social: 0.485285 },
}
const F1 = { i: 1, eigenvalue: 2.113559, explained: 0.1921, pos: 'Diversified · Collective', neg: 'Specialist · Capitalist', loadings: { scope: 0.560788, tempo: -0.376512 } }
const F2 = { i: 2, eigenvalue: 1.702379, explained: 0.1548, pos: 'Erratic · Night owl', neg: 'Steady · Early bird', loadings: { clock: 0.559604 } }
const F3 = { i: 3, eigenvalue: 1.250515, explained: 0.1137, pos: 'Contrarian · Intuitive', neg: 'Consensus · Analytical', loadings: { crowd: 0.565688 } }
const EIGEN: IntelEigen = {
  eigenvalues: [3.552431, 2.113559, 1.702379, 1.250515, 0.818879, 0.668136, 0.362948, 0.341694, 0.118686, 0.044787, 0.025986],
  explained: [0.3229, 0.1921, 0.1548, 0.1137, 0.0744, 0.0607, 0.033, 0.0311, 0.0108, 0.0041, 0.0024],
  cumulative: [0.3229, 0.5151, 0.6699, 0.7835, 0.858, 0.9187, 0.9517, 0.9828, 0.9936, 0.9976, 1.0],
  keep: 4, sample: 16,
  keys: ['ownership', 'tempo', 'wealth', 'risk', 'crowd', 'outlook', 'method', 'scope', 'social', 'clock', 'stability'],
  factors: [F0, F1, F2, F3],
}
const SCORES: IntelFactorScore[] = [{ i: 0, score: -1.1634, pct: 26.9 }, { i: 1, score: -0.2263, pct: 43.8 }, { i: 2, score: -0.8763, pct: 25.1 }, { i: 3, score: 0.9982, pct: 81.4 }]
const AXES = [
  { key: 'ownership', label: 'Ownership style', neg: 'Collective', pos: 'Capitalist' },
  { key: 'social', label: 'Social', neg: 'Solitary', pos: 'Social' },
  { key: 'risk', label: 'Risk', neg: 'Cautious', pos: 'Bold' },
]
const community = (p: Partial<IntelCommunityV3> = {}): IntelCommunityV3 => ({
  axes: [], intelligences: [], truth: {}, n: 16, computed_at: null,
  map: { explained: [0.3229, 0.1921], axes: [F0, F1] }, eigen: EIGEN, ...p,
})

describe('eigen basics', () => {
  it('names and keys factors', () => {
    expect(intelFactorKey(0)).toBe('F1')
    expect(intelFactorName(F0)).toBe('Social · Bold / Solitary · Cautious')
    expect(intelFactorName(null)).toBe('high / low')
  })
  it('detects an empty analysis', () => {
    expect(intelEigenEmpty(null)).toBe(true)
    expect(intelEigenEmpty({ ...EIGEN, factors: [] })).toBe(true)
    expect(intelEigenEmpty(EIGEN)).toBe(false)
  })
  it('writes the headline from keep and the cumulative share', () => {
    expect(intelEigenSentence(EIGEN)).toBe('4 factors explain 78% of the differences between 16 traders.')
    expect(intelEigenSentence({ ...EIGEN, keep: 1, factors: [F0] })).toBe('1 factor explains 32% of the differences between 16 traders.')
    expect(intelEigenSentence(null)).toBe('')
  })
})

describe('intelScreeGeometry', () => {
  it('draws 11 bars, highlights the kept ones and places the λ = 1 line', () => {
    const g = intelScreeGeometry(EIGEN, 320, 160)
    expect(g.empty).toBe(false)
    expect(g.bars).toHaveLength(11)
    expect(g.bars.filter(b => b.retained).map(b => b.key)).toEqual(['F1', 'F2', 'F3', 'F4'])
    expect(g.maxValue).toBe(4)
    // λ = 1 sits at a quarter of the plot height above the baseline
    expect(g.kaiserY).toBeCloseTo(g.bottom - (g.bottom - g.top) / 4, 6)
    // the tallest bar is the first one, bars descend
    expect(g.bars[0]!.h).toBeGreaterThan(g.bars[1]!.h)
    // cumulative line ends at the top (100%)
    expect(g.dots[10]!.y).toBeCloseTo(g.top, 6)
    expect(g.path.startsWith('M')).toBe(true)
    expect(g.path.split('L')).toHaveLength(11)
    // everything inside the viewBox
    for (const b of g.bars) { expect(b.x).toBeGreaterThanOrEqual(0); expect(b.x + b.w).toBeLessThanOrEqual(320) }
  })
  it('is empty without data and falls back to computed shares', () => {
    expect(intelScreeGeometry(null).empty).toBe(true)
    const g = intelScreeGeometry({ ...EIGEN, explained: [], cumulative: [], eigenvalues: [2, 1, 1], keep: NaN as unknown as number })
    expect(g.bars[0]!.explained).toBeCloseTo(0.5)
    expect(g.bars[2]!.cumulative).toBeCloseTo(1)
    expect(g.bars.filter(b => b.retained)).toHaveLength(3)
  })
  it('reads a bar in plain words', () => {
    const g = intelScreeGeometry(EIGEN)
    expect(intelScreeLine(g.bars[0]!)).toContain('F1 explains 32% of the differences (worth 3.55 axes); with the ones before it, 32%. Kept')
    expect(intelScreeLine(g.bars[4]!)).toContain('Not kept')
  })
})

describe('intelLoadingRows', () => {
  it('sorts by strength and names the axis end that goes with the positive pole', () => {
    const rows = intelLoadingRows(F0, AXES)
    expect(rows[0]!.key).toBe('social')
    expect(rows.map(r => r.key)).toHaveLength(7)
    const own = rows.find(r => r.key === 'ownership')!
    expect(own.side).toBe('neg')
    expect(own.pole).toBe('Collective')
    expect(own.strong).toBe(true)
    expect(own.left).toBeCloseTo(50 - 0.381063 * 50)
    expect(own.width).toBeCloseTo(0.381063 * 50)
    expect(rows.find(r => r.key === 'risk')!.words).toBe('Social · Bold goes with bold (Risk, +0.42)')
    const scope = rows.find(r => r.key === 'scope')!
    expect(scope.label).toBe('scope')
    expect(scope.pole).toBe('low')
    expect(scope.strong).toBe(false)
    expect(scope.words).toBe('scope: barely part of it')
  })
  it('is empty without a factor', () => {
    expect(intelLoadingRows(null, AXES)).toEqual([])
  })
})

describe('intelFactorRows', () => {
  it('joins your scores with the factors on a ±3 sd track', () => {
    const rows = intelFactorRows(EIGEN, SCORES)
    expect(rows).toHaveLength(4)
    const r0 = rows[0]!
    expect(r0.key).toBe('F1')
    expect(r0.sd).toBeCloseTo(Math.sqrt(3.552431))
    expect(r0.z).toBeCloseTo(-1.1634 / Math.sqrt(3.552431))
    expect(r0.at).toBeCloseTo((r0.z! + 3) / 6)
    expect(r0.words).toBe('further toward Solitary · Cautious than 73% of traders')
    expect(rows[1]!.words).toBe('further toward Specialist · Capitalist than 56% of traders')
    expect(rows[3]!.words).toBe('further toward Contrarian · Intuitive than 81% of traders')
  })
  it('handles a newcomer and no analysis', () => {
    const rows = intelFactorRows(EIGEN, [])
    expect(rows[0]!.score).toBeNull()
    expect(rows[0]!.at).toBeNull()
    expect(rows[0]!.words).toContain('not placed yet')
    expect(intelFactorRows(null, SCORES)).toEqual([])
  })
  it('clamps far scores to the track ends', () => {
    expect(intelFactorRows(EIGEN, [{ i: 0, score: 40, pct: 100 }])[0]!.at).toBe(1)
  })
})

describe('typicality and influence words', () => {
  it('maps unusual_pct to four levels', () => {
    expect(intelTypicalityWords({ d2: 3, unusual_pct: 10 }).level).toBe('typical')
    expect(intelTypicalityWords({ d2: 13.6, unusual_pct: 74.4 })).toMatchObject({ level: 'ordinary', title: 'An ordinary profile' })
    expect(intelTypicalityWords({ d2: 13.6, unusual_pct: 74.4 }).line).toContain('more unusual than 74% of profiles')
    // 74.6 is shown as 75%: it must read as distinctive, not "ordinary … 75%"
    expect(intelTypicalityWords({ d2: 13.6, unusual_pct: 74.6 })).toMatchObject({ level: 'distinctive' })
    expect(intelTypicalityWords({ d2: 20, unusual_pct: 90 }).level).toBe('distinctive')
    expect(intelTypicalityWords({ d2: 30, unusual_pct: 99 }).level).toBe('rare')
    expect(intelTypicalityWords(null)).toMatchObject({ level: 'unknown', pct: null })
  })
  it('reads PageRank influence from the percentile and shows the rank', () => {
    const w = intelInfluenceWords({ rank: 0.8143, pct: 77.4 })
    expect(w.level).toBe('high')
    expect(w.rank).toBe('0.81× a typical trader')
    expect(w.line).toContain('more than for 77% of traders')
    expect(intelInfluenceWords({ rank: 1, pct: 50 }).level).toBe('middle')
    expect(intelInfluenceWords({ rank: 0.2, pct: 5 }).level).toBe('low')
    expect(intelInfluenceWords({ rank: null, pct: null })).toMatchObject({ level: 'unknown', rank: '—' })
    expect(intelInfluenceWords(undefined).level).toBe('unknown')
  })
})

describe('people who behave like you', () => {
  const PAYLOAD: IntelSimilarPayload = {
    metric: 'Mahalanobis distance in the community eigen space',
    results: [
      {
        kind: 'friend', distance: 1.143, archetype: 'Balanced explorer', id: '92dc595d', name: 'Hans B.', avatar_url: null, is_bot: true, is_demo: false, mbti: 'ISTJ', code_inferred: 'ISTP',
        shared_factors: [{ i: 2, pos: 'Erratic · Night owl', neg: 'Steady · Early bird', side: 'neg' }, { i: 3, pos: 'Contrarian · Intuitive', neg: 'Consensus · Analytical', side: 'pos' }],
      },
      { kind: 'other', distance: 3.2, archetype: 'Momentum scalper', shared_factors: [{ i: 0, pos: 'Social · Bold', neg: 'Solitary · Cautious', side: 'neg' }] },
    ],
  }
  it('words the distance and the shared leanings', () => {
    expect(intelClosenessWords(1.1)).toBe('behaves very much like you')
    expect(intelClosenessWords(2.2)).toBe('behaves a lot like you')
    expect(intelClosenessWords(4)).toBe('alike in parts')
    expect(intelClosenessWords(6)).toBe('quite different from you')
    expect(intelClosenessWords(null)).toBe('distance unknown')
    expect(intelSharedWords(PAYLOAD.results[0]!.shared_factors)).toBe('Both lean Steady · Early bird and Contrarian · Intuitive.')
    expect(intelSharedWords([])).toBe('')
  })
  it('names friends (with a compare link and bot chip) and keeps others anonymous', () => {
    const [a, b] = intelSimilarRows(PAYLOAD)
    expect(a).toMatchObject({ named: true, title: 'Hans B.', bot: true, code: 'ISTP', kindLabel: 'Friend', href: '/insights?compare=92dc595d' })
    expect(a!.line).toBe('Reads as balanced explorer. Behaves very much like you (distance 1.14). Both lean Steady · Early bird and Contrarian · Intuitive.')
    expect(b).toMatchObject({ named: false, title: 'A trader (momentum scalper)', href: null, kindLabel: 'Trader', key: 'anon-1' })
    expect(b!.line).toBe('Alike in parts (distance 3.20). Both lean Solitary · Cautious.')
  })
  it('is empty for a newcomer', () => {
    expect(intelSimilarRows({ results: [], detail: 'Not placed yet: make a few calls first.' })).toEqual([])
    expect(intelSimilarRows(null)).toEqual([])
  })
})

describe('factor map axes', () => {
  it('offers the retained factors with their explained share', () => {
    const o = intelFactorOptions(community())
    expect(o.map(x => x.key)).toEqual(['F1', 'F2', 'F3', 'F4'])
    expect(o[0]!.label).toBe('F1 · Social · Bold (32%)')
    expect(intelFactorCaption(o[1])).toBe('F2 — 19% of the differences')
    expect(intelFactorCaption(null)).toBe('')
  })
  it('falls back to community.map.axes before the first eigen run', () => {
    const o = intelFactorOptions(community({ eigen: null, map: { explained: [0.33, 0.19], axes: [{ pos: 'A', neg: 'B', loadings: {} }, { pos: 'C', neg: 'D', loadings: {} }] } }))
    expect(o.map(x => [x.key, x.explained])).toEqual([['F1', 0.33], ['F2', 0.19]])
    expect(intelFactorOptions(null)).toEqual([])
  })
  it('places you on any factor pair in sd units', () => {
    const g = intelFactorPairGeometry(SCORES, EIGEN, 2, 3, 320, 22, 3)
    expect(g.me!.x).toBeCloseTo(-0.8763 / Math.sqrt(1.702379))
    expect(g.me!.y).toBeCloseTo(0.9982 / Math.sqrt(1.250515))
    expect(g.me!.sx).toBeLessThan(g.zero)
    expect(g.me!.sy).toBeLessThan(g.zero) // y grows upward
    expect(g.rings[1]).toBeCloseTo((2 / 3) * 138)
    expect(intelFactorPairGeometry([], EIGEN, 0, 1).me).toBeNull()
  })
})

describe('consensus spectrum', () => {
  const S: IntelSpectral = {
    consensus: 0.1979, second_camp: 0.1364, eigenvalues: [2.1769, 1.5007, 1.1462, 1.0], members: 11, linked_pairs: 17,
    alignment: { kenji: -1.531, samuel: 1.271, hans: 1.388, mei: -1.329, noah: -0.2, demo: -0 },
  }
  const MEMBERS = [
    { id: 'kenji', name: 'Kenji W.', is_bot: true, role: 'dissident' },
    { id: 'samuel', name: 'Samuel M.', is_bot: true, role: 'member' },
    { id: 'hans', name: 'Hans B.', is_bot: true, role: 'member' },
    { id: 'mei', name: 'Mei C.', is_bot: true, role: 'dissident' },
    { id: 'demo', name: 'Demo trader', is_bot: false, role: 'leader' },
  ]
  it('words consensus and the second camp against the room size', () => {
    expect(intelConsensusWords(0.7, 11)).toBe('most of the room moves as one')
    expect(intelConsensusWords(0.3, 11)).toBe('a clear main view')
    expect(intelConsensusWords(0.1979, 11)).toBe('a loose main view')
    expect(intelConsensusWords(0.1, 11)).toBe('no common view')
    expect(intelConsensusWords(null, 11)).toBe('not measured')
    expect(intelSecondCampWords(0.1364, 0.1979, 11)).toBe('a real competing camp')
    expect(intelSecondCampWords(0.1, 0.5, 11)).toBe('a small second camp')
    expect(intelSecondCampWords(0.05, 0.5, 11)).toBe('no real second camp')
    expect(intelSecondCampWords(0, 0.5, 11)).toBe('no second camp')
  })
  it('words alignment', () => {
    expect(intelAlignWords(1.3)).toBe('moves with the room')
    expect(intelAlignWords(0.5)).toBe('mostly with the room')
    expect(intelAlignWords(0)).toContain('no clear side')
    expect(intelAlignWords(-0.5)).toBe('leans to the other side')
    expect(intelAlignWords(-1.5)).toBe('takes the other side')
    expect(intelAlignWords(null)).toContain('not linked')
  })
  it('builds bars sorted by alignment with dissidents marked', () => {
    const s = intelSpectrum(S, MEMBERS, 'hans')
    expect(s.empty).toBe(false)
    expect(s.members).toBe(11)
    expect(s.linked).toBe(17)
    expect(s.consensus).toMatchObject({ words: 'a loose main view' })
    expect(s.consensus!.width).toBeCloseTo(19.79)
    expect(s.consensus!.line).toContain('20% of the room')
    expect(s.second!.words).toBe('a real competing camp')
    expect(s.rows.map(r => r.id)).toEqual(['hans', 'samuel', 'demo', 'noah', 'mei', 'kenji'])
    const kenji = s.rows.find(r => r.id === 'kenji')!
    expect(kenji).toMatchObject({ dissident: true, side: 'against', bot: true, name: 'Kenji W.' })
    expect(kenji.left).toBeCloseTo(50 - (1.531 / 2) * 50)
    expect(s.rows[0]).toMatchObject({ me: true, side: 'with', left: 50 })
    const demo = s.rows.find(r => r.id === 'demo')!
    expect(demo).toMatchObject({ value: 0, side: 'apart', width: 0, dissident: false })
    expect(Object.is(demo.value, -0)).toBe(false)
    expect(s.rows.find(r => r.id === 'noah')!.name).toBe('A member')
  })
  it('is empty when the room has no spectrum', () => {
    expect(intelSpectrum(null)).toMatchObject({ empty: true, rows: [], consensus: null })
    expect(intelSpectrum({ ...S, second_camp: null }).second).toBeNull()
  })
})
