import { describe, expect, it } from 'vitest'
import {
  TAU, activePanelFor, agentSphere, blendHistory, badgeLabel, compactUsd, donutArcPath, intradayCurve, orthographic, runState,
  sharesToArcs, signedPct, sparkline, subsolarLongitude, unreadFor, walletRings,
} from '~/utils/navIcons'

describe('intradayCurve', () => {
  it('compounds only the returns since 00:00 GMT and ends at now', () => {
    // 48 hourly returns; the last 3 belong to today at 02:30 GMT (hours 0, 1 and the open hour 2)
    const history = [...Array(45).fill(0.5), 0.01, -0.02, 0.03]
    const c = intradayCurve(history, new Date('2026-10-20T02:30:00Z'))!
    expect(c.t).toEqual([0, 1, 2, 2.5])
    expect(c.v[0]).toBe(0)
    expect(c.v[1]).toBeCloseTo(1, 10)
    expect(c.v[3]).toBeCloseTo((1.01 * 0.98 * 1.03 - 1) * 100, 10)
  })

  it('starts later when the history is shorter than the day', () => {
    const c = intradayCurve([0.01, 0.01], new Date('2026-10-20T10:00:00Z'))!
    expect(c.t[0]).toBe(9)
    expect(c.v).toHaveLength(3)
  })

  it('is null without history and ignores non-finite returns', () => {
    expect(intradayCurve([], new Date())).toBeNull()
    expect(intradayCurve(undefined, new Date())).toBeNull()
    const c = intradayCurve([Number.NaN], new Date('2026-10-20T00:10:00Z'))!
    expect(c.v).toEqual([0, 0])
  })
})

describe('sparkline', () => {
  it('maps the 24 h axis onto the width and keeps 0 on the value axis', () => {
    const s = sparkline({ t: [0, 12], v: [0, 2] }, 26, 14, 1)
    expect(s.end[0]).toBeCloseTo(1 + 0.5 * 24, 5)       // noon = half the drawable width
    expect(s.end[1]).toBeCloseTo(1, 5)                   // the max sits on the top edge
    expect(s.zeroY).toBeCloseTo(13, 5)                   // 0 on the bottom edge
    expect(s.area.endsWith('Z')).toBe(true)
    expect(s.last).toBe(2)
  })

  it('does not blow a flat day up to full height', () => {
    const s = sparkline({ t: [0, 1], v: [0, 0.01] }, 26, 14, 1, 0.6)
    expect(Math.abs(s.end[1] - s.zeroY)).toBeLessThan(1)
  })
})

describe('walletRings', () => {
  const wallets = [
    { id: 'a', name: 'Main', total_value: 300, available_balance: 100, assets: [{ symbol: 'BTC', current_value: 150 }, { symbol: 'AAPL', current_value: 50 }] },
    { id: 'b', name: 'Crypto', total_value: 100, available_balance: 0, assets: [{ symbol: 'ETH', current_value: 100 }] },
  ]
  const classOf = (a: { symbol: string }) => (a.symbol === 'AAPL' ? 'stocks' : 'crypto')

  it('outer ring = wallet shares of the total, inner ring = asset types + cash', () => {
    const r = walletRings(wallets, classOf)
    expect(r.total).toBe(400)
    expect(r.wallets.map(w => [w.key, w.share])).toEqual([['a', 0.75], ['b', 0.25]])
    expect(r.classes.map(c => c.key)).toEqual(['crypto', 'cash', 'stocks'])
    expect(r.classes.reduce((s, c) => s + c.share, 0)).toBeCloseTo(1, 10)
    expect(r.classes[0]!.share).toBeCloseTo(250 / 400, 10)
  })

  it('drops empty or negative values instead of drawing them', () => {
    const r = walletRings([{ id: 'x', name: 'X', total_value: -5, assets: [{ symbol: 'BTC', current_value: Number.NaN }] }], classOf)
    expect(r.total).toBe(0)
    expect(r.wallets).toEqual([])
    expect(r.classes).toEqual([])
  })
})

describe('ring geometry', () => {
  it('lays arcs clockwise with gaps and a single share as a full ring', () => {
    const arcs = sharesToArcs([{ key: 'a', label: 'a', value: 1, share: 0.5 }, { key: 'b', label: 'b', value: 1, share: 0.5 }], 0.1)
    expect(arcs[0]!.a0).toBeCloseTo(0.05, 10)
    expect(arcs[1]!.a1).toBeCloseTo(TAU - 0.05, 10)
    expect(sharesToArcs([{ key: 'a', label: 'a', value: 1, share: 1 }])[0]).toMatchObject({ a0: 0, a1: TAU })
  })

  it('draws a closed annulus for a full turn and a sector otherwise', () => {
    expect(donutArcPath(12, 12, 10, 6, 0, TAU).match(/A/g)).toHaveLength(4)
    const d = donutArcPath(12, 12, 10, 6, 0, Math.PI / 2)
    expect(d.startsWith('M12.000 2.000')).toBe(true)     // 12 o'clock on the outer radius
    expect(d).toContain('22.000 12.000')                  // 3 o'clock
    expect(d.endsWith('Z')).toBe(true)
  })
})

describe('agentSphere', () => {
  const pts = agentSphere([
    { id: 'hot', status: 'live', risk: 1, patience: 0.5, contrarian: 0, trades: 400 },
    { id: 'calm', status: 'paused', risk: 0, patience: 0.5, contrarian: 0, trades: 100 },
    { id: 'bad', status: 'error' },
  ])

  it('maps status to running / waiting / error', () => {
    expect(pts.map(p => p.state)).toEqual(['running', 'waiting', 'error'])
    expect(runState('training')).toBe('running')
    expect(runState('idle')).toBe('waiting')
    expect(runState(undefined)).toBe('waiting')
  })

  it('spreads agents with no personality data instead of stacking them', () => {
    const [a, b] = agentSphere([{ id: 'x1' }, { id: 'x2' }])
    expect(Math.hypot(a!.x - b!.x, a!.y - b!.y, a!.z - b!.z)).toBeGreaterThan(0.05)
  })

  it('places risk on latitude, keeps every point on the unit sphere and sizes by activity', () => {
    expect(pts[0]!.lat).toBeCloseTo(70, 10)
    expect(pts[1]!.lat).toBeCloseTo(-70, 10)
    for (const p of pts) expect(Math.hypot(p.x, p.y, p.z)).toBeCloseTo(1, 10)
    expect(pts[0]!.size).toBeCloseTo(1, 10)
    expect(pts[1]!.size).toBeCloseTo(0.55 + 0.45 * 0.5, 10)
    expect(pts[2]!.size).toBeCloseTo(0.55, 10)
  })
})

describe('globe', () => {
  it('puts noon over Greenwich at 12:00 GMT and moves 15° west per hour', () => {
    expect(subsolarLongitude(new Date('2026-10-20T12:00:00Z'))).toBe(0)
    expect(subsolarLongitude(new Date('2026-10-20T13:00:00Z'))).toBe(-15)
    expect(subsolarLongitude(new Date('2026-10-20T00:00:00Z'))).toBe(180)
    expect(subsolarLongitude(new Date('2026-10-20T06:00:00Z'))).toBe(90)
  })

  it('projects the view centre to the origin and hides the far side', () => {
    const c = orthographic(30, 0, 30)
    expect(c.x).toBeCloseTo(0, 10); expect(c.y).toBeCloseTo(0, 10); expect(c.depth).toBeCloseTo(1, 10)
    expect(orthographic(30 + 180, 0, 30).depth).toBeLessThan(0)
    expect(orthographic(0, 90, 0).y).toBeCloseTo(1, 10)
    expect(orthographic(0, 90, 0, 20).depth).toBeGreaterThan(0)   // tilted: the north pole shows
  })
})

describe('chat', () => {
  const convs = [
    { participants: ['me', 'x'], unread_count_me: 2 },
    { participants: ['me', 'y'], unread_count: 3 },        // shared field: /chat draws no badge for it
    { participants: ['a', 'b'], unread_count_me: 9 },     // not mine: never counted
    { participantDetails: [{ user_id: 'me' }], unread_count_me: 1 },
  ]
  it('counts only the user\'s own conversations', () => {
    expect(unreadFor(convs, 'me')).toBe(3)
    expect(unreadFor(convs, 'nobody')).toBe(0)
  })
  it('labels the dot', () => {
    expect(badgeLabel(0)).toBe('')
    expect(badgeLabel(7)).toBe('7')
    expect(badgeLabel(120)).toBe('99+')
  })
})

describe('format', () => {
  it('formats money and signed percents', () => {
    expect(compactUsd(230_875)).toBe('$230.9k')
    expect(compactUsd(1_250)).toBe('$1.25k')
    expect(signedPct(-0.471)).toBe('-0.47%')
    expect(signedPct(0.001)).toBe('0.00%')
    expect(signedPct(1.5, 1)).toBe('+1.5%')
  })
})

describe('activePanelFor', () => {
  const panels = [
    { id: 'lab' as const, match: ['/strategies', '/strategy', '/agents'] },
    { id: 'news' as const, match: ['/news', '/articles'] },
  ]
  it('keeps the tab selected on detail pages and ignores look-alike prefixes', () => {
    expect(activePanelFor('/strategy/42', panels)).toBe('lab')
    expect(activePanelFor('/strategies', panels)).toBe('lab')
    expect(activePanelFor('/articles/9', panels)).toBe('news')
    expect(activePanelFor('/newsletter', panels)).toBeNull()
    expect(activePanelFor('/settings', panels)).toBeNull()
  })
})

describe('blendHistory', () => {
  it('blends only the leaves sharing the longest history, cap-weighted', () => {
    const b = blendHistory([
      { history: [0.02, 0.04], cap: 3 },
      { history: [0.0, 0.08], cap: 1 },
      { history: [], cap: 100 },          // prediction market: no hourly data
      { history: [0.5], cap: 100 },       // shorter series: left out
    ])!
    expect(b.count).toBe(2)
    expect(b.history[0]).toBeCloseTo(0.015, 10)
    expect(b.history[1]).toBeCloseTo(0.05, 10)
  })
  it('falls back to equal weights when a cap is missing, null when nothing has history', () => {
    expect(blendHistory([{ history: [0.02] }, { history: [0.04], cap: 9 }])!.history[0]).toBeCloseTo(0.03, 10)
    expect(blendHistory([{ history: [] }, {}])).toBeNull()
  })
})
