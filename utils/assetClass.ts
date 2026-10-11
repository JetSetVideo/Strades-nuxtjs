/**
 * Asset-class taxonomy — one source of truth for how an asset is themed.
 *
 * Used by the News feed (fallback thumbnails + colour-coded category tags),
 * the asset detail page (default header artwork) and the top navigation bar
 * (brand logo when viewing an asset).
 *
 * Backend taxonomy this maps from (`/api/assets/`):
 *   type     — commodity | cryptocurrency | fiat_currency | stock
 *   category — precious_metals | energy | layer1 | meme | payments |
 *              major | finance | healthcare | technology
 *
 * Artwork is inline SVG encoded as a data URI: no network request, no missing
 * image, and it renders identically offline.
 */

export const ASSET_CLASSES = [
  'precious_metals',
  'commodities',
  'fiat',
  'crypto',
  'stocks',
] as const

export type AssetClassId = typeof ASSET_CLASSES[number]

export interface AssetClassTheme {
  id: AssetClassId
  label: string
  /** Primary accent — used for tag text and borders. */
  color: string
  /** Translucent fill for tag backgrounds. */
  tint: string
  /** Two-stop gradient for artwork and headers. */
  gradient: [string, string]
}

const THEMES: Record<AssetClassId, AssetClassTheme> = {
  precious_metals: {
    id: 'precious_metals',
    label: 'Precious Metals',
    color: '#f4c145',
    tint: 'rgba(244, 193, 69, 0.14)',
    gradient: ['#f7d774', '#b8860b'],
  },
  commodities: {
    id: 'commodities',
    label: 'Commodities',
    color: '#ff9f45',
    tint: 'rgba(255, 159, 69, 0.14)',
    gradient: ['#ffb066', '#c2410c'],
  },
  fiat: {
    id: 'fiat',
    label: 'Fiat Currencies',
    color: '#4fa8ff',
    tint: 'rgba(79, 168, 255, 0.14)',
    gradient: ['#7cc0ff', '#1d4ed8'],
  },
  crypto: {
    id: 'crypto',
    label: 'Crypto',
    color: '#b48aff',
    tint: 'rgba(180, 138, 255, 0.14)',
    gradient: ['#c9a6ff', '#6d28d9'],
  },
  stocks: {
    id: 'stocks',
    label: 'Stocks',
    color: '#00e58a',
    tint: 'rgba(0, 229, 138, 0.14)',
    gradient: ['#5cf0b4', '#047857'],
  },
}

/**
 * Ticker → class for the traded universe. Needed because news items reference
 * bare symbols ("BTC", "XAU") with no type or category attached, so there is
 * nothing else to classify them by.
 */
const SYMBOL_CLASS: Record<string, AssetClassId> = {
  // Precious metals
  XAU: 'precious_metals', XAG: 'precious_metals', XPT: 'precious_metals',
  XPD: 'precious_metals', GOLD: 'precious_metals', SILVER: 'precious_metals',
  // Other commodities
  WTI: 'commodities', BRN: 'commodities', NG: 'commodities',
  HG: 'commodities', CL: 'commodities', OIL: 'commodities', COPPER: 'commodities',
  // Crypto
  BTC: 'crypto', ETH: 'crypto', SOL: 'crypto', ADA: 'crypto', XRP: 'crypto',
  DOGE: 'crypto', DOT: 'crypto', LINK: 'crypto', AVAX: 'crypto', MATIC: 'crypto',
  // Fiat
  USD: 'fiat', EUR: 'fiat', JPY: 'fiat', GBP: 'fiat',
  CHF: 'fiat', CAD: 'fiat', AUD: 'fiat', CNY: 'fiat',
}

/**
 * Classify a bare token (ticker, pair or tag). Returns null when the token is
 * not a recognised instrument — callers then fall back to a broader signal
 * such as the article's own category.
 */
export function classifyToken(token: string | null | undefined): AssetClassId | null {
  if (!token) return null
  const upper = token.replace(/^#/, '').toUpperCase()

  if (SYMBOL_CLASS[upper]) return SYMBOL_CLASS[upper]

  // FX pairs: "EUR/USD", "EURUSD"
  const pair = upper.replace('/', '')
  if (pair.length === 6 && SYMBOL_CLASS[pair.slice(0, 3)] === 'fiat' && SYMBOL_CLASS[pair.slice(3)] === 'fiat') {
    return 'fiat'
  }
  if (upper.includes('/')) return 'fiat'

  return null
}

export interface AssetLike {
  type?: string | null
  category?: string | null
  symbol?: string | null
  name?: string | null
}

/**
 * Resolve an asset (or a loose news tag) to its class.
 * Falls back to `stocks` — the most common case — when nothing matches.
 */
export function resolveAssetClass(asset: AssetLike | string | null | undefined): AssetClassId {
  if (!asset) return 'stocks'

  if (typeof asset === 'string') {
    return resolveAssetClass({ symbol: asset, category: asset, type: asset })
  }

  // A known ticker is the strongest signal — it distinguishes precious metals
  // from other commodities, which type/category alone cannot.
  const bySymbol = classifyToken(asset.symbol)
  if (bySymbol) return bySymbol

  const category = (asset.category ?? '').toLowerCase()
  if (category.includes('precious')) return 'precious_metals'

  const type = (asset.type ?? '').toLowerCase()
  if (type.includes('crypto') || category === 'layer1' || category === 'meme') return 'crypto'
  if (type.includes('fiat') || type === 'forex' || category === 'major') return 'fiat'
  if (type.includes('commodit') || category === 'energy') return 'commodities'
  if (type.includes('stock') || type === 'equity') return 'stocks'

  // News categories use their own vocabulary.
  if (category === 'crypto') return 'crypto'
  if (category === 'forex') return 'fiat'
  if (category === 'commodities') return 'commodities'
  if (category === 'stocks') return 'stocks'

  return 'stocks'
}

export function assetClassTheme(input: AssetLike | AssetClassId | string | null | undefined): AssetClassTheme {
  if (typeof input === 'string' && (ASSET_CLASSES as readonly string[]).includes(input)) {
    return THEMES[input as AssetClassId]
  }
  return THEMES[resolveAssetClass(input as AssetLike | string)]
}

const encode = (svg: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(svg.replace(/\s+/g, ' ').trim())}`

/** Distinct motif per class, drawn on the class gradient. */
function artworkSvg(cls: AssetClassId): string {
  const { gradient: [from, to] } = THEMES[cls]

  const motifs: Record<AssetClassId, string> = {
    // Stacked ingots
    precious_metals: `
      <g fill="rgba(255,255,255,0.92)">
        <path d="M56 104h56l10 18H46z"/>
        <path d="M92 80h44l9 18H83z"/>
        <path d="M24 80h44l9 18H15z"/>
      </g>`,
    // Barrel with a flame
    commodities: `
      <g fill="rgba(255,255,255,0.92)">
        <rect x="52" y="62" width="56" height="62" rx="8"/>
        <rect x="44" y="78" width="72" height="8" opacity="0.55"/>
        <rect x="44" y="100" width="72" height="8" opacity="0.55"/>
        <path d="M80 24c14 16 22 26 22 36a22 22 0 0 1-44 0c0-10 8-20 22-36z" opacity="0.85"/>
      </g>`,
    // Banknote
    fiat: `
      <g fill="rgba(255,255,255,0.92)">
        <rect x="20" y="52" width="120" height="72" rx="10"/>
        <circle cx="80" cy="88" r="20" fill="${to}"/>
        <path d="M80 76v24M72 82h16M72 94h16" stroke="rgba(255,255,255,0.95)" stroke-width="4" fill="none" stroke-linecap="round"/>
      </g>`,
    // Linked hex nodes
    crypto: `
      <g fill="none" stroke="rgba(255,255,255,0.92)" stroke-width="7" stroke-linejoin="round">
        <path d="M80 34l30 17v34L80 102 50 85V51z"/>
      </g>
      <g fill="rgba(255,255,255,0.92)">
        <circle cx="80" cy="34" r="9"/><circle cx="110" cy="85" r="9"/><circle cx="50" cy="85" r="9"/>
      </g>`,
    // Candlesticks
    stocks: `
      <g fill="rgba(255,255,255,0.92)">
        <rect x="36" y="74" width="16" height="34" rx="4"/><rect x="41" y="62" width="6" height="58" rx="3"/>
        <rect x="72" y="52" width="16" height="46" rx="4"/><rect x="77" y="40" width="6" height="70" rx="3"/>
        <rect x="108" y="86" width="16" height="26" rx="4"/><rect x="113" y="74" width="6" height="50" rx="3"/>
      </g>`,
  }

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="${from}"/>
          <stop offset="1" stop-color="${to}"/>
        </linearGradient>
      </defs>
      <rect width="160" height="160" fill="url(#g)"/>
      ${motifs[cls]}
    </svg>`
}

const artworkCache = new Map<AssetClassId, string>()

/**
 * Default artwork for a class — the News thumbnail fallback and the asset
 * page's header visual. Cached because the encoded string is stable.
 */
export function assetClassArtwork(input: AssetLike | AssetClassId | string | null | undefined): string {
  const cls = assetClassTheme(input).id
  let art = artworkCache.get(cls)
  if (!art) {
    art = encode(artworkSvg(cls))
    artworkCache.set(cls, art)
  }
  return art
}

/** Inline style object for a colour-coded category tag. */
export function assetClassTagStyle(input: AssetLike | AssetClassId | string | null | undefined) {
  const theme = assetClassTheme(input)
  return {
    color: theme.color,
    background: theme.tint,
    borderColor: theme.color,
  }
}
