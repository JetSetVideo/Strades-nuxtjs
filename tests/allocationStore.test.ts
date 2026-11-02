import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAllocationStore } from '~/stores/allocation'

describe('allocation store — no invented default', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('starts at zeros (not 25/25/25/25) and never falls back to the demo user id', () => {
    const store = useAllocationStore()
    expect(store.allocationPie).toEqual({ fiat: 0, crypto: 0, stocks: 0, commodities: 0 })
    expect(store.userId).not.toBe('user_001')
    expect(store.is100Percent).toBe(false)
  })

  it('takes the mix of actual holdings', () => {
    const store = useAllocationStore()
    const pie = { fiat: 26.9, crypto: 73.1, stocks: 0, commodities: 0 }
    store.setFromHoldings(pie)
    expect(store.allocationPie).toEqual(pie)
    expect(store.allocationPie).not.toBe(pie)
    expect(store.is100Percent).toBe(true)
  })
})
