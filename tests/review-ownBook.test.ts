import { describe, expect, it } from 'vitest'
import { ownBookErrorText, ownBookFigures } from '~/composables/useOwnBook'
import { ownBookFrom } from '~/utils/ownBook'

// C8: the shared own-book total must equal /wallet's KPI (ownBookFrom), and be null unless read.
describe('useOwnBook pure figures', () => {
  const book = ownBookFrom({
    custody: [{ id: 'w1', cash_usd: '1000', allocated_usd: '0' }],
    botsByWallet: { w1: [] },
    portfolio: { cash_balance: '9000', holdings: [{ asset: { symbol: 'BTC' }, current_value: 1166.08 }] },
  })

  it('ready → the same total and cash as ownBookFrom (the KPI)', () => {
    const f = ownBookFigures('ready', book)
    expect(f.total).toBeCloseTo(11166.08, 2)
    expect(f.total).toBe(book.total)
    expect(f.cash).toBe(book.cash)
    expect(f.cash).toBe(10000)
  })

  it('null (never a fake 0) while idle, loading, signed out or on error', () => {
    for (const s of ['idle', 'loading', 'signed-out', 'error'] as const) {
      expect(ownBookFigures(s, book)).toEqual({ total: null, cash: null })
    }
    expect(ownBookFigures('ready', null)).toEqual({ total: null, cash: null })
  })

  it('an empty book reads 0 (the account has no paper money yet), not null', () => {
    const empty = ownBookFrom({ custody: [], botsByWallet: {}, portfolio: null })
    expect(ownBookFigures('ready', empty)).toEqual({ total: 0, cash: 0 })
  })

  it('error text only for a real error, not for signed out', () => {
    expect(ownBookErrorText('error')).toMatch(/could not be read/)
    expect(ownBookErrorText('signed-out')).toBeNull()
    expect(ownBookErrorText('ready')).toBeNull()
  })
})
