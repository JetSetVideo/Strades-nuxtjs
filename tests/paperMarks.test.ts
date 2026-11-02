import { describe, expect, it } from 'vitest'
import { DEFAULT_PAPER_CAPITAL, GUEST_OWNER, livePriceOf, paperCapital, paperMark, paperOwnerId } from '~/utils/paperMarks'
import { canWithdrawCall, clampConfidence, DEFAULT_CONFIDENCE, lockedReason } from '~/utils/callRules'

describe('paper marks — P&L from entry and the live price, never a sine wave', () => {
  const assets = [
    { id: 'bitcoin', symbol: 'BTC', current_price: 80000, live: { pair: 'BTCUSDT' } },
    { id: 'apple', symbol: 'AAPL', current_price: 200 }, // bundled price, no live quote
  ]

  it('uses the live price of the asset (by id, else by symbol)', () => {
    expect(livePriceOf(assets, 'bitcoin', 'BTC')).toBe(80000)
    expect(livePriceOf(assets, 'unknown-id', 'btc')).toBe(80000)
  })

  it('a bundled (not live) price or an unknown asset is no mark', () => {
    expect(livePriceOf(assets, 'apple', 'AAPL')).toBeNull()
    expect(livePriceOf(assets, 'x', 'X')).toBeNull()
  })

  it('computes long and short P&L from the entry price', () => {
    expect(paperMark({ side: 'buy', simulated_price: 100, notional_value: 1000 }, 110)).toEqual({ pct: 10, value: 100 })
    const short = paperMark({ side: 'sell', simulated_price: 100, notional_value: 1000 }, 110)!
    expect(short.pct).toBeCloseTo(-10, 10)
    expect(short.value).toBeCloseTo(-100, 10)
  })

  it('returns null (shown —) without a price or with a broken entry', () => {
    expect(paperMark({ side: 'buy', simulated_price: 100, notional_value: 1000 }, null)).toBeNull()
    expect(paperMark({ side: 'buy', simulated_price: 0, notional_value: 1000 }, 110)).toBeNull()
    expect(paperMark({ side: 'buy', simulated_price: 100, notional_value: 1000 }, NaN)).toBeNull()
  })

  it('is stable over time: the same price gives the same P&L', () => {
    const t = { side: 'buy' as const, simulated_price: 62500, notional_value: 5000 }
    expect(paperMark(t, 63000)).toEqual(paperMark(t, 63000))
  })
})

describe('paper owner and capital', () => {
  it('stamps the signed-in user, never user_001', () => {
    expect(paperOwnerId(true, 'u_42')).toBe('u_42')
    expect(paperOwnerId(true, 42)).toBe('42')
    expect(paperOwnerId(false, 'u_42')).toBe(GUEST_OWNER)
    expect(paperOwnerId(true, 'user_001')).toBe(GUEST_OWNER)
    expect(paperOwnerId(true, null)).toBe(GUEST_OWNER)
  })

  it('sizes on the paper wallets\' free cash, else null (caller shows the labelled default)', () => {
    expect(paperCapital([{ cash_usd: '24282.83' }, { cash_usd: '1000' }])).toBeCloseTo(25282.83, 2)
    expect(paperCapital([{ cash_usd: '0' }])).toBeNull()
    expect(paperCapital([])).toBeNull()
    expect(paperCapital(undefined)).toBeNull()
    expect(DEFAULT_PAPER_CAPITAL).toBe(100_000)
  })
})

describe('calls — confidence input and locked records', () => {
  const now = Date.parse('2026-11-02T12:00:00Z')

  it('confidence is 1–5, default 3', () => {
    expect(clampConfidence(undefined)).toBe(DEFAULT_CONFIDENCE)
    expect(clampConfidence('x')).toBe(3)
    expect([0, 1, 2.6, 5, 9].map(clampConfidence)).toEqual([1, 1, 3, 5, 5])
  })

  it('a pending call with its target ahead can be withdrawn', () => {
    expect(canWithdrawCall({ status: 'pending', targetTs: now + 3_600_000 }, now)).toBe(true)
  })

  it('resolved calls are locked', () => {
    for (const status of ['accurate', 'missed', 'expired']) {
      expect(canWithdrawCall({ status, targetTs: now + 3_600_000 }, now)).toBe(false)
      expect(lockedReason({ status }, now)).toMatch(/Resolved/)
    }
  })

  it('a pending call past its target (awaiting the result) is locked too', () => {
    expect(canWithdrawCall({ status: 'pending', targetTs: now - 1 }, now)).toBe(false)
    expect(canWithdrawCall({ status: 'pending', targetDate: '2026-10-30T00:00:00Z' }, now)).toBe(false)
    expect(lockedReason({ status: 'pending', targetTs: now - 1 }, now)).toMatch(/waiting for the result/)
  })
})
