import { defineStore } from 'pinia'
import type { AssetClass } from '~/stores/macro'

export interface InfluencerSignal {
  type: 'bullish' | 'bearish' | 'neutral'
  asset: string
  confidence: number
  issued_at: string
  thesis: string
}

export interface Influencer {
  id: string
  handle: string
  name: string
  avatar_url: string
  followers: number
  followed_by_user: boolean
  specialization: AssetClass[]
  credibility_score: number
  win_rate_calls_30d: number
  latest_signal: InfluencerSignal
  last_30d_pnl_pct: number
  platforms: string[]
}

export interface InfluencersState {
  list: Influencer[]
  hydrated: boolean
  loading: boolean
  error: string | null
}

export const useInfluencersStore = defineStore('influencers', {
  state: (): InfluencersState => ({ list: [], hydrated: false, loading: false, error: null }),
  actions: {
    async fetchInfluencers() {
      this.loading = true
      try {
        const res = await fetch('/data/core/influencers.json')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        this.list = await res.json()
        this.hydrated = true
      } catch (e: any) {
        this.error = e.message
        console.error('influencers.fetchInfluencers', e)
      } finally {
        this.loading = false
      }
    },
    toggleFollow(id: string) {
      const inf = this.list.find(i => i.id === id)
      if (inf) inf.followed_by_user = !inf.followed_by_user
    }
  },
  getters: {
    followed: (s) => s.list.filter(i => i.followed_by_user),
    bySpec: (s) => (cls: AssetClass) => s.list.filter(i => i.specialization.includes(cls)),
    /** Weighted bullish/bearish skew across followed influencers */
    consensusBias(): number {
      const list = (this.followed as Influencer[])
      if (!list.length) return 0
      let acc = 0, w = 0
      for (const inf of list) {
        const dir = inf.latest_signal.type === 'bullish' ? 1 : inf.latest_signal.type === 'bearish' ? -1 : 0
        const weight = inf.credibility_score * inf.latest_signal.confidence
        acc += dir * weight
        w += weight
      }
      return w === 0 ? 0 : acc / w
    },
    latestSignals(): Array<Influencer & { ts: number }> {
      return [...this.list]
        .map(i => ({ ...i, ts: new Date(i.latest_signal.issued_at).getTime() }))
        .sort((a, b) => b.ts - a.ts)
    }
  }
})
