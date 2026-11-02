import { describe, expect, it } from 'vitest'
import { intelDirectiveLaunchWeights, intelInputRows, intelInputsTotal, intelInteractionRows } from '~/utils/intelligenceV3'

const KEYS = ['momentum', 'mean_reversion', 'breakout', 'grid_dca', 'chain_propagation'] as const

describe('directive mix → launcher weights', () => {
  it('keeps only launcher keys, drops negatives/NaN, normalises to 1', () => {
    const w = intelDirectiveLaunchWeights({ momentum: 2, mean_reversion: 1, breakout: 1, grid_dca: -1, chain_propagation: Number.NaN, other: 9 }, KEYS)
    expect(w).toEqual({ momentum: 0.5, mean_reversion: 0.25, breakout: 0.25, grid_dca: 0, chain_propagation: 0 })
    expect(Object.values(w!).every(v => v >= 0 && v <= 1)).toBe(true)
  })
  it('is null when there is nothing usable (launcher keeps Random / own mix)', () => {
    expect(intelDirectiveLaunchWeights(null, KEYS)).toBeNull()
    expect(intelDirectiveLaunchWeights({ momentum: 0 }, KEYS)).toBeNull()
    expect(intelDirectiveLaunchWeights({ unknown: 1 }, KEYS)).toBeNull()
  })
})

describe('avatar training feed rows (C6 inputs)', () => {
  const inputs = { calls: 3, resolved_calls: 1, sessions: 2, page_views: 40, messages: 0, news_reads: 0,
    interactions_by_type: { agent_plug: 2, share_article: 1, search_used: 4, other: 1 }, window_days: 60 }

  it('always lists every input, zero included, each with a link to add more', () => {
    const rows = intelInputRows(inputs)
    expect(rows.map(r => r.key)).toEqual(['calls', 'resolved_calls', 'news_reads', 'messages', 'sessions', 'page_views'])
    expect(rows.find(r => r.key === 'messages')).toMatchObject({ count: 0, to: '/chat' })
    expect(rows.find(r => r.key === 'calls')).toMatchObject({ count: 3, to: '/prices' })
    expect(rows.find(r => r.key === 'news_reads')!.to).toBe('/news')
  })
  it('shows "—" (null) without inputs (older server), never a made-up 0', () => {
    expect(intelInputRows(null).every(r => r.count === null)).toBe(true)
    expect(intelInputsTotal(null)).toBeNull()
  })
  it('names typed clicks, biggest first, caps the tail', () => {
    expect(intelInteractionRows(inputs)).toEqual([
      { label: 'searches', count: 4 }, { label: 'agent plugs', count: 2 },
      { label: 'article shares', count: 1 }, { label: 'other clicks', count: 1 },
    ])
    expect(intelInteractionRows(inputs, 2)).toEqual([{ label: 'searches', count: 4 }, { label: 'agent plugs', count: 2 }, { label: 'more kinds', count: 2 }])
  })
  it('totals server inputs (resolved calls are a subset of calls, not added twice)', () => {
    expect(intelInputsTotal(inputs)).toBe(3 + 2 + 40 + 8)
  })
})
