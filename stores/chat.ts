import { defineStore } from 'pinia'
import { publicAssetUrl } from '~/composables/useLocalJson'
import {
  applyReactionResult,
  chatActionError,
  isServerConversationId,
  mapServerConversation,
  mapServerConversationDetail,
  mapServerMessage,
  mergeServerConversation,
  replaceConversationMessages,
  shareMessageBody,
  toggleOwnReaction,
  upsertConversation,
  type ChatAction,
  type ChatSource,
  type Conversation,
  type Message,
  type ServerConversation,
  type ServerMessage,
  type ServerProfile,
  type ServerReactionResult,
  type ShareItem,
} from '~/utils/chatMap'

// Types live in utils/chatMap.ts (pure, tested); re-exported for existing imports.
export type { Participant, Conversation, Message, ChatSource } from '~/utils/chatMap'

/**
 * Chat store.
 *  - Signed in  → the user's own conversations from the server (direct chats and group rooms). If the API
 *                 fails the store says so (`error`) and holds NO sample rows: the page shows the error + Retry.
 *  - Signed out → the bundled sample conversations (`source: 'sample'`), which the page labels as sample.
 * `hydratedFor` remembers whose data is loaded ('sample' or 'user:<id>') so a sign-in after the first paint
 * reloads instead of keeping the sample rows.
 */

export type OpenResult = 'ok' | 'not-found' | 'error'

let inflight: { key: string; promise: Promise<void> } | null = null

function sessionKey(): { key: string; signedIn: boolean; meId: string } {
  const { isAuthenticated, user } = useAuth()
  if (isAuthenticated.value) {
    const id = user.value?.id ?? ''
    return { key: `user:${id}`, signedIn: true, meId: id }
  }
  return { key: 'sample', signedIn: false, meId: 'user_001' }
}

function statusOf(e: unknown): number {
  const err = e as { status?: number; statusCode?: number; response?: { status?: number } }
  return err?.response?.status ?? err?.status ?? err?.statusCode ?? 0
}

function messageOf(e: unknown): string {
  const status = statusOf(e)
  if (status === 401) return 'Your session expired. Sign in again to see your conversations.'
  if (status >= 500) return `The chat server failed (HTTP ${status}).`
  if (status) return `The chat server answered HTTP ${status}.`
  return 'Could not reach the chat server.'
}

/** A failed start / react / send as one plain sentence (uses the server's `detail` when it sent one). */
export function describeChatError(action: ChatAction, e: unknown): string {
  const err = e as { data?: { detail?: unknown }; response?: { _data?: { detail?: unknown } } }
  return chatActionError(action, statusOf(e), err?.data?.detail ?? err?.response?._data?.detail)
}

function api() {
  const { $api } = useNuxtApp()
  return $api as typeof $fetch
}

export const useChatStore = defineStore('chat', {
  state: () => ({
    conversations: [] as Conversation[],
    messages: [] as Message[],
    activeConversation: null as Conversation | null,
    hydrated: false,
    loading: false,
    /** Plain-language reason the list could not load (signed in, API failed). */
    error: null as string | null,
    /** Where the rows came from; null before the first load. */
    source: null as ChatSource | null,
    /** 'sample' or 'user:<id>' — whose data is loaded. */
    hydratedFor: null as string | null,
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
        const legacyVal = conversation[`unread_count_${userId}`]
        return total + (legacyVal ?? conversation.unread_count ?? 0)
      }, 0)
    },

    getRecentConversations: (state) => (userId: string) => {
      return state.conversations
        .filter(conversation =>
          // Server rows are the caller's by construction; sample rows are filtered to the demo user.
          conversation.source === 'server' ||
          conversation.participantDetails?.some(p => p.user_id === userId) ||
          conversation.participants.includes(userId)
        )
        .sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime())
    },

    /** 0–1 urgency score from unread volume and message recency — drives the nav badge pulse */
    getEmotionalUrgency: (state) => (userId: string) => {
      let score = 0

      for (const conversation of state.conversations) {
        if (!conversation.participants.includes(userId)) continue
        const unread = conversation[`unread_count_${userId}`] || 0
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

    isSample: (state) => state.source === 'sample',
  },

  actions: {
    /**
     * Load the list for whoever is signed in now. No-op when that data is already loaded without error.
     * On the server it does nothing: the session is only known in the browser.
     */
    async ensureLoaded(force = false) {
      if (import.meta.server) return
      const { key, signedIn, meId } = sessionKey()
      if (!force && this.hydratedFor === key && !this.error) return
      if (inflight && inflight.key === key) return inflight.promise
      const promise = (signedIn ? this.loadServer(meId) : this.loadSample()).then(() => {
        this.hydratedFor = this.error ? null : key
        this.hydrated = true
      })
      inflight = { key, promise }
      try {
        await promise
      } finally {
        if (inflight?.promise === promise) inflight = null
      }
    },

    async loadServer(meId: string) {
      this.loading = true
      this.error = null
      try {
        const data = await api()<ServerConversation[] | { results?: ServerConversation[] }>('/api/v1/social/conversations/')
        const rows = Array.isArray(data) ? data : data?.results ?? []
        this.conversations = rows.map(c => mapServerConversation(c, meId))
        // Messages are fetched per conversation (detail endpoint); drop any sample messages.
        this.messages = this.messages.filter(m => isServerConversationId(m.conversation_id))
        this.source = 'server'
      } catch (e) {
        console.warn('chat: GET /api/v1/social/conversations/ failed', e)
        // Never fall back to the sample JSON for a signed-in user.
        this.conversations = []
        this.messages = []
        this.source = 'server'
        this.error = messageOf(e)
      } finally {
        this.loading = false
      }
    },

    async loadSample() {
      this.loading = true
      this.error = null
      try {
        const [convs, msgs] = await Promise.all([
          $fetch<Conversation[]>(publicAssetUrl('/data/chat/conversations.json')),
          $fetch<Message[]>(publicAssetUrl('/data/chat/messages.json')),
        ])
        this.conversations = convs.map(c => ({ ...c, source: 'sample' as const }))
        this.messages = msgs
        this.source = 'sample'
      } catch (e) {
        console.error('chat: sample conversations failed to load', e)
        this.conversations = []
        this.messages = []
        this.source = 'sample'
        this.error = 'The sample conversations could not be loaded.'
      } finally {
        this.loading = false
      }
    },

    /** Kept for existing callers: (re)load the list for the current session. */
    async fetchConversations() {
      await this.ensureLoaded(true)
    },

    /** Kept for existing callers: one conversation's messages (server), or nothing more for samples. */
    async fetchMessages(conversationId?: string) {
      if (conversationId) await this.openConversation(conversationId)
    },

    /**
     * Make one conversation available by id: from the server when signed in (fetched even when it is
     * not in the list — e.g. a room link from Insights), from the sample JSON otherwise.
     */
    async openConversation(conversationId: string): Promise<OpenResult> {
      await this.ensureLoaded()
      if (import.meta.server) return 'error'
      if (this.source !== 'server' || !isServerConversationId(conversationId)) {
        // Sample rows, or a conversation started in this tab (NewMessageModal) that only lives here.
        return this.getConversationById(conversationId) ? 'ok' : 'not-found'
      }
      const { meId } = sessionKey()
      try {
        const data = await api()<ServerConversation>(`/api/v1/social/conversations/${conversationId}/`)
        const { conversation: fresh, messages } = mapServerConversationDetail(data, meId)
        // The detail has no message_count: keep the list's exact count over the newest-100 window.
        const conversation = mergeServerConversation(this.getConversationById(fresh.id), fresh)
        this.conversations = upsertConversation(this.conversations, conversation)
        this.messages = replaceConversationMessages(this.messages, conversation.id, messages)
        return 'ok'
      } catch (e) {
        const status = statusOf(e)
        if (status === 404) return 'not-found'
        console.warn(`chat: GET conversation ${conversationId} failed`, e)
        return 'error'
      }
    },

    /**
     * POST a message to a server conversation; the server's copy is added to the store. Throws on failure.
     * `replyTo` (C4 `reply_to`) and `share` (C4 `share: {kind, id}`) are optional: an older server ignores them,
     * so the store keeps the quote locally when the answer has none.
     */
    async sendMessageRemote(
      conversationId: string,
      content: string,
      opts: { replyTo?: Message | null; share?: { kind: string; id: string } } = {},
    ) {
      const body: Record<string, unknown> = { content }
      if (opts.replyTo) body.reply_to = opts.replyTo.id
      if (opts.share) body.share = opts.share
      const data = await api()<ServerMessage>(
        `/api/v1/social/conversations/${conversationId}/messages/`,
        { method: 'POST', body },
      )
      const conversation = this.conversations.find(c => c.id === conversationId)
      const newMessage = mapServerMessage(data, conversation?.participants ?? [])
      if (opts.replyTo && !newMessage.reply_to_preview) {
        // Server without C4 reply_to: show the quote in this tab only (it is not saved).
        newMessage.reply_to_preview = {
          id: String(opts.replyTo.id),
          content: opts.replyTo.content,
          author: opts.replyTo.sender_full_name || opts.replyTo.sender_username,
        }
        newMessage.reply_to_id = String(opts.replyTo.id)
        newMessage.reply_to = String(opts.replyTo.id)
      }
      this.messages.push(newMessage)
      if (conversation) {
        conversation.last_message_at = newMessage.created_at
        conversation.last_message_preview = newMessage.content.slice(0, 200)
        conversation.message_count += 1
      }
      return newMessage
    },

    /**
     * Start (or reopen) a direct conversation with `userId` on the server and put it in the list.
     * Throws an Error whose message is the sentence to show (403: "You can message friends, bots and …").
     */
    async startDirectConversation(userId: string): Promise<Conversation> {
      const { signedIn, meId } = sessionKey()
      if (!signedIn) throw new Error('Sign in to start a conversation that is saved.')
      try {
        const data = await api()<ServerConversation>('/api/v1/social/conversations/', {
          method: 'POST', body: { user_id: userId },
        })
        const fresh = mapServerConversation(data, meId)
        const conversation = mergeServerConversation(this.getConversationById(fresh.id), fresh)
        this.conversations = upsertConversation(this.conversations, conversation)
        if (this.source !== 'server') this.source = 'server'
        return conversation
      } catch (e) {
        console.warn('chat: POST /api/v1/social/conversations/ failed', e)
        throw new Error(describeChatError('start', e))
      }
    },

    /**
     * Share an object (C9) into server conversations: people get their direct conversation (started or reopened),
     * rooms get the message as is. Returns one line per target; never throws.
     */
    async shareToTargets(
      item: ShareItem,
      targets: Array<{ kind: 'person' | 'room'; id: string; label: string }>,
      note = '',
    ): Promise<Array<{ label: string; ok: boolean; conversationId?: string; error?: string }>> {
      const { content, share } = shareMessageBody(item, note)
      const out: Array<{ label: string; ok: boolean; conversationId?: string; error?: string }> = []
      for (const t of targets) {
        try {
          const convId = t.kind === 'room' ? t.id : (await this.startDirectConversation(t.id)).id
          try {
            try {
              await this.sendMessageRemote(convId, content, { share })
            } catch (e) {
              // The server could not attach this object (a sample id, not yours: 400/404): send the link line only.
              const s = statusOf(e)
              if (s !== 400 && s !== 404) throw e
              await this.sendMessageRemote(convId, content)
            }
            out.push({ label: t.label, ok: true, conversationId: convId })
          } catch (e) {
            out.push({ label: t.label, ok: false, conversationId: convId, error: describeChatError('send', e) })
          }
        } catch (e) {
          out.push({ label: t.label, ok: false, error: e instanceof Error ? e.message : String(e) })
        }
      }
      return out
    },

    /** The public people directory (first page), for the New message picker when signed in. */
    async fetchProfiles(): Promise<ServerProfile[]> {
      const data = await api()<ServerProfile[] | { results?: ServerProfile[] }>('/api/v1/social/profiles/')
      return Array.isArray(data) ? data : data?.results ?? []
    },

    /**
     * Toggle my reaction on a server message: optimistic, then the server's answer (my state + per-emoji
     * totals) wins; on failure the toggle is undone and an Error with the sentence to show is thrown.
     */
    async toggleReactionRemote(conversationId: string, messageId: string, emoji: string) {
      const message = this.messages.find(m => String(m.id) === String(messageId))
      if (!message) throw new Error('This message is no longer loaded. Reload the conversation.')
      const { meId } = sessionKey()
      const username = useAuth().user.value?.username
      Object.assign(message, toggleOwnReaction(message, meId, emoji, username))
      try {
        const res = await api()<ServerReactionResult>(
          `/api/v1/social/conversations/${conversationId}/messages/${messageId}/reactions/`,
          { method: 'POST', body: { emoji } },
        )
        Object.assign(message, applyReactionResult(message, meId, res, username))
        return res
      } catch (e) {
        // Undo only my optimistic toggle (toggling again), so a concurrent success on another emoji survives.
        Object.assign(message, toggleOwnReaction(message, meId, emoji, username))
        console.warn(`chat: reaction ${emoji} on ${messageId} failed`, e)
        throw new Error(describeChatError('react', e))
      }
    },

    async initializeStore() {
      await this.ensureLoaded()
    },

    setActiveConversation(conversationId: string) {
      const conversation = this.conversations.find(c => c.id === conversationId)
      if (conversation) {
        this.activeConversation = conversation
      }
    },

    /** Local-only message (sample conversations and conversations created in this tab). */
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
          const unreadKey = `unread_count_${recipientId}` as const
          if (unreadKey in conversation) {
            conversation[unreadKey] = (conversation[unreadKey] ?? 0) + 1
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
        const legacyKey = `unread_count_${userId}` as const
        if (legacyKey in conversation) {
          conversation[legacyKey] = 0
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
