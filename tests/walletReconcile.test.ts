import { describe, expect, it } from 'vitest'
import { reconcileWallet, type ReconcilableWallet } from '~/utils/walletReconcile'

function asset(
  amount: number,
  average: number,
  price: number,
  allocation: number,
): ReconcilableWallet['assets'][0] {
  const current = amount * price
  const cost = amount * average
  return {
    amount,
    average_price: average,
    current_price: price,
    current_value: current,
    return_amount: current - cost,
    return_percentage: cost > 0 ? ((current - cost) / cost) * 100 : 0,
    allocation_percentage: allocation,
  }
}

/** Catalog shape: book = invested + return, and that return is copied into cash. */
function staleBookWallet(): ReconcilableWallet {
  return {
    total_value: 125750.45,
    available_balance: 15750.45,
    invested_amount: 110000,
    total_return: 15750.45,
    total_return_percentage: 14.32,
    assets: [
      asset(1.25, 45000, 62500, 62.1),
      asset(15.5, 2800, 3200, 39.4),
      asset(50, 150, 175, 6.95),
      asset(25, 200, 240, 4.77),
    ],
  }
}

describe('reconcileWallet', () => {
  it('rebuilds the main portfolio so weights sum to 100', () => {
    const wallet = staleBookWallet()
    reconcileWallet(wallet)

    const weights = wallet.assets.map(a => a.allocation_percentage)
    const sum = weights.reduce((s, n) => s + n, 0)
    expect(sum).toBeCloseTo(100, 6)
    expect(Math.max(...weights)).toBeLessThanOrEqual(100)
    expect(wallet.total_value).toBeCloseTo(142475, 6)
    expect(wallet.available_balance).toBe(0)
    expect(wallet.assets[0].allocation_percentage).toBeCloseTo((78125 / 142475) * 100, 6)
  })

  it('is stable when applied twice', () => {
    const wallet = staleBookWallet()
    reconcileWallet(wallet)
    const snapshot = JSON.stringify(wallet)
    reconcileWallet(wallet)
    expect(JSON.stringify(wallet)).toBe(snapshot)
  })

  it('keeps cash that still fits inside the book', () => {
    const wallet: ReconcilableWallet = {
      total_value: 1000,
      available_balance: 200,
      invested_amount: 700,
      total_return: 100,
      total_return_percentage: 14,
      assets: [asset(8, 100, 100, 80)],
    }
    reconcileWallet(wallet)
    expect(wallet.available_balance).toBe(200)
    expect(wallet.total_value).toBeCloseTo(1000, 6)
    expect(wallet.assets[0].allocation_percentage).toBeCloseTo(80, 6)
  })

  it('reprices a position and keeps the pie closed', () => {
    const wallet = staleBookWallet()
    reconcileWallet(wallet)
    wallet.assets[0].current_price = 80000
    reconcileWallet(wallet)
    const sum = wallet.assets.reduce((s, a) => s + a.allocation_percentage, 0)
    expect(sum).toBeCloseTo(100, 6)
    expect(wallet.assets[0].current_value).toBeCloseTo(1.25 * 80000, 6)
    expect(wallet.total_value).toBeCloseTo(wallet.assets.reduce((s, a) => s + a.current_value, 0), 6)
  })
})
