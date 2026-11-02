import { describe, expect, it } from 'vitest'
import { ownBookFrom } from '~/utils/ownBook'
import { classRiskRows, valueAtRisk, varParams, zFor, horizonScale } from '~/utils/riskBook'
import { BUDGET_FORMULA, VAR_FORMULA, portfolioValueTree, riskTrees } from '~/utils/riskTree'
import { drillable, findPath, headline, sumInputs } from '~/utils/valueTree'
import type { OwnBookRaw } from '~/utils/walletTree'

const VOL = { fiat: 0.05, crypto: 0.7, stocks: 0.3, commodities: 0.35 }
const SETTINGS = { var_confidence: 99, var_horizon_days: 5, annualisation_days: 365, alert_drawdown_pct: 10, starting_capital: 10000, fee_bps: 10 }

const diego: OwnBookRaw = {
  custody: [{ id: 'w1', cash_usd: '2000', allocated_usd: '500' }],
  botsByWallet: { w1: [{ alive: true, equity: 3000, open_positions: [{ symbol: 'ETH/USDT', qty: 1, mark: 3000 }] }] },
  portfolio: { cash_balance: '1000', holdings: [{ asset: { symbol: 'AAPL' }, current_value: 4000 }] },
}

function input(raw: OwnBookRaw | null, state: 'ready' | 'signed-out' | 'error' = 'ready', settings: Record<string, unknown> | null = SETTINGS) {
  const book = raw ? ownBookFrom(raw) : null
  const rows = classRiskRows(book?.pie ?? { fiat: 0, crypto: 0, stocks: 0, commodities: 0 }, VOL)
  const params = settings ? varParams(settings) : varParams({}, {}, false)
  return { state, raw, value: state === 'ready' && book ? book.total : null, rows, params, settings: settings ?? undefined }
}

describe('riskTree — /risk KPI value trees', () => {
  it('Portfolio Value reuses "Your paper": same total, inputs sum, /risk ids', () => {
    const t = portfolioValueTree(input(diego))
    expect(t.label).toBe('Portfolio Value')
    expect(t.value).toBeCloseTo(10000, 6)
    expect(sumInputs(t)).toBeCloseTo(10000, 6)
    expect(t.inputs!.every(i => i.id.startsWith('risk.value.'))).toBe(true)
  })

  it('VaR tree: label from settings, value = valueAtRisk, = z · √h · √Σ (class 1-day σ in $)²', () => {
    const inp = input(diego)
    const { var: v } = riskTrees(inp)
    expect(v.label).toBe('VaR (99% · 5 d)')
    expect(v.formula).toBe(VAR_FORMULA)
    expect(v.value).toBe(valueAtRisk(10000, inp.rows, 0, inp.params))
    const classes = v.inputs!.filter(i => /^risk\.var\.(fiat|crypto|stocks|commodities)$/.test(i.id))
    expect(classes).toHaveLength(4)
    // exposures (weight × value) sum to the book
    expect(classes.reduce((s, c) => s + (c.value as number), 0)).toBeCloseTo(10000, 6)
    const sigmas = classes.map(c => c.inputs!.find(i => i.id.endsWith('.sigma_1d'))!.value as number)
    const recomposed = zFor(99) * horizonScale(5) * Math.sqrt(sigmas.reduce((s, x) => s + x * x, 0))
    expect(v.value as number).toBeCloseTo(recomposed, 2)
    // each class carries its sample volatility
    const vol = findPath(v, 'risk.var.crypto.vol').at(-1)!
    expect(vol.value).toBe(0.7)
    expect(vol.source?.kind).toBe('sample')
    expect(v.settings!.map(s => s.key)).toEqual(['var_confidence', 'var_horizon_days', 'annualisation_days'])
    expect(v.settings!.map(s => s.value)).toEqual(['99%', '5 d', '365 d'])
    expect(findPath(v, 'risk.var.z').at(-1)!.value).toBe('2.3263')
    expect(findPath(v, 'risk.var.horizon').at(-1)!.value).toBe('2.2361')
  })

  it('Risk budget used = VaR ÷ (V × drawdown %), drills down to VaR, value and the drawdown setting', () => {
    const { var: v, budget } = riskTrees(input(diego))
    expect(budget.formula).toBe(BUDGET_FORMULA)
    expect(budget.value as number).toBeCloseTo(((v.value as number) / 1000) * 100, 9)
    expect(budget.inputs!.map(i => i.id)).toEqual(['risk.budget.var', 'risk.budget.value', 'risk.budget.drawdown'])
    expect(budget.inputs![0]!.value).toBe(v.value)
    expect(budget.inputs![1]!.value).toBeCloseTo(10000, 6)
    expect(budget.inputs![2]!.value).toBe(10)
    expect(findPath(budget, 'risk.budget.var.crypto.vol').map(n => n.id)).toEqual(['risk.budget', 'risk.budget.var', 'risk.budget.var.crypto', 'risk.budget.var.crypto.vol'])
    expect(budget.settings![0]).toMatchObject({ key: 'alert_drawdown_pct', value: '10%', href: '/settings#set-alert_drawdown_pct' })
    expect(budget.explain).toMatch(/^Your 5-day 99% VaR is \d+\.\d% of the 10% drawdown you set as your alert\. Loss budget: \$1,000\.00\.$/)
  })

  it('a zero book still opens: VaR $0.00, budget "—", formula + inputs + settings', () => {
    const { value, var: v, budget } = riskTrees(input({ custody: [], botsByWallet: {}, portfolio: null }))
    expect(headline(v).text).toBe('$0.00')
    expect(v.status).toBe('empty')
    expect(headline(budget).text).toBe('—')
    expect(budget.reason).toContain('$0.00')
    for (const n of [value, v, budget]) {
      expect(drillable(n)).toBe(true)
      expect(n.formula).toBeTruthy()
      expect(n.settings!.length).toBeGreaterThan(0)
      expect(n.inputs!.length).toBeGreaterThan(0)
    }
  })

  it('signed out: built-in defaults (95% · 1 d) marked "default", unknown values still open', () => {
    const { value, var: v, budget } = riskTrees(input(null, 'signed-out', null))
    expect(v.label).toBe('VaR (95% · 1 d)')
    expect(v.value).toBeNull()
    expect(headline(v).text).toBe('—')
    expect(v.settings!.map(s => s.value)).toEqual(['95% (default)', '1 d (default)', '365 d (default)'])
    expect(budget.settings![0]!.value).toBe('10% (default)')
    expect(v.explain).toContain('Default 95% · 1 d')
    for (const n of [value, v, budget]) {
      expect(n.value).toBeNull()
      expect(drillable(n)).toBe(true)
      expect(n.status).toBe('empty')
    }
    // class exposures unknown, volatilities still shown
    expect(v.inputs!.find(i => i.id === 'risk.var.crypto')!.value).toBeNull()
    expect(findPath(v, 'risk.var.crypto.vol').at(-1)!.value).toBe(0.7)
  })
})
