/**
 * Value trees for the /risk KPIs (wave 5 lane risk-tree). Each KPI opens top-down:
 *   Portfolio Value  -> "Your paper" (utils/walletTree.ts ownPaperTree, same total as the KPI)
 *   VaR (conf · h)   -> z(conf), √h, each class's exposure in $ (weight × value) with its volatility
 *                       and its 1-day σ in $ -> var_confidence, var_horizon_days, annualisation_days
 *   Risk budget used -> VaR, portfolio value, drawdown alert -> alert_drawdown_pct
 * Zero and unknown still open (formula + inputs + settings). Pure: no Nuxt, no store.
 * Math lives in utils/riskBook.ts; money through fmtMoneyKpi, percent/number through utils/format.ts.
 */
import {
  RISK_CLASSES,
  SQRT_TIME_NOTE,
  VAR_Z,
  classExposures,
  horizonScale,
  riskBudgetMeaning,
  riskBudgetUsedPct,
  valueAtRisk,
  varLabel,
  zFor,
  type ClassRiskRow,
  type RiskClass,
  type VarParams,
} from '~/utils/riskBook'
import { ownPaperTree, type OwnBookLoadState, type OwnBookRaw } from '~/utils/walletTree'
import { fmtMoneyKpi, type ValueNode, type ValueSetting, type ValueStatus } from '~/utils/valueTree'
import { fmtNumber, fmtPctFromFraction, fmtPctFromPercent } from '~/utils/format'

type Primary = Record<string, unknown>

export const VAR_FORMULA = 'VaR = z(conf) × √h × √Σ (wᵢ · σᵢ,1d · V)²   [ρ = 0]   with σᵢ,1d = σᵢ ÷ √(days per year)'
export const BUDGET_FORMULA = 'Risk budget used = VaR ÷ (Portfolio value × drawdown alert %)'
export const DEFAULT_VOL_SOURCE = 'bundled macro state · volatility_by_class'

const CLASS_LABEL: Record<RiskClass, string> = { fiat: 'Fiat / cash', crypto: 'Crypto', stocks: 'Stocks', commodities: 'Commodities' }

const BOOK = { kind: 'computed' as const, name: 'utils/ownBook.ts · your own book (same total as Portfolio Value)' }
const RISK = { kind: 'computed' as const, name: 'utils/riskBook.ts' }

/** Rename a tree's ids (and its descendants') so the same subtree can sit under another KPI. */
export function reId(node: ValueNode, from: string, to: string): ValueNode {
  const id = node.id.startsWith(from) ? to + node.id.slice(from.length) : `${to}.${node.id}`
  return { ...node, id, ...(node.inputs ? { inputs: node.inputs.map(c => reId(c, from, to)) } : {}) }
}

const dflt = (p: VarParams) => (p.fromSettings ? '' : ' (default)')

/** The settings that drive VaR, as tree links (/settings#set-<key>). */
export function varSettings(p: VarParams): ValueSetting[] {
  return [
    { key: 'var_confidence', label: 'VaR confidence', value: `${fmtPctFromPercent(p.confidence, { decimals: 0 })}${dflt(p)}`, href: '/settings#set-var_confidence' },
    { key: 'var_horizon_days', label: 'VaR horizon', value: `${fmtNumber(p.horizonDays, { decimals: 0 })} d${dflt(p)}`, href: '/settings#set-var_horizon_days' },
    { key: 'annualisation_days', label: 'Days per year', value: `${fmtNumber(p.annualisationDays, { decimals: 0 })} d${dflt(p)}`, href: '/settings#set-annualisation_days' },
  ]
}

export function drawdownSetting(p: VarParams): ValueSetting {
  const d = p.alertDrawdownPct % 1 ? 1 : 0
  return { key: 'alert_drawdown_pct', label: 'Drawdown alert', value: `${fmtPctFromPercent(p.alertDrawdownPct, { decimals: d })}${dflt(p)}`, href: '/settings#set-alert_drawdown_pct' }
}

/** Status + reason of a KPI whose book is not ready. */
function notReady(state: OwnBookLoadState): { status: ValueStatus; reason: string } {
  if (state === 'loading') return { status: 'loading', reason: 'Reading your wallets…' }
  if (state === 'signed-out') return { status: 'empty', reason: 'Sign in to read your own book.' }
  return { status: 'error', reason: 'Your wallets could not be read right now.' }
}

export interface RiskTreeInput {
  state: OwnBookLoadState
  raw: OwnBookRaw | null
  /** Book total when ready (utils/ownBook.ts), else null. */
  value: number | null
  rows: ClassRiskRow[]
  params: VarParams
  /** Where the class volatilities come from (shown on each class). */
  volSource?: string
  settings?: Primary
  settingsDefaults?: Primary
}

/** Portfolio Value = "Your paper" (walletTree), under /risk ids. */
export function portfolioValueTree(input: Pick<RiskTreeInput, 'state' | 'raw' | 'settings' | 'settingsDefaults'>): ValueNode {
  const paper = ownPaperTree({ state: input.state, raw: input.raw, settings: input.settings, settingsDefaults: input.settingsDefaults })
  return { ...reId(paper, 'wallet.paper', 'risk.value'), label: 'Portfolio Value' }
}

function classNode(row: ClassRiskRow, exp: { exposureUsd: number; dailySigmaUsd: number } | null, value: number | null, p: VarParams, volSource: string): ValueNode {
  const id = `risk.var.${row.class}`
  const known = exp !== null && value !== null
  const node: ValueNode = {
    id,
    label: `${CLASS_LABEL[row.class]} exposure`,
    value: known ? exp!.exposureUsd : null,
    unit: 'usd',
    formula: known
      ? `exposure = weight × value = ${fmtPctFromPercent(row.allocation)} × ${fmtMoneyKpi(value)} · 1-day σ = exposure × ${fmtPctFromFraction(row.volatility)} ÷ √${p.annualisationDays}`
      : 'exposure = weight × portfolio value · 1-day σ = exposure × annual σ ÷ √(days per year)',
    source: RISK,
    inputs: [
      { id: `${id}.weight`, label: 'Weight in your book', value: known ? row.allocation : null, unit: 'pct', source: BOOK },
      { id: `${id}.vol`, label: 'Annual volatility', value: row.volatility, unit: 'frac', source: { kind: 'sample', name: volSource } },
      {
        id: `${id}.sigma_1d`, label: '1-day σ in $', value: known ? exp!.dailySigmaUsd : null, unit: 'usd',
        formula: `exposure × annual σ ÷ √${p.annualisationDays}`, source: RISK,
        settings: [varSettings(p)[2]!],
      },
    ],
  }
  if (known && exp!.exposureUsd === 0) {
    node.status = 'empty'
    node.reason = 'Nothing of your book in this class.'
  } else if (!known) {
    node.reason = 'Not read yet: no book.'
  }
  return node
}

/** VaR (conf · h) as a value tree. Its value equals `valueAtRisk(V, rows, 0, params)`. */
export function varTree(input: RiskTreeInput): ValueNode {
  const p = input.params
  const ready = input.state === 'ready' && input.value !== null
  const v = ready ? input.value! : null
  const exps = v !== null ? classExposures(v, input.rows, p.annualisationDays) : null
  const z = zFor(p.confidence)
  const sqrtH = horizonScale(p.horizonDays)
  const varUsd = v !== null ? valueAtRisk(v, input.rows, 0, p) : null
  const together = v !== null ? valueAtRisk(v, input.rows, 1, p) : null
  const volSource = input.volSource || DEFAULT_VOL_SOURCE

  const inputs: ValueNode[] = [
    {
      id: 'risk.var.z', label: `z at ${fmtPctFromPercent(p.confidence, { decimals: 0 })} (one-sided)`,
      value: fmtNumber(z, { decimals: 4 }), unit: 'text',
      formula: `z(90%) = ${VAR_Z[90]} · z(95%) = ${VAR_Z[95]} · z(99%) = ${VAR_Z[99]} (normal quantiles)`,
      source: { kind: 'setting', name: 'var_confidence' },
      settings: [varSettings(p)[0]!],
    },
    {
      id: 'risk.var.horizon', label: `√h (h = ${fmtNumber(p.horizonDays, { decimals: 0 })} d)`,
      value: fmtNumber(sqrtH, { decimals: 4 }), unit: 'text',
      formula: SQRT_TIME_NOTE,
      source: { kind: 'setting', name: 'var_horizon_days' },
      settings: [varSettings(p)[1]!],
    },
    ...RISK_CLASSES.map((cls, i) => classNode(input.rows[i] ?? { class: cls, allocation: 0, volatility: 0, risk: 0 }, exps ? exps[i]! : null, v, p, volSource)),
  ]

  const explainParts = [
    'Classes assumed independent (ρ = 0).',
    together !== null ? `If they all moved together (ρ = 1): ${fmtMoneyKpi(together)}.` : '',
    'Volatilities are sample (bundled macro state), not measured from your own returns.',
    p.fromSettings ? '' : 'Default 95% · 1 d: sign in to use your own settings.',
  ]
  const node: ValueNode = {
    id: 'risk.var',
    label: varLabel(p),
    value: varUsd,
    unit: 'usd',
    formula: VAR_FORMULA,
    inputs,
    settings: varSettings(p),
    explain: explainParts.filter(Boolean).join(' '),
    source: RISK,
  }
  if (!ready) Object.assign(node, notReady(input.state))
  else if (varUsd === 0) {
    node.status = 'empty'
    node.reason = `Your book is at ${fmtMoneyKpi(0)}: nothing at risk.`
  }
  return node
}

/** Risk budget used as a value tree: VaR ÷ (V × drawdown alert %). */
export function riskBudgetTree(input: RiskTreeInput, var_?: ValueNode, value_?: ValueNode): ValueNode {
  const p = input.params
  const vNode = var_ ?? varTree(input)
  const pvNode = value_ ?? portfolioValueTree(input)
  const ready = input.state === 'ready' && input.value !== null
  const v = ready ? input.value! : null
  const varUsd = typeof vNode.value === 'number' ? vNode.value : null
  const used = riskBudgetUsedPct(varUsd, v, p.alertDrawdownPct)
  const meaning = riskBudgetMeaning(used, p, v)
  const lossBudget = v !== null ? v * (p.alertDrawdownPct / 100) : null

  const node: ValueNode = {
    id: 'risk.budget',
    label: 'Risk budget used',
    value: used,
    unit: 'pct',
    formula: BUDGET_FORMULA,
    inputs: [
      reId(vNode, 'risk.var', 'risk.budget.var'),
      { ...reId(pvNode, 'risk.value', 'risk.budget.value'), label: 'Portfolio value' },
      {
        id: 'risk.budget.drawdown', label: 'Drawdown alert', value: p.alertDrawdownPct, unit: 'pct',
        source: { kind: 'setting', name: 'alert_drawdown_pct' }, settings: [drawdownSetting(p)],
      },
    ],
    settings: [drawdownSetting(p), ...varSettings(p).slice(0, 2)],
    explain: `${meaning}${lossBudget !== null ? ` Loss budget: ${fmtMoneyKpi(lossBudget)}.` : ''}`,
    source: RISK,
  }
  if (!ready) Object.assign(node, notReady(input.state))
  else if (used === null) {
    node.status = 'empty'
    node.reason = `Your book is at ${fmtMoneyKpi(0)}: no loss budget to measure against.`
  }
  return node
}

/** The three /risk KPI trees, built once so the budget reuses the same VaR and value nodes. */
export function riskTrees(input: RiskTreeInput): { value: ValueNode; var: ValueNode; budget: ValueNode } {
  const value = portfolioValueTree(input)
  const v = varTree(input)
  return { value, var: v, budget: riskBudgetTree(input, v, value) }
}
