import { describe, expect, it } from 'vitest'
import {
  FALLBACK_CLASS_VOL,
  VAR_DEFAULTS,
  classExposures,
  classRiskRows,
  horizonScale,
  portfolioVolPct,
  riskBudgetMeaning,
  riskBudgetUsedPct,
  toHorizonDays,
  valueAtRisk,
  varLabel,
  varParams,
  zFor,
} from '~/utils/riskBook'

const D1_95_252 = { confidence: 95 as const, horizonDays: 1, annualisationDays: 252 as const }

describe('riskBook — Risk page figures', () => {
  it('reproduces board-finance R4: diego, 73.1% crypto at 80.75% vol, cash at 0 → 1-day 95% VaR ≈ $1,668.57 (√252)', () => {
    const rows = classRiskRows(
      { fiat: 26.9, crypto: 73.1, stocks: 0, commodities: 0 },
      { fiat: 0, crypto: 0.8075, stocks: 0.3, commodities: 0.35 },
    )
    // z = 1.6449 (4 dp table; the old 1.645 gave $1,668.67)
    expect(valueAtRisk(27280.33, rows, 0, D1_95_252)).toBeCloseTo(1668.57, 1)
    // One risky class: both correlation bounds agree.
    expect(valueAtRisk(27280.33, rows, 1, D1_95_252)).toBeCloseTo(1668.57, 1)
  })

  it('separates the ρ = 0 and ρ = 1 bounds on a two-class book (golden values)', () => {
    const rows = classRiskRows(
      { fiat: 0, crypto: 50, stocks: 50, commodities: 0 },
      { fiat: 0.05, crypto: 0.4, stocks: 0.4, commodities: 0.35 },
    )
    expect(valueAtRisk(10000, rows, 0, D1_95_252)).toBeCloseTo(293.08, 1)
    expect(valueAtRisk(10000, rows, 1, D1_95_252)).toBeCloseTo(414.48, 1)
    expect(portfolioVolPct(rows)).toBeCloseTo(40, 9)
    expect(rows.find(r => r.class === 'crypto')?.risk).toBeCloseTo(20, 9)
  })

  it('gives honest zeros for an empty book, with every class still listed', () => {
    const rows = classRiskRows({ fiat: 0, crypto: 0, stocks: 0, commodities: 0 }, null)
    expect(rows.map(r => r.class)).toEqual(['fiat', 'crypto', 'stocks', 'commodities'])
    expect(rows.every(r => r.allocation === 0 && r.risk === 0)).toBe(true)
    expect(portfolioVolPct(rows)).toBe(0)
    expect(valueAtRisk(0, rows, 0)).toBe(0)
  })

  it('falls back per class only when the macro vol is missing', () => {
    const rows = classRiskRows({ fiat: 100, crypto: 0, stocks: 0, commodities: 0 }, { crypto: 0.9 })
    expect(rows.find(r => r.class === 'crypto')?.volatility).toBe(0.9)
    expect(rows.find(r => r.class === 'fiat')?.volatility).toBe(FALLBACK_CLASS_VOL.fiat)
  })
})

describe('riskBook — VaR follows the primary values', () => {
  const rows = classRiskRows(
    { fiat: 20, crypto: 50, stocks: 30, commodities: 0 },
    { fiat: 0.05, crypto: 0.7, stocks: 0.3, commodities: 0.35 },
  )

  it('z table: 90 → 1.2816, 95 → 1.6449, 99 → 2.3263; anything else → 95', () => {
    expect(zFor(90)).toBe(1.2816)
    expect(zFor(95)).toBe(1.6449)
    expect(zFor(99)).toBe(2.3263)
    expect(zFor('99')).toBe(2.3263)
    expect(zFor(97)).toBe(1.6449)
    expect(zFor(null)).toBe(1.6449)
  })

  it('horizon: square-root-of-time on whole days clamped to 1–30', () => {
    expect(horizonScale(1)).toBe(1)
    expect(horizonScale(5)).toBeCloseTo(Math.sqrt(5), 12)
    expect(horizonScale('10')).toBeCloseTo(Math.sqrt(10), 12)
    expect(toHorizonDays(0)).toBe(1)
    expect(toHorizonDays(45)).toBe(30)
    expect(toHorizonDays('abc')).toBe(1)
  })

  it('VaR scales with z and √h, and with √(days per year)', () => {
    const base = valueAtRisk(10000, rows, 0, D1_95_252)
    const p99h5 = valueAtRisk(10000, rows, 0, { confidence: 99, horizonDays: 5, annualisationDays: 252 })
    expect(p99h5).toBeCloseTo(base * (2.3263 / 1.6449) * Math.sqrt(5), 1)
    const p90 = valueAtRisk(10000, rows, 0, { confidence: 90, horizonDays: 1, annualisationDays: 252 })
    expect(p90).toBeCloseTo(base * (1.2816 / 1.6449), 1)
    const d365 = valueAtRisk(10000, rows, 0, { confidence: 95, horizonDays: 1, annualisationDays: 365 })
    expect(d365).toBeCloseTo(base * Math.sqrt(252 / 365), 1)
  })

  it('VaR (ρ = 0) = z · √h · √Σ (1-day σ in $)² over the class exposures', () => {
    const exps = classExposures(10000, rows, 365)
    expect(exps.reduce((s, e) => s + e.exposureUsd, 0)).toBeCloseTo(10000, 9)
    const root = Math.sqrt(exps.reduce((s, e) => s + e.dailySigmaUsd ** 2, 0))
    expect(valueAtRisk(10000, rows, 0, { confidence: 99, horizonDays: 5, annualisationDays: 365 }))
      .toBeCloseTo(2.3263 * Math.sqrt(5) * root, 2)
  })

  it('params: value → server default → built-in; not loaded → 95 % / 1 d defaults, flagged', () => {
    const p = varParams(
      { var_confidence: 99, var_horizon_days: 5, annualisation_days: 252, alert_drawdown_pct: null },
      { var_confidence: 95, var_horizon_days: 1, annualisation_days: 365, alert_drawdown_pct: 10 },
    )
    expect(p).toEqual({ confidence: 99, horizonDays: 5, annualisationDays: 252, alertDrawdownPct: 10, fromSettings: true })
    const d = varParams({}, {}, false)
    expect(d).toEqual({ ...VAR_DEFAULTS, fromSettings: false })
    expect(varLabel(p)).toBe('VaR (99% · 5 d)')
    expect(varLabel(d)).toBe('VaR (95% · 1 d)')
  })

  it('risk budget used = VaR ÷ (V × drawdown %), unknown when V = 0', () => {
    expect(riskBudgetUsedPct(320, 10000, 10)).toBeCloseTo(32, 9)
    expect(riskBudgetUsedPct(1500, 10000, 10)).toBeCloseTo(150, 9)
    expect(riskBudgetUsedPct(0, 0, 10)).toBeNull()
    expect(riskBudgetUsedPct(null, 10000, 10)).toBeNull()
    expect(riskBudgetUsedPct(320, null, 10)).toBeNull()
  })

  it('one-line meaning names the horizon, the confidence and the alert', () => {
    const p = varParams({ var_confidence: 95, var_horizon_days: 1, alert_drawdown_pct: 10 })
    expect(riskBudgetMeaning(32, p, 10000)).toBe('Your 1-day 95% VaR is 32.0% of the 10% drawdown you set as your alert.')
    const d = varParams({}, {}, false)
    expect(riskBudgetMeaning(32, d, 10000)).toBe('Your 1-day 95% VaR is 32.0% of the 10% default drawdown alert.')
    expect(riskBudgetMeaning(null, p, 0)).toContain('$0.00')
    expect(riskBudgetMeaning(null, p, null)).toContain('not read')
  })
})
