import { defineStore } from 'pinia'

export type BotStatus = 'live' | 'paused' | 'stopped' | 'error'

export interface Bot {
  id: string
  owner_id: string
  name: string
  agent_id: string
  strategy_id: string | null
  platform_id: string
  status: BotStatus
  started_at: string
  uptime_pct: number
  trades_today: number
  trades_30d: number
  pnl_today_usd: number
  pnl_30d_usd: number
  pnl_30d_pct: number
  capital_allocated_usd: number
  next_action_at: string | null
  tags: string[]
}

export interface BotsState {
  list: Bot[]
  hydrated: boolean
  loading: boolean
  error: string | null
}

export const useBotsStore = defineStore('bots', {
  state: (): BotsState => ({ list: [], hydrated: false, loading: false, error: null }),
  actions: {
    async fetchBots() {
      this.loading = true
      try {
        const res = await fetch('/data/core/bots.json')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        this.list = await res.json()
        this.hydrated = true
      } catch (e: any) {
        this.error = e.message
        console.error('bots.fetchBots', e)
      } finally {
        this.loading = false
      }
    },
    toggleStatus(id: string) {
      const b = this.list.find(x => x.id === id)
      if (!b) return
      b.status = b.status === 'live' ? 'paused' : 'live'
    }
  },
  getters: {
    live: (s) => s.list.filter(b => b.status === 'live'),
    paused: (s) => s.list.filter(b => b.status === 'paused'),
    totalCapital: (s) => s.list.reduce((a, b) => a + b.capital_allocated_usd, 0),
    totalPnl30dUsd: (s) => s.list.reduce((a, b) => a + b.pnl_30d_usd, 0),
    totalPnlTodayUsd: (s) => s.list.reduce((a, b) => a + b.pnl_today_usd, 0),
    byAgent: (s) => (agentId: string) => s.list.filter(b => b.agent_id === agentId)
  }
})
