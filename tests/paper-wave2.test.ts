import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import {
  botCapitalBlock, DEFAULT_PAPER_CAPITAL, floorQty, heldQuantity, orderQuantity, portfolioFill, portfolioHolding,
  resolvePaperCapital, TRADE_POLL_MS, tradeErrorText, tradePollDue,
} from '~/utils/paperMarks'
import {
  callStyle, fmtHorizonHours, fromPaperTrades, isSampleCall, laneFromQuery, summarizeHistory, type HistoryEvent,
} from '~/utils/historyTimeline'
import { usePaperStore } from '~/stores/paper'
import { livePriceChanges } from '~/stores/macro'
import { nextMarketLimit, PREDICT_MAX, PREDICT_PAGE } from '~/composables/usePredictMarkets'

const NOW = Date.parse('2026-11-02T12:00:00Z')
const H = 3_600_000
const iso = (t: number) => new Date(t).toISOString()

describe('paper capital — one source (TRADE-1, BOT-3)', () => {
  it('free paper cash wins, a known $0 included (never a bigger default)', () => {
    expect(resolvePaperCapital(10166.08, 25000)).toEqual({ amount: 10166.08, source: 'cash' })
    expect(resolvePaperCapital('0.00', 25000)).toEqual({ amount: 0, source: 'cash' })
    expect(resolvePaperCapital(-5, 25000)).toEqual({ amount: 0, source: 'cash' })
  })
  it('unknown cash → Settings starting_capital → 10,000', () => {
    expect(resolvePaperCapital(null, 25000)).toEqual({ amount: 25000, source: 'settings' })
    expect(resolvePaperCapital(undefined, '5000')).toEqual({ amount: 5000, source: 'settings' })
    expect(resolvePaperCapital(null, 0)).toEqual({ amount: 10_000, source: 'default' })
    expect(resolvePaperCapital(null, null)).toEqual({ amount: DEFAULT_PAPER_CAPITAL, source: 'default' })
    expect(resolvePaperCapital('abc', undefined).amount).toBe(10_000)
  })
  it('bot capital: blocked with a reason at $0 free, above free cash, or under $10', () => {
    expect(botCapitalBlock('10000', '0E-8')).toMatch(/No free cash/)
    expect(botCapitalBlock('10000', 0)).toMatch(/No free cash/)
    expect(botCapitalBlock('600', '500')).toMatch(/more than this wallet/)
    expect(botCapitalBlock('5', '500')).toMatch(/at least \$10/)
    expect(botCapitalBlock('', '500')).toMatch(/at least/)
    expect(botCapitalBlock('500', '500')).toBe('')
    expect(botCapitalBlock('500', null)).toBe('') // wallet not read yet: the server still checks
  })
})

describe('/trade poll (PERF-7)', () => {
  const run = { alive: true, paused: false }
  it('polls every 15 s, only for a visible signed-in desk with a running bot', () => {
    expect(TRADE_POLL_MS).toBe(15_000)
    expect(tradePollDue({ walletId: 'w', signedOut: false, hidden: false, bots: [run] })).toBe(true)
    expect(tradePollDue({ walletId: 'w', signedOut: false, hidden: false, bots: [] })).toBe(false)
    expect(tradePollDue({ walletId: 'w', signedOut: false, hidden: false, bots: [{ alive: true, paused: true }, { alive: false }] })).toBe(false)
    expect(tradePollDue({ walletId: '', signedOut: false, hidden: false, bots: [run] })).toBe(false)
    expect(tradePollDue({ walletId: 'w', signedOut: true, hidden: false, bots: [run] })).toBe(false)
    expect(tradePollDue({ walletId: 'w', signedOut: false, hidden: true, bots: [run] })).toBe(false)
  })
})

describe('server paper book helpers (C1)', () => {
  const pf = {
    cash_balance: '5000.00',
    holdings: [
      { asset: { id: 'btc', symbol: 'BTC' }, quantity: '0.06465517', average_buy_price: '77330.01' },
      { asset: { id: 'eth', symbol: 'ETH' }, quantity: '0' },
    ],
    transactions: [
      { asset_symbol: 'BTC', type: 'buy', quantity: '0.01', price: '76000', total_value: '760', timestamp: '2026-11-01T10:00:00Z' },
      { asset_symbol: 'BTC', type: 'buy', quantity: '0.05465517', price: '77330.01', total_value: '4226.48', timestamp: '2026-11-02T10:00:00Z' },
    ],
  }
  it('finds the holding by id, else symbol; a 0 quantity is not held', () => {
    expect(heldQuantity(pf, 'btc', 'BTC')).toBeCloseTo(0.06465517, 8)
    expect(heldQuantity(pf, 'bitcoin', 'btc')).toBeCloseTo(0.06465517, 8)
    expect(portfolioHolding(pf, 'eth', 'ETH')).toBeNull()
    expect(heldQuantity(null, 'btc', 'BTC')).toBe(0)
  })
  it('orders: buy = notional / price; sell never exceeds the holding (no shorts)', () => {
    expect(orderQuantity({ side: 'buy', notional: 500, price: 100 })).toBe(5)
    expect(orderQuantity({ side: 'sell', notional: 500, price: 100, held: 2 })).toBe(2)
    expect(orderQuantity({ side: 'sell', notional: 500, price: 100, held: 0 })).toBe(0)
    expect(orderQuantity({ side: 'sell', notional: 500, price: 100 })).toBe(0)
    expect(orderQuantity({ side: 'buy', notional: 500, price: null })).toBe(0)
    expect(orderQuantity({ side: 'buy', notional: 0, price: 100 })).toBe(0)
  })
  it('quantities round DOWN to 8 dp', () => {
    expect(floorQty(500 / 77330.01)).toBe(0.00646579)
    expect(floorQty(0.06465517)).toBe(0.06465517)
    expect(floorQty(-1)).toBe(0)
    expect(floorQty(NaN)).toBe(0)
  })
  it('fill: the C1 `fill` when present, else the newest transaction, else the quote', () => {
    expect(portfolioFill({ ...pf, fill: { price: '77001.5', quantity: '0.01', total_value: '770.02', fee: '0.77' } }, 'BTC', 77000))
      .toEqual({ price: 77001.5, quantity: 0.01, total: 770.02, fee: 0.77, source: 'fill' })
    expect(portfolioFill(pf, 'btc', 77000)).toMatchObject({ price: 77330.01, source: 'transaction' })
    expect(portfolioFill({ cash_balance: '1' }, 'BTC', 77000)).toEqual({ price: 77000, quantity: null, total: null, fee: null, source: 'quote' })
  })
  it('errors read as one line, never a raw object', () => {
    expect(tradeErrorText({ data: { errors: { quantity: 'Insufficient cash balance. Required: 9, Available: 1.' } } })).toMatch(/^Insufficient cash/)
    expect(tradeErrorText({ data: { errors: { asset_id: ['No live price for BTC.'] } } })).toBe('No live price for BTC.')
    expect(tradeErrorText({ data: { detail: 'Forbidden' } })).toBe('Forbidden')
    expect(tradeErrorText({ statusCode: 429 })).toMatch(/Too many/)
    expect(tradeErrorText(new Error('x'))).toMatch(/Nothing was booked/)
  })
})

describe('paper ledger — no fake trades, samples never count (TRADE-4/5)', () => {
  beforeEach(() => setActivePinia(createPinia()))
  it('has no seedDemo any more', () => {
    expect((usePaperStore() as unknown as Record<string, unknown>).seedDemo).toBeUndefined()
  })
  it('win rate is null (—) until one of the user\'s own trades closes', () => {
    const paper = usePaperStore()
    expect(paper.winRate).toBeNull()
    const t = paper.placeOrder({ asset_id: 'btc', asset_symbol: 'BTC', side: 'buy', wallet_pct: 5, simulated_price: 100, capital_usd: 10_000 })
    expect(paper.winRate).toBeNull()
    paper.closeTrade(t.id, 110)
    expect(paper.winRate).toBe(100)
  })
  it('sample rows stay out of open P&L, realised P&L and the win rate', () => {
    const paper = usePaperStore()
    const s1 = paper.placeOrder({ asset_id: 'gold', asset_symbol: 'XAU', side: 'buy', wallet_pct: 2, simulated_price: 100, sample: true, capital_usd: 10_000 })
    paper.closeTrade(s1.id, 104)
    paper.placeOrder({ asset_id: 'eth', asset_symbol: 'ETH', side: 'buy', wallet_pct: 3, simulated_price: 100, sample: true, capital_usd: 10_000 })
    paper.markToMarket(() => 50)
    expect(paper.realizedPnlValue).toBe(0)
    expect(paper.winRate).toBeNull()
    expect(paper.openPnlValue).toBe(0)
    expect(paper.ownOpenTrades).toHaveLength(0)
    expect(paper.openTrades).toHaveLength(1) // still listed (with a Sample chip)
    expect(paper.equityCurve).toEqual([])
  })
  it('a missing capital sizes on 10,000, not 100,000', () => {
    const t = usePaperStore().placeOrder({ asset_id: 'btc', asset_symbol: 'BTC', side: 'buy', wallet_pct: 5, simulated_price: 100 })
    expect(t.notional_value).toBe(500)
  })
})

describe('history — samples and "How you call" from the calls (PRED-3, REVIEW-5)', () => {
  it('fromPaperTrades passes `sample` through, so the summary skips it', () => {
    const base = { user_id: 'u', asset_id: 'gold', asset_symbol: 'XAU', side: 'buy', wallet_pct: 2, simulated_price: 100, notional_value: 200,
      hypothetical_pnl_pct: 0, hypothetical_pnl_value: 0, is_paper: true }
    const rows = fromPaperTrades([
      { ...base, id: 's', timestamp: iso(NOW - 48 * H), status: 'closed', closed_at: iso(NOW - 24 * H), realized_pnl_value: 200, sample: true },
      { ...base, id: 'o', timestamp: iso(NOW - 2 * H), status: 'open', mark_price: 101, hypothetical_pnl_value: 2 },
    ] as any, NOW)
    expect(rows.map(e => e.sample)).toEqual([true, false])
    const own = summarizeHistory(rows.filter(e => !e.sample))
    expect(own.realized).toEqual({ paper: 0, real: 0, n: 0 })
    expect(own.open.paper).toBe(1)
  })

  const ev = (p: Partial<HistoryEvent>): HistoryEvent => ({
    id: 'x', at: iso(NOW), start_at: null, tense: 'past', lane: 'prediction', kind: 'call_made', mode: null, title: '', subtitle: '',
    asset: 'ETH', amount_usd: null, pnl_usd: null, pct: null, score: null, status: null, href: null, ref: null, sample: false,
    source: 'server', data: {}, ...p,
  })
  it('one bullish 1W call (6.4 d span) → 1/1 bullish, horizon "6 d" (not the EMA\'s "1 h")', () => {
    const made = NOW - H
    const s = callStyle([
      ev({ id: 'call:1:made', at: iso(made), pct: 8.2, ref: { type: 'prediction', id: '1' }, data: { timeframe: '1W' } }),
      ev({ id: 'call:1:due', kind: 'call_due', at: iso(made + 152.73 * H), start_at: iso(made), pct: 8.2, ref: { type: 'prediction', id: '1' } }),
    ])
    expect(s).toEqual({ n: 1, bullish: 1, horizonHours: expect.closeTo(152.73, 2) })
    expect(fmtHorizonHours(s.horizonHours)).toBe('6 d')
  })
  it('without a target row the chip label gives the horizon; median over calls; down calls are not bullish', () => {
    const s = callStyle([
      ev({ id: 'a', pct: 2, data: { timeframe: '1D' } }),
      ev({ id: 'b', pct: -3, data: { timeframe: '1W' } }),
      ev({ id: 'c', pct: 0, data: { timeframe: '1M' } }),
      ev({ id: 'd', kind: 'call_resolved', pct: 4 }),
    ])
    expect(s).toEqual({ n: 3, bullish: 2, horizonHours: 168 })
    expect(callStyle([])).toEqual({ n: 0, bullish: 0, horizonHours: null })
  })
  it('summary carries the call style and the strategies count', () => {
    const s = summarizeHistory([ev({ id: 'a', pct: 1, data: { timeframe: '1D' } }), ev({ id: 'st', kind: 'strategy_created', lane: 'agent' })])
    expect(s.style.n).toBe(1)
    expect(s.strategies).toEqual({ n: 1 })
  })
  it('horizon wording', () => {
    expect(fmtHorizonHours(5)).toBe('5 h')
    expect(fmtHorizonHours(2160)).toBe('3 mo')
    expect(fmtHorizonHours(null)).toBeNull()
    expect(fmtHorizonHours(0)).toBeNull()
  })
  it('deep link ?lane= accepts only a real lane', () => {
    expect(laneFromQuery('prediction')).toBe('prediction')
    expect(laneFromQuery(['opinion'])).toBe('opinion')
    expect(laneFromQuery('nope')).toBeNull()
    expect(laneFromQuery(undefined)).toBeNull()
  })
  it('sample calls: demo seed, or made before the account\'s sample_history_before', () => {
    const cut = iso(NOW)
    expect(isSampleCall({ demo: true, timestamp: iso(NOW + H) }, cut)).toBe(true)
    expect(isSampleCall({ timestamp: iso(NOW - H) }, cut)).toBe(true)
    expect(isSampleCall({ timestamp: iso(NOW + H) }, cut)).toBe(false)
    expect(isSampleCall({ timestamp: iso(NOW - H) }, undefined)).toBe(false)
  })
})

describe('prices mood — live assets only (PRICES-1)', () => {
  it('keeps only live assets with a real 24 h move; deterministic', () => {
    const assets = [
      { id: 'btc', live: { pair: 'BTCUSDT' }, change_24h_pct: 1.234 },
      { id: 'jpm', change_24h_pct: undefined },
      { id: 'ng' },
      { id: 'eth', live: { pair: 'ETHUSDT' }, change_24h_pct: NaN },
    ]
    expect(livePriceChanges(assets as any)).toEqual({ btc: 1.23 })
    expect(livePriceChanges(assets as any)).toEqual(livePriceChanges(assets as any))
  })
})

describe('/predict pages of 50 (PERF-8)', () => {
  it('+50 per click, never above the total or the server cap', () => {
    expect(PREDICT_PAGE).toBe(50)
    expect(nextMarketLimit(50, 1000)).toBe(100)
    expect(nextMarketLimit(50, 70)).toBe(70)
    expect(nextMarketLimit(150, 1000)).toBe(PREDICT_MAX)
    expect(nextMarketLimit(200, 1000)).toBe(200)
  })
})
