import { describe, expect, it } from 'vitest'
import {
  activityRange,
  ageOf,
  buildDeskCalendar,
  dayTone,
  isPaidRole,
  shiftActivity,
  snapsFromHistory,
  valueAt,
  visitorSees,
} from '~/utils/profileDesk'
import { compareCircle, profileMask } from '~/utils/profileMask'

const history = {
  wallet_001: {
    '2024-01-01': { total_value: 100, assets: { BTC: { value: 100 }, ETH: { value: 0 } } },
    '2024-01-03': { total_value: 110, assets: { BTC: { value: 80 }, ETH: { value: 30 } } },
  },
}

describe('profile desk', () => {
  it('colors a rising day green, a falling day red, and a flat trade orange', () => {
    expect(dayTone(1.2, 0, false)).toBe('green')
    expect(dayTone(-1.2, 0, false)).toBe('red')
    expect(dayTone(0.1, 2, false)).toBe('orange')
    expect(dayTone(null, 0, false)).toBe('idle')
    expect(dayTone(4, 1, true)).toBe('ahead')
  })

  it('interpolates between snapshots and stops after the last one', () => {
    const snaps = snapsFromHistory(history.wallet_001)
    expect(valueAt(snaps, '2024-01-02')).toBe(105)
    expect(valueAt(snaps, '2024-01-04')).toBeNull()
    expect(valueAt(snaps, '2023-12-31')).toBeNull()
  })

  it('uses the monthly calendar for the whole book and keeps scheduled days out of best and worst', () => {
    const desk = buildDeskCalendar({
      histories: history,
      walletIds: ['wallet_001'],
      trades: [{ date: '2024-01-02', symbol: 'BTC', walletId: 'wallet_001' }],
      seed: [
        { day: 15, pnl_eur: 50, pnl_pct: 4, trades_total: 3, trades_won: 2, is_upcoming: false },
        { day: 24, pnl_eur: 80, pnl_pct: 9, trades_total: 2, trades_won: 2, is_upcoming: true },
      ],
      today: '2026-10-23',
      events: [{ date: '2026-10-23', label: 'Desk open' }],
    })
    const recorded = desk.weeks.flat().find(d => d.date === '2026-10-15')
    const scheduled = desk.weeks.flat().find(d => d.date === '2026-10-24')
    expect(recorded?.tone).toBe('green')
    expect(recorded?.pnlPct).toBe(4)
    expect(scheduled?.tone).toBe('ahead')
    expect(desk.best?.date).not.toBe('2026-10-24')
    expect(desk.best?.pnlPct).toBeGreaterThan(4)
    expect(desk.active).toBe(true)
    expect(desk.weeks.flat().find(d => d.date === '2026-10-23')?.marks).toEqual(['Desk open'])
    expect(ageOf('1990-01-14', '2026-10-23')).toBe('36 yr 9 mo')
    expect(ageOf('2025-06-01', '2026-10-23')).toBe('1 yr 4 mo')
  })

  it('follows one asset and one wallet instead of the whole book', () => {
    const asset = buildDeskCalendar({
      histories: history,
      walletIds: ['wallet_001'],
      trades: [],
      seed: [{ day: 2, pnl_eur: 50, pnl_pct: 4, trades_total: 1, trades_won: 1, is_upcoming: false }],
      today: '2024-01-03',
      asset: 'ETH',
    })
    const jan3 = asset.weeks.flat().find(d => d.date === '2024-01-03')
    expect(jan3?.pnlPct).not.toBe(4)
    expect(jan3?.tone).toBe('green')

    const missing = buildDeskCalendar({
      histories: history,
      walletIds: ['wallet_001'],
      trades: [{ date: '2024-01-02', symbol: 'BTC', walletId: 'wallet_001' }],
      seed: [],
      today: '2024-01-03',
      walletId: 'wallet_999',
    })
    expect(missing.weeks.flat().every(d => d.trades === 0)).toBe(true)
  })

  it('steps a week, month, quarter, or year and labels that window', () => {
    const week = activityRange('2026-10-23', 'week')
    expect(week.start).toBe('2026-10-18')
    expect(week.end).toBe('2026-10-24')
    expect(week.label).toBe('Oct 18 – 24, 2026')
    const month = activityRange('2026-10-23', 'month')
    expect(month.start).toBe('2026-10-01')
    expect(month.end).toBe('2026-10-31')
    expect(month.gridStart).toBe('2026-09-27')
    expect(month.label).toBe('October 2026')
    expect(activityRange('2026-10-23', 'quarter').label).toBe('Q4 2026')
    expect(activityRange('2026-10-23', 'year').label).toBe('2026')
    expect(shiftActivity('2026-10-23', 'week', -1)).toBe('2026-10-16')
    expect(shiftActivity('2026-10-23', 'month', 1)).toBe('2026-11-01')
    expect(shiftActivity('2026-10-23', 'quarter', -1)).toBe('2026-07-01')
    expect(shiftActivity('2026-10-23', 'year', 1)).toBe('2027-10-23')
    const desk = buildDeskCalendar({
      histories: history,
      walletIds: ['wallet_001'],
      trades: [],
      seed: [],
      today: '2024-01-03',
    })
    expect(desk.weeks.flat().find(d => d.date === '2024-01-02')?.level).toBe(105)
  })

  it('puts a paid desk ahead of a verified one, and a verified desk ahead of the rest', () => {
    const people = [
      { id: 'open', premium: false, verified: false },
      { id: 'paid', premium: true, verified: false },
      { id: 'trusted', premium: false, verified: true },
      { id: 'both', premium: true, verified: true },
    ]
    expect(people.sort(compareCircle).map(p => p.id)).toEqual(['both', 'paid', 'trusted', 'open'])
  })

  it('paints a scalper warmer than a buy-and-hold mask, and a grey empty desk', () => {
    const scalper = profileMask('user_003', { style: 'scalper' })
    const holder = profileMask('user_002', { style: 'buy_hold' })
    const empty = profileMask('nofriend', { muted: true })
    expect(scalper.from).not.toBe(holder.from)
    expect(scalper.head).not.toBe(holder.head)
    expect(empty.wash).not.toBe(scalper.wash)
    expect(empty.edge).not.toBe(scalper.edge)
  })

  it('keeps a free visitor off friends-only blocks and a paid role in control', () => {
    expect(visitorSees('public')).toBe(true)
    expect(visitorSees('friends_only')).toBe(false)
    expect(visitorSees('private')).toBe(false)
    expect(isPaidRole('user')).toBe(false)
    expect(isPaidRole('premium')).toBe(true)
  })
})
