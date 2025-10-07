import { defineStore } from 'pinia'

export interface DiscussionMember {
  id: string
  username: string
  avatar: string
  role: 'creator' | 'member'
  joined_at: string
}

export interface Discussion {
  id: string
  name: string
  description: string
  created_at: string
  created_by: string
  is_active: boolean
  category: string
  tags: string[]
  data_affiliated: string[]
  members: DiscussionMember[]
  last_message: {
    text: string
    timestamp: string
  }
  unread_count: number
  message_count: number
  pinned_message?: {
    id: string
    text: string
    author: string
    timestamp: string
  }
}

export const useDiscussionsStore = defineStore('discussionsStore', {
  state: () => ({
    discussions: [] as Discussion[],
    loading: false,
    error: null as Error | null
  }),

  getters: {
    getDiscussionById: (state) => (id: string) => {
      return state.discussions.find(discussion => discussion.id === id)
    },

    getActiveDiscussions: (state) => {
      return state.discussions.filter(discussion => discussion.is_active)
    },

    getDiscussionsByCategory: (state) => (category: string) => {
      return state.discussions.filter(discussion => discussion.category === category)
    }
  },

  actions: {
    async fetchDiscussions() {
      try {
        this.loading = true
        const discussionsData = await $fetch<Discussion[]>('/Discussions.json')
        this.discussions = discussionsData
      } catch (error) {
        this.error = error as Error
        console.error('Failed to fetch discussions:', error)
      } finally {
        this.loading = false
      }
    },

    async initializeStore() {
      await this.fetchDiscussions()
    }
  }
})