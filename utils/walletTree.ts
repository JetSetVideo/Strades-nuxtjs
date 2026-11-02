/**
 * Value tree for /wallet (Gall's law: the first one, one number): "Your paper", the
 * signed-in account's OWN paper equity, opened top-down:
 *   Your paper -> custody cash + bot equity at live prices + portfolio cash + holdings at mark
 *             -> the Settings primary values that drive it (starting capital, fee per side).
 * Same definition and same total as utils/ownBook.ts (ownBookFrom): the tree is built from the
 * raw API rows the loader read, so its inputs always sum to the headline.
 * Pure: no Nuxt, no store. The page records the raw rows with `recordingBookApi`.
 */
// Money in the tree, its reasons and its settings: fmtMoneyKpi (2 dp below $1M, compact above),
// the same rule as the /wallet KPI strip, so both print the same total.
import {
  ownBookFrom,
  type BotLike,
  type CustodyWalletLike,
  type OwnBookApi,
  type PortfolioLike,
} from '~/utils/ownBook'
import { fmtMoneyKpi, type ValueNode, type ValueSetting } from '~/utils/valueTree'

/** What `loadOwnBook` read, kept so the tree can show each part. */
export interface OwnBookRaw {
  custody: CustodyWalletLike[]
  /** `undefined` for a wallet whose bots could not be read (counted at cost by ownBook). */
  botsByWallet: Record<string, BotLike[] | undefined>
  portfolio: PortfolioLike | null
  /** True when GET /api/portfolio/ failed (the server creates one, so a miss is a failure). */
  portfolioError?: boolean
}

export type OwnBookLoadState = 'loading' | 'ready' | 'signed-out' | 'error'

/** Wrap the trading API so the raw rows `loadOwnBook` reads are kept for the tree. */
export function recordingBookApi(api: OwnBookApi): { api: OwnBookApi; raw: OwnBookRaw } {
  const raw: OwnBookRaw = { custody: [], botsByWallet: {}, portfolio: null, portfolioError: false }
  return {
    raw,
    api: {
      listWallets: async () => (raw.custody = await api.listWallets()),
      listBots: async (walletId: string) => {
        raw.botsByWallet[walletId] = undefined
        const bots = await api.listBots(walletId)
        raw.botsByWallet[walletId] = bots
        return bots
      },
      portfolio: async () => {
        try {
          raw.portfolio = await api.portfolio()
          return raw.portfolio
        } catch (error) {
          raw.portfolioError = true
          throw error
        }
      },
    },
  }
}

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

type Primary = Record<string, unknown>

function settingValue(key: string, values: Primary, defaults: Primary): unknown {
  const v = values[key]
  return v === null || v === undefined ? defaults[key] : v
}

/**
 * The primary values that drive "Your paper", formatted for the tree's setting links
 * (/settings#set-<key>). '—' while the settings are not read (signed out, loading).
 */
export function paperSettings(values: Primary = {}, defaults: Primary = {}): ValueSetting[] {
  const capital = settingValue('starting_capital', values, defaults)
  const fee = settingValue('fee_bps', values, defaults)
  return [
    {
      key: 'starting_capital',
      label: 'Paper starting capital',
      value: capital === undefined ? '—' : capital === null ? null : fmtMoneyKpi(num(capital)),
      href: '/settings#set-starting_capital',
    },
    {
      key: 'fee_bps',
      label: 'Fee per side',
      value: fee === undefined ? '—' : fee === null ? null : `${num(fee)} bps`,
      href: '/settings#set-fee_bps',
    },
  ]
}

export const PAPER_FORMULA = 'Your paper = custody cash + bot equity at live prices + portfolio cash + portfolio holdings at mark'

const PAPER_EXPLAIN = 'Your own paper money only: the sample platform wallets on this page are never added. '
  + 'Paper starting capital is the cash a new paper portfolio and a new backtest start with (an existing '
  + 'portfolio keeps its cash); fee per side is charged on backtest fills today and on bot fills later.'

const IDS = {
  root: 'wallet.paper',
  cash: 'wallet.paper.custody_cash',
  bots: 'wallet.paper.bot_equity',
  pfCash: 'wallet.paper.portfolio_cash',
  pfHoldings: 'wallet.paper.portfolio_holdings',
} as const

const SRC = {
  wallets: { kind: 'api' as const, name: 'GET /api/wallets/ · cash_usd' },
  bots: { kind: 'api' as const, name: 'GET /api/wallets/{id}/bots/ · equity' },
  portfolioCash: { kind: 'api' as const, name: 'GET /api/portfolio/ · cash_balance' },
  portfolioHoldings: { kind: 'api' as const, name: 'GET /api/portfolio/ · holdings[].current_value' },
  book: { kind: 'computed' as const, name: 'utils/ownBook.ts (same total as the KPI)' },
}

/** The four inputs with no value (not read yet / signed out / failed): every option stays visible. */
function blankInputs(reason: string): ValueNode[] {
  return [
    { id: IDS.cash, label: 'Custody wallet cash', value: null, unit: 'usd', reason, source: SRC.wallets },
    { id: IDS.bots, label: 'Bot equity at live prices', value: null, unit: 'usd', reason, source: SRC.bots },
    { id: IDS.pfCash, label: 'Portfolio cash', value: null, unit: 'usd', reason, source: SRC.portfolioCash },
    { id: IDS.pfHoldings, label: 'Portfolio holdings at mark', value: null, unit: 'usd', reason, source: SRC.portfolioHoldings },
  ]
}

/**
 * "Your paper" as a value tree. Zero and unknown still open: formula, the four inputs
 * (0 or "—" with a one-line reason) and the settings.
 */
export function ownPaperTree(input: {
  state: OwnBookLoadState
  raw: OwnBookRaw | null
  settings?: Primary
  settingsDefaults?: Primary
}): ValueNode {
  const base = {
    id: IDS.root,
    label: 'Your paper',
    unit: 'usd' as const,
    formula: PAPER_FORMULA,
    settings: paperSettings(input.settings, input.settingsDefaults),
    explain: PAPER_EXPLAIN,
    source: SRC.book,
  }

  if (input.state === 'loading') {
    return { ...base, value: null, status: 'loading', inputs: blankInputs('Reading your paper wallets…') }
  }
  if (input.state === 'signed-out') {
    const reason = 'Sign in to see your own paper wallets.'
    return { ...base, value: null, status: 'empty', reason, inputs: blankInputs('Sign in to read it.') }
  }
  if (input.state === 'error' || !input.raw) {
    const reason = 'Your paper wallets could not be read right now.'
    return { ...base, value: null, status: 'error', reason, inputs: blankInputs('Not read: the request failed.') }
  }

  const raw = input.raw
  const book = ownBookFrom(raw)

  // 1 · custody wallet cash
  const cash = raw.custody.reduce((s, w) => s + num(w.cash_usd), 0)
  const cashNode: ValueNode = {
    id: IDS.cash, label: 'Custody wallet cash', value: cash, unit: 'usd', source: SRC.wallets,
    ...(cash === 0 ? {
      status: 'empty' as const,
      reason: raw.custody.length
        ? 'Your custody wallets hold no free cash (it is reserved for bots).'
        : 'No custody paper wallet yet: create one in Trade.',
    } : {}),
  }

  // 2 · bot equity: live bots at their own marks; unreadable wallets at reserved cost (as ownBook)
  let live = 0
  let liveBots = 0
  let atCost = 0
  let unreadable = 0
  for (const w of raw.custody) {
    const bots = raw.botsByWallet[w.id]
    if (!bots) {
      const allocated = num(w.allocated_usd)
      atCost += allocated
      if (allocated > 0) unreadable += 1
      continue
    }
    for (const b of bots) {
      if (!b.alive) continue
      live += num(b.equity)
      liveBots += 1
    }
  }
  const botValue = live + atCost
  const botNode: ValueNode = {
    id: IDS.bots, label: 'Bot equity at live prices', value: botValue, unit: 'usd', source: SRC.bots,
    formula: 'Σ live bots (cash + Σ qty × the bot\'s live mark). Stopped bots: their money is back in wallet cash.',
  }
  if (unreadable > 0) {
    botNode.status = 'stale'
    botNode.reason = `Bots of ${unreadable} wallet${unreadable === 1 ? '' : 's'} could not be read: ${fmtMoneyKpi(atCost)} counted at reserved cost, not at live prices.`
    botNode.inputs = [
      { id: `${IDS.bots}.live`, label: `Live bots (${liveBots})`, value: live, unit: 'usd', source: SRC.bots },
      { id: `${IDS.bots}.at_cost`, label: 'Reserved, bots unreadable', value: atCost, unit: 'usd', source: { kind: 'api', name: 'GET /api/wallets/ · allocated_usd' } },
    ]
  } else if (botValue === 0) {
    botNode.status = 'empty'
    botNode.reason = raw.custody.length ? 'No live bot in your custody wallets.' : 'No custody wallet, so no bot.'
  }

  // 3-4 · portfolio cash + holdings at the server's stored mark
  const pf = raw.portfolio
  let pfCashNode: ValueNode
  let pfHoldNode: ValueNode
  if (!pf) {
    const reason = raw.portfolioError
      ? `Your portfolio could not be read: counted as ${fmtMoneyKpi(0)} in Your paper.`
      : 'No portfolio on your account yet.'
    const value = raw.portfolioError ? null : 0
    pfCashNode = { id: IDS.pfCash, label: 'Portfolio cash', value, unit: 'usd', status: raw.portfolioError ? 'error' : 'empty', reason, source: SRC.portfolioCash }
    pfHoldNode = { id: IDS.pfHoldings, label: 'Portfolio holdings at mark', value, unit: 'usd', status: raw.portfolioError ? 'error' : 'empty', reason, source: SRC.portfolioHoldings }
  } else {
    const pfCash = num(pf.cash_balance)
    let held = 0
    let count = 0
    for (const h of pf.holdings ?? []) {
      const symbol = String(h.asset?.symbol ?? h.symbol ?? '')
      const value = num(h.current_value)
      if (!symbol || !value) continue // same rule as ownBookFrom
      held += value
      count += 1
    }
    pfCashNode = {
      id: IDS.pfCash, label: 'Portfolio cash', value: pfCash, unit: 'usd', source: SRC.portfolioCash,
      ...(pfCash === 0 ? { status: 'empty' as const, reason: 'No free cash left in your portfolio.' } : {}),
    }
    pfHoldNode = {
      id: IDS.pfHoldings, label: `Portfolio holdings at mark${count ? ` (${count})` : ''}`, value: held, unit: 'usd',
      formula: 'Σ holdings: quantity × the server\'s stored price', source: SRC.portfolioHoldings,
      ...(held === 0 ? { status: 'empty' as const, reason: 'No holding in your portfolio yet.' } : {}),
    }
  }

  const root: ValueNode = { ...base, value: book.total, inputs: [cashNode, botNode, pfCashNode, pfHoldNode] }
  if (raw.portfolioError) {
    root.status = 'stale'
    root.reason = 'Your portfolio could not be read: this total leaves it out.'
  } else if (book.total === 0) {
    root.status = 'empty'
    root.reason = book.empty ? 'You have no paper wallet yet: create one in Trade.' : `Your paper wallets and portfolio are at ${fmtMoneyKpi(0)}.`
  }
  return root
}
