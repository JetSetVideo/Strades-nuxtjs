import { describe, expect, it } from 'vitest'
import {
  BINANCE_FEED,
  CATALOG_FEED,
  assetFeedStreams,
  extraFeedKeys,
  feedKeyForAsset,
  feedStreams,
  indexAssetsByFeed,
  STRADES_QUOTE_FEED,
} from '~/utils/assetFeeds'

const base = { id: '1', symbol: 'X', name: 'X' }

describe('feedKeyForAsset', () => {
  it('sends a Kalshi bet to Kalshi even when the quote pair is the backend placeholder', () => {
    expect(feedKeyForAsset({
      ...base,
      type: 'bet',
      tags: ['bet', 'kalshi', 'politics'],
      live: { pair: 'strades-api' },
    })).toBe('kalshi')
  })

  it('sends a Polymarket bet to Polymarket from source or tag', () => {
    expect(feedKeyForAsset({ ...base, type: 'bet', source: 'polymarket' })).toBe('polymarket')
    expect(feedKeyForAsset({ ...base, type: 'bet', tags: ['polymarket'] })).toBe('polymarket')
  })

  it('treats a non-placeholder live pair as Binance', () => {
    expect(feedKeyForAsset({ ...base, type: 'cryptocurrency', symbol: 'BTC', live: { pair: 'BTCUSDT' } })).toBe(BINANCE_FEED)
    expect(feedKeyForAsset({ ...base, type: 'commodity', symbol: 'XAU', live: { pair: 'PAXGUSDT' } })).toBe(BINANCE_FEED)
  })

  it('keeps a backend quote with no venue on the Strades feed', () => {
    expect(feedKeyForAsset({
      ...base, type: 'fiat_currency', symbol: 'GBP', live: { pair: 'strades-api' },
    })).toBe(STRADES_QUOTE_FEED)
  })

  it('puts an unquoted asset in the catalog', () => {
    expect(feedKeyForAsset({ ...base, type: 'stock', symbol: 'AAPL' })).toBe(CATALOG_FEED)
  })
})

describe('feedStreams', () => {
  it('keeps an enabled live feed and drops a blocked one even when the switch is on', () => {
    expect(feedStreams(true, 'live')).toBe(true)
    expect(feedStreams(true, 'ok')).toBe(true)
    expect(feedStreams(true, 'blocked')).toBe(false)
    expect(feedStreams(false, 'live')).toBe(false)
    expect(feedStreams(true, undefined)).toBe(true)
  })

  it('stops a Kalshi bet when that feed is disconnected', () => {
    const bet = { ...base, type: 'bet', tags: ['kalshi'] }
    const enabled = (id: string) => id !== 'kalshi'
    expect(assetFeedStreams(bet, enabled, () => 'live')).toBe(false)
    expect(assetFeedStreams(bet, () => true, () => 'live')).toBe(true)
    expect(assetFeedStreams(
      { ...base, type: 'bet', source: 'polymarket' },
      () => true,
      (id) => (id === 'polymarket' ? 'blocked' : 'live'),
    )).toBe(false)
  })
})

describe('extraFeedKeys', () => {
  it('hides feeds already listed as providers and keeps a stable order', () => {
    const indexed = indexAssetsByFeed([
      { ...base, id: 'a', type: 'bet', tags: ['kalshi'] },
      { ...base, id: 'b', type: 'cryptocurrency', live: { pair: 'BTCUSDT' } },
      { ...base, id: 'c', type: 'stock' },
      { ...base, id: 'd', type: 'fiat_currency', live: { pair: 'strades-api' } },
    ])
    expect(extraFeedKeys(indexed, ['kalshi', 'polymarket'])).toEqual([
      BINANCE_FEED,
      STRADES_QUOTE_FEED,
      CATALOG_FEED,
    ])
  })
})
