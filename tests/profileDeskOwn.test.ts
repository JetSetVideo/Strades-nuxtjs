import { describe, expect, it } from 'vitest'
import { BOOK_USER_ID, DESK_PENDING_NOTE, deskFigures, ownBookUserId } from '~/utils/profileDesk'

describe('profile desk — only the signed-in account\'s own numbers', () => {
  const catalog = new Set(['user_001', 'user_002'])
  const inCatalog = (id: string) => catalog.has(id)

  it('never falls back to the sample row for an account outside the book', () => {
    expect(ownBookUserId('b3f1-uuid-of-olivia', inCatalog)).toBeNull()
    expect(ownBookUserId(undefined, inCatalog)).toBeNull()
    expect(ownBookUserId('', inCatalog)).toBeNull()
    expect(ownBookUserId('user_002', inCatalog)).toBe('user_002')
    expect(ownBookUserId('b3f1-uuid-of-olivia', inCatalog)).not.toBe(BOOK_USER_ID)
  })

  it('blanks every desk figure (— + reason) when the book is not the account\'s own', () => {
    const desk = deskFigures({ own: false, walletValues: [230875], winRate: 62.5, bots: [{ status: 'live' }] })
    expect(desk).toEqual({
      own: false, value: null, win: null, live: null, bots: null, coverage: null, edge: null, note: DESK_PENDING_NOTE,
    })
  })

  it('computes the own desk with the page\'s existing rules (golden values)', () => {
    const desk = deskFigures({
      own: true,
      walletValues: [142475, 88400],
      winRate: 62.5,
      bots: [{ status: 'live' }, { status: 'live' }, { status: 'live' }, { status: 'paused' }],
    })
    expect(desk.value).toBe(230875)
    expect(desk.win).toBe(62.5)
    expect(desk.live).toBe(3)
    expect(desk.bots).toBe(4)
    expect(desk.coverage).toBeCloseTo(0.75)
    expect(desk.edge).toBe('ahead')
    expect(desk.note).toBe('')
  })

  it('uses the catalog value only when no wallet carries one, clamps, and leaves an unknown win rate unknown', () => {
    expect(deskFigures({ own: true, walletValues: [], catalogValue: 5000, bots: [] }).value).toBe(5000)
    expect(deskFigures({ own: true, walletValues: [-10], bots: [] }).value).toBe(0)
    const desk = deskFigures({ own: true, walletValues: [1], winRate: null, bots: [] })
    expect(desk.win).toBeNull()
    expect(desk.edge).toBeNull()
    expect(desk.coverage).toBe(0)
    expect(deskFigures({ own: true, walletValues: [1], winRate: 50, bots: [] }).edge).toBe('even')
    expect(deskFigures({ own: true, walletValues: [1], winRate: 44.9, bots: [] }).edge).toBe('behind')
  })
})
