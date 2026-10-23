import { describe, expect, it } from 'vitest'
import {
  aggregateWallets,
  assetLayers,
  equityPath,
  riskProfile,
  sharePaths,
  stackBands,
  walletLayers,
} from '~/utils/walletBook'

describe('walletBook', () => {
  it('ends the equity path on the current value', () => {
    const path = equityPath('wallet_001::30d', 30, 1000, 10)
    expect(path).toHaveLength(30)
    expect(path.at(-1)).toBe(1000)
    expect(path.every(value => value > 0)).toBe(true)
  })

  it('keeps every share column at 100% and pins the last column to the current mix', () => {
    const paths = sharePaths(
      [{ id: 'a', share: 0.2 }, { id: 'b', share: 0.8 }],
      10,
      'seed',
    )
    for (const row of paths) expect(row[0] + row[1]).toBeCloseTo(1)
    expect(paths.at(-1)?.[0]).toBeCloseTo(0.2)
    expect(paths.at(-1)?.[1]).toBeCloseTo(0.8)
  })

  it('gives a hidden sleeve its share without stretching the one left visible', () => {
    const bands = stackBands(
      [{ x: 0, y: 20 }],
      [[0.25, 0.75]],
      [{ id: 'stocks' }, { id: 'crypto', hidden: true }],
      100,
    )
    expect(bands[0].points[0].bottom).toBeCloseTo(100)
    expect(bands[0].points[0].top).toBeCloseTo(80)
    expect(bands[1].hidden).toBe(true)
    expect(bands[1].points[0].top).toBeCloseTo(20)
  })

  it('colors holdings by class and stacks the largest sleeve on top', () => {
    const layers = assetLayers([
      { asset_id: 'bitcoin', symbol: 'BTC', current_value: 90 },
      { asset_id: 'ethereum', symbol: 'ETH', current_value: 5 },
      { asset_id: 'apple', symbol: 'AAPL', current_value: 5 },
    ])
    expect(layers.map(layer => layer.label)).toEqual(['AAPL', 'ETH', 'BTC'])
    expect(layers.map(layer => layer.group)).toEqual(['stocks', 'crypto', 'crypto'])
    expect(layers.at(-1)?.color).toBe('#F5A623')
    expect(layers.reduce((sum, layer) => sum + layer.share, 0)).toBeCloseTo(1)
  })

  it('splits the total book into wallets and sums the combined return', () => {
    const book = aggregateWallets([
      {
        id: 'a',
        name: 'Main',
        total_value: 75,
        daily_change: 1,
        assets: [{ asset_id: 'bitcoin', symbol: 'BTC', amount: 1, average_price: 20, current_price: 40, current_value: 40 }],
        performance_history: { '30d': { change: 5, change_percentage: 7 } },
      },
      {
        id: 'b',
        name: 'Trading',
        total_value: 25,
        daily_change: -1,
        assets: [{ asset_id: 'bitcoin', symbol: 'BTC', amount: 1, average_price: 10, current_price: 20, current_value: 20 }],
        performance_history: { '30d': { change: 5, change_percentage: 25 } },
      },
    ])
    expect(book?.id).toBe('all')
    expect(book?.total_value).toBe(100)
    expect(book?.daily_change).toBe(0)
    expect(book?.performance_history?.['30d'].change).toBe(10)
    expect(book?.performance_history?.['30d'].change_percentage).toBeCloseTo((10 / 90) * 100)
    const btc = book?.assets?.find(asset => asset.symbol === 'BTC')
    expect(btc?.current_value).toBe(60)
    expect(btc?.allocation_percentage).toBeCloseTo(60)
    const layers = walletLayers([
      { id: 'a', name: 'Main', total_value: 75 },
      { id: 'b', name: 'Trading', total_value: 25 },
    ])
    expect(layers.at(-1)?.label).toBe('Main')
    expect(layers.at(-1)?.share).toBeCloseTo(0.75)
  })

  it('scores a crypto-heavy book as high risk', () => {
    const risk = riskProfile(
      [{ symbol: 'BTC', allocation_percentage: 90, return_percentage: 10 }],
      { '30d': { change_percentage: 4 } },
    )
    expect(risk.riskLevel).toBe('high')
    expect(risk.exposure.crypto).toBeCloseTo(90)
    expect(risk.winRate).toBe(100)
  })
})
