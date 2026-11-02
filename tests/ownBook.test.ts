import { describe, expect, it } from 'vitest'
import {
  baseSymbol,
  bookLoadState,
  emptyOwnBook,
  loadOwnBook,
  ownBookFrom,
  pieFromClassValues,
  type OwnBookApi,
} from '~/utils/ownBook'

describe('ownBook — the signed-in account\'s own paper book', () => {
  it('sums custody cash + live bot equity + portfolio cash + holdings (golden value)', () => {
    const book = ownBookFrom({
      custody: [{ id: 'w1', cash_usd: '25314.25', allocated_usd: '0' }],
      botsByWallet: { w1: [] },
      portfolio: {
        cash_balance: '7336.48',
        holdings: [
          { asset: { symbol: 'BTC' }, current_value: 12000 },
          { asset: { symbol: 'AAPL' }, current_value: '7943.85' },
        ],
      },
    })
    // board-finance "@data" answer: diego ≈ 25,314.25 + 7,336.48 + 19,943.85 = 52,594.58
    expect(book.total).toBeCloseTo(52594.58, 2)
    expect(book.parts.custody).toBeCloseTo(25314.25, 2)
    expect(book.parts.portfolio).toBeCloseTo(27280.33, 2)
    expect(book.cash).toBeCloseTo(32650.73, 2)
    expect(book.byClass.crypto).toBe(12000)
    expect(book.byClass.stocks).toBeCloseTo(7943.85, 2)
    expect(book.pie.fiat + book.pie.crypto + book.pie.stocks + book.pie.commodities).toBeCloseTo(100, 9)
    expect(book.empty).toBe(false)
  })

  it('counts a live bot at its equity (not allocated + P&L) and splits it by position class', () => {
    const book = ownBookFrom({
      custody: [{ id: 'w1', cash_usd: 1000, allocated_usd: 500 }],
      botsByWallet: {
        w1: [
          { alive: true, equity: 560, open_positions: [{ symbol: 'ETH/USDT', qty: 0.1, mark: 3000 }] },
          { alive: false, equity: 999 }, // stopped: its money is already back in cash
        ],
      },
      portfolio: null,
    })
    expect(book.total).toBe(1560)
    expect(book.byClass.crypto).toBe(300)
    expect(book.byClass.fiat).toBe(1260) // 1000 wallet cash + 260 bot cash
    expect(book.unmarkedWallets).toBe(0)
  })

  it('falls back to cash + allocated (flagged unmarked) when a wallet\'s bots cannot be read', () => {
    const book = ownBookFrom({
      custody: [{ id: 'w1', cash_usd: '100', allocated_usd: '50' }],
      botsByWallet: { w1: undefined },
      portfolio: null,
    })
    expect(book.total).toBe(150)
    expect(book.unmarkedWallets).toBe(1)
  })

  it('gives zeros (not 25/25/25/25) for an account with no holdings', () => {
    const book = ownBookFrom({ custody: [], botsByWallet: {}, portfolio: null })
    expect(book.total).toBe(0)
    expect(book.pie).toEqual({ fiat: 0, crypto: 0, stocks: 0, commodities: 0 })
    expect(book.empty).toBe(true)
    expect(emptyOwnBook().pie).toEqual({ fiat: 0, crypto: 0, stocks: 0, commodities: 0 })
    expect(pieFromClassValues({ fiat: 0, crypto: 0, stocks: 0, commodities: 0 })).toEqual({ fiat: 0, crypto: 0, stocks: 0, commodities: 0 })
  })

  it('reads the class from the base of a quote pair', () => {
    expect(baseSymbol('BTCUSDT')).toBe('BTC')
    expect(baseSymbol('eth/usdt')).toBe('ETH')
    expect(baseSymbol('SOL')).toBe('SOL')
    expect(baseSymbol('USD')).toBe('USD')
  })

  it('loads through the API, tolerates one wallet\'s bots failing, and lets a 401 through', async () => {
    const api: OwnBookApi = {
      listWallets: async () => [
        { id: 'a', cash_usd: '10', allocated_usd: '5' },
        { id: 'b', cash_usd: '20', allocated_usd: '0' },
      ],
      listBots: async id => {
        if (id === 'a') throw new Error('boom')
        return [{ alive: true, equity: 7 }]
      },
      portfolio: async () => { throw Object.assign(new Error('nope'), { status: 404 }) },
    }
    const book = await loadOwnBook(api)
    expect(book.total).toBe(10 + 5 + 20 + 7)
    expect(book.unmarkedWallets).toBe(1)
    expect(book.hasPortfolio).toBe(false)

    const signedOut: OwnBookApi = {
      listWallets: async () => { throw Object.assign(new Error('auth'), { status: 401 }) },
      listBots: async () => [],
      portfolio: async () => ({ cash_balance: 0, holdings: [] }),
    }
    await expect(loadOwnBook(signedOut)).rejects.toMatchObject({ status: 401 })
    expect(bookLoadState({ status: 401 })).toBe('signed-out')
    expect(bookLoadState(new Error('x'))).toBe('error')
    expect(bookLoadState(null)).toBe('error')
  })
})
