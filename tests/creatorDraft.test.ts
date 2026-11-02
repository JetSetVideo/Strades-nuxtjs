import { describe, expect, it } from 'vitest'
import { creatorConditionFromServer, draftFromCreatorCode, draftFromServer } from '~/utils/creatorDraft'
import { toServerStrategy } from '~/utils/strategyServer'

describe('reopen a strategy in the Creator (/creator?id=)', () => {
  it('restores the creator payload exactly', () => {
    const code = {
      assets: { from: 'USD', to: 'BTC', allocation: 25 },
      period: { start: '2025-01-01', end: '2025-12-31' },
      frequency: '4h',
      dataSources: ['binance_ohlcv'],
      conditions: [{ indicator: 'RSI', operator: 'lt', value: 30 }],
      actions: [{ kind: 'buy' }],
      formulas: [],
      pool: [{ id: 'BTC', op: 'include' }],
      variables: { stop_loss: '5' },
      profiles: ['p1'],
    }
    const d = draftFromCreatorCode({ name: 'RSI dip', category: 'technical' }, code, 100)
    expect(d).toMatchObject({
      name: 'RSI dip', category: 'technical', assetFrom: 'USD', assetTo: 'BTC', allocation: 25, frequency: '4h',
      dataSources: ['binance_ohlcv'], variables: [{ key: 'stop_loss', value: '5' }], selectedProfiles: ['p1'],
      period: { start: '2025-01-01', end: '2025-12-31' },
    })
    expect(d.blocks.map(b => [b.type, b.id])).toEqual([['condition', 100], ['action', 101]])
    expect(d.blocks[0]!.data).toEqual({ indicator: 'RSI', operator: 'lt', value: 30 })
  })

  it('maps engine conditions back to creator blocks', () => {
    expect(creatorConditionFromServer({ indicator: 'rsi', period: 7, operator: '<', value: 30, timeframe: '1D', side: 'entry' }))
      .toEqual({ indicator: 'RSI', indicatorParam: 7, operator: 'lt', value: 30, valueType: 'static', timeframe: '1D' })
    expect(creatorConditionFromServer({ indicator: 'price', operator: 'cross_over', value: 'sma:50' }))
      .toMatchObject({ indicator: 'PRICE', operator: 'crosses_up', valueType: 'indicator', valueIndicator: 'SMA', valueIndicatorParam: 50 })
    expect(creatorConditionFromServer({ indicator: 'rsi', operator: '!=' })).toBeNull()
  })

  it('round-trips a USD → BTC strategy through the server shape', () => {
    const r = toServerStrategy({ name: 'RSI dip', assetFrom: 'USD', assetTo: 'BTC', frequency: '1D', allocation: 20,
      variables: [{ key: 'stop_loss', value: '5' }], conditions: [{ indicator: 'RSI', operator: 'lt', value: 30 }] })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const p = r.payload
    const d = draftFromServer({ name: p.name, category: p.category, assets_entry: p.assets.entry, assets_exit: p.assets.exit,
      frequency: p.frequency, conditions: p.conditions, parameters: p.parameters }, 1)
    expect(d).toMatchObject({ assetFrom: 'USD', assetTo: 'BTC', allocation: 20, frequency: '1D', variables: [{ key: 'stop_loss', value: '5' }] })
    // Only the entry rule comes back (the exit is its generated negation).
    expect(d.blocks).toHaveLength(1)
    expect(d.blocks[0]!.data).toMatchObject({ indicator: 'RSI', operator: 'lt', value: 30, indicatorParam: 14 })
  })
})
