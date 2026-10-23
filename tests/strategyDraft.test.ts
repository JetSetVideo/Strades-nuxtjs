import { describe, expect, it } from 'vitest'
import {
  patchFromParameters,
  sourceBasis,
  strategyParameters,
  suggestFromProfile,
  wheelModel,
  type DraftShape,
} from '~/utils/strategyDraft'

const empty: DraftShape = {
  name: 'Shift',
  description: '',
  category: 'crypto',
  assetFrom: 'BTC',
  assetTo: 'XAU',
  allocation: 40,
  frequency: '1D',
  dataSources: ['ds_price_ohlcv', 'ds_region_map'],
  pool: [
    { id: 'BTC', op: 'include' },
    { id: 'ETH', op: 'include' },
    { id: 'WTI', op: 'exclude' },
  ],
  variables: [{ key: 'stop_loss', value: '5' }],
  blocks: [
    { type: 'formula', id: 1, data: { op: 'exchange', left: 'BTC', right: 'XAU', into: '20' } },
  ],
  selectedProfiles: [],
  period: { start: '2024-01-01', end: '2024-06-01' },
}

describe('strategy draft', () => {
  it('classifies price, calendar, map, and combined sources', () => {
    expect(sourceBasis({ id: 'ds_price_ohlcv' })).toBe('price')
    expect(sourceBasis({ id: 'ds_econ_calendar', basis: 'calendar' })).toBe('calendar')
    expect(sourceBasis({ id: 'ds_geopolitical' })).toBe('map')
    expect(sourceBasis({ id: 'ds_lane_weather', tags: ['map', 'calendar'] })).toBe('both')
    expect(sourceBasis({ id: 'ds_social_sentiment', category: 'sentiment', tags: ['nlp'] })).toBe('signal')
  })

  it('keeps excluded assets out of the start ring and moves weight on the outer ring', () => {
    const wheel = wheelModel({ ...empty, wallet: null, sourceBases: ['price', 'map'] })
    expect(wheel.start.map(s => s.key)).toEqual(['crypto'])
    expect(wheel.end.some(s => s.key === 'commodities')).toBe(true)
    const cryptoStart = wheel.start.find(s => s.key === 'crypto')!.share
    const cryptoEnd = wheel.end.find(s => s.key === 'crypto')!.share
    expect(cryptoEnd).toBeLessThan(cryptoStart)
  })

  it('round-trips the same parameters through JSON', () => {
    const params = strategyParameters(empty, ['price', 'map'])
    const patch = patchFromParameters(params)
    expect(patch?.assetFrom).toBe('BTC')
    expect(patch?.pool).toEqual(empty.pool)
    expect(patch?.blocks?.[0]?.data.op).toBe('exchange')
    expect(patch?.dataSources).toEqual(empty.dataSources)
    expect(patch?.variables).toEqual([{ key: 'stop_loss', value: '5' }])
  })

  it('fills include, exclude, formulas, and sources from a profile', () => {
    const draft = suggestFromProfile({
      pie: { crypto: 70, stocks: 22, commodities: 6, fiat: 2 },
      swarm: { crypto: 20, stocks: 20, commodities: 40, fiat: 20 },
      periodS: 3600,
      bars: 90,
      now: Date.parse('2026-01-15T00:00:00Z'),
    })
    expect(draft.assetFrom).toBe('BTC')
    expect(draft.assetTo).toBe('XAU')
    expect(draft.pool?.some(p => p.id === 'USD' && p.op === 'exclude')).toBe(true)
    expect(draft.pool?.some(p => p.id === 'XAU' && p.op === 'include')).toBe(true)
    expect(draft.pool?.some(p => p.id === 'BTC' && p.op === 'include')).toBe(true)
    expect(draft.dataSources).toContain('ds_price_ohlcv')
    expect(draft.dataSources).toContain('ds_econ_calendar')
    expect(draft.blocks?.map(b => b.type)).toEqual(['condition', 'formula', 'formula', 'formula', 'action'])
    expect(draft.frequency).toBe('1h')
  })
})
