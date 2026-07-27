/**
 * usePriceCache — localStorage-backed TTL cache for financial data.
 *
 * Data tiers (speed → staleness tolerance):
 *  HOT   (2 min)  — base reference prices: BTC, ETH, XAU, EUR, GBP, JPY
 *  WARM  (5 min)  — full asset list with current prices
 *  COLD  (24 h)   — asset metadata only (name, symbol, type, icon_url, market_cap)
 *
 * Strategy:
 *  1. On boot: serve from cache immediately (zero network latency to user)
 *  2. Background: fetch fresh data from backend
 *  3. On update: overwrite cache + update derived values
 *
 * Base prices (BTC, ETH, XAU, EUR) are stored separately because every
 * other price in the app can be expressed relative to them.
 */

// ── Cache keys ────────────────────────────────────────────────────────────
const KEYS = {
  ASSETS_WARM:  'strades_assets_v1',
  ASSETS_META:  'strades_assets_meta_v1',
  BASE_PRICES:  'strades_base_prices_v1',
  MARKET_STATE: 'strades_market_state_v1',
} as const

// ── TTL in milliseconds ───────────────────────────────────────────────────
const TTL = {
  HOT:   2 * 60 * 1000,          //  2 min  — base prices
  WARM:  5 * 60 * 1000,          //  5 min  — full asset list
  COLD:  24 * 60 * 60 * 1000,    // 24 hrs  — metadata
} as const

// ── Base price symbols — the "anchors" everything else derives from ────────
export const BASE_SYMBOLS = ['BTC', 'ETH', 'XAU', 'EUR', 'GBP', 'JPY', 'XAG', 'WTI']

interface CacheEntry<T> {
  data: T
  savedAt: number   // ms since epoch
}

// ── Helpers ───────────────────────────────────────────────────────────────

function _save<T>(key: string, data: T): void {
  if (typeof window === 'undefined') return
  try {
    const entry: CacheEntry<T> = { data, savedAt: Date.now() }
    localStorage.setItem(key, JSON.stringify(entry))
  } catch {
    // Storage quota exceeded or private mode — silently skip
  }
}

function _load<T>(key: string, ttl: number): T | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const entry: CacheEntry<T> = JSON.parse(raw)
    if (Date.now() - entry.savedAt > ttl) return null  // expired
    return entry.data
  } catch {
    return null
  }
}

function _peek<T>(key: string): { data: T; ageMs: number } | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const entry: CacheEntry<T> = JSON.parse(raw)
    return { data: entry.data, ageMs: Date.now() - entry.savedAt }
  } catch {
    return null
  }
}

function _remove(key: string): void {
  if (typeof window === 'undefined') return
  try { localStorage.removeItem(key) } catch { /* noop */ }
}

// ── Public composable ─────────────────────────────────────────────────────

export interface BasePriceMap {
  [symbol: string]: number   // e.g. { BTC: 85000, ETH: 2000, EUR: 1.085 }
}

export const usePriceCache = () => {

  // ── Asset list (WARM tier) ──────────────────────────────────────────────

  function loadAssets<T>(): T | null {
    return _load<T>(KEYS.ASSETS_WARM, TTL.WARM)
  }

  function saveAssets<T>(assets: T): void {
    _save(KEYS.ASSETS_WARM, assets)
    // Also extract and save base prices from this set
    if (Array.isArray(assets)) {
      const bases: BasePriceMap = {}
      for (const a of assets as any[]) {
        if (BASE_SYMBOLS.includes(a.symbol)) {
          bases[a.symbol] = Number(a.current_price)
        }
      }
      if (Object.keys(bases).length > 0) saveBasePrices(bases)
    }
  }

  /** Returns cached assets ignoring TTL — for "stale-while-revalidate" UI */
  function peekAssets<T>(): { data: T; ageMs: number; isStale: boolean } | null {
    const result = _peek<T>(KEYS.ASSETS_WARM)
    if (!result) return null
    return { ...result, isStale: result.ageMs > TTL.WARM }
  }

  // ── Asset metadata (COLD tier — no prices, just static info) ─────────────

  function loadAssetMeta<T>(): T | null {
    return _load<T>(KEYS.ASSETS_META, TTL.COLD)
  }

  function saveAssetMeta<T>(meta: T): void {
    _save(KEYS.ASSETS_META, meta)
  }

  // ── Base prices (HOT tier) ────────────────────────────────────────────────

  function loadBasePrices(): BasePriceMap | null {
    return _load<BasePriceMap>(KEYS.BASE_PRICES, TTL.HOT)
  }

  function saveBasePrices(prices: BasePriceMap): void {
    _save(KEYS.BASE_PRICES, prices)
  }

  /** Always return base prices, ignoring TTL — for display even if stale */
  function peekBasePrices(): BasePriceMap {
    const result = _peek<BasePriceMap>(KEYS.BASE_PRICES)
    return result?.data ?? {}
  }

  function getBasePrice(symbol: string): number | null {
    const prices = peekBasePrices()
    return prices[symbol] ?? null
  }

  // ── Market state (WARM tier) ──────────────────────────────────────────────

  interface MarketState {
    sentiment: number      // -1 bear → +1 bull
    volatility: number     // 0-1
    dominantClass: string  // stocks / crypto / commodities / fiat
    updatedAt: string
  }

  function loadMarketState(): MarketState | null {
    return _load<MarketState>(KEYS.MARKET_STATE, TTL.WARM)
  }

  function saveMarketState(state: MarketState): void {
    _save(KEYS.MARKET_STATE, state)
  }

  // ── Cache age helpers ────────────────────────────────────────────────────

  function assetCacheAgeMs(): number | null {
    const r = _peek(KEYS.ASSETS_WARM)
    return r ? r.ageMs : null
  }

  function assetCacheAgeLabel(): string {
    const ms = assetCacheAgeMs()
    if (ms === null) return 'No cache'
    if (ms < 60_000) return `${Math.round(ms / 1000)}s ago`
    if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m ago`
    return `${Math.round(ms / 3_600_000)}h ago`
  }

  function isAssetCacheStale(): boolean {
    const r = _peek(KEYS.ASSETS_WARM)
    return !r || r.ageMs > TTL.WARM
  }

  // ── Full cache wipe (e.g. logout) ─────────────────────────────────────────

  function clearAll(): void {
    Object.values(KEYS).forEach(_remove)
  }

  return {
    // Assets
    loadAssets,
    saveAssets,
    peekAssets,
    // Metadata
    loadAssetMeta,
    saveAssetMeta,
    // Base prices
    loadBasePrices,
    saveBasePrices,
    peekBasePrices,
    getBasePrice,
    // Market state
    loadMarketState,
    saveMarketState,
    // Helpers
    assetCacheAgeMs,
    assetCacheAgeLabel,
    isAssetCacheStale,
    clearAll,
    TTL,
    BASE_SYMBOLS,
  }
}
