import { defineStore } from 'pinia'

// Types for chat and messaging
export interface Participant {
  user_id: string
  username: string
  full_name: string
  avatar_url: string
  is_online: boolean
  unread_count: number
}

export interface Conversation {
  id: string
  participants: string[]
  participantDetails: Participant[]
  type: 'direct' | 'group'
  title: string | null
  description: string
  created_by: string
  created_at: string
  last_message_at: string
  is_active: boolean
  message_count: number
  unread_count: number
  // Legacy per-user keys kept for backward compat with old local JSON
  unread_count_user_001?: number
  unread_count_user_002?: number
  unread_count_user_003?: number
  unread_count_user_004?: number
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
  sender_username: string
  sender_full_name: string
  sender_avatar_url: string
  recipient_ids: string[]
  content: string
  message_type: 'text' | 'image' | 'file' | 'system'
  content_type: 'text' | 'image' | 'attachment'
  timestamp: string
  created_at: string
  is_read: boolean
  is_edited: boolean
  is_deleted: boolean
  edited_at: string | null
  reply_to: string | null
  reply_to_id: string | null
  reply_to_preview: { id: string; content: string } | null
  attachment_url: string
  attachment_name: string
  attachments: Array<{
    type: 'image' | 'file' | 'link' | 'share'
    url?: string
    filename?: string
    size_bytes?: number
    title?: string
    description?: string
    share_id?: string
    share_kind?: string
    asset_id?: string
    asset_symbol?: string
    strategy_id?: string
    opinion_vector?: { fiat: number; crypto: number; stocks: number; commodities: number }
  }>
  reactions: Array<{
    id?: number
    user_id: string
    username?: string
    reaction?: string
    emoji?: string
    timestamp?: string
  }>
  metadata: {
    character_count: number
    mentions: string[]
    hashtags: string[]
  }
}

// Shape returned by the backend
interface BackendConversation {
  id: string
  type: 'direct' | 'group'
  name: string
  topic: string
  avatar_url: string
  last_message_at: string
  last_message_preview: string
  unread_count: number
  participants: Array<{
    user_id: string
    username: string
    full_name: string
    avatar_url: string
    is_online: boolean
    unread_count: number
  }>
}

interface BackendMessage {
  id: string
  conversation_id: string
  sender_id: string
  sender_username: string
  sender_full_name: string
  sender_avatar_url: string
  content: string
  content_type: 'text' | 'image' | 'attachment'
  reply_to_id: string | null
  reply_to_preview: { id: string; content: string } | null
  attachment_url: string
  attachment_name: string
  is_deleted: boolean
  created_at: string
  reactions: Array<{ id: number; user_id: string; username: string; emoji: string }>
}

// Map backend conversation to local Conversation interface
function mapBackendConversation(bc: BackendConversation): Conversation {
  return {
    id: bc.id,
    participants: bc.participants.map(p => p.user_id),
    participantDetails: bc.participants,
    type: bc.type,
    title: bc.name || null,
    description: bc.topic || '',
    created_by: bc.participants[0]?.user_id || '',
    created_at: bc.last_message_at,
    last_message_at: bc.last_message_at,
    is_active: true,
    message_count: 0,
    unread_count: bc.unread_count,
    metadata: {
      topic: bc.topic,
    },
  }
}

// Map backend message to local Message interface
function mapBackendMessage(bm: BackendMessage): Message {
  return {
    id: bm.id,
    conversation_id: bm.conversation_id,
    sender_id: bm.sender_id,
    sender_username: bm.sender_username,
    sender_full_name: bm.sender_full_name,
    sender_avatar_url: bm.sender_avatar_url,
    recipient_ids: [],
    content: bm.content,
    message_type: bm.content_type === 'attachment' ? 'file' : (bm.content_type as 'text' | 'image'),
    content_type: bm.content_type,
    timestamp: bm.created_at,
    created_at: bm.created_at,
    is_read: false,
    is_edited: false,
    is_deleted: bm.is_deleted,
    edited_at: null,
    reply_to: bm.reply_to_id,
    reply_to_id: bm.reply_to_id,
    reply_to_preview: bm.reply_to_preview,
    attachment_url: bm.attachment_url,
    attachment_name: bm.attachment_name,
    attachments: bm.attachment_url
      ? [{ type: 'file', url: bm.attachment_url, filename: bm.attachment_name }]
      : [],
    reactions: bm.reactions.map(r => ({
      id: r.id,
      user_id: r.user_id,
      username: r.username,
      reaction: r.emoji,
      emoji: r.emoji,
    })),
    metadata: {
      character_count: bm.content.length,
      mentions: [],
      hashtags: [],
    },
  }
}

export const useChatStore = defineStore('chat', {
  state: () => ({
    conversations: [] as Conversation[],
    messages: [] as Message[],
    activeConversation: null as Conversation | null,
    hydrated: false,
    loading: false,
    error: null as Error | null,
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
        // Support both new unified unread_count and old per-user keys
        const legacyKey = `unread_count_${userId}` as keyof Conversation
        const legacyVal = conversation[legacyKey] as number | undefined
        return total + (legacyVal ?? conversation.unread_count ?? 0)
      }, 0)
    },

    getRecentConversations: (state) => (userId: string) => {
      return state.conversations
        .filter(conversation =>
          // Include all if participantDetails available, else fall back to participants array
          conversation.participantDetails?.some(p => p.user_id === userId) ||
          conversation.participants.includes(userId)
        )
        .sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime())
    },

    /** 0–1 urgency score from unread volume and message recency — drives the nav badge pulse */
    getEmotionalUrgency: (state) => (userId: string) => {
      const unreadKey = `unread_count_${userId}` as keyof Conversation
      let score = 0

      for (const conversation of state.conversations) {
        if (!conversation.participants.includes(userId)) continue
        const unread = (conversation[unreadKey] as number) || 0
        if (unread === 0) continue

        const hoursAgo = (Date.now() - new Date(conversation.last_message_at).getTime()) / 3_600_000
        const recencyBoost = hoursAgo < 1 ? 1 : hoursAgo < 6 ? 0.7 : 0.35
        score += unread * recencyBoost
      }

      return Math.min(1, score / 12)
    },

    totalUnread: (state) => {
      return state.conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0)
    },
  },

  actions: {
    async fetchConversations() {
      this.loading = true
      this.error = null

      // Try backend first
      try {
        const { accessToken } = useAuth()
        const config = useRuntimeConfig()
        const apiBase = config.public.apiBase as string

        const data = await $fetch<BackendConversation[]>('/api/social/conversations/', {
          baseURL: apiBase,
          headers: accessToken.value
            ? { Authorization: `Bearer ${accessToken.value}` }
            : {},
        })
        this.conversations = data.map(mapBackendConversation)
        return
      } catch (backendError) {
        console.warn('Backend conversations fetch failed, falling back to local JSON:', backendError)
      } finally {
        this.loading = false
      }

      // Fall back to local JSON
      try {
        const conversationsData = await $fetch<Conversation[]>('/data/chat/conversations.json')
        this.conversations = conversationsData
      } catch (error) {
        this.error = error as Error
        console.error('Failed to fetch conversations from local JSON:', error)
      }
    },

    async fetchMessages(conversationId?: string) {
      // If a specific conversationId is provided, try the backend endpoint
      if (conversationId) {
        try {
          const { accessToken } = useAuth()
          const config = useRuntimeConfig()
          const apiBase = config.public.apiBase as string

          const data = await $fetch<{ messages: BackendMessage[] }>(
            `/api/social/conversations/${conversationId}/`,
            {
              baseURL: apiBase,
              headers: accessToken.value
                ? { Authorization: `Bearer ${accessToken.value}` }
                : {},
            }
          )

          const mapped = data.messages.map(mapBackendMessage)
          // Replace messages for this conversation in the store
          this.messages = [
            ...this.messages.filter(m => m.conversation_id !== conversationId),
            ...mapped,
          ]
          return
        } catch (backendError) {
          console.warn(
            `Backend messages fetch failed for conv ${conversationId}, falling back to local JSON:`,
            backendError
          )
        }
      }

      // Fall back to local JSON (loads all messages)
      try {
        const messagesData = await $fetch<Message[]>('/data/chat/messages.json')
        this.messages = messagesData
      } catch (error) {
        console.error('Failed to fetch messages from local JSON:', error)
      }
    },

    async sendMessageRemote(conversationId: string, content: string) {
      const { accessToken } = useAuth()
      const config = useRuntimeConfig()
      const apiBase = config.public.apiBase as string

      try {
        const data = await $fetch<BackendMessage>(
          `/api/social/conversations/${conversationId}/messages/`,
          {
            baseURL: apiBase,
            method: 'POST',
            headers: accessToken.value
              ? { Authorization: `Bearer ${accessToken.value}` }
              : {},
            body: { content },
          }
        )

        const newMessage = mapBackendMessage(data)
        this.messages.push(newMessage)

        // Update conversation's last message time
        const conversation = this.conversations.find(c => c.id === conversationId)
        if (conversation) {
          conversation.last_message_at = newMessage.created_at
          conversation.message_count += 1
        }

        return newMessage
      } catch (error) {
        console.error('Failed to send message via backend:', error)
        throw error
      }
    },

    async initializeStore() {
      if (this.hydrated) return
      await Promise.all([
        this.fetchConversations(),
        this.fetchMessages()
      ])
      this.hydrated = true
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

      const conversation = this.conversations.find(c => c.id === message.conversation_id)
      if (conversation) {
        conversation.last_message_at = newMessage.timestamp
        conversation.message_count += 1

        message.recipient_ids.forEach(recipientId => {
          const unreadKey = `unread_count_${recipientId}` as keyof Conversation
          if (unreadKey in conversation) {
            (conversation[unreadKey] as number) += 1
          }
        })
      }

      try {
        const { chatMessage } = useActivityLog()
        chatMessage({
          conversationId: message.conversation_id,
          recipientIds: message.recipient_ids,
          length: message.content?.length ?? message.metadata?.character_count ?? 0,
          hasShare: message.attachments?.some(a => a.type === 'share') ?? false,
        })
      } catch { /* activity log optional */ }

      return newMessage
    },

    markMessagesAsRead(conversationId: string, userId: string) {
      this.messages
        .filter(msg => msg.conversation_id === conversationId && msg.recipient_ids.includes(userId))
        .forEach(msg => {
          msg.is_read = true
        })

      const conversation = this.conversations.find(c => c.id === conversationId)
      if (conversation) {
        conversation.unread_count = 0
        const legacyKey = `unread_count_${userId}` as keyof Conversation
        if (legacyKey in conversation) {
          ;(conversation[legacyKey] as number) = 0
        }
      }
    },

    addReaction(messageId: string, userId: string, reaction: string) {
      const message = this.messages.find(m => String(m.id) === String(messageId))
      if (message) {
        const existingReaction = message.reactions.find(
          r => r.user_id === userId && (r.reaction === reaction || r.emoji === reaction)
        )

        if (existingReaction) {
          message.reactions = message.reactions.filter(
            r => !(r.user_id === userId && (r.reaction === reaction || r.emoji === reaction))
          )
        } else {
          message.reactions.push({
            user_id: userId,
            reaction: reaction,
            emoji: reaction,
            timestamp: new Date().toISOString(),
          })
        }
      }
    },

    editMessage(messageId: string, newContent: string) {
      const message = this.messages.find(m => String(m.id) === String(messageId))
      if (message) {
        message.content = newContent
        message.is_edited = true
        message.edited_at = new Date().toISOString()
      }
    },

    deleteMessage(messageId: string) {
      const message = this.messages.find(m => String(m.id) === String(messageId))
      if (message) {
        message.is_deleted = true
        message.content = '[Message deleted]'
      }
    },

    createConversation(
      conversation: Omit<Conversation, 'id' | 'created_at' | 'last_message_at' | 'message_count'>
    ) {
      const newConversation: Conversation = {
        ...conversation,
        id: `conv_${Date.now()}`,
        created_at: new Date().toISOString(),
        last_message_at: new Date().toISOString(),
        message_count: 0,
      }

      this.conversations.push(newConversation)
      return newConversation
    },
  },
})
