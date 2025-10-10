import { defineStore } from 'pinia'

export interface LegacyMessage {
  id: string
  attachments: any[]
  deleted: boolean
  from: string
  message: string
  meta: {
    type: string
  }
  modified: boolean
  parent: string | null
  reactions: any[]
  read: boolean
  timestamp: string
  to: string
}

export interface MessagesData {
  [key: string]: LegacyMessage
}

export const useMessagesStore = defineStore('messagesStore', {
  state: () => ({
    messages: {} as MessagesData,
    loading: false,
    error: null as Error | null
  }),

  getters: {
    getMessagesByFriendId: (state) => (friendId: string) => {
      return Object.values(state.messages).filter(message =>
        message.from === friendId || message.to === friendId
      );
    },

    getAllMessages: (state) => {
      return Object.values(state.messages);
    }
  },

  actions: {
    async fetchMessages() {
      try {
        this.loading = true
        const messagesData = await $fetch<MessagesData>('/Messages.json')
        this.messages = messagesData
      } catch (error) {
        this.error = error as Error
        console.error('Failed to fetch messages:', error)
      } finally {
        this.loading = false
      }
    },

    async initializeStore() {
      await this.fetchMessages()
    }
  }
})
