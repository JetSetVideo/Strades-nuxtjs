import { describe, expect, it } from 'vitest'
import { drillable, findPath, headline } from '~/utils/valueTree'
import {
  DIR_ENGINE_DEFAULTS, dirBudgetValue, dirFraction, directiveBudgetNode, directiveBudgetTrees, dirIds,
} from '~/utils/directiveTree'

// What GET /api/v1/intelligence/me/ returns (fractions; directives.py).
const DIRECTIVE = { max_position_pct: 0.15, stop_loss_pct: 0.021, take_profit_pct: 0.042, computed_at: '2026-10-30T10:00:00Z' }
const NOT_SET = { max_position_pct: null, stop_loss_pct: null, take_profit_pct: null }

describe('directiveTree — the precedence of apps/wallets/risk_budget.py', () => {
  it('Settings (percent) > directive (fraction) > engine default', () => {
    expect(dirBudgetValue('stop_loss', 5, 0.021)).toEqual({ value: 0.05, source: 'settings' })
    expect(dirBudgetValue('stop_loss', null, 0.021)).toEqual({ value: 0.021, source: 'agent directive' })
    expect(dirBudgetValue('stop_loss', null, null)).toEqual({ value: 0.08, source: 'engine default' })
    expect(dirBudgetValue('take_profit', undefined, undefined)).toEqual({ value: DIR_ENGINE_DEFAULTS.take_profit, source: 'engine default' })
    // same cases as the backend test (directive stored in percent there)
    expect(dirBudgetValue('max_position', null, 15)).toEqual({ value: 0.15, source: 'agent directive' })
    expect(dirBudgetValue('stop_loss', null, 2)).toEqual({ value: 0.02, source: 'agent directive' })
  })

  it('max position is kept within 1 %–100 %', () => {
    expect(dirBudgetValue('max_position', 0.5, null).value).toBe(0.01)
    expect(dirBudgetValue('max_position', 100, null).value).toBe(1)
  })

  it('dirFraction: fractions stay, ≥ 1 is a percent, junk is null', () => {
    expect(dirFraction(0.05)).toBe(0.05)
    expect(dirFraction(5)).toBe(0.05)
    expect(dirFraction('x')).toBeNull()
    expect(dirFraction(null)).toBeNull()
  })

  it('no setting: rows show the directive, labelled, with the Settings link', () => {
    const rows = directiveBudgetTrees({ directive: DIRECTIVE, settings: NOT_SET, settingsState: 'ready' })
    expect(rows.map(r => [r.label, headline(r).text, r.inUse])).toEqual([
      ['Max position', '15.0%', 'agent directive'],
      ['Stop loss', '2.1%', 'agent directive'],
      ['Take profit', '4.2%', 'agent directive'],
    ])
    expect(rows.map(r => r.settings![0].href)).toEqual([
      '/settings#set-max_position_pct', '/settings#set-stop_loss_pct', '/settings#set-take_profit_pct',
    ])
    const sl = rows[1]
    expect(sl.inputs!.map(i => i.label)).toEqual(['Your Settings value', 'Your agent directive · in use', 'Engine default'])
    expect(headline(sl.inputs![0])).toEqual({ text: '—', muted: 'Not set: the next candidate is used.' })
    expect(sl.inputs![1].formula).toBe('stop loss = 2 % + 6 % × risk appetite')
    expect(sl.settings![0].value).toBeNull() // → "not set" in the component
  })

  it('a Settings value wins and is printed in the link', () => {
    const r = directiveBudgetNode({ key: 'take_profit', directive: DIRECTIVE, settings: { take_profit_pct: 12 }, settingsState: 'ready' })
    expect(r.inUse).toBe('settings')
    expect(headline(r).text).toBe('12.0%')
    expect(r.settings![0].value).toBe('12.0%')
    expect(r.inputs![0].label).toBe('Your Settings value · in use')
    expect(findPath(r, dirIds('take_profit').engine).at(-1)!.value).toBe(0.15)
  })

  it('no directive, no setting: the engine default, every candidate still listed', () => {
    const rows = directiveBudgetTrees({ directive: null, settings: NOT_SET, settingsState: 'ready' })
    expect(rows.map(r => r.value)).toEqual([0.25, 0.08, 0.15])
    expect(rows.every(r => r.inUse === 'engine default' && drillable(r) && r.inputs!.length === 3)).toBe(true)
    expect(rows[0].inputs![1].reason).toMatch(/No directive yet/)
  })

  it('settings loading / unreadable: loading, then shown without them and marked stale', () => {
    const loading = directiveBudgetNode({ key: 'stop_loss', directive: DIRECTIVE, settingsState: 'loading' })
    expect(loading.status).toBe('loading')
    expect(drillable(loading)).toBe(true)
    const out = directiveBudgetNode({ key: 'stop_loss', directive: DIRECTIVE, settings: { stop_loss_pct: 9 }, settingsState: 'signed-out' })
    expect(out.inUse).toBe('agent directive') // an unread setting is never used
    expect(out.status).toBe('stale')
    expect(out.settings![0].value).toBe('—')
    expect(out.inputs![0].reason).toBe('Sign in to read your Settings.')
  })

  it('ids are stable whatever the source', () => {
    const idsOf = (r: any) => [r.id, ...r.inputs.map((i: any) => i.id)]
    const a = directiveBudgetTrees({ directive: DIRECTIVE, settings: NOT_SET }).map(idsOf)
    const b = directiveBudgetTrees({ directive: null, settings: { max_position_pct: 10, stop_loss_pct: 3, take_profit_pct: 6 } }).map(idsOf)
    expect(a).toEqual(b)
    expect(a[0]).toEqual(['directive.budget.max_position', 'directive.budget.max_position.settings', 'directive.budget.max_position.directive', 'directive.budget.max_position.engine'])
  })
})
