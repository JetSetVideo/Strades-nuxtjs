import { describe, expect, it } from 'vitest'
import {
  applyHorizonFilter,
  applyHorizonStates,
  betHorizonBucket,
  defaultHorizonStates,
  betExpiryMs,
  betSourceLabel,
  countHiddenByHorizon,
  DEFAULT_BET_HORIZON,
  horizonMs,
  isBetAsset,
  withinHorizon,
  BET_COLOR,
  BET_HORIZONS,
} from '~/utils/betAssets'

const DAY = 86_400_000
const NOW = Date.parse('2026-10-08T00:00:00Z')
const iso = (offsetDays: number) => new Date(NOW + offsetDays * DAY).toISOString()

describe('isBetAsset', () => {
  it('recognises the bet type, case-insensitively', () => {
    expect(isBetAsset({ type: 'bet' })).toBe(true)
    expect(isBetAsset({ type: 'BET' })).toBe(true)
  })
  it('leaves the four instrument classes alone', () => {
    for (const t of ['stock', 'commodity', 'cryptocurrency', 'fiat_currency']) {
      expect(isBetAsset({ type: t })).toBe(false)
    }
    expect(isBetAsset(null)).toBe(false)
    expect(isBetAsset({})).toBe(false)
  })
})

describe('BET_COLOR', () => {
  it('is a distinct hex colour outside the shared assetClass palette', () => {
    expect(BET_COLOR).toMatch(/^#[0-9a-f]{6}$/i)
    const palette = ['#f4c145', '#ff9f45', '#4fa8ff', '#b48aff', '#00e58a']
    expect(palette).not.toContain(BET_COLOR.toLowerCase())
  })
})

describe('betExpiryMs', () => {
  it('parses ISO dates and tolerates missing/garbage input', () => {
    expect(betExpiryMs({ expires_at: iso(5) })).toBe(NOW + 5 * DAY)
    expect(betExpiryMs({ expires_at: null })).toBeNull()
    expect(betExpiryMs({})).toBeNull()
    expect(betExpiryMs({ expires_at: 'not-a-date' })).toBeNull()
  })
})

describe('withinHorizon', () => {
  it('keeps a bet resolving inside the window', () => {
    expect(withinHorizon({ expires_at: iso(3) }, '7d', NOW)).toBe(true)
    expect(withinHorizon({ expires_at: iso(29) }, '30d', NOW)).toBe(true)
  })
  it('hides a bet resolving beyond the window', () => {
    expect(withinHorizon({ expires_at: iso(20) }, '7d', NOW)).toBe(false)
    expect(withinHorizon({ expires_at: iso(200) }, '90d', NOW)).toBe(false)
  })
  it('keeps an endless bet (no expiry) — it is not "beyond" anything', () => {
    expect(withinHorizon({ expires_at: null }, '7d', NOW)).toBe(true)
    expect(withinHorizon({}, '30d', NOW)).toBe(true)
  })
  it('keeps an already-expired bet — it is not in the future', () => {
    expect(withinHorizon({ expires_at: iso(-2) }, '7d', NOW)).toBe(true)
  })
  it("treats 'all' as no restriction", () => {
    expect(withinHorizon({ expires_at: iso(9999) }, 'all', NOW)).toBe(true)
    expect(horizonMs('all')).toBe(Infinity)
  })
  it('is boundary-inclusive at exactly the horizon', () => {
    expect(withinHorizon({ expires_at: iso(30) }, '30d', NOW)).toBe(true)
  })
})

describe('applyHorizonFilter — bet-only, never touches other classes', () => {
  const list = [
    { id: 'btc', type: 'cryptocurrency' },                       // not a bet
    { id: 'b_near', type: 'bet', expires_at: iso(5) },
    { id: 'b_far', type: 'bet', expires_at: iso(200) },
    { id: 'b_open', type: 'bet', expires_at: null },
    { id: 'aapl', type: 'stock' },                               // not a bet
  ]

  it('drops far-future bets and keeps everything else', () => {
    expect(applyHorizonFilter(list, '7d', NOW).map(a => a.id))
      .toEqual(['btc', 'b_near', 'b_open', 'aapl'])
  })

  it('keeps the far bet once the horizon reaches it', () => {
    expect(applyHorizonFilter(list, '1y', NOW).map(a => a.id)).toContain('b_far')
  })

  it("'all' returns the list untouched", () => {
    expect(applyHorizonFilter(list, 'all', NOW)).toBe(list)
  })

  it('never removes non-bet rows, at any horizon', () => {
    for (const h of BET_HORIZONS.map(o => o.id)) {
      const kept = applyHorizonFilter(list, h, NOW).map(a => a.id)
      expect(kept).toContain('btc')
      expect(kept).toContain('aapl')
    }
  })
})

describe('countHiddenByHorizon', () => {
  it('counts only the bets a horizon would hide', () => {
    const list = [
      { id: 'btc', type: 'cryptocurrency' },
      { id: 'b1', type: 'bet', expires_at: iso(500) },
      { id: 'b2', type: 'bet', expires_at: iso(500) },
      { id: 'b3', type: 'bet', expires_at: iso(1) },
    ]
    expect(countHiddenByHorizon(list, '30d', NOW)).toBe(2)
    expect(countHiddenByHorizon(list, 'all', NOW)).toBe(0)
  })
})

describe('applyHorizonStates', () => {
  const list = [
    { id: 'near', type: 'bet', expires_at: iso(3) },
    { id: 'month', type: 'bet', expires_at: iso(20) },
    { id: 'quarter', type: 'bet', expires_at: iso(60) },
    { id: 'stock', type: 'stock', expires_at: iso(400) },
  ]

  it('puts each future bet in one window', () => {
    expect(betHorizonBucket(list[0]!, NOW)).toBe('7d')
    expect(betHorizonBucket(list[1]!, NOW)).toBe('30d')
    expect(betHorizonBucket(list[2]!, NOW)).toBe('90d')
  })

  it('highlights two windows and still hides an excluded third', () => {
    const states = { ...defaultHorizonStates(), '7d': 'include' as const, '30d': 'include' as const }
    expect(applyHorizonStates(list, states, NOW).map(a => a.id)).toEqual(['near', 'month', 'stock'])
  })

  it('shows every window when every chip is neutral', () => {
    expect(applyHorizonStates(list, {}, NOW).map(a => a.id)).toEqual(['near', 'month', 'quarter', 'stock'])
  })
})

describe('defaults', () => {
  it('defaults to a bounded horizon that excludes far-future bets', () => {
    expect(DEFAULT_BET_HORIZON).toBe('30d')
    expect(horizonMs(DEFAULT_BET_HORIZON)).toBeLessThan(Infinity)
  })
  it('labels Polymarket and Kalshi from their source key', () => {
    expect(betSourceLabel('kalshi')).toBe('Kalshi')
    expect(betSourceLabel('polymarket')).toBe('Polymarket')
    expect(betSourceLabel(null)).toBe('')
  })
})
