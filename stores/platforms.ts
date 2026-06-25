import { defineStore } from 'pinia'
import type { AssetClass } from '~/stores/macro'

export type PlatformStatus = 'connected' | 'rate_limited' | 'disconnected' | 'error'

export interface TradingPlatform {
  id: string
  user_id: string
  name: string
  type: 'crypto_exchange' | 'stock_broker' | 'bank' | 'commodity_vault' | 'other'
  logo: string
  color: string
  status: PlatformStatus
  api_health: number
  balance_usd: number
  available_usd: number
  asset_classes: AssetClass[]
  asset_count: number
  last_sync_at: string
  daily_pnl_usd: number
  daily_pnl_pct: number
  monthly_pnl_pct: number
  fees_30d_usd: number
  two_factor: boolean
  permissions: string[]
}

export interface PlatformsState {
  list: TradingPlatform[]
  hydrated: boolean
  loading: boolean
  error: string | null
}

export const usePlatformsStore = defineStore('platforms', {
  state: (): PlatformsState => ({ list: [], hydrated: false, loading: false, error: null }),
  actions: {
    async fetchPlatforms() {
      this.loading = true
      try {
        const res = await fetch('/data/core/trading_platforms.json')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        this.list = await res.json()
        this.hydrated = true
        this.error = null
      } catch (e: any) {
        this.error = e.message
        console.error('platforms.fetchPlatforms', e)
      } finally {
        this.loading = false
      }
    }
  },
  getters: {
    totalBalance: (s) => s.list.reduce((acc, p) => acc + p.balance_usd, 0),
    totalAvailable: (s) => s.list.reduce((acc, p) => acc + p.available_usd, 0),
    totalDailyPnl: (s) => s.list.reduce((acc, p) => acc + p.daily_pnl_usd, 0),
    healthAvg: (s) => s.list.length ? s.list.reduce((a, p) => a + p.api_health, 0) / s.list.length : 0,
    connectedCount: (s) => s.list.filter(p => p.status === 'connected').length,
    byAssetClass: (s) => (cls: AssetClass) => s.list.filter(p => p.asset_classes.includes(cls)),
    /** Aggregated balance broken down per asset class (split evenly across classes the platform covers) */
    balanceByClass(): Record<AssetClass, number> {
      const out: Record<AssetClass, number> = { fiat: 0, crypto: 0, stocks: 0, commodities: 0 }
      for (const p of this.list) {
        const share = p.balance_usd / (p.asset_classes.length || 1)
        for (const cls of p.asset_classes) out[cls] += share
      }
      return out
    },
    /** Normalized allocation that the wallet should show if it aggregated all platforms */
    aggregateAllocationPie(): Record<AssetClass, number> {
      const balances = this.balanceByClass
      const total = balances.fiat + balances.crypto + balances.stocks + balances.commodities
      if (total === 0) return { fiat: 25, crypto: 25, stocks: 25, commodities: 25 }
      return {
        fiat: (balances.fiat / total) * 100,
        crypto: (balances.crypto / total) * 100,
        stocks: (balances.stocks / total) * 100,
        commodities: (balances.commodities / total) * 100
      }
    }
  }
})
