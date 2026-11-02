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
 */

export const DEFAULT_PAPER_CAPITAL = 100_000
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
