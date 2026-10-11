import { describe, expect, it } from 'vitest'
import { normalizeOperator } from '~/composables/useBacktest'

// Regression: the creator's rule editor emits ids (gt, crosses_up, …) that the
// Monte Carlo engine didn't recognise, so every user rule was ignored (0 trades).
describe('normalizeOperator', () => {
  it('maps the rule-editor ids to engine operators', () => {
    expect(['gt', 'lt', 'gte', 'lte', 'eq', 'crosses_up', 'crosses_dn'].map(normalizeOperator))
      .toEqual(['>', '<', '>=', '<=', '==', 'cross_above', 'cross_below'])
  })
  it('keeps symbolic operators and legacy names working', () => {
    expect(['>', '<', '>=', 'cross_above', 'cross_over'].map(normalizeOperator))
      .toEqual(['>', '<', '>=', 'cross_above', 'cross_above'])
  })
})
