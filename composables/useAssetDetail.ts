/**
 * useAssetDetail — fetches the full enriched asset profile from the backend.
 *
 * Strategy (stale-while-revalidate):
 *  1. On call: immediately serve from localStorage cache (if fresh enough).
 *  2. Background: fetch from /api/assets/<symbol>/detail/ with JWT if available.
 *  3. Fallback: try /public/data/companies/<symbol.toLowerCase()>.json.
 *  4. Expose loading, isRefreshing, detail, error, and refresh().
 *
 * Cache key: strades_asset_detail_<SYMBOL>_v1 — TTL 3 minutes.
 */

import { ref, watch, isRef } from 'vue'
import type { Ref } from 'vue'

// ── Types ─────────────────────────────────────────────────────────────────

export interface AssetDetail {
  // Base Asset fields
  id: string
  symbol: string
  name: string
  type: 'stock' | 'cryptocurrency' | 'fiat_currency' | 'commodity'
  category: string
  description: string
  location: string
  industry: string
  current_price: number
  currency: string
  market_cap: number | null
  icon_url: string
  website: string
  tags: string[]
  psychology_profile: {
    risk_tolerance: 'very_low' | 'low' | 'medium' | 'high' | 'very_high'
    market_sentiment: 'bullish' | 'neutral' | 'bearish'
    investor_confidence: number
    volatility_index: number
  }

  // Type-specific detail blocks (one is populated, others null)
  stock_detail: {
    ceo: string
    founders: string[]
    headquarter: string
    founded: string
    exchange: string
    sector: string
    employees: number
    revenue_ttm: number
    net_income_ttm: number
    total_assets: number
    total_equity: number
    pe_ratio: number
    pb_ratio: number
    dividend_yield: number | null
    beta: number
    shares_outstanding: number
    brand_value: number | null
    brand_rank: number | null
    customer_loyalty: number
  } | null

  crypto_detail: {
    consensus_mechanism: string
    blockchain_name: string
    circulating_supply: number
    max_supply: number | null
    total_supply: number
    block_time_seconds: number
    transaction_speed_tps: number
    has_smart_contracts: boolean
    layer: number
    whitepaper_url: string
    github_url: string
    explorer_url: string
    use_cases: string[]
    founders: string[]
    launch_year: number
  } | null

  commodity_detail: {
    commodity_type: string
    unit: string
    major_producers: Array<{ country: string; share_pct: number; annual_volume?: number }>
    major_consumers: Array<{ country: string; share_pct: number }>
    supply_annual: number
    demand_annual: number
    inventory_level: number
    production_cost_usd: number
    seasonal_notes: string
    storage_type: string
  } | null

  forex_detail: {
    country_or_region: string
    central_bank: string
    interest_rate: number
    inflation_rate: number
    gdp_usd: number
    gdp_growth_rate: number
    unemployment_rate: number
    currency_pair_type: string
    base_currency: string
    quote_currency: string
    trade_balance_bn: number
    debt_to_gdp: number
  } | null

  // Always present collections
  financial_reports: Array<{
    period_type: string
    period_label: string
    period_end: string
    revenue: number
    net_income: number
    gross_profit: number
    operating_income: number
    eps: number
    gross_margin: number
    operating_margin: number
    net_margin: number
    revenue_yoy_growth: number | null
    eps_vs_estimate_pct: number | null
    revenue_vs_estimate_pct: number | null
  }>

  supply_nodes: Array<{
    node_type: string
    name: string
    relationship_description: string
    location_country: string
    dependency_level: string
    products_or_services: string[]
    lat: number | null
    lng: number | null
    health_score: number
  }>

  competitors: Array<{
    name: string
    symbol: string
    market_share_overlap: string
    our_advantage: string
    threat_level: string
    market_share_pct: number | null
  }>

  products: Array<{
    product_type: string
    name: string
    category: string
    description: string
    launch_year: number | null
    revenue_annual_usd: number | null
    users_count: number | null
    market_share_pct: number | null
    growth_rate_pct: number | null
  }>

  geographies: Array<{
    country: string
    region: string
    percentage: number
    purpose: string
    lat: number | null
    lng: number | null
  }>

  calendar_events: Array<{
    date: string
    title: string
    event_type: string
    importance: string
    expected_impact: string
  }>

  regulatory: Array<{
    issue: string
    status: string
    potential_impact: string
    jurisdiction: string
    timeline: string
  }>

  similar_assets: Array<{
    related_asset: {
      id: string
      symbol: string
      name: string
      current_price: number
      icon_url: string
      type: string
    }
    relationship_type: string
    strength: number
    correlation_coefficient: number | null
    description: string
  }>
}

// ── Cache helpers ──────────────────────────────────────────────────────────

const DETAIL_TTL_MS = 3 * 60 * 1000 // 3 minutes

interface CacheEntry<T> {
  data: T
  savedAt: number
}

function _detailCacheKey(symbol: string): string {
  return `strades_asset_detail_${symbol.toUpperCase()}_v1`
}

function _saveDetail(symbol: string, data: AssetDetail): void {
  if (typeof window === 'undefined') return
  try {
    const entry: CacheEntry<AssetDetail> = { data, savedAt: Date.now() }
    localStorage.setItem(_detailCacheKey(symbol), JSON.stringify(entry))
  } catch {
    // Storage quota exceeded or private mode — silently skip
  }
}

function _loadDetail(symbol: string): { data: AssetDetail; isStale: boolean } | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(_detailCacheKey(symbol))
    if (!raw) return null
    const entry: CacheEntry<AssetDetail> = JSON.parse(raw)
    const ageMs = Date.now() - entry.savedAt
    return { data: entry.data, isStale: ageMs > DETAIL_TTL_MS }
  } catch {
    return null
  }
}

// ── Composable ─────────────────────────────────────────────────────────────

export function useAssetDetail(symbolInput: Ref<string> | string) {
  const config = useRuntimeConfig()
  const apiBase = config.public.apiBase as string
  const { accessToken } = useAuth()

  const detail = ref<AssetDetail | null>(null)
  const loading = ref(false)
  const isRefreshing = ref(false)
  const error = ref<string | null>(null)

  const getSymbol = (): string =>
    isRef(symbolInput) ? symbolInput.value : symbolInput

  // ── Fetch from backend ────────────────────────────────────────────────────
  async function _fetchFromBackend(symbol: string): Promise<AssetDetail | null> {
    const headers: Record<string, string> = {}
    if (accessToken.value) {
      headers['Authorization'] = `Bearer ${accessToken.value}`
    }
    try {
      const data = await $fetch<AssetDetail>(
        `/api/assets/${symbol}/detail/`,
        { baseURL: apiBase, headers }
      )
      return data
    } catch (err: any) {
      // 404 is expected for assets without a detail endpoint — not an error
      if (err?.response?.status === 404 || err?.status === 404) return null
      throw err
    }
  }

  // ── Fallback: static JSON file ────────────────────────────────────────────
  async function _fetchFromStaticFile(symbol: string): Promise<AssetDetail | null> {
    try {
      const data = await $fetch<AssetDetail>(
        `/data/companies/${symbol.toLowerCase()}.json`
      )
      return data
    } catch {
      return null
    }
  }

  // ── Main fetch logic (stale-while-revalidate) ─────────────────────────────
  async function refresh(): Promise<void> {
    const symbol = getSymbol()
    if (!symbol) return

    // Check cache
    const cached = _loadDetail(symbol)

    if (cached && !cached.isStale) {
      // Fresh cache — return immediately, no network needed
      detail.value = cached.data
      loading.value = false
      return
    }

    if (cached && cached.isStale) {
      // Stale cache — serve immediately, revalidate in background
      detail.value = cached.data
      isRefreshing.value = true
    } else {
      // No cache — show loading state
      loading.value = true
    }

    error.value = null

    try {
      // Try backend first
      let freshData = await _fetchFromBackend(symbol)

      // Fallback to static file if backend returned nothing
      if (!freshData) {
        freshData = await _fetchFromStaticFile(symbol)
      }

      if (freshData) {
        detail.value = freshData
        _saveDetail(symbol, freshData)
      }
      // If no data from either source, keep stale cache (don't null out detail)
    } catch (err: any) {
      // Network error — only set error if we have no stale data to show
      if (!detail.value) {
        error.value = err?.message || 'Failed to load asset details'
      }
      // Otherwise silently fail — user still sees stale data
    } finally {
      loading.value = false
      isRefreshing.value = false
    }
  }

  // ── Watch for symbol changes ──────────────────────────────────────────────
  if (isRef(symbolInput)) {
    watch(symbolInput, (newSymbol) => {
      if (newSymbol) {
        detail.value = null
        error.value = null
        refresh()
      }
    }, { immediate: true })
  } else {
    // Static symbol — fetch once on composable init
    refresh()
  }

  return {
    detail: detail as Ref<AssetDetail | null>,
    loading: loading as Ref<boolean>,
    isRefreshing: isRefreshing as Ref<boolean>,
    error: error as Ref<string | null>,
    refresh,
  }
}
