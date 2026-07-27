/** Canonical asset domain types — single source of truth. */

export type AssetType = 'cryptocurrency' | 'fiat_currency' | 'stock' | 'commodity'

export interface Asset {
  id: string
  symbol: string
  name: string
  type: AssetType
  category: string
  description: string
  location: string
  industry: string
  market_cap?: number
  current_price: number
  currency: string
  similar_assets: string[]
  depends_on: string[]
  proximity_level: number
  tags: string[]
  icon_url: string
  website: string
  launch_date: string
  created_at: string
  updated_at: string
  /** Optional psychology fields used by living UI */
  psychology_profile?: {
    risk?: number
    volatility_affinity?: number
    [key: string]: unknown
  }
  liquidity_depth?: number
  fluctuation_velocity?: number
  change_24h_pct?: number
}

export interface AssetRelationship {
  id: string
  asset_id: string
  related_asset_id: string
  relationship_type: 'similar' | 'dependency' | 'competitor' | 'supplier' | 'paired'
  strength: number
  description: string
  correlation_coefficient: number
  created_at: string
  updated_at: string
}

/** Live price tick — timestamps are epoch ms for store consistency. */
export interface PriceUpdate {
  symbol: string
  price: number
  change24h: number
  timestamp: number
}

export interface Activity {
  id: string
  type: string
  symbol: string
  message: string
  timestamp: number
}

export interface NewsItem {
  id: string
  title: string
  content: string
  source: string
  timestamp: number
  url?: string
  impact?: 'HIGH' | 'MEDIUM' | 'LOW'
}
