// Shared types between frontend and backend
export interface Asset {
  id: string
  symbol: string
  name: string
  price: number
  change24h: number
}

export interface Strategy {
  id: string
  name: string
  description: string
  creator: string
  performance: number
} 