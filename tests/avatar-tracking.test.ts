import { describe, expect, it } from 'vitest'
import { batchOutcome, trackingAllowed, trackingConsentOn, writeTrackingConsent, TRACKING_CONSENT_KEY } from '~/composables/useTracking'
import { trainingTickReward } from '~/stores/training'
import { STORAGE_UID_KEY } from '~/utils/userStorage'

function memStorage(init: Record<string, string> = {}) {
  const m = new Map(Object.entries(init))
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => { m.set(k, String(v)) },
    removeItem: (k: string) => { m.delete(k) },
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() { return m.size },
    _m: m,
  }
}

describe('tracking consent gate', () => {
  it('is on by default and off only when the user switched it off', () => {
    const s = memStorage()
    expect(trackingConsentOn(s)).toBe(true)
    writeTrackingConsent(false, s)
    expect(trackingConsentOn(s)).toBe(false)
    writeTrackingConsent(true, s)
    expect(trackingConsentOn(s)).toBe(true)
  })

  it('is stored per signed-in account (another account on this browser keeps its own choice)', () => {
    const s = memStorage({ [STORAGE_UID_KEY]: 'u1' })
    writeTrackingConsent(false, s)
    expect(s._m.get(`${TRACKING_CONSENT_KEY}::u:u1`)).toBe('0')
    s.setItem(STORAGE_UID_KEY, 'u2')
    expect(trackingConsentOn(s)).toBe(true)
  })

  it('sends nothing unless client + signed in + consent', () => {
    expect(trackingAllowed({ client: true, authed: true, consent: true })).toBe(true)
    expect(trackingAllowed({ client: true, authed: true, consent: false })).toBe(false)
    expect(trackingAllowed({ client: true, authed: false, consent: true })).toBe(false)
    expect(trackingAllowed({ client: false, authed: true, consent: true })).toBe(false)
  })
})

describe('batch outcome (server keeps valid events, reports rejected)', () => {
  it('reads {accepted, rejected:[{index, reason}]}', () => {
    expect(batchOutcome({ accepted: 2, rejected: [{ index: 1, reason: 'payload: bad type' }] }))
      .toEqual({ accepted: 2, rejected: 1, reasons: ['payload: bad type'] })
  })
  it('works with an older server (no rejected) and with junk', () => {
    expect(batchOutcome({ accepted: 3 })).toEqual({ accepted: 3, rejected: 0, reasons: [] })
    expect(batchOutcome(null)).toEqual({ accepted: 0, rejected: 0, reasons: [] })
    expect(batchOutcome('<html>')).toEqual({ accepted: 0, rejected: 0, reasons: [] })
  })
})

describe('training tick reward (no Math.random)', () => {
  it('is undefined without a scored call, so the EMA is untouched and the UI shows —', () => {
    expect(trainingTickReward([{ type: 'asset_click', payload: {} }])).toBeUndefined()
    expect(trainingTickReward([])).toBeUndefined()
  })
  it('is the hit rate of scored calls mapped to ±0.02, identical on every run', () => {
    const evs = [
      { type: 'prediction_triggered' as const, payload: { hit: true } },
      { type: 'prediction_triggered' as const, payload: { hit: false } },
      { type: 'prediction_triggered' as const, payload: { hit: true } },
      { type: 'asset_click' as const, payload: {} },
    ]
    const a = trainingTickReward(evs)
    expect(a).toBeCloseTo(0.006667, 6)
    expect(trainingTickReward(evs)).toBe(a)
    expect(trainingTickReward([{ type: 'prediction_triggered', payload: { hit: false } }])).toBe(-0.02)
  })
})
