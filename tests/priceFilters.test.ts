import { describe, expect, it } from 'vitest'
import {
  allowsAny,
  allowsValue,
  applyTypeFilters,
  cycleKey,
  cycleTriState,
  emptyTypeStates,
  sortAssets,
  type FilterTriState,
} from '~/utils/priceFilters'

const assets = [
  { id: 'aapl', type: 'stock', market_cap: 3, fluctuation_velocity: 0.2 },
  { id: 'btc', type: 'cryptocurrency', market_cap: 1, fluctuation_velocity: 0.9 },
  { id: 'eur', type: 'fiat_currency', market_cap: 0, fluctuation_velocity: 0.1 },
  { id: 'gold', type: 'commodity', market_cap: 2, fluctuation_velocity: 0.4 },
]

describe('cycleTriState', () => {
  it('walks include → exclude → neutral', () => {
    expect(cycleTriState('neutral')).toBe('include')
    expect(cycleTriState('include')).toBe('exclude')
    expect(cycleTriState('exclude')).toBe('neutral')
  })
})

describe('applyTypeFilters', () => {
  it('shows everything when all chips are neutral', () => {
    const states = emptyTypeStates(['stock', 'cryptocurrency', 'fiat_currency', 'commodity'])
    expect(applyTypeFilters(assets, states).map(a => a.id)).toEqual(['aapl', 'btc', 'eur', 'gold'])
  })

  it('whitelists included types', () => {
    const states: Record<string, FilterTriState> = {
      stock: 'include',
      cryptocurrency: 'neutral',
      fiat_currency: 'neutral',
      commodity: 'neutral',
    }
    expect(applyTypeFilters(assets, states).map(a => a.id)).toEqual(['aapl'])
  })

  it('hides excluded types even when others are included', () => {
    const states: Record<string, FilterTriState> = {
      stock: 'include',
      cryptocurrency: 'include',
      fiat_currency: 'exclude',
      commodity: 'neutral',
    }
    expect(applyTypeFilters(assets, states).map(a => a.id)).toEqual(['aapl', 'btc'])
  })

  it('exclude-only mode hides those types and keeps the rest', () => {
    const states: Record<string, FilterTriState> = {
      stock: 'exclude',
      cryptocurrency: 'neutral',
      fiat_currency: 'neutral',
      commodity: 'neutral',
    }
    expect(applyTypeFilters(assets, states).map(a => a.id)).toEqual(['btc', 'eur', 'gold'])
  })
})

describe('allowsValue / allowsAny', () => {
  it('unions two includes and still drops an exclude', () => {
    const states: Record<string, FilterTriState> = {
      stock: 'include',
      cryptocurrency: 'include',
      commodity: 'exclude',
    }
    expect(allowsValue('stock', states)).toBe(true)
    expect(allowsValue('cryptocurrency', states)).toBe(true)
    expect(allowsValue('commodity', states)).toBe(false)
    expect(allowsValue('fiat_currency', states)).toBe(false)
    expect(allowsAny(['commodity', 'stock'], states)).toBe(false)
    expect(allowsAny(['stock'], states)).toBe(true)
  })

  it('exclude-only keeps every other value', () => {
    expect(allowsValue('stock', { stock: 'exclude' })).toBe(false)
    expect(allowsValue('cryptocurrency', { stock: 'exclude' })).toBe(true)
  })

  it('cycles back to an empty map', () => {
    const states: Record<string, FilterTriState> = {}
    cycleKey(states, 'stock')
    expect(states.stock).toBe('include')
    cycleKey(states, 'stock')
    expect(states.stock).toBe('exclude')
    cycleKey(states, 'stock')
    expect(states.stock).toBeUndefined()
  })
})

describe('sortAssets', () => {
  const changes = { aapl: 1.2, btc: -3.4, eur: 0.1, gold: 2.0 }

  it('orders gainers high to low, and reverse flips the list', () => {
    const gainers = sortAssets(assets, 'gainers', changes, false).map(a => a.id)
    expect(gainers[0]).toBe('gold')
    expect(gainers[gainers.length - 1]).toBe('btc')
    expect(sortAssets(assets, 'gainers', changes, true).map(a => a.id)).toEqual(gainers.slice().reverse())
  })

  it('orders by market cap', () => {
    expect(sortAssets(assets, 'cap', changes, false).map(a => a.id)).toEqual(['aapl', 'gold', 'btc', 'eur'])
  })
})
