import { describe, expect, it } from 'vitest'
import type { Prediction } from '~/stores/predictions'
import {
  apiDecimal, isPredictionSyncable, predictionFromApi, predictionSyncSignature, predictionToApi, predictionTargetTs,
} from '~/utils/predictionSync'
import { trimPayload } from '~/composables/useTracking'

const NOW = Date.UTC(2026, 9, 20, 12)
const call = (over: Partial<Prediction> = {}): Prediction => ({
  id: 'pred_1792_abc12', userId: 'current_user', assetId: 'BTC', assetName: 'Bitcoin',
  timestamp: new Date(NOW).toISOString(), currentPrice: 60123.123456789123, predictedPrice: 63000.5,
  predictedChangePct: 4.78, direction: 'bullish', timeframe: '1W',
  targetDate: new Date(NOW + 168 * 3_600_000).toISOString(), targetTs: NOW + 168 * 3_600_000,
  confidence: 3, note: '', status: 'pending', rangeMin: 55000, rangeMax: 66000, rangePosition: 0.4,
  sawFriendsFirst: true, friendsCountAtRecord: 2, source: 'card', chartStyle: 'candle', ...over,
})

describe('apiDecimal', () => {
  it('keeps at most 10 decimals and drops trailing zeros', () => {
    expect(apiDecimal(60123.123456789123)).toBe('60123.1234567891')
    expect(apiDecimal(0.43)).toBe('0.43')
    expect(apiDecimal(100)).toBe('100')
  })
  it('rejects non-positive and non-numbers', () => {
    expect(apiDecimal(0)).toBeNull()
    expect(apiDecimal(-1)).toBeNull()
    expect(apiDecimal('x')).toBeNull()
    expect(apiDecimal(Number.NaN)).toBeNull()
  })
})

describe('isPredictionSyncable', () => {
  it('only the user\'s own pending, non-demo calls still ahead', () => {
    expect(isPredictionSyncable(call(), NOW)).toBe(true)
    expect(isPredictionSyncable(call({ demo: true }), NOW)).toBe(false)
    expect(isPredictionSyncable(call({ userId: 'kevin_scalper' }), NOW)).toBe(false)
    expect(isPredictionSyncable(call({ status: 'accurate' }), NOW)).toBe(false)
    expect(isPredictionSyncable(call({ timeframe: '5Y' }), NOW)).toBe(false)
    expect(isPredictionSyncable(call({ targetTs: NOW + 60_000 }), NOW)).toBe(false)
  })
})

describe('predictionToApi', () => {
  it('maps the store shape onto the API contract', () => {
    const b = predictionToApi(call())
    expect(b).toMatchObject({
      client_id: 'pred_1792_abc12', asset_symbol: 'BTC', timeframe: '1W', client_price: '60123.1234567891',
      predicted_price: '63000.5', range_min: '55000', range_max: '66000', range_position: 0.4,
      saw_friends_first: true, friends_count_at_record: 2, source: 'card', chart_style: 'candle',
    })
    expect(b.target_at).toBe(new Date(NOW + 168 * 3_600_000).toISOString())
  })
  it('drops an inverted range and clamps the rest', () => {
    const b = predictionToApi(call({ rangeMin: 70000, rangeMax: 60000, rangePosition: 3, confidence: 9, note: 'x'.repeat(400) }))
    expect(b.range_min).toBeUndefined()
    expect(b.range_position).toBe(1)
    expect(b.confidence).toBe(5)
    expect((b.note as string).length).toBe(280)
  })
})

describe('signature and round trip', () => {
  it('changes when the point moves, not when unrelated fields change', () => {
    const a = call()
    expect(predictionSyncSignature(a)).toBe(predictionSyncSignature({ ...a, chartStyle: 'line' }))
    expect(predictionSyncSignature(a)).not.toBe(predictionSyncSignature({ ...a, predictedPrice: 64000 }))
    expect(predictionSyncSignature(a)).not.toBe(predictionSyncSignature({ ...a, targetTs: a.targetTs! + 3_600_000 }))
  })
  it('a call pulled back from the server has the signature of what was sent', () => {
    const a = call()
    const server = {
      id: 'uuid', client_id: a.id, asset_symbol: 'BTC', asset_type: 'cryptocurrency', timeframe: '1W',
      made_at: a.timestamp, target_at: new Date(a.targetTs!).toISOString(), horizon_hours: 168, reference_price: 60123,
      predicted_price: 63000.5, predicted_change_pct: 4.78, direction: 'bullish' as const, confidence: 3, note: '',
      range_min: 55000, range_max: 66000, range_position: 0.4, saw_friends_first: true, status: 'pending',
      resolved_price: null, score: null, revision_count: 0,
    }
    expect(predictionSyncSignature(predictionFromApi(server))).toBe(predictionSyncSignature(a))
  })
})

describe('predictionTargetTs', () => {
  it('falls back from targetTs to targetDate to timestamp + horizon', () => {
    expect(predictionTargetTs({ targetTs: 5, targetDate: '', timestamp: '', timeframe: '1D' })).toBe(5)
    expect(predictionTargetTs({ targetDate: '2026-10-21T00:00:00.000Z', timestamp: '', timeframe: '1D' })).toBe(Date.parse('2026-10-21T00:00:00.000Z'))
    expect(predictionTargetTs({ targetDate: 'bad', timestamp: new Date(NOW).toISOString(), timeframe: '1D' })).toBe(NOW + 24 * 3_600_000)
  })
})

describe('trimPayload', () => {
  it('keeps small payloads as plain JSON', () => {
    expect(trimPayload({ a: 1, b: 'x', c: [1, 2] })).toEqual({ a: 1, b: 'x', c: [1, 2] })
  })
  it('drops bulky fields but keeps scalars when over budget', () => {
    const out = trimPayload({ id: 'BTC', n: 3, big: Array.from({ length: 500 }, (_, i) => i), long: 'y'.repeat(5000) })
    expect(out).toMatchObject({ _trimmed: true, id: 'BTC', n: 3 })
    expect(out.big).toBeUndefined()
    expect((out.long as string).length).toBe(120)
  })
  it('survives circular payloads', () => {
    const o: Record<string, unknown> = {}
    o.self = o
    expect(trimPayload(o)).toEqual({ _unserialisable: true })
  })
})
