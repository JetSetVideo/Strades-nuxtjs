import { describe, expect, it } from 'vitest'
import { LAB_DOCK_EMPTY, ownWalletDock } from '~/composables/useNavPanels'

const book = (over: Partial<{ total: number, byClass: any, parts: any, empty: boolean }> = {}) => ({
  total: 10_166.08,
  byClass: { fiat: 7_336.48, crypto: 2_829.6, stocks: 0, commodities: 0 },
  parts: { custody: 0, portfolio: 10_166.08 },
  empty: false,
  ...over,
})

describe('Wallet dock = the user\'s own paper (C8, board-ia IA-4)', () => {
  it('shows the own total, never the sample wallets', () => {
    const d = ownWalletDock('ready', book())
    expect(d.value).toEqual([{ text: '$10.2k', tone: 'accent' }])
    expect(d.summary).toBe('Wallet — your paper $10.2k; Cash 72%, crypto 28%')
    expect(d.summary).not.toContain('230.9k')
    expect(d.summary).not.toContain('across')
  })
  it('rings: paper wallets vs portfolio, asset types with fiat as Cash', () => {
    const d = ownWalletDock('ready', book({ total: 300, parts: { custody: 100, portfolio: 200 }, byClass: { fiat: 150, crypto: 150, stocks: 0, commodities: 0 } }), k => k.toUpperCase())
    expect(d.wallets.map(w => [w.key, w.label, w.share])).toEqual([['custody', 'Paper wallets', 1 / 3], ['portfolio', 'Portfolio', 2 / 3]])
    expect(d.classes.map(c => c.label).sort()).toEqual(['CRYPTO', 'Cash'])
    expect(d.classes.reduce((s, c) => s + c.share, 0)).toBeCloseTo(1)
  })
  it('anything but a read book is "—" with the reason', () => {
    expect(ownWalletDock('idle', null).value[0]!.text).toBe('—')
    expect(ownWalletDock('loading', null).summary).toContain('reading')
    expect(ownWalletDock('signed-out', null).summary).toContain('sign in')
    expect(ownWalletDock('error', null).summary).toContain('could not be read')
    const empty = ownWalletDock('ready', book({ total: 0, empty: true }))
    // same number as the /wallet KPI ("YOUR PAPER $0.00"), muted
    expect(empty.value).toEqual([{ text: '$0', tone: 'muted' }])
    expect(empty.summary).toContain('your paper $0')
    expect(empty.wallets).toEqual([])
    expect(empty.classes).toEqual([])
  })
})

describe('Lab dock without an own strategy (board-ia IA-3)', () => {
  it('shows no number and no sample agents', () => {
    expect(LAB_DOCK_EMPTY.points).toEqual([])
    expect(LAB_DOCK_EMPTY.running).toBe(0)
    expect(LAB_DOCK_EMPTY.value).toEqual([{ text: '—', tone: 'muted', long: 'no strategy yet' }])
    expect(LAB_DOCK_EMPTY.summary).not.toMatch(/running|agents/)
  })
})
