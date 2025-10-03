import { defineStore } from 'pinia'

// Types for chat and messaging
export interface Conversation {
  id: string
  participants: string[]
  type: 'direct' | 'group'
  title: string | null
  description: string
  created_by: string
  created_at: string
  last_message_at: string
  is_active: boolean
  message_count: number
  unread_count_user_001: number
  unread_count_user_002: number
  unread_count_user_003: number
  unread_count_user_004: number
  metadata: {
    topic?: string
    shared_strategies?: string[]
    meeting_scheduled?: string
  }
}

export interface Message {
  id: string
  conversation_id: string
  sender_id: string
  recipient_ids: string[]
  content: string
  message_type: 'text' | 'image' | 'file' | 'system'
  timestamp: string
  is_read: boolean
  is_edited: boolean
  edited_at: string | null
  attachments: Array<{
    type: 'image' | 'file' | 'link'
    url?: string
    filename?: string
    size_bytes?: number
    title?: string
    description?: string
  }>
  reactions: Array<{
    user_id: string
    reaction: string
    timestamp: string
  }>
  reply_to: string | null
  metadata: {
    character_count: number
    mentions: string[]
    hashtags: string[]
  }
}

export const useChatStore = defineStore('chat', {
  state: () => ({
    conversations: [] as Conversation[],
    messages: [] as Message[],
    activeConversation: null as Conversation | null,
    loading: false,
    error: null as Error | null
  }),

  getters: {
    getConversationById: (state) => (id: string) => {
      return state.conversations.find(conversation => conversation.id === id)
    },

    getUserConversations: (state) => (userId: string) => {
      return state.conversations.filter(conversation =>
        conversation.participants.includes(userId)
      )
    },

    getConversationMessages: (state) => (conversationId: string) => {
      return state.messages
        .filter(message => message.conversation_id === conversationId)
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    },

    getUnreadCount: (state) => (userId: string) => {
      return state.conversations.reduce((total, conversation) => {
        const unreadKey = `unread_count_${userId}` as keyof Conversation
        return total + (conversation[unreadKey] as number || 0)
      }, 0)
    },

    getRecentConversations: (state) => (userId: string) => {
      return state.conversations
        .filter(conversation => conversation.participants.includes(userId))
        .sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime())
    }
  },

  actions: {
    async fetchConversations() {
      try {
        this.loading = true
        const conversationsData = await $fetch<Conversation[]>('/data/chat/conversations.json')
        this.conversations = conversationsData
      } catch (error) {
        this.error = error as Error
        console.error('Failed to fetch conversations:', error)
      } finally {
        this.loading = false
      }
    },

    async fetchMessages() {
      try {
        const messagesData = await $fetch<Message[]>('/data/chat/messages.json')
        this.messages = messagesData
      } catch (error) {
        console.error('Failed to fetch messages:', error)
      }
    },

    async initializeStore() {
      await Promise.all([
        this.fetchConversations(),
        this.fetchMessages()
      ])
    },

    setActiveConversation(conversationId: string) {
      const conversation = this.conversations.find(c => c.id === conversationId)
      if (conversation) {
        this.activeConversation = conversation
      }
    },

    sendMessage(message: Omit<Message, 'id' | 'timestamp' | 'is_read' | 'is_edited' | 'edited_at'>) {
      const newMessage: Message = {
        ...message,
        id: `msg_${Date.now()}`,
        timestamp: new Date().toISOString(),
        is_read: false,
        is_edited: false,
        edited_at: null
      }

      this.messages.push(newMessage)

      // Update conversation's last message time and message count
      const conversation = this.conversations.find(c => c.id === message.conversation_id)
      if (conversation) {
        conversation.last_message_at = newMessage.timestamp
        conversation.message_count += 1

        // Update unread counts for other participants
        message.recipient_ids.forEach(recipientId => {
          const unreadKey = `unread_count_${recipientId}` as keyof Conversation
          if (unreadKey in conversation) {
            (conversation[unreadKey] as number) += 1
          }
        })
      }

      return newMessage
    },

    markMessagesAsRead(conversationId: string, userId: string) {
      // Mark messages as read
      this.messages
        .filter(msg => msg.conversation_id === conversationId && msg.recipient_ids.includes(userId))
        .forEach(msg => {
          msg.is_read = true
        })

      // Reset unread count
      const conversation = this.conversations.find(c => c.id === conversationId)
      if (conversation) {
        const unreadKey = `unread_count_${userId}` as keyof Conversation
        if (unreadKey in conversation) {
          (conversation[unreadKey] as number) = 0
        }
      }
    },

    addReaction(messageId: string, userId: string, reaction: string) {
      const message = this.messages.find(m => m.id === messageId)
      if (message) {
        // Remove existing reaction from this user
        message.reactions = message.reactions.filter(r => r.user_id !== userId)

        // Add new reaction
        message.reactions.push({
          user_id: userId,
          reaction: reaction,
          timestamp: new Date().toISOString()
        })
      }
    },

    createConversation(conversation: Omit<Conversation, 'id' | 'created_at' | 'last_message_at' | 'message_count'>) {
      const newConversation: Conversation = {
        ...conversation,
        id: `conv_${Date.now()}`,
        created_at: new Date().toISOString(),
        last_message_at: new Date().toISOString(),
        message_count: 0
      }

      this.conversations.push(newConversation)
      return newConversation
    }
  }
})
