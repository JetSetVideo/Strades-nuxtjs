/**
 * Value trees: every important number answers "where does this come from?", top-down:
 * value -> formula + inputs (each input is itself a node) -> the Settings primary values that drive it.
 * Spec: Strades-comms/swarm-2026-10-30b/shots/design/DESIGN-AUDIT.md §3. The component (UI/ValueTree.vue)
 * only renders; composables build the nodes.
 */
import { DASH, fmtMoney, fmtNumber, fmtPctFromFraction, fmtPctFromPercent, isNum, type Maybe } from '~/utils/format'

export type ValueUnit = 'usd' | 'pct' | 'frac' | 'count' | 'ratio' | 'bps' | 'days' | 'text'
export type ValueStatus = 'ok' | 'empty' | 'stale' | 'error' | 'loading'
export type ValueSourceKind = 'api' | 'computed' | 'setting' | 'sample' | 'simulated' | 'browser'

export interface ValueSetting { key: string; label: string; value: string | null; href?: string }

export interface ValueNode {
  id: string
  label: string
  /** null = unknown -> "—" + reason; 0 is a real zero and still shows the formula and settings */
  value: number | string | null
  unit: ValueUnit
  signed?: boolean
  status?: ValueStatus
  reason?: string
  source?: { kind: ValueSourceKind; name: string; asOf?: string }
  formula?: string
  inputs?: ValueNode[]
  settings?: ValueSetting[]
  explain?: string
}

const finite = isNum

/**
 * ONE money precision for KPI tiles and value trees (Wave 4 · formats lane):
 *   below $1M → 2 decimals: "$9,756.84" · "−$9.00" · "+$2.00" (signed) · "$0.00" (zero is never signed)
 *   from  $1M → compact, 1 decimal: "$1.2M" · "−$3.4B"
 * So the /wallet KPI strip and the "Your paper" tree print the same total, to the cent.
 */
export const MONEY_COMPACT_FROM = 1_000_000

/** A KPI / value-tree amount, per the rule above. "—" for unknown. */
export function fmtMoneyKpi(v: Maybe<number>, opts: { signed?: boolean; currency?: string } = {}): string {
  if (!isNum(v)) return DASH
  // Compare the value as printed at 2 dp, so 999,999.996 goes compact ("$1.0M"), not "$1,000,000.00".
  const compact = Number(Math.abs(v).toFixed(2)) >= MONEY_COMPACT_FROM
  return fmtMoney(v, { decimals: 2, compact, signed: opts.signed, currency: opts.currency })
}

/** Tone of a signed amount as printed at `decimals`: a value that prints as zero is neutral. */
export function signTone(v: Maybe<number>, decimals = 2): 'positive' | 'negative' | 'neutral' {
  if (!isNum(v) || Number(Math.abs(v).toFixed(decimals)) === 0) return 'neutral'
  return v > 0 ? 'positive' : 'negative'
}

/**
 * One formatter for the tree; delegates to utils/format.ts (U+2212 minus, sign before the
 * currency symbol, zero unsigned). Money: fmtMoneyKpi. Percent: 1 dp, 2 dp when 0 < |x| < 1 %.
 */
export function formatValue(v: number | string | null | undefined, unit: ValueUnit, signed = false): string {
  if (typeof v === 'string') return v
  if (!finite(v)) return DASH
  switch (unit) {
    case 'usd': return fmtMoneyKpi(v, { signed })
    case 'pct': return fmtPctFromPercent(v, { signed })
    case 'frac': return fmtPctFromFraction(v, { signed })
    case 'bps': return `${fmtNumber(v, { decimals: 0, signed })} bps`
    case 'days': return `${fmtNumber(v, { decimals: v % 1 ? 1 : 0, signed })} d`
    case 'ratio': return fmtNumber(v, { decimals: 2, signed })
    case 'count': return fmtNumber(v, { decimals: 0, signed })
    default: {
      const n = Object.is(v, -0) ? 0 : v
      const sign = n < 0 ? '−' : signed && n > 0 ? '+' : ''
      return `${sign}${Math.abs(n)}`
    }
  }
}

/** What level 0 shows: the formatted value, or "—"/0 with the reason. */
export function headline(node: ValueNode): { text: string; muted: string } {
  if (node.status === 'loading') return { text: '', muted: 'Loading…' }
  if (node.status === 'error') return { text: DASH, muted: node.reason || "Couldn't load" }
  const text = formatValue(node.value, node.unit, node.signed)
  const muted = node.value === null || node.status === 'empty' || node.status === 'stale' ? (node.reason || '') : ''
  return { text, muted }
}

/** Can the user open this node? Always when it has a formula, inputs, settings or an explanation — even at 0. */
export const drillable = (n: ValueNode): boolean => !!(n.formula || n.inputs?.length || n.settings?.length || n.explain)

/** Find a node by its dotted id path ("wallet.equity.cash"), for ?explain= deep links. */
export function findPath(root: ValueNode, id: string): ValueNode[] {
  if (root.id === id) return [root]
  for (const c of root.inputs ?? []) {
    const p = findPath(c, id)
    if (p.length) return [root, ...p]
  }
  return []
}

/** Reverse index: setting key -> labels of the nodes it drives (the "Used by" line in Settings). */
export function usedBy(roots: ValueNode[]): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  const walk = (n: ValueNode) => {
    for (const s of n.settings ?? []) (out[s.key] ??= []).includes(n.label) || out[s.key].push(n.label)
    for (const c of n.inputs ?? []) walk(c)
  }
  roots.forEach(walk)
  return out
}

/** Sum of the inputs' values when they are all known numbers (null if any is unknown): to cross-check a total. */
export function sumInputs(n: ValueNode): number | null {
  const xs = (n.inputs ?? []).map(i => i.value)
  if (!xs.length || xs.some(x => !finite(x))) return null
  return (xs as number[]).reduce((s, x) => s + x, 0)
}
