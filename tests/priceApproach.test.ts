import { describe, expect, it } from 'vitest'
import {
  CLOSING_REMAINING, indexLivePrices, levelRole, lookupPrice, priceApproach,
} from '~/utils/priceApproach'

const HOUR = 3_600_000

describe('priceApproach', () => {
  it('stays quiet at the start, and when price moves away', () => {
    const start = priceApproach(100, 110, 100, 4 * HOUR)
    expect(start.remaining).toBe(1)
    expect(start.closing).toBe(false)
    expect(start.closeness).toBe(0)
    expect(start.role).toBe('limit')
    const away = priceApproach(100, 110, 95, 4 * HOUR)
    expect(away.covered).toBeLessThan(0)
    expect(away.closing).toBe(false)
    expect(levelRole(110, 95)).toBe('limit')
  })

  it('fires in the last 20% of the original gap, with closeness = 1 − √remaining', () => {
    const hot = priceApproach(100, 110, 108, 4 * HOUR)
    expect(hot.remaining).toBeCloseTo(CLOSING_REMAINING, 6)
    expect(hot.closing).toBe(true)
    expect(hot.closeness).toBeCloseTo(1 - Math.sqrt(0.2), 6)
    expect(hot.speedPerHour).toBeCloseTo(0.2, 6)
    expect(hot.etaMs).toBeCloseTo(HOUR, -1)
    expect(hot.role).toBe('limit')
    const floor = priceApproach(100, 90, 92, HOUR)
    expect(floor.role).toBe('support')
    expect(floor.closing).toBe(true)
    expect(floor.remaining).toBeCloseTo(0.2, 6)
  })

  it('does not invent a pace from a move that just happened', () => {
    const fresh = priceApproach(180, 198, 195.89, 2_000)
    expect(fresh.closing).toBe(true)
    expect(fresh.etaMs).toBeNull()
    expect(fresh.speedPerHour).toBe(0)
  })

  it('does not keep warning once the target is reached', () => {
    const hit = priceApproach(100, 110, 110, HOUR)
    expect(hit.reached).toBe(true)
    expect(hit.closing).toBe(false)
    expect(hit.closeness).toBe(1)
  })

  it('indexes live prices by id and ticker', () => {
    const { prices, symbols } = indexLivePrices([{ id: 'bitcoin', symbol: 'BTC', current_price: 100 }])
    expect(symbols.bitcoin).toBe('BTC')
    expect(lookupPrice(prices, 'btc')).toBe(100)
    expect(lookupPrice(prices, 'bitcoin')).toBe(100)
    expect(lookupPrice(prices, 'ETH')).toBeNull()
  })
})
