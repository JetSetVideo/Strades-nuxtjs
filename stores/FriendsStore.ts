import { defineStore } from 'pinia'

export interface FriendMessage {
  id: string
  senderId: string
  text: string
  timestamp: string
}

export interface Friend {
  id: string
  image: string
  messages: FriendMessage[]
  name: string
  online: boolean
  username: string
  value: number
  value_evolution_percent: number
}

export const useFriendsStore = defineStore('friends', {
  state: () => ({
    friends: [] as Friend[],
    loading: false,
    error: null as Error | null
  }),

  getters: {
    getFriendById: (state) => (id: string) => {
      console.log('getFriendById called with id:', id);
      const friend = state.friends.find(friend => friend.id === id);
      console.log('Found friend:', friend);
      return friend;
    },

    getOnlineFriends: (state) => {
      return state.friends.filter(friend => friend.online);
    },

    getFriendsCount: (state) => {
      return state.friends.length;
    }
  },

  actions: {
    async fetchFriends() {
      try {
        this.loading = true
        const friendsData = await $fetch<Friend[]>('/Friends.json')
        this.friends = friendsData
      } catch (error) {
        this.error = error as Error
        console.error('Failed to fetch friends:', error)
      } finally {
        this.loading = false
      }
    },

    async getMessages(friendId: string) {
      const friend = this.getFriendById(friendId);
      return friend ? friend.messages : [];
    },

    async initializeStore() {
      await this.fetchFriends()
    }
  }
})
