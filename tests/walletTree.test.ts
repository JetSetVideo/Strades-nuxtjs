import { describe, expect, it } from 'vitest'
import { loadOwnBook, ownBookFrom, type OwnBookApi } from '~/utils/ownBook'
import { drillable, findPath, headline, sumInputs } from '~/utils/valueTree'
import { PAPER_FORMULA, ownPaperTree, paperSettings, recordingBookApi, type OwnBookRaw } from '~/utils/walletTree'

const SETTINGS = { starting_capital: 5000, fee_bps: 25 }
const DEFAULTS = { starting_capital: 10000, fee_bps: 10 }

const diego: OwnBookRaw = {
  custody: [{ id: 'w1', cash_usd: '25314.25', allocated_usd: '500' }],
  botsByWallet: {
    w1: [
      { alive: true, equity: 560, open_positions: [{ symbol: 'ETH/USDT', qty: 0.1, mark: 3000 }] },
      { alive: false, equity: 999 },
    ],
  },
  portfolio: {
    cash_balance: '7336.48',
    holdings: [
      { asset: { symbol: 'BTC' }, current_value: 12000 },
      { asset: { symbol: 'AAPL' }, current_value: '7943.85' },
      { asset: { symbol: '' }, current_value: 50 }, // no symbol: ownBook skips it, so must the tree
    ],
  },
}

describe('walletTree — "Your paper" value tree', () => {
  it('inputs sum to the headline, which equals the own-book total', () => {
    const tree = ownPaperTree({ state: 'ready', raw: diego, settings: SETTINGS, settingsDefaults: DEFAULTS })
    const total = ownBookFrom(diego).total
    expect(tree.value).toBeCloseTo(total, 6)
    expect(sumInputs(tree)).toBeCloseTo(total, 6)
    expect(tree.formula).toBe(PAPER_FORMULA)
    expect(tree.inputs!.map(i => i.value)).toEqual([25314.25, 560, 7336.48, 19943.85])
    expect(headline(tree)).toEqual({ text: '$53,154.58', muted: '' })
    expect(findPath(tree, 'wallet.paper.bot_equity').map(n => n.label)).toEqual(['Your paper', 'Bot equity at live prices'])
  })

  it('a zero book still opens: formula, four inputs at $0 with reasons, settings', () => {
    const tree = ownPaperTree({ state: 'ready', raw: { custody: [], botsByWallet: {}, portfolio: null } })
    expect(tree.value).toBe(0)
    expect(tree.status).toBe('empty')
    expect(headline(tree).text).toBe('$0.00')
    expect(headline(tree).muted).toMatch(/no paper wallet yet/i)
    expect(drillable(tree)).toBe(true)
    expect(tree.inputs).toHaveLength(4)
    for (const i of tree.inputs!) {
      expect(i.value).toBe(0)
      expect(i.reason).toBeTruthy()
    }
    expect(sumInputs(tree)).toBe(0)
    expect(tree.settings!.map(s => s.key)).toEqual(['starting_capital', 'fee_bps'])
  })

  it('an unknown input (portfolio unreadable) is "—" with a reason and breaks the cross-check sum', () => {
    const raw: OwnBookRaw = { ...diego, portfolio: null, portfolioError: true }
    const tree = ownPaperTree({ state: 'ready', raw })
    const pf = tree.inputs!.find(i => i.id === 'wallet.paper.portfolio_cash')!
    expect(pf.value).toBeNull()
    expect(headline(pf)).toEqual({ text: '—', muted: 'Your portfolio could not be read: counted as $0.00 in Your paper.' })
    expect(sumInputs(tree)).toBeNull()
    expect(tree.status).toBe('stale')
    expect(tree.value).toBeCloseTo(25314.25 + 560, 6) // the own-book total, which leaves the portfolio out
  })

  it('unreadable bots: reserved capital at cost, split out and flagged, sum still matches', () => {
    const raw: OwnBookRaw = { custody: [{ id: 'w1', cash_usd: 100, allocated_usd: 50 }], botsByWallet: { w1: undefined }, portfolio: null }
    const tree = ownPaperTree({ state: 'ready', raw })
    const bots = tree.inputs!.find(i => i.id === 'wallet.paper.bot_equity')!
    expect(bots.value).toBe(50)
    expect(bots.status).toBe('stale')
    expect(bots.reason).toMatch(/1 wallet could not be read: \$50\.00 counted at reserved cost/)
    expect(sumInputs(bots)).toBe(50)
    expect(sumInputs(tree)).toBe(ownBookFrom(raw).total)
  })

  it('signed out / error / loading keep the formula, inputs and settings visible', () => {
    for (const state of ['signed-out', 'error', 'loading'] as const) {
      const tree = ownPaperTree({ state, raw: null })
      expect(tree.value).toBeNull()
      expect(tree.formula).toBe(PAPER_FORMULA)
      expect(tree.inputs).toHaveLength(4)
      expect(tree.settings).toHaveLength(2)
      expect(drillable(tree)).toBe(true)
    }
    expect(headline(ownPaperTree({ state: 'signed-out', raw: null }))).toEqual({ text: '—', muted: 'Sign in to see your own paper wallets.' })
  })

  it('settings: the user value, else the default, else "—"; links to /settings#set-<key>', () => {
    expect(paperSettings(SETTINGS, DEFAULTS).map(s => [s.value, s.href])).toEqual([
      ['$5,000.00', '/settings#set-starting_capital'],
      ['25 bps', '/settings#set-fee_bps'],
    ])
    expect(paperSettings({ starting_capital: null, fee_bps: null }, DEFAULTS).map(s => s.value)).toEqual(['$10,000.00', '10 bps'])
    expect(paperSettings().map(s => s.value)).toEqual(['—', '—'])
  })

  it('recordingBookApi keeps the raw rows loadOwnBook read, including failures', async () => {
    const api: OwnBookApi = {
      listWallets: async () => [{ id: 'a', cash_usd: 10, allocated_usd: 5 }, { id: 'b', cash_usd: 1, allocated_usd: 0 }],
      listBots: async (id) => { if (id === 'a') throw new Error('500'); return [{ alive: true, equity: 3 }] },
      portfolio: async () => { throw Object.assign(new Error('503'), { status: 503 }) },
    }
    const rec = recordingBookApi(api)
    const book = await loadOwnBook(rec.api)
    expect(rec.raw.custody).toHaveLength(2)
    expect('a' in rec.raw.botsByWallet && rec.raw.botsByWallet.a === undefined).toBe(true)
    expect(rec.raw.botsByWallet.b).toHaveLength(1)
    expect(rec.raw.portfolioError).toBe(true)
    const tree = ownPaperTree({ state: 'ready', raw: rec.raw })
    expect(tree.value).toBe(book.total)
  })
})
