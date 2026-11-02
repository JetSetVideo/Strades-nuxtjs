/**
 * Value trees for the risk budget on "Your agent's directive" (/insights): what a NEW bot launched now
 * actually uses, with the same precedence as the backend (Strades-backend apps/wallets/risk_budget.py):
 *   1. your Settings primary value (max_position_pct / stop_loss_pct / take_profit_pct, in PERCENT), if set;
 *   2. else your agent directive (apps/intelligence directives.py, stored as a FRACTION: 0.05 = 5 %);
 *   3. else the engine default (max position 25 %, stop loss 8 %, take profit 15 %).
 * The max position is then clamped to 1 %–100 % of the wallet.
 * Pure: no Nuxt, no store. Each row opens to the three candidates (the one in use first), the
 * directive's own formula and the Settings link (/settings#set-<key>).
 */
import { fmtPctFromPercent } from '~/utils/format'
import type { ValueNode, ValueSetting } from '~/utils/valueTree'

export type DirBudgetKey = 'max_position' | 'stop_loss' | 'take_profit'
export type DirBudgetSource = 'settings' | 'agent directive' | 'engine default'
export type DirSettingsState = 'ready' | 'loading' | 'error' | 'signed-out'

/** The directive fields the budget reads (fractions, as GET /api/v1/intelligence/me/ returns them). */
export interface DirDirectiveLike {
  max_position_pct?: number | null
  stop_loss_pct?: number | null
  take_profit_pct?: number | null
  computed_at?: string | null
}

/** Engine defaults: apps/wallets/risk_budget.py ENGINE_DEFAULTS (fractions). */
export const DIR_ENGINE_DEFAULTS: Record<DirBudgetKey, number> = { max_position: 0.25, stop_loss: 0.08, take_profit: 0.15 }

export const DIR_PRECEDENCE = 'in use = your Settings value if set, else your agent directive, else the engine default'

interface Meta {
  key: DirBudgetKey
  label: string
  setting: 'max_position_pct' | 'stop_loss_pct' | 'take_profit_pct'
  settingLabel: string
  directive: keyof DirDirectiveLike
  directiveFormula: string
  explain: string
}

export const DIR_BUDGET_META: Meta[] = [
  {
    key: 'max_position', label: 'Max position', setting: 'max_position_pct', settingLabel: 'Max position', directive: 'max_position_pct',
    directiveFormula: 'max position = 5 % + 20 % × discipline × skill room, skill room = (call accuracy − 35 %) ÷ 30 %, clipped to 0–1',
    explain: 'Largest share of the paper wallet one position may take (kept between 1 % and 100 %).',
  },
  {
    key: 'stop_loss', label: 'Stop loss', setting: 'stop_loss_pct', settingLabel: 'Default stop loss', directive: 'stop_loss_pct',
    directiveFormula: 'stop loss = 2 % + 6 % × risk appetite',
    explain: 'A position is closed when it falls this far below its entry.',
  },
  {
    key: 'take_profit', label: 'Take profit', setting: 'take_profit_pct', settingLabel: 'Default take profit', directive: 'take_profit_pct',
    directiveFormula: 'take profit = 2 × stop loss (= 4 % + 12 % × risk appetite)',
    explain: 'A position is closed when it gains this much above its entry (on paper).',
  },
]

export const dirIds = (key: DirBudgetKey) => ({
  root: `directive.budget.${key}`,
  settings: `directive.budget.${key}.settings`,
  directive: `directive.budget.${key}.directive`,
  engine: `directive.budget.${key}.engine`,
})

const finiteNum = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '' || typeof v === 'boolean') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * A directive value as a fraction. The directive stores fractions (0.05 = 5 %); a value of 1 or more
 * is read as a percent (5 → 5 %), the same "≥ 1 means percent" rule the backtest uses for stops.
 */
export function dirFraction(v: unknown): number | null {
  const n = finiteNum(v)
  if (n === null) return null
  return n >= 1 ? n / 100 : n
}

/** One value with the backend's precedence. `settingPct` is the Settings value in PERCENT (null = not set). */
export function dirBudgetValue(key: DirBudgetKey, settingPct: unknown, directiveValue: unknown): { value: number; source: DirBudgetSource } {
  const s = finiteNum(settingPct)
  const d = dirFraction(directiveValue)
  let out: { value: number; source: DirBudgetSource }
  if (s !== null) out = { value: s / 100, source: 'settings' }
  else if (d !== null) out = { value: d, source: 'agent directive' }
  else out = { value: DIR_ENGINE_DEFAULTS[key], source: 'engine default' }
  if (key === 'max_position') out.value = Math.max(0.01, Math.min(1, out.value))
  return { value: Number(out.value.toFixed(6)), source: out.source }
}

const SOURCE_WORD: Record<DirBudgetSource, string> = {
  settings: 'your Settings', 'agent directive': 'your agent directive', 'engine default': 'the engine default',
}
export const dirSourceWord = (s: DirBudgetSource | null | undefined) => (s ? SOURCE_WORD[s] : '')

/** One risk-budget row as a value tree. */
export function directiveBudgetNode(input: {
  key: DirBudgetKey
  directive: DirDirectiveLike | null
  settings?: Record<string, unknown> | null
  settingsState?: DirSettingsState
}): ValueNode & { inUse: DirBudgetSource | null } {
  const meta = DIR_BUDGET_META.find(m => m.key === input.key)!
  const ids = dirIds(meta.key)
  const state = input.settingsState ?? 'ready'
  const settingsRead = state === 'ready'
  const settingPct = settingsRead ? finiteNum(input.settings?.[meta.setting]) : null
  const directiveFrac = dirFraction(input.directive?.[meta.directive])
  const engine = DIR_ENGINE_DEFAULTS[meta.key]
  const link: ValueSetting = {
    key: meta.setting, label: meta.settingLabel, href: `/settings#set-${meta.setting}`,
    value: !settingsRead ? '—' : settingPct === null ? null : fmtPctFromPercent(settingPct),
  }

  const settingsNode: ValueNode = {
    id: ids.settings, label: 'Your Settings value', unit: 'frac',
    value: settingPct === null ? null : settingPct / 100,
    source: { kind: 'setting', name: `Settings › ${meta.settingLabel}` },
    settings: [link],
    reason: state === 'loading' ? 'Reading your Settings…'
      : state === 'signed-out' ? 'Sign in to read your Settings.'
        : state === 'error' ? "Couldn't read your Settings."
          : settingPct === null ? 'Not set: the next candidate is used.' : undefined,
  }
  const directiveNode: ValueNode = {
    id: ids.directive, label: 'Your agent directive', unit: 'frac', value: directiveFrac,
    source: { kind: 'api', name: `GET /api/v1/intelligence/me/ · directive.${String(meta.directive)}`, asOf: input.directive?.computed_at ?? undefined },
    formula: meta.directiveFormula,
    explain: 'Advice computed from your behaviour profile at the last analysis.',
    reason: directiveFrac === null ? 'No directive yet: it appears after your first analysis.' : undefined,
  }
  const engineNode: ValueNode = {
    id: ids.engine, label: 'Engine default', unit: 'frac', value: engine,
    source: { kind: 'api', name: 'apps/wallets/risk_budget.py · ENGINE_DEFAULTS' },
  }

  const base = {
    id: ids.root, label: meta.label, unit: 'frac' as const,
    formula: DIR_PRECEDENCE + (meta.key === 'max_position' ? ', kept between 1 % and 100 %' : ''),
    explain: meta.explain,
    settings: [link],
  }

  if (state === 'loading') {
    return { ...base, value: null, status: 'loading', inputs: [settingsNode, directiveNode, engineNode], inUse: null }
  }
  const picked = dirBudgetValue(meta.key, settingPct, input.directive?.[meta.directive])
  const used = picked.source === 'settings' ? settingsNode : picked.source === 'agent directive' ? directiveNode : engineNode
  // precedence order (stable), the candidate in use labelled
  const inputs = [settingsNode, directiveNode, engineNode].map(n => (n === used ? { ...n, label: `${n.label} · in use` } : n))
  return {
    ...base,
    value: picked.value,
    source: picked.source === 'settings' ? { kind: 'setting', name: `from ${SOURCE_WORD.settings}` }
      : { kind: 'computed', name: `from ${SOURCE_WORD[picked.source]}` },
    ...(!settingsRead ? { status: 'stale' as const, reason: 'Without your Settings: a Settings value would win.' } : {}),
    inputs,
    inUse: picked.source,
  }
}

/** The three rows, in display order. */
export function directiveBudgetTrees(input: {
  directive: DirDirectiveLike | null
  settings?: Record<string, unknown> | null
  settingsState?: DirSettingsState
}) {
  return DIR_BUDGET_META.map(m => directiveBudgetNode({ ...input, key: m.key }))
}
