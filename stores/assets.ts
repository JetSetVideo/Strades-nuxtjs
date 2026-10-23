import { defineStore } from 'pinia'
import { usePriceCache } from '~/composables/usePriceCache'
import { publicAssetUrl } from '~/composables/useLocalJson'
import { feedKeyForAsset } from '~/utils/assetFeeds'
import { useDataFeedsStore } from '~/stores/dataFeeds'
import type { Asset } from '~/types/asset'
import { buildMarketTree, type MarketNode } from '~/utils/marketTree'
import type { LiveQuote } from '~/server/api/market/quotes.get'

export type AssetSource = 'api' | 'bundled' | 'none'

export type { Asset } from '~/types/asset'

/**
 * API → store shape. The Django serializer names the 24h move `price_change_24h`;
 * only a number backed by a real quote (`quote_updated_at`) becomes
 * change_24h_pct — an unknown move must stay unknown, never a fake 0.00%.
 */
function fromApi(raw: Asset & { price_change_24h?: number | string | null; quote_updated_at?: string | null }): Asset {
  const a: Asset = { ...raw }
  // DRF serializes DecimalField as strings ("3.800000"); the UI does arithmetic on these.
  const num = (v: unknown) => (v === null || v === undefined || v === '' ? undefined : Number(v))
  a.current_price = num(raw.current_price) ?? 0
  a.market_cap = num(raw.market_cap)
  const change = num(raw.price_change_24h)
  if (change !== undefined && Number.isFinite(change) && raw.quote_updated_at) {
    a.change_24h_pct = change
    a.live = { pair: 'strades-api', at: raw.quote_updated_at } // quoted by the backend (refresh_quotes)
  }
  return a
}

export const useAssetsStore = defineStore('assets', {
  state: () => ({
    assets: [] as Asset[],
    loading: false,        // true only when there is zero data (first cold load)
    isRefreshing: false,   // true during background refresh (data already shown)
    fromCache: false,      // true when current data was served from localStorage
    error: null as Error | null,
    lastUpdated: null as Date | null,
    dataSource: 'none' as AssetSource,
    liveCount: 0,
  }),

  getters: {
    /**
     * Market tree over LIVE quotes only (real 24h moves). One source of truth
     * for every compact market readout (nav icon, nav value): root.ret is the
     * cap-weighted live market move, root.children the per-class moves.
     * Null until live quotes have arrived.
     */
    liveMarket: (state): MarketNode | null => {
      const live = state.assets.filter(a => a.live && typeof a.change_24h_pct === 'number')
      if (!live.length) return null
      return buildMarketTree(live.map(a => ({
        id: a.id, label: a.symbol, classKey: a.type ?? 'stock', sectorKey: a.category || 'other',
        cap: a.market_cap ?? null, ret: (a.change_24h_pct as number) / 100, history: a.return_history,
      })))
    },

    getAssetById: (state) => (id: string) => {
      return state.assets.find(asset => asset.id === id)
    },

    getAssetBySymbol: (state) => (symbol: string) => {
      return state.assets.find(asset => asset.symbol === symbol)
    },

    getAssetsByType: (state) => (type: string) => {
      return state.assets.filter(asset => asset.type === type)
    },

    getAssetsByCategory: (state) => (category: string) => {
      return state.assets.filter(asset => asset.category === category)
    },

    getAssetsByProximityLevel: (state) => (level: number) => {
      return state.assets.filter(asset => asset.proximity_level === level)
    }
  },

  actions: {
    /**
     * Fetch fresh data; update cache and store.
     *
     * Sources, in order: Django API → bundled /core/assets.json. An API that
     * answers with ZERO assets (empty dev DB) is treated as "no data", not as
     * success — that silently blanked /prices before. `dataSource` records
     * which source won, and every fallback is logged.
     * Live quotes (server/api/market/quotes) are then merged on top.
     */
    async fetchAssets() {
      // Capture Nuxt context before the first await (it is lost after one).
      const priceCache = usePriceCache()
      const { $api } = useNuxtApp()
      const localAssetsUrl = publicAssetUrl('/core/assets.json')
      const quotesUrl = publicAssetUrl('/api/market/quotes')

      const unwrap = (raw: { results?: Asset[] } | Asset[] | null | undefined): Asset[] =>
        Array.isArray(raw) ? raw : raw?.results ?? []

      let assets: Asset[] = []
      let source: AssetSource = 'none'
      try {
        // DRF paginates (20/page) — follow `next` so no asset silently disappears.
        type Page = { results?: Asset[]; next?: string | null } | Asset[]
        const get = $api as (url: string) => Promise<Page>
        let page: Page = await get('/api/assets/')
        assets = unwrap(page)
        for (let guard = 0; !Array.isArray(page) && page.next && guard < 50; guard++) {
          const next = new URL(page.next)
          page = await get(`${next.pathname}${next.search}`)
          assets = assets.concat(unwrap(page))
        }
        assets = assets.map(fromApi)
        // The API catalogue has no logos / relationship links yet: fill blanks from the bundled one by id.
        const bundled = await $fetch<Asset[]>(localAssetsUrl).catch(() => [] as Asset[])
        const byId = new Map(bundled.map(b => [b.id, b]))
        assets = assets.map(a => {
          const b = byId.get(a.id)
          if (!b) return a
          return {
            ...a,
            icon_url: a.icon_url || b.icon_url,
            similar_assets: a.similar_assets ?? b.similar_assets,
            depends_on: a.depends_on ?? b.depends_on,
          }
        })
        if (assets.length) source = 'api'
        else console.warn('[assets] /api/assets/ returned 0 assets; falling back to bundled list')
      } catch (err) {
        console.warn('[assets] /api/assets/ failed; falling back to bundled list', err)
      }

      if (!assets.length) {
        try {
          assets = await $fetch<Asset[]>(localAssetsUrl)
          source = 'bundled'
        } catch (error) {
          this.error = error as Error
          console.error('[assets] bundled assets.json failed too', error)
          return
        }
      }

      this.assets = assets
      this.dataSource = source
      this.fromCache = false
      this.lastUpdated = new Date()
      this.error = null
      priceCache.saveAssets(assets)
      await this.mergeLiveQuotes(quotesUrl)
    },

    /** Overlay real prices / 24h change / hourly history where a live market exists. */
    async mergeLiveQuotes(quotesUrl = publicAssetUrl('/api/market/quotes')) {
      const symbols = this.assets.map(a => a.symbol).filter(Boolean)
      if (!symbols.length) return
      try {
        const { quotes, at } = await $fetch<{ quotes: Record<string, LiveQuote>; at: string }>(quotesUrl, {
          query: { symbols: symbols.join(',') },
        })
        const feeds = useDataFeedsStore()
        for (const a of this.assets) {
          // A stopped feed keeps its last quote and simply leaves the list.
          if (!feeds.receiving(feedKeyForAsset(a))) continue
          const q = quotes[a.symbol?.toUpperCase()]
          if (!q) continue
          a.current_price = q.price
          a.change_24h_pct = q.change_24h_pct
          a.return_history = q.history
          a.live = { pair: q.pair, proxy: q.proxy, at }
        }
        this.liveCount = this.assets.filter(x => x.live).length
      } catch (err) {
        this.liveCount = this.assets.filter(x => x.live).length
        console.warn('[assets] live quotes unavailable; showing bundled prices', err)
      }
    },

    /**
     * Boot strategy:
     *  1. Serve stale-or-fresh cache immediately (zero-latency to user)
     *  2. Kick off background refresh; set isRefreshing so UI shows overlay
     *  3. On completion, swap in fresh data silently
     */
    async initializeStore() {
      const priceCache = usePriceCache()
      if (this.isRefreshing) return

      // ── Step 1: load from cache (ignoring TTL — stale-while-revalidate) ──
      const cached = priceCache.peekAssets<Asset[]>()
      if (cached && cached.data.length > 0) {
        this.assets = cached.data
        this.fromCache = true
        this.loading = false
      } else {
        // Truly no data yet — show skeleton
        this.loading = true
      }

      // ── Step 2: background refresh ────────────────────────────────────────
      this.isRefreshing = true
      await this.fetchAssets()
      this.loading = false
      this.isRefreshing = false
    },

    updateAssetPrice(assetId: string, newPrice: number) {
      const asset = this.assets.find(a => a.id === assetId)
      if (asset) {
        asset.current_price = newPrice
        asset.updated_at = new Date().toISOString()
      }
    },

    getAssetPriceHistory(assetId: string) {
      return []
    }
  }
}) 