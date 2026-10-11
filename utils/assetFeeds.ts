/**
 * Which API an asset's price actually comes from.
 *
 * The prices bar used to print "40 live · API", which reads as forty APIs.
 * Forty is the count of assets that have a live quote. This module is the
 * map behind the panel: every asset lands in exactly one feed.
 *
 * Order of evidence:
 *   1. A bet's venue tag or `source` (Kalshi, Polymarket, …).
 *   2. A live quote whose pair is a market symbol (the Binance overlay).
 *   3. A live quote whose pair is `strades-api` (the backend attached a
 *      number and named no venue).
 *   4. No live quote — the catalog price only.
 */

export const BINANCE_FEED = 'binance'
export const STRADES_QUOTE_FEED = 'strades-api'
export const CATALOG_FEED = 'catalog'

/** Feeds that are not rows in GET /api/providers/, labelled in the panel. */
export const LOCAL_FEEDS: Record<string, { label: string; blurb: string }> = {
  kalshi: {
    label: 'Kalshi',
    blurb: 'Prediction-market contracts from the Kalshi public API.',
  },
  polymarket: {
    label: 'Polymarket',
    blurb: 'Prediction-market contracts from Polymarket.',
  },
  bets: {
    label: 'Bets',
    blurb: 'Prediction-market contracts with no venue named on the asset.',
  },
  [BINANCE_FEED]: {
    label: 'Binance',
    blurb: 'Public ticker. Crypto, plus EUR and gold where Binance lists a proxy.',
  },
  [STRADES_QUOTE_FEED]: {
    label: 'Strades quotes',
    blurb: 'The backend attached a quote. No venue API is named on the asset.',
  },
  [CATALOG_FEED]: {
    label: 'Catalog only',
    blurb: 'No live quote. The price is the one stored with the asset.',
  },
}

const LOCAL_FEED_ORDER = ['kalshi', 'polymarket', 'bets', BINANCE_FEED, STRADES_QUOTE_FEED, CATALOG_FEED]

export interface FeedAssetInput {
  id: string
  symbol: string
  name: string
  type?: string | null
  tags?: string[] | null
  source?: string | null
  live?: { pair?: string } | null
}

export function feedKeyForAsset(asset: FeedAssetInput): string {
  const tags = (asset.tags ?? []).map(t => String(t).toLowerCase())
  const source = String(asset.source ?? '').toLowerCase()
  const isBet = String(asset.type ?? '').toLowerCase() === 'bet' || tags.includes('bet')
  if (isBet) {
    if (source === 'polymarket' || tags.includes('polymarket')) return 'polymarket'
    if (source === 'kalshi' || tags.includes('kalshi')) return 'kalshi'
    if (source) return source
    return 'bets'
  }
  const pair = asset.live?.pair
  if (pair && pair !== STRADES_QUOTE_FEED) return BINANCE_FEED
  if (asset.live) return STRADES_QUOTE_FEED
  return CATALOG_FEED
}

export function indexAssetsByFeed<T extends FeedAssetInput>(assets: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const asset of assets) {
    const key = feedKeyForAsset(asset)
    const list = map.get(key)
    if (list) list.push(asset)
    else map.set(key, [asset])
  }
  return map
}

/** Feeds that have assets and are not already a provider row. */
export function extraFeedKeys(indexed: Map<string, FeedAssetInput[]>, providerIds: string[]): string[] {
  const covered = new Set(providerIds)
  const keys = [...indexed.keys()].filter(id => !covered.has(id) && (indexed.get(id)?.length ?? 0) > 0)
  keys.sort((a, b) => {
    const ia = LOCAL_FEED_ORDER.indexOf(a)
    const ib = LOCAL_FEED_ORDER.indexOf(b)
    return (ia === -1 ? LOCAL_FEED_ORDER.length : ia) - (ib === -1 ? LOCAL_FEED_ORDER.length : ib)
      || a.localeCompare(b)
  })
  return keys
}
