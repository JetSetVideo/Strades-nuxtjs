import { describe, expect, it } from 'vitest'
import { cashRank, serverFrequency, toServerStrategy, toSimulatedConditions, tradedPair } from '~/utils/strategyServer'

const base = { name: 'Momentum', assetFrom: 'usd', assetTo: 'btc', frequency: '1D', allocation: 25 }

describe('toServerStrategy', () => {
  it('maps creator rules to the engine vocabulary, with an inverse exit', () => {
    const r = toServerStrategy({ ...base, variables: [{ key: 'stop_loss', value: '5' }],
      conditions: [{ indicator: 'PRICE', operator: 'crosses_up', valueType: 'indicator', value: 0, valueIndicator: 'SMA', valueIndicatorParam: 50 }] })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.payload.assets).toEqual({ entry: 'BTC', exit: 'USD' })
    expect(r.payload.conditions).toEqual([
      { indicator: 'price', operator: 'cross_over', value: 'sma:50', timeframe: '1D', side: 'entry' },
      { indicator: 'price', operator: 'cross_under', value: 'sma:50', timeframe: '1D', side: 'exit' },
    ])
    expect(r.payload.parameters).toEqual({ stop_loss: 5, position_size: 0.25 })
  })

  it('keeps indicator periods and static values', () => {
    const r = toServerStrategy({ ...base, conditions: [{ indicator: 'RSI', indicatorParam: 7, operator: 'lt', value: 30 }] })
    expect(r.ok && r.payload.conditions[0]).toEqual({ indicator: 'rsi', period: 7, operator: '<', value: 30, timeframe: '1D', side: 'entry' })
    expect(r.ok && r.payload.conditions[1]?.operator).toBe('>=')
  })

  it('refuses rules the engine cannot execute, naming them', () => {
    const r = toServerStrategy({ ...base, conditions: [{ indicator: 'MACD', operator: 'gt', value: 0 }] })
    expect(r.ok).toBe(false)
    expect(!r.ok && r.errors[0]).toMatch(/MACD/)
  })

  it('requires at least one rule', () => {
    const r = toServerStrategy({ ...base, conditions: [] })
    expect(!r.ok && r.errors.join(' ')).toMatch(/IF rule/)
  })

  it('maps frequencies to replayable bars', () => {
    expect(['1m', '5m', '1h', '4h', '1D', '1W', '1M'].map(serverFrequency)).toEqual(['15m', '15m', '1h', '4h', '1D', '1D', '1D'])
  })
})

describe('FROM/TO → traded asset (wave 2: USD→BTC asked the engine for USDUSDT)', () => {
  const rsi = [{ indicator: 'RSI', operator: 'lt', value: 30 }]

  it('USD → BTC trades BTC, never USD', () => {
    expect(tradedPair('USD', 'BTC')).toEqual({ traded: 'BTC', counter: 'USD', direction: 'buy' })
    const r = toServerStrategy({ ...base, assetFrom: 'USD', assetTo: 'BTC', conditions: rsi })
    expect(r.ok && r.payload.assets.entry).toBe('BTC')
    expect(r.ok && r.payload.conditions[0]).toMatchObject({ indicator: 'rsi', operator: '<', value: 30, side: 'entry' })
  })

  it('BTC → USD trades BTC as a sell: the IF rule becomes the exit', () => {
    const p = tradedPair('btc', 'usd')
    expect(p).toMatchObject({ traded: 'BTC', counter: 'USD', direction: 'sell' })
    const r = toServerStrategy({ ...base, assetFrom: 'BTC', assetTo: 'USD', conditions: [{ indicator: 'RSI', operator: 'gt', value: 70 }] })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.payload.assets).toEqual({ entry: 'BTC', exit: 'USD' })
    expect(r.payload.conditions).toEqual([
      { indicator: 'rsi', period: 14, operator: '<=', value: 70, timeframe: '1D', side: 'entry' },
      { indicator: 'rsi', period: 14, operator: '>', value: 70, timeframe: '1D', side: 'exit' },
    ])
    expect(r.notes.join(' ')).toMatch(/Sells BTC when your IF rule holds/)
  })

  it('ETH → BTC (documented choice) trades the target BTC against USD and says ETH is unused', () => {
    const p = tradedPair('ETH', 'BTC')
    expect(p).toMatchObject({ traded: 'BTC', counter: 'ETH', direction: 'buy' })
    expect('note' in p && p.note).toMatch(/ETH is not used/)
    const r = toServerStrategy({ ...base, assetFrom: 'ETH', assetTo: 'BTC', conditions: rsi })
    expect(r.ok && r.payload.assets).toEqual({ entry: 'BTC', exit: 'ETH' })
    expect(r.ok && r.notes.join(' ')).toMatch(/ETH is not used/)
  })

  it('fiat vs USD trades the fiat; a lone non-cash FROM is traded as before', () => {
    expect(tradedPair('USD', 'EUR')).toMatchObject({ traded: 'EUR', direction: 'buy' })
    expect(tradedPair('EUR', 'USDT')).toMatchObject({ traded: 'EUR', direction: 'sell' })
    expect(tradedPair('SOL', '')).toEqual({ traded: 'SOL', counter: 'USD', direction: 'buy' })
  })

  it('refuses cash-only flows instead of asking the engine for USDUSDT', () => {
    expect(tradedPair('USD', 'USDT')).toHaveProperty('error')
    expect(tradedPair('USD', '')).toHaveProperty('error')
    expect(tradedPair('', '')).toHaveProperty('error')
    expect(tradedPair('BTC', 'btc')).toHaveProperty('error')
    const r = toServerStrategy({ ...base, assetFrom: 'USD', assetTo: '', conditions: rsi })
    expect(!r.ok && r.errors.join(' ')).toMatch(/USD is cash/)
  })

  it('ranks cash', () => {
    expect([cashRank('usdc'), cashRank('EUR'), cashRank('BTC'), cashRank(undefined)]).toEqual([2, 1, 0, 0])
  })
})

describe('toSimulatedConditions — the Monte Carlo engine only models price', () => {
  it('keeps price-vs-number rules on the traded asset', () => {
    const r = toSimulatedConditions([{ indicator: 'PRICE', operator: 'gt', value: 80000 }], 'BTC', '1D')
    expect(r).toEqual({ conditions: [{ datasource: 'price', asset: 'BTC', operator: 'gt', value: 80000, timeframe: '1D' }], skipped: [] })
  })

  it('skips an RSI rule instead of turning it into "price < 30", and never invents 50000', () => {
    const r = toSimulatedConditions([
      { indicator: 'RSI', operator: 'lt', value: 30 },
      { indicator: 'PRICE', operator: 'lt', valueType: 'indicator', value: 0, valueIndicator: 'SMA' },
    ], 'BTC', '1D')
    expect(r.conditions).toEqual([])
    expect(r.skipped).toHaveLength(2)
    expect(r.skipped[0]).toMatch(/Rule 1 \(RSI\)/)
  })
})
