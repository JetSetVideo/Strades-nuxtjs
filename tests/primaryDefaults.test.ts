import { describe, expect, it } from 'vitest'
import { horizonDefaultNote, primaryNumber, resolveCallDefaults, resolveNewBotCapital, startingCapitalFrom } from '~/utils/primaryDefaults'
import { livePrice, quickBetBlock, quoteDecimals } from '~/utils/quickBet'

describe('primary values → form defaults (top-down)', () => {
  it('reads the user value, else the server default, as a number', () => {
    expect(primaryNumber('fee_bps', { fee_bps: 12 }, { fee_bps: 10 })).toBe(12)
    expect(primaryNumber('fee_bps', { fee_bps: null }, { fee_bps: 10 })).toBe(10)
    expect(primaryNumber('stop_loss_pct', {}, { stop_loss_pct: null })).toBeNull()
    expect(primaryNumber('benchmark', { benchmark: 'BTC' })).toBeNull()
    expect(primaryNumber('shorting', { shorting: false })).toBeNull()
  })

  it('call defaults: built-in 3 / 1W until the settings are read', () => {
    const d = resolveCallDefaults(false, { default_confidence: 5, default_horizon_days: 30 })
    expect(d).toMatchObject({ confidence: 3, confidenceSource: 'built-in', horizonId: '1W', horizonDays: null, horizonSource: 'built-in' })
    expect(horizonDefaultNote(d)).toBe('')
  })

  it('call defaults from Settings: confidence clamped 1–5, days → nearest horizon', () => {
    const d = resolveCallDefaults(true, { default_confidence: 5, default_horizon_days: 30 }, {})
    expect(d).toMatchObject({ confidence: 5, confidenceSource: 'settings', horizonId: '1M', horizonDays: 30, horizonSource: 'settings' })
    expect(resolveCallDefaults(true, { default_confidence: 9, default_horizon_days: 1 }).confidence).toBe(5)
    expect(resolveCallDefaults(true, { default_horizon_days: 1 }).horizonId).toBe('1D')
    expect(resolveCallDefaults(true, { default_horizon_days: 365 }).horizonId).toBe('1Y')
    expect(resolveCallDefaults(true, { default_horizon_days: 90 }).horizonId).toBe('3M')
    // the server default counts as the user's setting (it is what Settings shows)
    expect(resolveCallDefaults(true, {}, { default_confidence: 3, default_horizon_days: 7 })).toMatchObject({ horizonId: '1W', horizonSource: 'settings', confidenceSource: 'settings' })
    expect(horizonDefaultNote(resolveCallDefaults(true, { default_horizon_days: 10 }))).toBe('Your default call horizon is 10 days (Settings); 1W is the nearest horizon.')
  })

  it('new-bot capital: Settings when signed in, the local value otherwise', () => {
    expect(startingCapitalFrom(true, { starting_capital: 25000 }, { starting_capital: 10000 })).toBe(25000)
    expect(startingCapitalFrom(true, { starting_capital: null }, { starting_capital: 10000 })).toBe(10000)
    expect(startingCapitalFrom(false, { starting_capital: 25000 })).toBeNull()
    expect(startingCapitalFrom(true, { starting_capital: 5 })).toBeNull()
    expect(resolveNewBotCapital(1000, 25000)).toEqual({ value: 25000, source: 'settings' })
    expect(resolveNewBotCapital(1000, null)).toEqual({ value: 1000, source: 'local' })
  })
})

describe('QuickPaperBet price', () => {
  it('a usable quote or null — never an invented price', () => {
    expect(livePrice(80000)).toBe(80000)
    expect(livePrice('1.25')).toBe(1.25)
    expect(livePrice(0)).toBeNull()
    expect(livePrice(null)).toBeNull()
    expect(livePrice(undefined)).toBeNull()
    expect(livePrice('')).toBeNull()
    expect(livePrice(Number.NaN)).toBeNull()
  })

  it('no price (or a 0 % size) blocks the bet with a reason', () => {
    expect(quickBetBlock(null, 5)).toMatch(/No live price yet/)
    expect(quickBetBlock(80000, 0)).toMatch(/size/)
    expect(quickBetBlock(80000, 5)).toBe('')
  })

  it('quote decimals grow for sub-dollar assets', () => {
    expect(quoteDecimals(80000)).toBe(2)
    expect(quoteDecimals(0.5)).toBe(4)
    expect(quoteDecimals(0.000123)).toBe(6)
    expect(quoteDecimals(null)).toBe(2)
  })
})
