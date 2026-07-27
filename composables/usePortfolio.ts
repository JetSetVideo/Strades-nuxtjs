/**
 * usePortfolio — fetches the authenticated user's portfolio from the backend.
 *
 * Endpoint: GET /api/portfolio/
 * Requires: valid JWT access token (from useAuth)
 *
 * Returns reactive state: { portfolio, loading, error, refresh }
 */

export interface PortfolioAsset {
  id: string
  symbol: string
  name: string
  current_price: number
  icon_url?: string | null
}

export interface PortfolioHolding {
  asset: PortfolioAsset
  quantity: number
  average_buy_price: number
  current_value: number
  unrealized_pnl: number
  unrealized_pnl_pct: number
}

export interface PortfolioTransaction {
  id: number
  type: 'buy' | 'sell'
  asset_id: string
  asset_symbol: string
  quantity: number
  price: number
  total_value: number
  fee: number
  timestamp: string
  status: string
}

export interface Portfolio {
  id: number
  name: string
  cash_balance: number
  currency: string
  total_value: number
  total_invested: number
  holdings: PortfolioHolding[]
  transactions: PortfolioTransaction[]
  created_at?: string
  updated_at?: string
}

export const usePortfolio = () => {
  const config = useRuntimeConfig()
  const apiBase = config.public.apiBase as string
  const { accessToken, isAuthenticated } = useAuth()

  const portfolio = ref<Portfolio | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const refresh = async () => {
    if (!isAuthenticated.value || !accessToken.value) {
      error.value = 'Not authenticated.'
      return
    }

    loading.value = true
    error.value = null

    try {
      const data = await $fetch<Portfolio>(`${apiBase}/api/portfolio/`, {
        headers: { Authorization: `Bearer ${accessToken.value}` },
      })
      portfolio.value = data
    } catch (err: any) {
      const detail = err?.data?.detail || err?.message || 'Failed to load portfolio.'
      error.value = detail
      console.error('[usePortfolio] fetch error:', err)
    } finally {
      loading.value = false
    }
  }

  return {
    portfolio: readonly(portfolio),
    loading: readonly(loading),
    error: readonly(error),
    refresh,
  }
}
