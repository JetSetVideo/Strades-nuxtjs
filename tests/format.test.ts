import { describe, expect, it } from 'vitest'
import {
  DASH, MINUS, fmtCount, fmtDate, fmtDateTime, fmtDayTime, fmtMoney, fmtNumber, fmtPctFromFraction, fmtPctFromPercent,
  fmtProbability, fmtRelative, fmtShortDate, fmtSignedMoney, fmtSignedNumber, fmtStatValue, fmtTime, isNum, pctDecimals, toDate,
} from '~/utils/format'

const M = MINUS

describe('unknown values', () => {
  it('prints — for null, undefined, NaN and ±Infinity everywhere', () => {
    for (const v of [null, undefined, NaN, Infinity, -Infinity]) {
      expect(fmtNumber(v)).toBe(DASH)
      expect(fmtSignedNumber(v)).toBe(DASH)
      expect(fmtCount(v)).toBe(DASH)
      expect(fmtMoney(v)).toBe(DASH)
      expect(fmtSignedMoney(v, { compact: true })).toBe(DASH)
      expect(fmtPctFromFraction(v)).toBe(DASH)
      expect(fmtPctFromPercent(v)).toBe(DASH)
      expect(fmtProbability(v)).toBe(DASH)
    }
    expect(isNum(0)).toBe(true)
    expect(isNum('1' as unknown)).toBe(false)
  })
})

describe('fmtMoney', () => {
  it('puts the sign before the currency with a real minus', () => {
    expect(fmtMoney(-1234.56)).toBe(`${M}$1,234.56`)
    expect(fmtMoney(1234.56)).toBe('$1,234.56')
    expect(fmtSignedMoney(12)).toBe('+$12.00')
    expect(fmtSignedMoney(-9)).toBe(`${M}$9.00`)
    expect(fmtMoney(-9)).not.toContain('$-')
  })
  it('never prints a signed zero', () => {
    expect(fmtMoney(-0)).toBe('$0.00')
    expect(fmtSignedMoney(0)).toBe('$0.00')
    expect(fmtSignedMoney(-0.004)).toBe('$0.00')
    expect(fmtMoney(-0.4, { decimals: 0 })).toBe('$0')
  })
  it('compacts with lower-case k/M/B', () => {
    expect(fmtMoney(230_875, { compact: true })).toBe('$230.9k')
    expect(fmtMoney(-1_250_000, { compact: true })).toBe(`${M}$1.3M`)
    expect(fmtMoney(4_200_000_000, { compact: true })).toBe('$4.2B')
    expect(fmtMoney(999_960, { compact: true })).toBe('$1.0M')
    expect(fmtMoney(999.5, { compact: true })).toBe('$999.50')
    expect(fmtSignedMoney(9_000, { compact: true })).toBe('+$9.0k')
  })
  it('handles very large and very small values', () => {
    expect(fmtMoney(1e15)).toBe('$1,000,000,000,000,000.00')
    expect(fmtMoney(1e15, { compact: true })).toBe('$1,000.0T')
    expect(fmtMoney(0.000123)).toBe('$0.00')
    expect(fmtMoney(0.000123, { decimals: 6 })).toBe('$0.000123')
  })
  it('honours decimals and other currencies', () => {
    expect(fmtMoney(1234.5, { decimals: 0 })).toBe('$1,235')
    expect(fmtMoney(-5, { currency: 'EUR' })).toBe(`${M}€5.00`)
    expect(fmtMoney(5, { currency: 'chf' })).toBe('CHF\u00a05.00')
  })
})

describe('percent: the caller says fraction or percent', () => {
  it('fraction and percent inputs print the same text', () => {
    expect(fmtPctFromFraction(0.123)).toBe('12.3%')
    expect(fmtPctFromPercent(12.3)).toBe('12.3%')
    // the "0.4 %" win-rate bug: a fraction must go through fmtPctFromFraction
    expect(fmtPctFromFraction(0.4)).toBe('40.0%')
    expect(fmtPctFromPercent(0.4)).toBe('0.40%')
  })
  it('uses 1 dp, 2 dp only under 1 %', () => {
    expect(pctDecimals(5)).toBe(1)
    expect(pctDecimals(0.5)).toBe(2)
    expect(pctDecimals(0)).toBe(1)
    expect(fmtPctFromPercent(-0.42)).toBe(`${M}0.42%`)
    expect(fmtPctFromPercent(150)).toBe('150.0%')
    expect(fmtPctFromPercent(12345.6)).toBe('12,345.6%')
  })
  it('signs deltas and drops the sign at zero', () => {
    expect(fmtPctFromFraction(0.04, { signed: true })).toBe('+4.0%')
    expect(fmtPctFromFraction(-0.0121, { signed: true })).toBe(`${M}1.2%`)
    expect(fmtPctFromFraction(-0.0021, { signed: true })).toBe(`${M}0.21%`)
    expect(fmtPctFromPercent(-0, { signed: true })).toBe('0.0%')
    expect(fmtPctFromPercent(-0.001, { signed: true })).toBe('0.00%')
    expect(fmtPctFromPercent(3, { decimals: 0 })).toBe('3%')
  })
  it('prints probabilities at 0 dp', () => {
    expect(fmtProbability(0.634)).toBe('63%')
    expect(fmtProbability(1)).toBe('100%')
  })
})

describe('numbers and counts', () => {
  it('formats plain numbers with grouping and 2 dp by default', () => {
    expect(fmtNumber(1234.567)).toBe('1,234.57')
    expect(fmtNumber(-0.5)).toBe(`${M}0.50`)
    expect(fmtNumber(-0)).toBe('0.00')
    expect(fmtNumber(-0.001)).toBe('0.00')
    expect(fmtNumber(2.5, { decimals: 0 })).toBe('3')
    expect(fmtNumber(12_345, { compact: true })).toBe('12.3k')
  })
  it('signs deltas', () => {
    expect(fmtSignedNumber(1.5)).toBe('+1.50')
    expect(fmtSignedNumber(-1.5)).toBe(`${M}1.50`)
    expect(fmtSignedNumber(0)).toBe('0.00')
  })
  it('counts whole things', () => {
    expect(fmtCount(1234)).toBe('1,234')
    expect(fmtCount(1234.6)).toBe('1,235')
    expect(fmtCount(-0)).toBe('0')
    expect(fmtCount(1_123, { compact: true })).toBe('1.1k')
    expect(fmtCount(42, { compact: true })).toBe('42')
  })
})

describe('fmtStatValue (UIStat + UIKpiStrip share it)', () => {
  it('USD suffix becomes money with $ before the number', () => {
    expect(fmtStatValue(13, { suffix: 'USD', precision: 0, signed: true })).toEqual({ text: '+$13', suffix: '' })
    expect(fmtStatValue(-9, { suffix: 'USD', precision: 0, signed: true })).toEqual({ text: `${M}$9`, suffix: '' })
    expect(fmtStatValue(137_121.4, { suffix: 'USD' })).toEqual({ text: '$137,121.40', suffix: '' })   // cents below $1M
    expect(fmtStatValue(2_500_000, { suffix: 'USD' })).toEqual({ text: '$2.5M', suffix: '' })        // compact from $1M
    expect(fmtStatValue(12.4, { suffix: 'USD' })).toEqual({ text: '$12.40', suffix: '' })
  })
  it('% suffix uses the percent default and keeps the suffix', () => {
    expect(fmtStatValue(12.345, { suffix: '%' })).toEqual({ text: '12.3', suffix: '%' })
    expect(fmtStatValue(0.42, { suffix: '%' })).toEqual({ text: '0.42', suffix: '%' })
    expect(fmtStatValue(-3.2, { suffix: '%', precision: 2, signed: true })).toEqual({ text: `${M}3.20`, suffix: '%' })
  })
  it('plain numbers: integers bare, else 2 dp, 0 dp from 1,000', () => {
    expect(fmtStatValue(3)).toEqual({ text: '3', suffix: '' })
    expect(fmtStatValue(1.234)).toEqual({ text: '1.23', suffix: '' })
    expect(fmtStatValue(12_345.6)).toEqual({ text: '12,346', suffix: '' })
    expect(fmtStatValue(0.1234, { precision: 3 })).toEqual({ text: '0.123', suffix: '' })
    expect(fmtStatValue(5, { suffix: ' cr' })).toEqual({ text: '5', suffix: ' cr' })
  })
  it('strings pass through; unknown drops the suffix', () => {
    expect(fmtStatValue('3/5', { suffix: '%' })).toEqual({ text: '3/5', suffix: '%' })
    expect(fmtStatValue('—', { suffix: '%' })).toEqual({ text: '—', suffix: '' })
    expect(fmtStatValue(null, { suffix: 'USD' })).toEqual({ text: '—', suffix: '' })
    expect(fmtStatValue(NaN, { suffix: '%' })).toEqual({ text: '—', suffix: '' })
  })
})

describe('dates in English, UTC by default, 24-hour', () => {
  const t = '2026-11-06T15:41:00Z'
  it('formats date, time and both', () => {
    expect(fmtDate(t)).toBe('Nov 6, 2026')
    expect(fmtShortDate(t)).toBe('Nov 6')
    expect(fmtTime(t)).toBe('15:41')
    expect(fmtDateTime(t)).toBe('Nov 6, 2026, 15:41')
    expect(fmtDayTime(t)).toBe('Fri, Nov 6, 15:41')
  })
  it('never prints French month names', () => {
    expect(fmtDate('2026-01-03T12:00:00Z')).toBe('Jan 3, 2026')
    expect(fmtShortDate('2026-08-05T12:00:00Z')).toBe('Aug 5')
  })
  it('follows a given time zone', () => {
    expect(fmtTime(t, { timeZone: 'Europe/Paris' })).toBe('16:41')
    expect(fmtTime('2026-11-06T00:05:00Z')).toBe('00:05')
  })
  it('accepts Date, ISO string and epoch ms; bad input is —', () => {
    const ms = Date.parse(t)
    expect(fmtDate(new Date(ms))).toBe('Nov 6, 2026')
    expect(fmtDate(ms)).toBe('Nov 6, 2026')
    expect(fmtDate('not a date')).toBe(DASH)
    expect(fmtTime(null)).toBe(DASH)
    expect(fmtDayTime(undefined)).toBe(DASH)
    expect(fmtDate('')).toBe(DASH)
    expect(toDate(NaN)).toBeNull()
  })
  it('relative times', () => {
    const now = Date.parse(t)
    expect(fmtRelative(now - 20_000, now)).toBe('just now')
    expect(fmtRelative(now - 5 * 60_000, now)).toBe('5 min ago')
    expect(fmtRelative(now + 3 * 3_600_000, now)).toBe('in 3 h')
    expect(fmtRelative(now - 2 * 86_400_000, now)).toBe('2 d ago')
    expect(fmtRelative(now - 30 * 86_400_000, now)).toBe('Oct 7, 2026')
    expect(fmtRelative(null, now)).toBe(DASH)
  })
})
