/**
 * QuickPaperBet (asset page, Candle Chart side panel) — the price it may fill at.
 *
 * Wave 3 hid the whole form when an asset had no quote, because the component required a number.
 * Now the form always shows (side, size, notional, positions) and simply cannot be submitted
 * without a live price: the price reads "—" with a "no live price yet" chip, never an invented one.
 */

/** A usable quote (finite and > 0), else null. Accepts the API's string prices. */
export function livePrice(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) && n > 0 ? n : null
}

/** Fraction digits for a quote: cents from $1 up, more for sub-dollar assets (0.000123). */
export function quoteDecimals(price: number | null | undefined): number {
  if (typeof price !== 'number' || !Number.isFinite(price)) return 2
  const a = Math.abs(price)
  if (a >= 1) return 2
  if (a >= 0.01) return 4
  return 6
}

/** Why the bet cannot be placed ('' = it can). */
export function quickBetBlock(price: number | null | undefined, walletPct: number): string {
  if (livePrice(price) === null) return 'No live price yet: a paper bet needs a quote to fill at.'
  if (!(Number.isFinite(walletPct) && walletPct > 0)) return 'Pick a size above 0 %.'
  return ''
}
