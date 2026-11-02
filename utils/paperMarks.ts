/**
 * Paper trading marks, owner and capital (wave 2: the P&L was a sine wave, every
 * trade was stamped "user_001", and sizing assumed a $100k wallet).
 *
 *  - livePriceOf: the current price the asset page uses (stores/assets), only when
 *    it is backed by a live quote (`asset.live`). Bundled catalog prices are not
 *    a mark: null → the UI shows "—".
 *  - paperMark: P&L from the entry price and that current price. Never invented.
 *  - paperOwnerId: the signed-in user's id, else "guest" (never the demo user_001).
 *  - paperCapital: the user's paper cash (custody paper wallets, cash_usd), else
 *    null and the caller uses DEFAULT_PAPER_CAPITAL with a visible label.
 *  - resolvePaperCapital (swarm 11-02, TRADE-1/BOT-3): ONE sizing source for every paper
 *    form — the user's free paper cash, else Settings › starting_capital, else 10,000.
 *    Never the old 100k (it made a "5 %" click book half of a $10k user's money).
 *  - tradePollDue (PERF-7): /trade polls every 15 s only while a bot is running.
 */

/** Same as the server default for Settings › Paper starting capital (apps/users/primary.py). */
export const DEFAULT_PAPER_CAPITAL = 10_000
export const GUEST_OWNER = 'guest'

export interface PricedAsset {
  id?: string | number
  symbol?: string
  current_price?: number | string | null
  live?: unknown
}

export function livePriceOf(assets: PricedAsset[], assetId: string | undefined, symbol: string | undefined): number | null {
  const id = String(assetId ?? '').toLowerCase()
  const sym = String(symbol ?? '').toUpperCase()
  const a = assets.find(x => id && String(x.id ?? '').toLowerCase() === id)
    ?? assets.find(x => sym && String(x.symbol ?? '').toUpperCase() === sym)
  if (!a || !a.live) return null
  const p = Number(a.current_price)
  return Number.isFinite(p) && p > 0 ? p : null
}

export function paperMark(t: { side: 'buy' | 'sell'; simulated_price: number; notional_value: number }, price: number | null):
  { pct: number; value: number } | null {
  if (price === null || !Number.isFinite(price) || price <= 0) return null
  if (!Number.isFinite(t.simulated_price) || t.simulated_price <= 0) return null
  const direction = t.side === 'buy' ? 1 : -1
  const pct = ((price - t.simulated_price) / t.simulated_price) * 100 * direction
  const notional = Number.isFinite(t.notional_value) ? t.notional_value : 0
  return { pct, value: (pct / 100) * notional }
}

export function paperOwnerId(isAuthenticated: boolean, userId: string | number | null | undefined): string {
  const id = userId === null || userId === undefined ? '' : String(userId).trim()
  return isAuthenticated && id && id !== 'user_001' ? id : GUEST_OWNER
}

/** Sum of free paper cash over the user's custody wallets; null when there is none. */
export function paperCapital(wallets: { cash_usd?: string | number | null }[] | null | undefined): number | null {
  if (!wallets?.length) return null
  const total = wallets.reduce((s, w) => {
    const v = Number(w.cash_usd)
    return Number.isFinite(v) && v > 0 ? s + v : s
  }, 0)
  return total > 0 ? total : null
}

export type PaperCapitalSource = 'cash' | 'settings' | 'default'

export interface PaperCapital {
  /** USD the form sizes on (a % of it, or a cap). */
  amount: number
  /** 'cash' = the user's own free paper cash; 'settings' = Settings › Paper starting capital; 'default' = 10,000. */
  source: PaperCapitalSource
}

const finiteNum = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * One paper-capital source. `freeCash` = the user's free paper cash when it is KNOWN (0 included:
 * a known $0 must block the form with a reason, never fall back to a bigger default); null/undefined
 * = unknown (signed out, not loaded) → Settings starting_capital (> 0) → DEFAULT_PAPER_CAPITAL.
 */
export function resolvePaperCapital(freeCash: unknown, startingCapital?: unknown): PaperCapital {
  const cash = finiteNum(freeCash)
  if (cash !== null) return { amount: Math.max(0, cash), source: 'cash' }
  const start = finiteNum(startingCapital)
  if (start !== null && start > 0) return { amount: start, source: 'settings' }
  return { amount: DEFAULT_PAPER_CAPITAL, source: 'default' }
}

/** Why a bot cannot be launched with `capital` from a wallet holding `freeCash` ('' = it can). */
export function botCapitalBlock(capital: unknown, freeCash: unknown, min = 10): string {
  const free = finiteNum(freeCash)
  const cap = finiteNum(capital)
  if (free !== null && free < min) return 'No free cash in this wallet: stop a bot (Trade) or pick another wallet.'
  if (cap === null || cap < min) return `Capital must be at least $${min}.`
  if (free !== null && cap > free + 1e-9) return 'Capital is more than this wallet\'s free cash.'
  return ''
}

/** Poll period of the /trade desk while a bot runs (was 5 s, 3 GETs each, PERF-7). */
export const TRADE_POLL_MS = 15_000

/** A /trade poll tick fetches only for a visible, signed-in desk with at least one running (alive, not paused) bot. */
export function tradePollDue(o: { walletId: string; signedOut: boolean; hidden: boolean; bots: { alive?: boolean; paused?: boolean }[] }): boolean {
  if (!o.walletId || o.signedOut || o.hidden) return false
  return o.bots.some(b => !!b.alive && !b.paused)
}

/** Units for a hand order of `notional` USD at `price`; for a sell, never more than `held` (no shorts). */
export function orderQuantity(o: { side: 'buy' | 'sell'; notional: number; price: number | null; held?: number }): number {
  if (o.price === null || !Number.isFinite(o.price) || o.price <= 0) return 0
  if (!Number.isFinite(o.notional) || o.notional <= 0) return 0
  const q = o.notional / o.price
  if (o.side === 'sell') {
    const held = Number.isFinite(o.held) && (o.held as number) > 0 ? (o.held as number) : 0
    return Math.min(q, held)
  }
  return q
}

// ── Server paper book (POST /api/v1/portfolio/trade/, contract C1) ─────────────────────────────

export interface ServerHolding {
  asset?: { id?: string | number; symbol?: string } | null
  asset_id?: string
  symbol?: string
  quantity: string | number
  average_buy_price?: string | number
  current_value?: number | string | null
  unrealized_pnl?: number | string | null
}

export interface ServerPortfolio {
  cash_balance: string | number
  holdings?: ServerHolding[]
  transactions?: { asset_symbol?: string; type?: string; quantity?: string | number; price?: string | number; total_value?: string | number; fee?: string | number; timestamp?: string }[]
  /** C1 (optional, core-api): the fill of THIS request. */
  fill?: { price?: string | number; price_source?: string; quantity?: string | number; total_value?: string | number; fee?: string | number } | null
}

/** The holding of one asset in the server book (by id, else symbol); null when not held. */
export function portfolioHolding(pf: ServerPortfolio | null | undefined, assetId: string, symbol: string): ServerHolding | null {
  const id = String(assetId ?? '').toLowerCase()
  const sym = String(symbol ?? '').toUpperCase()
  const rows = pf?.holdings ?? []
  const h = rows.find(r => id && String(r.asset?.id ?? r.asset_id ?? '').toLowerCase() === id)
    ?? rows.find(r => sym && String(r.asset?.symbol ?? r.symbol ?? '').toUpperCase() === sym)
  if (!h) return null
  const q = Number(h.quantity)
  return Number.isFinite(q) && q > 0 ? h : null
}

/** Units held of one asset in the server book (0 when none). */
export function heldQuantity(pf: ServerPortfolio | null | undefined, assetId: string, symbol: string): number {
  const h = portfolioHolding(pf, assetId, symbol)
  return h ? Number(h.quantity) : 0
}

/** Round DOWN to 8 dp (the server stores Decimal quantities; never ask for more than computed). */
export function floorQty(q: number): number {
  if (!Number.isFinite(q) || q <= 0) return 0
  return Math.floor(q * 1e8 + 1e-6) / 1e8
}

export interface TradeFill { price: number; quantity: number | null; total: number | null; fee: number | null; source: 'fill' | 'transaction' | 'quote' }

/**
 * What the server filled: the C1 `fill` when the response has it, else the newest transaction of
 * this symbol (HandTrade.vue does the same), else the quote the user saw (source 'quote').
 */
export function portfolioFill(resp: ServerPortfolio | null | undefined, symbol: string, quote: number): TradeFill {
  const n = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null)
  const f = resp?.fill
  if (f && n(f.price) !== null) return { price: n(f.price)!, quantity: n(f.quantity), total: n(f.total_value), fee: n(f.fee), source: 'fill' }
  const sym = String(symbol ?? '').toUpperCase()
  const tx = [...(resp?.transactions ?? [])].filter(t => String(t.asset_symbol ?? '').toUpperCase() === sym)
    .sort((a, b) => String(b.timestamp ?? '').localeCompare(String(a.timestamp ?? '')))[0]
  if (tx && n(tx.price) !== null) return { price: n(tx.price)!, quantity: n(tx.quantity), total: n(tx.total_value), fee: n(tx.fee), source: 'transaction' }
  return { price: quote, quantity: null, total: null, fee: null, source: 'quote' }
}

/** One readable line from a DRF error ({errors:{field:msg}} | {detail}) — never a raw object. */
export function tradeErrorText(e: unknown): string {
  const err = e as { data?: { errors?: Record<string, unknown>; detail?: unknown }; status?: number; statusCode?: number; response?: { status?: number } }
  const status = err?.response?.status ?? err?.statusCode ?? err?.status ?? 0
  const errors = err?.data?.errors
  if (errors && typeof errors === 'object') {
    const first = Object.values(errors).map(v => (Array.isArray(v) ? v.join(' ') : String(v))).filter(Boolean)[0]
    if (first) return first
  }
  if (typeof err?.data?.detail === 'string' && err.data.detail) return err.data.detail
  if (status === 401) return 'Your session ended: sign in again to trade.'
  if (status === 429) return 'Too many orders at once: wait a moment.'
  return 'The order did not go through. Nothing was booked.'
}
