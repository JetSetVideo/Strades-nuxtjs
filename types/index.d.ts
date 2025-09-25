export interface PriceUpdate {
  symbol: string
  price: number
  timestamp: Date
}

export interface Activity {
  id: string
  type: 'TRADE' | 'STRATEGY' | 'SOCIAL'
  user: string
  details: Record<string, unknown>
  timestamp: Date
}

export interface NewsItem {
  id: string
  title: string
  content: string
  source: string
  impact: 'HIGH' | 'MEDIUM' | 'LOW'
  timestamp: Date
}

export interface User {
  id: string
  username: string
  email: string
  portfolio: Record<string, number>
} 