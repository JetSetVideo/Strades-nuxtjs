import { describe, expect, it } from 'vitest'
import { MONEY_COMPACT_FROM, drillable, findPath, fmtMoneyKpi, formatValue, headline, signTone, sumInputs, usedBy, type ValueNode } from '~/utils/valueTree'

const equity: ValueNode = {
  id: 'wallet.equity', label: 'Equity', value: 25282.83, unit: 'usd', formula: 'Equity = Cash + Σ qty × mark',
  inputs: [
    { id: 'wallet.equity.cash', label: 'Cash', value: 15097.33, unit: 'usd', settings: [{ key: 'starting_capital', label: 'Paper capital', value: '$10,000' }] },
    { id: 'wallet.equity.positions', label: 'Positions at mark', value: 10185.5, unit: 'usd',
      inputs: [{ id: 'wallet.equity.positions.btc', label: 'BTC', value: 10185.5, unit: 'usd', settings: [{ key: 'fee_bps', label: 'Fee', value: '10 bps' }] }] },
  ],
}

describe('value tree', () => {
  it('formats with one convention: sign before currency, U+2212, zero unsigned', () => {
    expect(formatValue(-1234.5, 'usd')).toBe('−$1,234.50')
    expect(formatValue(12, 'usd', true)).toBe('+$12.00')
    expect(formatValue(0.0123, 'frac')).toBe('1.2%')
    expect(formatValue(0.0042, 'frac')).toBe('0.42%')
    expect(formatValue(-0, 'pct')).toBe('0.0%')
    expect(formatValue(10, 'bps')).toBe('10 bps')
    expect(formatValue(null, 'usd')).toBe('—')
    expect(formatValue(Number.NaN, 'usd')).toBe('—')
  })

  it('money: one precision for KPI tiles and trees — 2 dp below $1M, compact from $1M', () => {
    expect(MONEY_COMPACT_FROM).toBe(1_000_000)
    expect(fmtMoneyKpi(9756.84)).toBe('$9,756.84')
    expect(fmtMoneyKpi(9757)).toBe('$9,757.00')
    expect(fmtMoneyKpi(-9, { signed: true })).toBe('−$9.00')
    expect(fmtMoneyKpi(2, { signed: true })).toBe('+$2.00')
    expect(fmtMoneyKpi(0, { signed: true })).toBe('$0.00')
    expect(fmtMoneyKpi(-0.004, { signed: true })).toBe('$0.00') // never "−$0.00" / "$-0"
    expect(fmtMoneyKpi(999_999.99)).toBe('$999,999.99')
    expect(fmtMoneyKpi(999_999.996)).toBe('$1.0M')
    expect(fmtMoneyKpi(1_234_567)).toBe('$1.2M')
    expect(fmtMoneyKpi(-3_400_000_000, { signed: true })).toBe('−$3.4B')
    expect(fmtMoneyKpi(null)).toBe('—')
    expect(formatValue(1_234_567, 'usd')).toBe(fmtMoneyKpi(1_234_567))
    expect(signTone(-9)).toBe('negative')
    expect(signTone(2)).toBe('positive')
    expect(signTone(-0.004)).toBe('neutral')
    expect(signTone(null)).toBe('neutral')
  })

  it('keeps zero and unknown drillable with a reason', () => {
    const zero: ValueNode = { id: 'z', label: 'Fees paid', value: 0, unit: 'usd', status: 'empty', reason: 'No trades yet', formula: 'Σ fees' }
    expect(headline(zero)).toEqual({ text: '$0.00', muted: 'No trades yet' })
    expect(drillable(zero)).toBe(true)
    const unknown: ValueNode = { id: 'u', label: 'Sharpe', value: null, unit: 'ratio', reason: 'needs a daily equity history', settings: [{ key: 'risk_free_rate_pct', label: 'Risk-free', value: '0 %' }] }
    expect(headline(unknown)).toEqual({ text: '—', muted: 'needs a daily equity history' })
    expect(drillable(unknown)).toBe(true)
    expect(drillable({ id: 'x', label: 'x', value: 1, unit: 'count' })).toBe(false)
  })

  it('finds a deep-link path and builds the reverse "used by" index', () => {
    expect(findPath(equity, 'wallet.equity.positions.btc').map(n => n.id)).toEqual(['wallet.equity', 'wallet.equity.positions', 'wallet.equity.positions.btc'])
    expect(findPath(equity, 'nope')).toEqual([])
    expect(usedBy([equity])).toEqual({ starting_capital: ['Cash'], fee_bps: ['BTC'] })
    expect(sumInputs(equity)).toBeCloseTo(25282.83, 2)
    expect(sumInputs({ ...equity, inputs: [...equity.inputs!, { id: 'n', label: 'n', value: null, unit: 'usd' }] })).toBeNull()
  })
})
