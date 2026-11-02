/**
 * Risk page figures as pure functions (swarm 2026-10-30b, board-finance F3–F5, board-data P0 #1/#2;
 * wave 5 lane risk-tree: VaR follows the user's primary values).
 *
 * Inputs: the account's class weights (% of its own book, utils/ownBook.ts), an annual volatility
 * per class, and the Settings primary values (var_confidence, var_horizon_days, annualisation_days,
 * alert_drawdown_pct). Each formula says which correlation it assumes:
 *   Portfolio vol   = Σ wᵢσᵢ                                  (ρ = 1: classes move together, an upper bound)
 *   σᵢ,1d           = σᵢ / √(days per year)                    (annualisation_days: 252 or 365)
 *   VaR (ρ = 0)     = z(conf) · √h · √Σ (wᵢ · σᵢ,1d · V)²       (classes independent, the page's figure)
 *   VaR (ρ = 1)     = z(conf) · √h · Σ wᵢ · σᵢ,1d · V           (shown next to it as the other bound)
 *   Risk budget used = VaR ÷ (V · alert_drawdown_pct %)        (in %; unknown when V = 0)
 * Square-root-of-time: an h-day σ is the 1-day σ × √h (assumes independent, identically distributed
 * daily returns with no drift).
 */
import type { AllocationPie } from '~/types/allocation'
import { fmtMoneyKpi } from '~/utils/valueTree'
import { fmtNumber, fmtPctFromPercent } from '~/utils/format'

export const RISK_CLASSES = ['fiat', 'crypto', 'stocks', 'commodities'] as const
export type RiskClass = typeof RISK_CLASSES[number]

// ─── VaR parameters (Settings → Risk budget / Display) ──────────────────────
export type VarConfidence = 90 | 95 | 99
/** One-sided normal quantiles, 4 dp. */
export const VAR_Z: Record<VarConfidence, number> = { 90: 1.2816, 95: 1.6449, 99: 2.3263 }
export const VAR_HORIZON_MIN = 1
export const VAR_HORIZON_MAX = 30

/**
 * Used when the user's settings are not read (signed out, loading, failed). Same values as the
 * server defaults (Strades-backend apps/users/primary.py: var_confidence 95, var_horizon_days 1,
 * annualisation_days 365, alert_drawdown_pct 10).
 */
export const VAR_DEFAULTS = { confidence: 95 as VarConfidence, horizonDays: 1, annualisationDays: 365 as 252 | 365, alertDrawdownPct: 10 }

export const SQRT_TIME_NOTE = 'Square-root-of-time: an h-day σ is the 1-day σ × √h (assumes independent daily returns, no drift).'

export interface VarParams {
  confidence: VarConfidence
  horizonDays: number
  annualisationDays: 252 | 365
  alertDrawdownPct: number
  /** False when the built-in defaults are used (settings not read). */
  fromSettings: boolean
}

/** z for a confidence; anything outside 90/95/99 falls back to 95. */
export function zFor(confidence: unknown): number {
  return VAR_Z[toConfidence(confidence)]
}

function toConfidence(v: unknown): VarConfidence {
  const n = Number(v)
  return n === 90 || n === 95 || n === 99 ? n : VAR_DEFAULTS.confidence
}

/** Whole days clamped to 1–30 (the server's range); junk → 1. */
export function toHorizonDays(v: unknown): number {
  const n = Math.round(Number(v))
  if (!Number.isFinite(n)) return VAR_DEFAULTS.horizonDays
  return Math.min(VAR_HORIZON_MAX, Math.max(VAR_HORIZON_MIN, n))
}

/** √h (square-root-of-time scaling of a 1-day σ). */
export function horizonScale(days: unknown): number {
  return Math.sqrt(toHorizonDays(days))
}

/**
 * The VaR parameters from the primary values (value, else the server default, else the built-in
 * default). `loaded` false → the built-in defaults, flagged `fromSettings: false`.
 */
export function varParams(
  values: Record<string, unknown> = {},
  defaults: Record<string, unknown> = {},
  loaded = true,
): VarParams {
  if (!loaded) return { ...VAR_DEFAULTS, fromSettings: false }
  const pick = (k: string) => (values[k] === null || values[k] === undefined ? defaults[k] : values[k])
  const days = Number(pick('annualisation_days'))
  const dd = Number(pick('alert_drawdown_pct'))
  return {
    confidence: toConfidence(pick('var_confidence')),
    horizonDays: toHorizonDays(pick('var_horizon_days') ?? VAR_DEFAULTS.horizonDays),
    annualisationDays: days === 252 ? 252 : 365,
    alertDrawdownPct: Number.isFinite(dd) && dd > 0 ? dd : VAR_DEFAULTS.alertDrawdownPct,
    fromSettings: true,
  }
}

/** The KPI label: "VaR (99% · 5 d)". */
export function varLabel(p: Pick<VarParams, 'confidence' | 'horizonDays'>): string {
  return `VaR (${fmtPctFromPercent(p.confidence, { decimals: 0 })} · ${fmtNumber(p.horizonDays, { decimals: 0 })} d)`
}

// ─── Classes ──────────────────────────────────────────────────────────────
/** Used only when the macro state carries no per-class volatility. */
export const FALLBACK_CLASS_VOL: Record<RiskClass, number> = { fiat: 0.05, crypto: 0.7, stocks: 0.3, commodities: 0.35 }

export const RISK_BUDGET_NOTE = 'VaR as a share of the loss your drawdown alert allows (portfolio value × drawdown alert %).'
export const STRESS_PENDING_NOTE = 'Not computed: needs a strategy with an entry rule. The old run had none, never traded, and reported 0%.'
export const CLASS_VOL_NOTE = 'Class volatilities come from the bundled macro state, not measured from your own returns.'

export interface ClassRiskRow {
  class: RiskClass
  /** Weight in % of the book. */
  allocation: number
  /** Annual volatility as a fraction (0.7 = 70%). */
  volatility: number
  /** wᵢσᵢ · 100: the class's share of Portfolio vol (ρ = 1). */
  risk: number
}

export function classRiskRows(pie: AllocationPie, vol: Partial<Record<RiskClass, number>> | null | undefined): ClassRiskRow[] {
  return RISK_CLASSES.map(cls => {
    const allocation = Number(pie[cls]) || 0
    const v = vol?.[cls]
    const volatility = typeof v === 'number' && Number.isFinite(v) ? v : FALLBACK_CLASS_VOL[cls]
    return { class: cls, allocation, volatility, risk: (allocation / 100) * volatility * 100 }
  })
}

/** Σ wᵢσᵢ in % (annual). Assumes ρ = 1, so it is an upper bound on the true vol. */
export function portfolioVolPct(rows: ClassRiskRow[]): number {
  return rows.reduce((s, r) => s + (r.allocation / 100) * r.volatility, 0) * 100
}

export interface ClassExposure {
  class: RiskClass
  /** wᵢ · V in USD. */
  exposureUsd: number
  /** Annual σᵢ as a fraction. */
  volatility: number
  /** wᵢ · σᵢ,1d · V in USD (one-day, one-σ move of the class's exposure). */
  dailySigmaUsd: number
}

/** Each class's exposure in $ and its one-day σ in $. */
export function classExposures(value: number, rows: ClassRiskRow[], annualisationDays: number): ClassExposure[] {
  const v = Number(value) || 0
  const root = Math.sqrt(annualisationDays > 0 ? annualisationDays : VAR_DEFAULTS.annualisationDays)
  return rows.map(r => {
    const exposureUsd = (r.allocation / 100) * v
    return { class: r.class, exposureUsd, volatility: r.volatility, dailySigmaUsd: exposureUsd * r.volatility / root }
  })
}

/** VaR in the book's currency (cents), under ρ = 0 (independent) or ρ = 1 (together). */
export function valueAtRisk(
  value: number,
  rows: ClassRiskRow[],
  correlation: 0 | 1,
  p: Pick<VarParams, 'confidence' | 'horizonDays' | 'annualisationDays'> = VAR_DEFAULTS,
): number {
  const sigmas = classExposures(value, rows, p.annualisationDays).map(e => e.dailySigmaUsd)
  const daily = correlation === 0
    ? Math.sqrt(sigmas.reduce((s, d) => s + d * d, 0))
    : sigmas.reduce((s, d) => s + d, 0)
  const loss = daily * zFor(p.confidence) * horizonScale(p.horizonDays)
  return Math.round(loss * 100) / 100
}

/** VaR ÷ (V · drawdown %) in percent; null when the book is 0 / unknown or the alert is not positive. */
export function riskBudgetUsedPct(varUsd: number | null, value: number | null, alertDrawdownPct: number): number | null {
  if (varUsd === null || value === null || !Number.isFinite(varUsd) || !Number.isFinite(value)) return null
  const budget = value * (alertDrawdownPct / 100)
  if (!(budget > 0)) return null
  return (varUsd / budget) * 100
}

/** The one-line meaning under "Risk budget used". */
export function riskBudgetMeaning(usedPct: number | null, p: VarParams, value: number | null): string {
  const conf = fmtPctFromPercent(p.confidence, { decimals: 0 })
  const dd = fmtPctFromPercent(p.alertDrawdownPct, { decimals: p.alertDrawdownPct % 1 ? 1 : 0 })
  const alert = p.fromSettings ? `the ${dd} drawdown you set as your alert` : `the ${dd} default drawdown alert`
  if (usedPct === null) {
    return value === null
      ? `Not computed: your book is not read. It compares your VaR with ${alert}.`
      : `Not computed: your book is at ${fmtMoneyKpi(0)}, so there is no loss budget to measure against ${alert}.`
  }
  return `Your ${p.horizonDays}-day ${conf} VaR is ${fmtPctFromPercent(usedPct)} of ${alert}.`
}
