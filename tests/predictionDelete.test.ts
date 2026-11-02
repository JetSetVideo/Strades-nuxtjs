import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { usePredictionsStore, type Prediction } from '~/stores/predictions'

const DAY = 86_400_000
const call = (id: string, status: Prediction['status'], targetOffset: number) => ({
  id, assetId: 'btc', timestamp: new Date(Date.now() - DAY).toISOString(), predictedChangePct: 3, predictedPrice: 103,
  currentPrice: 100, timeframe: '1W', targetDate: new Date(Date.now() + targetOffset).toISOString(), status, confidence: 3, note: '',
}) as unknown as Prediction

describe('predictions store — deletePrediction is guarded by canWithdrawCall', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('withdraws a pending call whose target is still ahead', () => {
    const store = usePredictionsStore()
    store.predictions = [call('a', 'pending', DAY)]
    expect(store.deletePrediction('a')).toBe(true)
    expect(store.predictions).toHaveLength(0)
  })

  it('refuses resolved calls and pending calls past their target (they stay on record)', () => {
    const store = usePredictionsStore()
    store.predictions = [call('r', 'missed', -DAY), call('p', 'pending', -DAY)]
    expect(store.deletePrediction('r')).toBe(false)
    expect(store.deletePrediction('p')).toBe(false)
    expect(store.predictions.map(p => p.id)).toEqual(['r', 'p'])
  })

  it('unknown id is a no-op', () => {
    const store = usePredictionsStore()
    expect(store.deletePrediction('nope')).toBe(false)
  })
})
