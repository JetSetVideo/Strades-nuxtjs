/**
 * Marks for the linked-asset cards: class colour, and a logo when we have one.
 * A ticker we trade wins over a guessed company name. Unknown names stay grey
 * initials rather than borrowing the stock green.
 */
import { assetClassArtwork, assetClassTheme, classifyToken, type AssetLike } from '~/utils/assetClass'
import { BET_COLOR, isBetAsset } from '~/utils/betAssets'

const ALIAS: Record<string, string> = {
  tsmc: 'TSM', amd: 'AMD', 'meta platforms': 'META', meta: 'META',
  microsoft: 'MSFT', nvidia: 'NVDA', alphabet: 'GOOGL', google: 'GOOGL',
  apple: 'AAPL', amazon: 'AMZN', tesla: 'TSLA', intel: 'INTC',
  silver: 'XAG', gold: 'XAU', 'us dollar': 'USD', 'u.s. dollar': 'USD', dollar: 'USD',
  'natural gas': 'NG', brent: 'BRN', bitcoin: 'BTC', ethereum: 'ETH', solana: 'SOL',
  euro: 'EUR',
}

/** Local issuer and coin marks. Remote catalogue icons still win when present. */
const LOCAL_LOGO: Record<string, string> = {
  TSLA: '/logos/logo_Tesla.png', AAPL: '/logos/apple.png', AMZN: '/logos/amazon.png',
  GOOGL: '/logos/google.png', MSFT: '/logos/msft.png', INTC: '/logos/intel.png',
  NVDA: '/logos/nvidia.png', BTC: '/logos/btc.svg', ETH: '/logos/eth.png',
}

export interface LinkedTone { color: string; tint: string; label: string }

const NEUTRAL: LinkedTone = { color: '#9aa0a6', tint: 'rgba(154, 160, 166, 0.14)', label: '' }
const BET_TONE: LinkedTone = { color: BET_COLOR, tint: 'rgba(255, 77, 157, 0.16)', label: 'Bet' }

const SHORT: Record<string, string> = {
  stocks: 'Stock', crypto: 'Crypto', fiat: 'Fiat', commodities: 'Commodity', precious_metals: 'Metal',
}

export function linkedSymbol(name: string, symbol?: string | null): string {
  const given = String(symbol ?? '').trim().toUpperCase()
  if (given) return given
  return ALIAS[name.trim().toLowerCase()] ?? ''
}

export function linkedTone(asset: (AssetLike & { type?: string | null }) | null | undefined, symbol = ''): LinkedTone {
  const sym = symbol.toUpperCase()
  if (isBetAsset(asset) || /^KX[A-Z0-9]/i.test(sym)) return BET_TONE
  if (!asset && !sym) return NEUTRAL
  const theme = assetClassTheme(asset ?? sym)
  if (!asset && !classifyToken(sym) && theme.id === 'stocks' && !/^[A-Z]{1,5}$/.test(sym)) return NEUTRAL
  return { color: theme.color, tint: theme.tint, label: SHORT[theme.id] ?? theme.label }
}

function equityTicker(symbol: string): boolean {
  if (!symbol || /^KX/i.test(symbol)) return false
  if (classifyToken(symbol)) return false
  return /^[A-Z]{1,5}$/.test(symbol)
}

/** Photo logo, then a known file, then a public company mark, then class artwork. */
export function linkedLogo(iconUrl: string | null | undefined, symbol: string, asset?: AssetLike | null): string | null {
  const icon = String(iconUrl ?? '').trim()
  // countryflags.io no longer resolves; a class mark is better than a broken image.
  if (icon && !/countryflags\.io/i.test(icon)) return icon
  const sym = symbol.toUpperCase()
  if (LOCAL_LOGO[sym]) return LOCAL_LOGO[sym]
  if (equityTicker(sym)) return `https://companiesmarketcap.com/img/company-logos/256/${sym}.png`
  if (sym || asset) return assetClassArtwork(asset ?? sym)
  return null
}
