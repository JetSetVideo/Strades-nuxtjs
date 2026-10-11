/**
 * Asset-class taxonomy tests.
 *
 * This module decides the colour and fallback artwork for every news tag,
 * asset header and nav brand mark, so a misclassification is visible
 * everywhere at once. The cases below pin the distinctions that are easy to
 * get wrong — chiefly Precious Metals vs. other Commodities, which the
 * backend's `type` field alone cannot express.
 */
import { describe, expect, it } from 'vitest'
import {
  ASSET_CLASSES,
  assetClassArtwork,
  assetClassTagStyle,
  assetClassTheme,
  classifyToken,
  resolveAssetClass,
} from '~/utils/assetClass'

describe('classifyToken', () => {
  it('separates precious metals from other commodities', () => {
    expect(classifyToken('XAU')).toBe('precious_metals')
    expect(classifyToken('XAG')).toBe('precious_metals')
    expect(classifyToken('WTI')).toBe('commodities')
    expect(classifyToken('NG')).toBe('commodities')
  })

  it('recognises crypto and fiat tickers', () => {
    expect(classifyToken('BTC')).toBe('crypto')
    expect(classifyToken('ETH')).toBe('crypto')
    expect(classifyToken('EUR')).toBe('fiat')
    expect(classifyToken('JPY')).toBe('fiat')
  })

  it('handles FX pairs in both notations, and leading hashes', () => {
    expect(classifyToken('EUR/USD')).toBe('fiat')
    expect(classifyToken('EURUSD')).toBe('fiat')
    expect(classifyToken('#BTC')).toBe('crypto')
  })

  it('is case-insensitive', () => {
    expect(classifyToken('btc')).toBe('crypto')
    expect(classifyToken('xau')).toBe('precious_metals')
  })

  it('returns null for tokens that are not instruments', () => {
    expect(classifyToken('swing_trade')).toBeNull()
    expect(classifyToken('TSLA')).toBeNull() // an equity, not in the ticker table
    expect(classifyToken('')).toBeNull()
    expect(classifyToken(null)).toBeNull()
  })
})

describe('resolveAssetClass', () => {
  it('classifies backend asset records by type and category', () => {
    expect(resolveAssetClass({ type: 'commodity', category: 'precious_metals', symbol: 'XAU' }))
      .toBe('precious_metals')
    expect(resolveAssetClass({ type: 'commodity', category: 'energy', symbol: 'NG' }))
      .toBe('commodities')
    expect(resolveAssetClass({ type: 'cryptocurrency', category: 'layer1', symbol: 'SOL' }))
      .toBe('crypto')
    expect(resolveAssetClass({ type: 'fiat_currency', category: 'major', symbol: 'GBP' }))
      .toBe('fiat')
    expect(resolveAssetClass({ type: 'stock', category: 'technology', symbol: 'AAPL' }))
      .toBe('stocks')
  })

  it('lets a known ticker override a coarse type', () => {
    // Gold arrives typed only as a commodity; the ticker is what makes it precious.
    expect(resolveAssetClass({ type: 'commodity', symbol: 'XAU' })).toBe('precious_metals')
  })

  it('maps news categories, which use their own vocabulary', () => {
    expect(resolveAssetClass({ category: 'crypto' })).toBe('crypto')
    expect(resolveAssetClass({ category: 'forex' })).toBe('fiat')
    expect(resolveAssetClass({ category: 'commodities' })).toBe('commodities')
    expect(resolveAssetClass({ category: 'stocks' })).toBe('stocks')
  })

  it('falls back to stocks rather than throwing on unknown input', () => {
    expect(resolveAssetClass(null)).toBe('stocks')
    expect(resolveAssetClass({})).toBe('stocks')
    expect(resolveAssetClass({ type: 'something-new' })).toBe('stocks')
  })
})

describe('themes and artwork', () => {
  it('gives every class a distinct label and accent colour', () => {
    const colors = new Set<string>()
    const labels = new Set<string>()
    for (const cls of ASSET_CLASSES) {
      const theme = assetClassTheme(cls)
      expect(theme.color).toMatch(/^#[0-9a-f]{6}$/i)
      colors.add(theme.color)
      labels.add(theme.label)
    }
    expect(colors.size).toBe(ASSET_CLASSES.length)
    expect(labels.size).toBe(ASSET_CLASSES.length)
  })

  it('names the four classes the spec calls out', () => {
    expect(assetClassTheme('precious_metals').label).toBe('Precious Metals')
    expect(assetClassTheme('commodities').label).toBe('Commodities')
    expect(assetClassTheme('fiat').label).toBe('Fiat Currencies')
    expect(assetClassTheme('crypto').label).toBe('Crypto')
  })

  it('produces self-contained inline SVG artwork per class', () => {
    const seen = new Set<string>()
    for (const cls of ASSET_CLASSES) {
      const art = assetClassArtwork(cls)
      expect(art.startsWith('data:image/svg+xml')).toBe(true)
      // No network dependency — the whole image travels in the URI.
      expect(art).not.toMatch(/https?:\/\//)
      seen.add(art)
    }
    expect(seen.size).toBe(ASSET_CLASSES.length)
  })

  it('routes a bare ticker to its class artwork', () => {
    expect(assetClassArtwork('XAU')).toBe(assetClassArtwork('precious_metals'))
    expect(assetClassArtwork('BTC')).toBe(assetClassArtwork('crypto'))
  })

  it('builds tag styles that carry colour, tint and border', () => {
    const style = assetClassTagStyle('BTC')
    expect(style.color).toBe(assetClassTheme('crypto').color)
    expect(style.background).toContain('rgba')
    expect(style.borderColor).toBe(style.color)
  })
})
