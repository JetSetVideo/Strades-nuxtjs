import { describe, expect, it } from 'vitest'
import { serverFrequency, toServerStrategy } from '~/utils/strategyServer'

const base = { name: 'Momentum', assetFrom: 'btc', assetTo: 'eth', frequency: '1D', allocation: 25 }

describe('toServerStrategy', () => {
  it('maps creator rules to the engine vocabulary, with an inverse exit', () => {
    const r = toServerStrategy({ ...base, variables: [{ key: 'stop_loss', value: '5' }],
      conditions: [{ indicator: 'PRICE', operator: 'crosses_up', valueType: 'indicator', value: 0, valueIndicator: 'SMA', valueIndicatorParam: 50 }] })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.payload.assets).toEqual({ entry: 'BTC', exit: 'ETH' })
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
