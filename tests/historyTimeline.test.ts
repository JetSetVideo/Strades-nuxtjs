import { describe, expect, it } from 'vitest'
import {
  enrichRunningAgents, fromCatalogWallets, fromLocalPredictions, fromPaperTrades, fromPluggedAgents,
  historySections, historyServerClientIds, historySpanProgress, historyTense, matchesHistoryFilter,
  mergeHistoryEvents, retenseHistory, riverDomain, riverX, summarizeHistory, histPct, histSignedUsd, histRelTime,
  historyFacts, historyAssetTone, historyBar, historyDetail, historyIntensity, historyState, historyVisual, histClockTime,
  type HistoryEvent, type HistoryFilter,
} from '~/utils/historyTimeline'

const NOW = Date.parse('2026-10-26T12:00:00Z')
const H = 3_600_000
const D = 24 * H
const iso = (t: number) => new Date(t).toISOString()

function ev(p: Partial<HistoryEvent> & { id: string; at: string }): HistoryEvent {
  return {
    start_at: null, tense: 'past', lane: 'prediction', kind: 'call_made', mode: null, title: p.id, subtitle: '',
    asset: null, amount_usd: null, pnl_usd: null, pct: null, score: null, status: null, href: null, ref: null,
    sample: false, source: 'server', data: {}, ...p,
  }
}

const allOn = (): HistoryFilter => ({
  lanes: new Set(['profile', 'opinion', 'prediction', 'trade', 'agent', 'activity']),
  modes: new Set(['real', 'paper', 'backtest']), q: '', range: 'all', showSample: true,
})

describe('tense', () => {
  it('span in progress is present, ahead is future, behind is past', () => {
    expect(historyTense(NOW + D, NOW - D, NOW)).toBe('present')
    expect(historyTense(NOW + D, null, NOW)).toBe('future')
    expect(historyTense(NOW + 2 * D, NOW + D, NOW)).toBe('future')
    expect(historyTense(NOW - H, null, NOW)).toBe('past')
  })
  it('a due call whose target passes stays in play as "awaiting a price"; resolved stays past', () => {
    const due = ev({ id: 'd', kind: 'call_due', asset: 'BTC', at: iso(NOW + H), start_at: iso(NOW - D), tense: 'present' })
    const res = ev({ id: 'r', kind: 'call_resolved', at: iso(NOW - H), start_at: iso(NOW - D), tense: 'past' })
    const [d2, r2] = retenseHistory([due, res], NOW + 2 * H)
    expect(d2).toMatchObject({ tense: 'present', kind: 'call_awaiting', title: 'BTC call awaiting a price' })
    expect(r2!.tense).toBe('past')
  })
  it('an ordinary future event becomes past once the clock passes it', () => {
    const [f] = retenseHistory([ev({ id: 'f', kind: 'demo_ends', at: iso(NOW + H), tense: 'future' })], NOW + 2 * H)
    expect(f!.tense).toBe('past')
  })
})

describe('local adapters', () => {
  const paper = [
    { id: 'p1', user_id: 'u', timestamp: iso(NOW - 2 * D), asset_id: 'btc', asset_symbol: 'BTC', side: 'buy', wallet_pct: 5,
      simulated_price: 100, notional_value: 500, hypothetical_pnl_pct: 2, hypothetical_pnl_value: 10, is_paper: true, status: 'open' },
    { id: 'p2', user_id: 'u', timestamp: iso(NOW - 5 * D), asset_id: 'eth', asset_symbol: 'ETH', side: 'sell', wallet_pct: 2,
      simulated_price: 50, notional_value: 200, hypothetical_pnl_pct: 0, hypothetical_pnl_value: 0, is_paper: true,
      status: 'closed', closed_at: iso(NOW - 3 * D), closed_price: 45, realized_pnl_pct: 10, realized_pnl_value: 20 },
  ] as any
  it('paper: open = present span with marked P&L, closed = past with realised P&L', () => {
    const [o, c] = fromPaperTrades(paper, NOW)
    expect(o).toMatchObject({ tense: 'present', kind: 'paper_open', mode: 'paper', pnl_usd: 10, start_at: paper[0].timestamp })
    expect(c).toMatchObject({ tense: 'past', kind: 'paper_closed', pnl_usd: 20, at: paper[1].closed_at })
  })
  it('local calls already on the server are skipped; demo seed calls are sample', () => {
    const preds = [
      { id: 'c1', assetId: 'btc', timestamp: iso(NOW - D), predictedChangePct: 3, predictedPrice: 103, currentPrice: 100,
        timeframe: '1W', targetDate: iso(NOW + 6 * D), status: 'pending', confidence: 3, note: '' },
      { id: 'c2', assetId: 'sol', timestamp: iso(NOW - D), predictedChangePct: -2, predictedPrice: 98, currentPrice: 100,
        timeframe: '1W', targetDate: iso(NOW + 6 * D), status: 'pending', confidence: 3, note: '', demo: true },
    ] as any
    const out = fromLocalPredictions(preds, new Set(['c1']), NOW)
    expect(out.map(e => e.id)).toEqual(['local-call:c2:made', 'local-call:c2:due'])
    expect(out.every(e => e.sample)).toBe(true)
    expect(out[1]!.tense).toBe('present')
  })
  it('catalog wallets are Real + Sample, never the user', () => {
    const out = fromCatalogWallets([{ id: 'w', name: 'Main', transactions: [{ id: 't', type: 'buy', asset_symbol: 'BTC', amount: 0.5, price: 45000, total_value: 22500, timestamp: '2024-01-15T10:30:00Z' }] }], NOW)
    expect(out[0]).toMatchObject({ mode: 'real', sample: true, source: 'catalog', kind: 'trade_buy', amount_usd: 22500 })
  })
  it('plugged agents are present opinion rows; disabled plugs are dropped', () => {
    const out = fromPluggedAgents([{ agent_id: 'a1', weight: 0.4, enabled: true }, { agent_id: 'a2', weight: 1, enabled: false }], id => (id === 'a1' ? 'Atlas' : undefined), NOW)
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ lane: 'opinion', tense: 'present', title: "Following Atlas's opinion" })
  })
  it('live engine numbers enrich running agents only', () => {
    const run = ev({ id: 'bot:x', kind: 'agent_running', lane: 'agent', at: iso(NOW), tense: 'present', ref: { type: 'bot', id: 'x' } })
    const other = ev({ id: 'o', at: iso(NOW - D) })
    const [r, o] = enrichRunningAgents([run, other], [{ bot_id: 'x', pnl: 12, pnl_pct: 2.4, alive: true, stats: { closed: 3, win_rate: 0.66 } }])
    expect(r).toMatchObject({ pnl_usd: 12, pct: 2.4, status: 'live' })
    expect(r!.data.closed).toBe(3)
    expect(o).toBe(other)
    const [dead] = enrichRunningAgents([run], [{ bot_id: 'x', alive: false }])
    expect(dead).toMatchObject({ status: 'stopped' })
    expect(dead!.title).toMatch(/stopped/)
  })
  it('open-ended rows never show an "Ends" date in their facts', () => {
    const facts = historyFacts(ev({ id: 'h', kind: 'position_open', lane: 'trade', at: iso(NOW), start_at: iso(NOW - D), tense: 'present' }))
    expect(facts.map(f => f.label)).not.toContain('Ends')
  })
})

describe('merge, filter, sections', () => {
  it('server rows win over a local copy with the same id and client ids are collected', () => {
    const s = ev({ id: 'a', at: iso(NOW), title: 'server', data: { client_id: 'c9' } })
    const l = ev({ id: 'a', at: iso(NOW), title: 'local', source: 'local' })
    expect(mergeHistoryEvents([s], [l]).map(e => e.title)).toEqual(['server'])
    expect([...historyServerClientIds([s])]).toEqual(['c9'])
  })
  it('range limits the past only; present and future always show', () => {
    const f = { ...allOn(), range: '7d' as const }
    expect(matchesHistoryFilter(ev({ id: 'old', at: iso(NOW - 30 * D) }), f, NOW)).toBe(false)
    expect(matchesHistoryFilter(ev({ id: 'run', at: iso(NOW), tense: 'present', start_at: iso(NOW - 300 * D) }), f, NOW)).toBe(true)
    expect(matchesHistoryFilter(ev({ id: 'fut', at: iso(NOW + 90 * D), tense: 'future' }), f, NOW)).toBe(true)
  })
  it('mode filter only applies to rows that have a mode; sample can be hidden; search is all-words', () => {
    const f = { ...allOn(), modes: new Set(['real'] as const) as any }
    expect(matchesHistoryFilter(ev({ id: 'p', at: iso(NOW), mode: 'paper' }), f, NOW)).toBe(false)
    expect(matchesHistoryFilter(ev({ id: 'c', at: iso(NOW) }), f, NOW)).toBe(true)
    expect(matchesHistoryFilter(ev({ id: 's', at: iso(NOW), sample: true }), { ...allOn(), showSample: false }, NOW)).toBe(false)
    expect(matchesHistoryFilter(ev({ id: 'q', at: iso(NOW), title: 'Called BTC up', asset: 'BTC' }), { ...allOn(), q: 'btc called' }, NOW)).toBe(true)
    expect(matchesHistoryFilter(ev({ id: 'q', at: iso(NOW), title: 'Called BTC up' }), { ...allOn(), q: 'eth' }, NOW)).toBe(false)
  })
  it('sections: future soonest first, past newest first grouped by day', () => {
    const s = historySections([
      ev({ id: 'f2', at: iso(NOW + 9 * D), tense: 'future' }), ev({ id: 'f1', at: iso(NOW + D), tense: 'future' }),
      ev({ id: 'p1', at: '2026-10-20T10:00:00Z' }), ev({ id: 'p2', at: '2026-10-20T18:00:00Z' }), ev({ id: 'p3', at: '2026-10-22T09:00:00Z' }),
      ev({ id: 'n', at: iso(NOW + D), start_at: iso(NOW - D), tense: 'present', kind: 'call_due' }),
    ], i => i.slice(0, 10))
    expect(s.future.map(e => e.id)).toEqual(['f1', 'f2'])
    expect(s.present.map(e => e.id)).toEqual(['n'])
    expect(s.past.map(g => [g.day, g.events.map(e => e.id)])).toEqual([['2026-10-22', ['p3']], ['2026-10-20', ['p2', 'p1']]])
  })
})

describe('summary', () => {
  it('counts exact outcomes, never EMAs, and splits realised P&L by mode', () => {
    const s = summarizeHistory([
      ev({ id: 'm1', kind: 'call_made', at: iso(NOW - 9 * D) }),
      ev({ id: 'r1', kind: 'call_resolved', at: iso(NOW - 2 * D), status: 'accurate', score: 80, data: { direction_correct: true } }),
      ev({ id: 'r2', kind: 'call_resolved', at: iso(NOW - D), status: 'missed', score: 20, data: { direction_correct: false } }),
      ev({ id: 'ex', kind: 'call_resolved', at: iso(NOW - D), status: 'expired' }),
      ev({ id: 'd', kind: 'call_due', at: iso(NOW + 3 * D), start_at: iso(NOW - D), tense: 'present' }),
      ev({ id: 'a', kind: 'agent_closed', lane: 'agent', mode: 'paper', at: iso(NOW - D), pnl_usd: 15 }),
      ev({ id: 'w', kind: 'trade_sell', lane: 'trade', mode: 'real', at: iso(NOW - D), pnl_usd: -5 }),
      ev({ id: 'b', kind: 'backtest', lane: 'trade', mode: 'backtest', at: iso(NOW - D), pct: 4 }),
    ])
    expect(s.calls).toEqual({ made: 1, resolved: 2, right: 1, open: 1, avgScore: 50 })
    expect(s.realized).toEqual({ paper: 15, real: -5, n: 2 })
    expect(s.next?.id).toBe('d')
    expect(s.backtests.best?.id).toBe('b')
  })
  it('span progress is 0..1', () => {
    expect(historySpanProgress(ev({ id: 's', at: iso(NOW + D), start_at: iso(NOW - D) }), NOW)).toBeCloseTo(0.5)
    expect(historySpanProgress(ev({ id: 's', at: iso(NOW) }), NOW)).toBeNull()
  })
})

describe('river', () => {
  it('NOW sits at the fixed share and the past range maps to the left edge', () => {
    const d = riverDomain([ev({ id: 'f', at: iso(NOW + 200 * D), tense: 'future' })], '30d', NOW)
    expect(riverX(NOW, d, 1000)).toBeCloseTo(700)
    expect(riverX(NOW - 30 * D, d, 1000)).toBeCloseTo(0)
    expect(riverX(d.to, d, 1000)).toBeCloseTo(1000)
    // a far call is clamped to the right edge, never off-canvas
    expect(riverX(NOW + 400 * D, d, 1000)).toBe(1000)
  })
  it('"all" starts before the first event', () => {
    const d = riverDomain([ev({ id: 'old', at: iso(NOW - 400 * D) })], 'all', NOW)
    expect(d.from).toBeLessThan(NOW - 400 * D)
  })
})

describe('row tone', () => {
  it('paints each asset class, and a Kalshi ticker as a bet', () => {
    expect(historyAssetTone('XAU')?.id).toBe('precious_metals')
    expect(historyAssetTone('WTI')?.id).toBe('commodities')
    expect(historyAssetTone('EUR')?.id).toBe('fiat')
    expect(historyAssetTone('BTC')?.id).toBe('crypto')
    expect(historyAssetTone('AMZN')?.id).toBe('stocks')
    expect(historyAssetTone('KXELONMARS-99')?.id).toBe('bet')
    expect(historyAssetTone('KXELONMARS-99')?.color).toBe('#ff4d9d')
    expect(historyAssetTone(null)).toBeNull()
  })

  it('reads the print: up, down, a clock with no price, or flat', () => {
    expect(historyState(ev({ id: 'u', at: iso(NOW), pct: 9.8 }))).toBe('up')
    expect(historyState(ev({ id: 'd', at: iso(NOW), pnl_usd: -12 }))).toBe('down')
    expect(historyState(ev({ id: 'a', at: iso(NOW), kind: 'call_awaiting', pct: 0 }))).toBe('warn')
    expect(historyState(ev({ id: 'm', at: iso(NOW), status: 'missed', pct: 4 }))).toBe('down')
    expect(historyState(ev({ id: 'z', at: iso(NOW), pct: 0, status: 'pending' }))).toBe('flat')
  })

  it('gets louder as the move, the score, or the confidence grows', () => {
    const quiet = historyIntensity(ev({ id: 'q', at: iso(NOW), pct: 0.4 }))
    const loud = historyIntensity(ev({ id: 'l', at: iso(NOW), pct: 18, score: 90 }))
    expect(loud).toBeGreaterThan(quiet)
    expect(loud).toBeLessThanOrEqual(1)
    expect(quiet).toBeGreaterThanOrEqual(0.18)
  })

  it('fills a scheduled span with the clock, and an open position with the mark', () => {
    const span = ev({ id: 's', at: iso(NOW + D), start_at: iso(NOW - D), tense: 'present', kind: 'call_due', asset: 'XAU' })
    expect(historyBar(span, NOW)).toBeCloseTo(0.5)
    const open = ev({ id: 'o', at: iso(NOW), start_at: iso(NOW - D), tense: 'present', kind: 'paper_open', pct: 10 })
    expect(historyBar(open, NOW)).toBeCloseTo(0.5)
    expect(historyBar(ev({ id: 'p', at: iso(NOW - D), tense: 'past', pct: 9.8 }), NOW)).toBeCloseTo(9.8 / 20)
    expect(historyBar(ev({ id: 'g', at: iso(NOW - D), tense: 'past', kind: 'day_digest' }), NOW)).toBeNull()
    expect(historyDetail(ev({ id: 'c', at: iso(NOW), asset: 'AMZN', kind: 'call_made', data: { timeframe: '1W' } }))).toBe('1W call')
    expect(historyDetail(ev({ id: 'a', at: iso(NOW), kind: 'day_digest', title: 'Active day', subtitle: '7 pages' }))).toBe('7 pages')
    const look = historyVisual(span, NOW)
    expect(look.asset?.id).toBe('precious_metals')
    expect(look.bar).toBeCloseTo(0.5)
  })
})

describe('format', () => {
  it('signs and units', () => {
    expect(histPct(2.345)).toBe('+2.3%')
    expect(histPct(-0.04)).toBe('−0.0%')
    expect(histSignedUsd(-12.5)).toBe('−$12.50')
    expect(histRelTime(iso(NOW + 3 * D), NOW)).toBe('in 3 d')
    expect(histRelTime(iso(NOW - 2 * H), NOW)).toBe('2 h ago')
    expect(histClockTime('2026-10-26T15:04:00.000Z', 'UTC')).toBe('15:04')
    expect(histClockTime('2026-10-26T15:04:00.000Z', 'Europe/Paris')).toBe('16:04')
  })
})
