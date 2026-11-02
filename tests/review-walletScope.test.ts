import { describe, expect, it } from 'vitest'
import { riskProfile, utcCalendarDaysAgo } from '~/utils/walletBook'

describe('wallet scope helpers (REVIEW-7, REVIEW-17)', () => {
  it('win rate is "—" (null) when the book has 0 closed (sell) trades', () => {
    const pos = [{ symbol: 'BTC', allocation_percentage: 90, return_percentage: 10 }]
    expect(riskProfile(pos, undefined, 0).winRate).toBeNull()
    expect(riskProfile(pos, undefined, 2).winRate).toBe(100)
    expect(riskProfile(pos).winRate).toBe(100) // old callers unchanged
  })

  it('fill dates use the UTC calendar day, not a 24 h window', () => {
    const now = Date.UTC(2026, 10, 2, 0, 10)
    expect(utcCalendarDaysAgo(Date.UTC(2026, 10, 1, 23, 50), now)).toBe(1) // 20 min ago, but yesterday
    expect(utcCalendarDaysAgo(Date.UTC(2026, 10, 2, 0, 1), now)).toBe(0)
    expect(utcCalendarDaysAgo(Date.UTC(2026, 9, 31, 0, 30), now)).toBe(2)
  })
})
