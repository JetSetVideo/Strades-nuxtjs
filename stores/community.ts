import { defineStore } from 'pinia'
import type { AssetClass } from '~/stores/macro'

export interface CommunityUser {
  id: string
  username: string
  avatar_url: string
  bio: string
  is_friend: boolean
  online: boolean
  timezone: string
  specialization: AssetClass[]
  trading_style: string
  win_rate: number
  last_30d_pnl_pct: number
  followers: number
  match_score: number
  last_active_at: string
}

export interface CommunityState {
  list: CommunityUser[]
  hydrated: boolean
  loading: boolean
  error: string | null
}

export const useCommunityStore = defineStore('community', {
  state: (): CommunityState => ({ list: [], hydrated: false, loading: false, error: null }),
  actions: {
    async fetchCommunity() {
      this.loading = true
      try {
        const res = await fetch('/data/core/community.json')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        this.list = await res.json()
        this.hydrated = true
      } catch (e: any) {
        this.error = e.message
        console.error('community.fetchCommunity', e)
      } finally {
        this.loading = false
      }
    },
    toggleFriend(id: string) {
      const u = this.list.find(x => x.id === id)
      if (!u) return
      u.is_friend = !u.is_friend

      if (u.is_friend) {
        try {
          const { interact } = useActivityLog()
          interact({
            action: 'friend_added',
            target: id,
            category: 'social',
            component: 'PersonCard',
            why: {
              intent: 'expand_network',
              context: {
                trading_style: u.trading_style,
                specialization: u.specialization,
                match_score: u.match_score,
              },
            },
            with: {
              friend_ids: [id],
              friend_profiles: [{
                id: u.id,
                username: u.username,
                trading_style: u.trading_style,
                specialization: u.specialization.map(String),
                avatar_url: u.avatar_url,
              }],
            },
            trainingPayload: { specialization: u.specialization },
          })
        } catch { /* activity log optional */ }
      }
    }
  },
  getters: {
    friends: (s) => s.list.filter(u => u.is_friend),
    discover: (s) => s.list.filter(u => !u.is_friend),
    online: (s) => s.list.filter(u => u.online),
    bySpec: (s) => (cls: AssetClass) => s.list.filter(u => u.specialization.includes(cls)),
    /** Top discovery picks ranked by match_score then followers */
    suggestions(): CommunityUser[] {
      return [...this.discover].sort((a, b) => {
        if (a.match_score !== b.match_score) return b.match_score - a.match_score
        return b.followers - a.followers
      })
    }
  }
})
