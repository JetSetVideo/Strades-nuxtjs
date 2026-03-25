import { defineStore } from 'pinia'

export interface FriendMessage {
  id: string
  senderId: string
  text: string
  timestamp: string
}

export interface Friend {
  id: string
  name: string
  username: string
  image: string
  value: number
  value_evolution_percent: number
  online: boolean
  performance_30d?: number
  win_rate?: number
  total_trades?: number
  trading_style?: string
  risk_tolerance?: string
  messages: FriendMessage[]
}

export const useFriendsStore = defineStore('friends', {
  state: () => ({
    friends: [] as Friend[],
    loading: false,
    error: null as string | null
  }),

  getters: {
    getFriendById: (state) => (id: string): Friend | undefined => {
      return state.friends.find(f => f.id === id)
    },

    getOnlineFriends: (state): Friend[] => {
      return state.friends.filter(f => f.online)
    },

    getFriendsCount: (state): number => {
      return state.friends.length
    },

    /** Top friends by 30d performance */
    getTopPerformers: (state): Friend[] => {
      return [...state.friends]
        .sort((a, b) => (b.performance_30d ?? 0) - (a.performance_30d ?? 0))
        .slice(0, 5)
    }
  },

  actions: {
    async fetchFriends(): Promise<void> {
      try {
        this.loading = true
        this.error = null
        // Try data/ subfolder first (enriched), then root fallback
        let data: Friend[] | null = null
        try {
          data = await $fetch<Friend[]>('/data/Friends.json')
        } catch {
          data = await $fetch<Friend[]>('/Friends.json')
        }
        if (!data) throw new Error('Friends data not found')
        this.friends = data
      } catch (err) {
        this.error = (err as Error).message
        console.error('[FriendsStore] fetchFriends failed:', err)
      } finally {
        this.loading = false
      }
    },

    getMessages(friendId: string): FriendMessage[] {
      return this.getFriendById(friendId)?.messages ?? []
    },

    async initializeStore(): Promise<void> {
      await this.fetchFriends()
    }
  }
})
