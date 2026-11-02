/**
 * The signed-in account's OWN book, the one Risk (and the Wallet KPI) must read.
 *
 * Definition agreed by @finance and @data (swarm 2026-10-30b, board-finance "@data" answer,
 * board-data round 3):
 *   book = Σ custody paper wallets [cash + Σ live bot EQUITY (cash + positions at the bot's marks)]
 *        + /api/portfolio/ [cash + holdings at the server's stored marks]
 * NOT cash + allocated + bot P&L (that double-counts P&L already released into cash).
 * The bundled wallets.json (owner user_001) is a demo book and never enters here.
 *
 * Pure: the loader takes the API as an argument so it is testable without Nuxt.
 */
import { EMPTY_ALLOCATION_PIE, type AllocationPie } from '~/types/allocation'
import { pieClassOf, type PieClass } from '~/utils/walletBook'

export interface CustodyWalletLike {
  id: string
  label?: string
  cash_usd: string | number
  allocated_usd: string | number
}

export interface BotLike {
  alive: boolean
  equity: number
  open_positions?: { symbol: string; qty: number; mark: number }[]
}

export interface PortfolioLike {
  cash_balance: string | number
  holdings: {
    asset?: { symbol?: string }
    symbol?: string
    current_value?: number | string | null
  }[]
}

export interface OwnBookPosition {
  symbol: string
  cls: PieClass
  value: number
  from: 'bot' | 'portfolio'
}

export interface OwnBook {
  /** USD, the account's paper money across custody wallets and the portfolio. */
  total: number
  /** USD of free cash (wallet cash + bot cash + portfolio cash). */
  cash: number
  byClass: Record<PieClass, number>
  /** Percent of `total` per class; all zeros when the book is empty. */
  pie: AllocationPie
  positions: OwnBookPosition[]
  parts: { custody: number; portfolio: number }
  walletCount: number
  hasPortfolio: boolean
  /** Custody wallets whose bots could not be read: valued at cash + allocated (cost), not marked. */
  unmarkedWallets: number
  /** True when the account has neither a custody wallet nor a portfolio. */
  empty: boolean
}

export const OWN_BOOK_NOTE = 'Your paper money: custody paper wallets (cash + live bot equity) + your portfolio (cash + holdings at the server\'s stored price).'

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

const zeroByClass = (): Record<PieClass, number> => ({ fiat: 0, crypto: 0, stocks: 0, commodities: 0 })

/** "BTC/USDT", "BTCUSDT", "btc" → "BTC": bot feeds quote pairs, the class lives on the base. */
export function baseSymbol(symbol: string): string {
  const upper = String(symbol || '').toUpperCase().trim()
  if (upper.includes('/')) return upper.split('/')[0]!
  const quote = ['USDT', 'USDC', 'BUSD', 'USD'].find(q => upper.length > q.length + 1 && upper.endsWith(q))
  return quote ? upper.slice(0, -quote.length) : upper
}

const classOf = (symbol: string): PieClass => pieClassOf(baseSymbol(symbol))

export function emptyOwnBook(): OwnBook {
  return {
    total: 0,
    cash: 0,
    byClass: zeroByClass(),
    pie: { ...EMPTY_ALLOCATION_PIE },
    positions: [],
    parts: { custody: 0, portfolio: 0 },
    walletCount: 0,
    hasPortfolio: false,
    unmarkedWallets: 0,
    empty: true,
  }
}

/** Class weights in % of a USD-by-class map. Zeros (not 25/25/25/25) when there is nothing. */
export function pieFromClassValues(byClass: Record<PieClass, number>): AllocationPie {
  const total = byClass.fiat + byClass.crypto + byClass.stocks + byClass.commodities
  if (!(total > 0)) return { ...EMPTY_ALLOCATION_PIE }
  return {
    fiat: (byClass.fiat / total) * 100,
    crypto: (byClass.crypto / total) * 100,
    stocks: (byClass.stocks / total) * 100,
    commodities: (byClass.commodities / total) * 100,
  }
}

export function ownBookFrom(input: {
  custody: CustodyWalletLike[]
  /** Bots per custody wallet id; `undefined` when that wallet's bots could not be read. */
  botsByWallet: Record<string, BotLike[] | undefined>
  portfolio: PortfolioLike | null
}): OwnBook {
  const byClass = zeroByClass()
  const positions: OwnBookPosition[] = []
  let cash = 0
  let custodyTotal = 0
  let unmarked = 0

  for (const wallet of input.custody) {
    const walletCash = num(wallet.cash_usd)
    cash += walletCash
    byClass.fiat += walletCash
    custodyTotal += walletCash
    const bots = input.botsByWallet[wallet.id]
    if (!bots) {
      // Bots unreadable: count the reserved capital at cost so the total is not short.
      const allocated = num(wallet.allocated_usd)
      byClass.fiat += allocated
      custodyTotal += allocated
      if (allocated > 0) unmarked += 1
      continue
    }
    for (const bot of bots) {
      if (!bot.alive) continue
      const equity = num(bot.equity)
      let inPositions = 0
      for (const p of bot.open_positions ?? []) {
        const value = num(p.qty) * num(p.mark)
        if (!value) continue
        const cls = classOf(p.symbol)
        byClass[cls] += value
        inPositions += value
        positions.push({ symbol: p.symbol, cls, value, from: 'bot' })
      }
      // The rest of the bot's equity is its cash (or contracts with no symbol class).
      const rest = equity - inPositions
      byClass.fiat += rest
      cash += Math.max(0, rest)
      custodyTotal += equity
    }
  }

  let portfolioTotal = 0
  const pf = input.portfolio
  if (pf) {
    const pfCash = num(pf.cash_balance)
    cash += pfCash
    byClass.fiat += pfCash
    portfolioTotal += pfCash
    for (const h of pf.holdings ?? []) {
      const symbol = String(h.asset?.symbol ?? h.symbol ?? '').toUpperCase()
      const value = num(h.current_value)
      if (!symbol || !value) continue
      const cls = classOf(symbol)
      byClass[cls] += value
      portfolioTotal += value
      positions.push({ symbol, cls, value, from: 'portfolio' })
    }
  }

  const total = custodyTotal + portfolioTotal
  return {
    total,
    cash,
    byClass,
    pie: pieFromClassValues(byClass),
    positions,
    parts: { custody: custodyTotal, portfolio: portfolioTotal },
    walletCount: input.custody.length,
    hasPortfolio: !!pf,
    unmarkedWallets: unmarked,
    empty: input.custody.length === 0 && !pf,
  }
}

export interface OwnBookApi {
  listWallets(): Promise<CustodyWalletLike[]>
  listBots(walletId: string): Promise<BotLike[]>
  portfolio(): Promise<PortfolioLike>
}

/**
 * Read the signed-in account's book. A failing `listWallets` (401 when signed out)
 * throws to the caller; one wallet's unreadable bots only mark that wallet unmarked,
 * and a missing portfolio counts as none.
 */
export async function loadOwnBook(api: OwnBookApi): Promise<OwnBook> {
  const custody = await api.listWallets()
  const entries = await Promise.all(custody.map(async wallet => {
    let bots: BotLike[] | undefined
    try { bots = await api.listBots(wallet.id) } catch { bots = undefined }
    return [wallet.id, bots] as const
  }))
  let portfolio: PortfolioLike | null = null
  try { portfolio = await api.portfolio() } catch { portfolio = null }
  return ownBookFrom({ custody, botsByWallet: Object.fromEntries(entries), portfolio })
}

/** 'signed-out' for a 401 from the API, 'error' for anything else. */
export function bookLoadState(error: unknown): 'signed-out' | 'error' {
  const status = (error as { status?: number; statusCode?: number } | null)?.status
    ?? (error as { statusCode?: number } | null)?.statusCode
  return status === 401 ? 'signed-out' : 'error'
}
