/** Canonical 100% allocation pie — sums to exactly 100. */

export interface AllocationPie {
  fiat: number
  crypto: number
  stocks: number
  commodities: number
}

export type AllocationClass = keyof AllocationPie

export const EMPTY_ALLOCATION_PIE: AllocationPie = {
  fiat: 0,
  crypto: 0,
  stocks: 0,
  commodities: 0,
}

export const EQUAL_ALLOCATION_PIE: AllocationPie = {
  fiat: 25,
  crypto: 25,
  stocks: 25,
  commodities: 25,
}

export function normalizeAllocationPie(pie: AllocationPie): AllocationPie {
  const sum = pie.fiat + pie.crypto + pie.stocks + pie.commodities
  if (sum === 0) return { ...EQUAL_ALLOCATION_PIE }
  if (Math.abs(sum - 100) < 0.01) return { ...pie }
  return {
    fiat: (pie.fiat / sum) * 100,
    crypto: (pie.crypto / sum) * 100,
    stocks: (pie.stocks / sum) * 100,
    commodities: (pie.commodities / sum) * 100,
  }
}
