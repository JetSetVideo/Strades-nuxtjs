/**
 * Chat: the server's conversation JSON → the chat store's types, plus the pure display rules
 * the chat list and the conversation page share.
 *
 * Server shapes: Strades-backend apps/social/serializers.py
 *   GET  /api/v1/social/conversations/              ConversationListSerializer[] (direct chats AND group rooms)
 *   GET  /api/v1/social/conversations/<uuid>/       ConversationDetailSerializer (+ messages: newest 100, oldest-first)
 *   POST /api/v1/social/conversations/<uuid>/messages/  {content} → MessageSerializer (201)
 *   POST /api/v1/social/conversations/              {user_id} → list item (201 created / 200 reopened; 403 not linked)
 *   POST /api/v1/social/conversations/<c>/messages/<m>/reactions/  {emoji} → {message_id, emoji, reacted, counts}
 */

import { fmtCount } from '~/utils/format'

export interface Participant {
  user_id: string
  username: string
  full_name: string
  avatar_url: string
  is_online: boolean
  unread_count: number
}

export type ChatSource = 'server' | 'sample'

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
  /** Server only: the last message's first 200 chars; avatar of a room. */
  last_message_preview?: string
  avatar_url?: string
  /**
   * Server only: true when `message_count` is the server's count of non-deleted messages (list / start endpoints,
   * or a detail with fewer than 100 messages). False = a lower bound (the newest-100 window of the detail).
   */
  message_count_known?: boolean
  /** Where the row came from: the user's account (server) or the bundled sample JSON. */
  source?: ChatSource
  // Per-user unread keys: the sample JSON uses them, and the nav badge (utils/navIcons unreadFor) reads them.
  [key: `unread_count_${string}`]: number | undefined
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
  reply_to_preview: { id: string; content: string; author?: string } | null
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
  /**
   * Server only, after a reaction toggle: the server's per-emoji totals ({emoji: n}). It wins over a tally of
   * `reactions` (which then only says which ones are mine) until the next detail fetch replaces the message.
   */
  reaction_counts?: Record<string, number>
  metadata: {
    character_count: number
    mentions: string[]
    hashtags: string[]
  }
}

// ── Server JSON ─────────────────────────────────────────────────────────────

export interface ServerParticipant {
  user_id: string
  username: string
  full_name?: string | null
  avatar_url?: string | null
  is_online?: boolean
  unread_count?: number
  last_read_at?: string | null
  joined_at?: string | null
  is_admin?: boolean
}

export interface ServerMessage {
  id: string
  conversation_id: string
  sender_id: string
  sender_username: string
  sender_full_name?: string | null
  sender_avatar_url?: string | null
  content: string
  content_type?: 'text' | 'image' | 'attachment' | string
  reply_to_id?: string | null
  reply_to_preview?: { id: string; content: string } | null
  /** C4 (social-api): `{id, preview, author}` when the message answers another one of the same conversation. */
  reply_to?: { id: string; preview?: string | null; author?: string | null } | string | null
  attachment_url?: string | null
  attachment_name?: string | null
  edited_at?: string | null
  is_deleted?: boolean
  created_at: string
  reactions?: Array<{ id: number; user_id: string; username: string; emoji: string; created_at?: string }>
}

export interface ServerConversation {
  id: string
  type: 'direct' | 'group' | string
  name?: string | null
  topic?: string | null
  avatar_url?: string | null
  participants?: ServerParticipant[]
  last_message_at?: string | null
  last_message_preview?: string | null
  unread_count?: number
  /** Non-deleted messages (list + start endpoints; null/absent on the detail endpoint). */
  message_count?: number | null
  created_at?: string | null
  /** Detail endpoint only. */
  messages?: ServerMessage[]
}

const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v))
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

export function mapServerParticipant(p: ServerParticipant): Participant {
  return {
    user_id: str(p.user_id),
    username: str(p.username),
    full_name: str(p.full_name),
    avatar_url: str(p.avatar_url),
    is_online: p.is_online === true,
    unread_count: num(p.unread_count),
  }
}

/** One server conversation → the store's Conversation. `meId` stamps the user's own unread key (nav badge). */
export function mapServerConversation(sc: ServerConversation, meId: string): Conversation {
  const details = (sc.participants ?? []).map(mapServerParticipant)
  const created = str(sc.created_at)
  const last = str(sc.last_message_at) || created
  const unread = num(sc.unread_count)
  const count = serverMessageCount(sc)
  const conv: Conversation = {
    id: str(sc.id),
    participants: details.map(p => p.user_id),
    participantDetails: details,
    type: sc.type === 'group' ? 'group' : 'direct',
    title: str(sc.name) || null,
    description: str(sc.topic),
    created_by: '',
    created_at: created || last,
    last_message_at: last,
    is_active: true,
    message_count: count.value,
    message_count_known: count.known,
    unread_count: unread,
    last_message_preview: str(sc.last_message_preview),
    avatar_url: str(sc.avatar_url),
    source: 'server',
    metadata: { topic: str(sc.topic) || undefined },
  }
  if (meId) conv[`unread_count_${meId}`] = unread
  return conv
}

/** The quoted message, from C4 `reply_to:{id, preview, author}` or the older `reply_to_id` + `reply_to_preview`. */
export function replyOf(sm: Pick<ServerMessage, 'reply_to' | 'reply_to_id' | 'reply_to_preview'>): Message['reply_to_preview'] {
  const r = sm.reply_to
  if (r && typeof r === 'object' && r.id) {
    return { id: str(r.id), content: str(r.preview), ...(r.author ? { author: str(r.author) } : {}) }
  }
  const id = (typeof r === 'string' && r) || sm.reply_to_id || sm.reply_to_preview?.id
  if (!id) return null
  return { id: str(id), content: str(sm.reply_to_preview?.content) }
}

export function mapServerMessage(sm: ServerMessage, participants: readonly string[] = []): Message {
  const ct = sm.content_type === 'image' || sm.content_type === 'attachment' ? sm.content_type : 'text'
  const content = str(sm.content)
  const attachmentUrl = str(sm.attachment_url)
  const attachmentName = str(sm.attachment_name)
  return {
    id: str(sm.id),
    conversation_id: str(sm.conversation_id),
    sender_id: str(sm.sender_id),
    sender_username: str(sm.sender_username),
    sender_full_name: str(sm.sender_full_name),
    sender_avatar_url: str(sm.sender_avatar_url),
    recipient_ids: participants.filter(id => id !== str(sm.sender_id)),
    content,
    message_type: ct === 'attachment' ? 'file' : ct,
    content_type: ct,
    timestamp: str(sm.created_at),
    created_at: str(sm.created_at),
    is_read: true,
    is_edited: !!sm.edited_at,
    is_deleted: sm.is_deleted === true,
    edited_at: sm.edited_at ?? null,
    reply_to: replyOf(sm)?.id ?? null,
    reply_to_id: replyOf(sm)?.id ?? null,
    reply_to_preview: replyOf(sm),
    attachment_url: attachmentUrl,
    attachment_name: attachmentName,
    attachments: attachmentUrl ? [{ type: 'file', url: attachmentUrl, filename: attachmentName }] : [],
    reactions: (sm.reactions ?? []).map(r => ({
      id: r.id, user_id: str(r.user_id), username: r.username, reaction: r.emoji, emoji: r.emoji, timestamp: r.created_at,
    })),
    metadata: { character_count: content.length, mentions: [], hashtags: [] },
  }
}

/** Detail JSON → conversation + its messages (already oldest-first on the server; sorted again to be safe). */
export function mapServerConversationDetail(sc: ServerConversation, meId: string): { conversation: Conversation; messages: Message[] } {
  const conversation = mapServerConversation(sc, meId)
  // Opening the detail marks it read on the server (views.py ConversationDetailView).
  conversation.unread_count = 0
  if (meId) conversation[`unread_count_${meId}`] = 0
  const messages = (sc.messages ?? [])
    .map(m => mapServerMessage(m, conversation.participants))
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))
  return { conversation, messages }
}

/** Replace the conversation with the same id, or put the new one first. */
export function upsertConversation(list: readonly Conversation[], conv: Conversation): Conversation[] {
  const i = list.findIndex(c => c.id === conv.id)
  if (i === -1) return [conv, ...list]
  const out = list.slice()
  out[i] = conv
  return out
}

/** Replace one conversation's messages, keep the others. */
export function replaceConversationMessages(all: readonly Message[], conversationId: string, incoming: readonly Message[]): Message[] {
  return [...all.filter(m => m.conversation_id !== conversationId), ...incoming]
}

/** Server conversation ids are UUIDs; the sample JSON uses ids like "conv_001". */
export function isServerConversationId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
}

// ── Message counts ─────────────────────────────────────────────────────────

/** The detail endpoint returns at most the newest 100 messages. */
export const DETAIL_MESSAGE_WINDOW = 100

/**
 * How many messages a server conversation has: `message_count` (list / start endpoints) is exact; without it
 * the detail's message window is exact only when it is not full (fewer than 100).
 */
export function serverMessageCount(sc: Pick<ServerConversation, 'message_count' | 'messages'>): { value: number; known: boolean } {
  const n = sc.message_count
  if (typeof n === 'number' && Number.isFinite(n) && n >= 0) return { value: Math.round(n), known: true }
  if (Array.isArray(sc.messages)) return { value: sc.messages.length, known: sc.messages.length < DETAIL_MESSAGE_WINDOW }
  return { value: 0, known: false }
}

/**
 * Put a freshly mapped server conversation over the one already in the list. The detail endpoint has no
 * `message_count`: keep the list's exact count rather than replacing it with the newest-100 window.
 */
export function mergeServerConversation(prev: Conversation | undefined, next: Conversation): Conversation {
  if (!prev || next.message_count_known || !prev.message_count_known) return next
  return { ...next, message_count: Math.max(prev.message_count, next.message_count), message_count_known: true }
}

/** "1 message" · "12 messages" · "100+ messages" (server, only a lower bound known) · "" (server, unknown). */
export function messageCountLabel(conv: Pick<Conversation, 'message_count' | 'message_count_known' | 'source'>): string {
  const n = Number.isFinite(conv.message_count) ? Math.max(0, conv.message_count) : 0
  if (conv.source === 'server' && conv.message_count_known !== true) {
    return n > 0 ? `${fmtCount(n)}+ messages` : ''
  }
  return `${fmtCount(n)} ${n === 1 ? 'message' : 'messages'}`
}

// ── Reactions ──────────────────────────────────────────────────────────────

/** The reaction buttons under a message (each is one emoji, as the server requires). */
export const CHAT_REACTIONS = ['👍', '❤️', '😂', '😮'] as const

type MessageReaction = Message['reactions'][number]
type ReactionState = Pick<Message, 'reactions' | 'reaction_counts'>

const emojiOf = (r: MessageReaction): string => r.emoji || r.reaction || ''
const isMine = (r: MessageReaction, meId: string, emoji: string) => r.user_id === meId && emojiOf(r) === emoji

export interface ReactionChip {
  emoji: string
  count: number
  /** The signed-in user (or the sample user) is one of them. */
  mine: boolean
}

/** Per-emoji totals under a message, in first-seen order. The server's totals win over a tally of the list. */
export function reactionSummary(msg: ReactionState, meId: string): ReactionChip[] {
  const order: string[] = []
  const tally: Record<string, number> = {}
  for (const r of msg.reactions ?? []) {
    const e = emojiOf(r)
    if (!e) continue
    if (!(e in tally)) { order.push(e); tally[e] = 0 }
    tally[e] += 1
  }
  const counts = msg.reaction_counts
  if (counts) for (const e of Object.keys(counts)) if (!order.includes(e)) order.push(e)
  const out: ReactionChip[] = []
  for (const e of order) {
    const mine = (msg.reactions ?? []).some(r => isMine(r, meId, e))
    const raw = counts ? counts[e] ?? 0 : tally[e] ?? 0
    const count = Math.max(Number.isFinite(raw) ? Math.round(raw) : 0, mine ? 1 : 0)
    if (count > 0) out.push({ emoji: e, count, mine })
  }
  return out
}

/** Optimistic toggle of my reaction (also its own undo: toggling twice restores the state). */
export function toggleOwnReaction(msg: ReactionState, meId: string, emoji: string, username?: string): Required<Pick<Message, 'reactions'>> & Pick<Message, 'reaction_counts'> {
  const list = msg.reactions ?? []
  const had = list.some(r => isMine(r, meId, emoji))
  const reactions = had
    ? list.filter(r => !isMine(r, meId, emoji))
    : [...list, { user_id: meId, username, emoji, reaction: emoji }]
  let reaction_counts = msg.reaction_counts
  if (reaction_counts) {
    const next = Math.max(0, (reaction_counts[emoji] ?? 0) + (had ? -1 : 1))
    reaction_counts = { ...reaction_counts, [emoji]: next }
    if (next === 0) delete reaction_counts[emoji]
  }
  return { reactions, reaction_counts }
}

/** POST …/reactions/ answer. */
export interface ServerReactionResult {
  message_id: string
  emoji: string
  reacted: boolean
  counts: Record<string, number>
}

/** Reconcile after the server answered: my reaction is what the server says, totals are the server's. */
export function applyReactionResult(msg: ReactionState, meId: string, res: ServerReactionResult, username?: string): Required<Pick<Message, 'reactions' | 'reaction_counts'>> {
  const emoji = str(res.emoji)
  const list = msg.reactions ?? []
  const has = list.some(r => isMine(r, meId, emoji))
  let reactions = list
  if (res.reacted && !has) reactions = [...list, { user_id: meId, username, emoji, reaction: emoji }]
  else if (!res.reacted && has) reactions = list.filter(r => !isMine(r, meId, emoji))
  const reaction_counts: Record<string, number> = {}
  for (const [e, n] of Object.entries(res.counts ?? {})) {
    if (typeof n === 'number' && Number.isFinite(n) && n > 0) reaction_counts[e] = Math.round(n)
  }
  return { reactions, reaction_counts }
}

// ── Errors (plain language for the start / react / send actions) ───────────

export type ChatAction = 'start' | 'react' | 'send'

/** One message per failed action; `detail` is the server's own `detail` string when it sent one. */
export function chatActionError(action: ChatAction, status: number, detail?: unknown): string {
  const said = typeof detail === 'string' && detail.trim() ? detail.trim() : ''
  if (status === 401) return 'Your session expired. Sign in again.'
  if (action === 'start') {
    if (status === 403) return said || 'You can message friends, bots and people you share a room with.'
    if (status === 400) return said || 'Pick another person: this one cannot be messaged.'
  }
  if (action === 'react') {
    if (status === 400) return 'The server only accepts a single emoji as a reaction.'
    if (status === 404) return 'This message is gone, or you are no longer in this conversation.'
  }
  if (action === 'send' && status === 404) return 'This conversation is gone, or you are no longer in it.'
  const what = action === 'start' ? 'Could not open the chat' : action === 'react' ? 'Reaction not saved' : 'Not sent'
  if (status >= 500) return `${what}: the chat server failed (HTTP ${status}).`
  if (status) return `${what}: the chat server answered HTTP ${status}.`
  return `${what}: could not reach the chat server.`
}

// ── New message: who can be picked (signed in) ──────────────────────────────

/** GET /api/v1/social/profiles/ item (UserPublicProfileSerializer, the fields used here). */
export interface ServerProfile {
  user_id: string
  username: string
  full_name?: string | null
  first_name?: string | null
  last_name?: string | null
  avatar_url?: string | null
  is_online?: boolean
  /** C2 (social-api, optional): a society bot. */
  is_bot?: boolean
  /** C2 (social-api, optional): the server would accept a direct conversation (friend, bot or room-mate). */
  can_message?: boolean
}

export interface DirectCandidate {
  user_id: string
  username: string
  full_name: string
  avatar_url: string
  is_online: boolean
  /** Already linked through a shared conversation: the server will accept it. Others may get a 403. */
  linked: boolean
  /** true/false when the server said so (C2 `can_message`, or linked); null = unknown (older server). */
  canMessage: boolean | null
  is_bot: boolean
  /** "In a room with you" · "You already chat" · "Bot" · "Add as friend first" · "" */
  note: string
}

/**
 * Picker order: people you already chat with directly, bots, named room-mates, others the server accepts,
 * unknown (older server), nameless room-mates (other demo accounts), then the refused ones.
 */
function candidateRank(c: DirectCandidate): number {
  if (c.linked && c.note === 'You already chat') return 0
  if (c.is_bot && c.canMessage !== false) return 1
  if (c.linked) return c.username ? 2 : 5
  if (c.canMessage === true) return 3
  if (c.canMessage === null) return 4
  return 6
}

/**
 * People a signed-in user can try to message directly: everyone in their server conversations first (the server
 * accepts them), then the public directory (the server decides: friends and bots pass, others get a 403).
 */
export function directCandidates(
  conversations: readonly Conversation[],
  profiles: readonly ServerProfile[],
  meId: string,
  query = '',
  limit = 30,
): DirectCandidate[] {
  const byId = new Map<string, DirectCandidate>()
  for (const c of conversations) {
    if (c.source !== 'server') continue
    for (const p of c.participantDetails ?? []) {
      if (!p.user_id || p.user_id === meId) continue
      const prev = byId.get(p.user_id)
      const note = c.type === 'group' ? 'In a room with you' : 'You already chat'
      if (prev) { if (c.type === 'group') prev.note = note; continue }
      byId.set(p.user_id, {
        user_id: p.user_id, username: p.username, full_name: p.full_name, avatar_url: p.avatar_url,
        is_online: p.is_online, linked: true, canMessage: true, is_bot: false, note,
      })
    }
  }
  for (const p of profiles) {
    const id = str(p.user_id)
    if (!id || id === meId) continue
    const prev = byId.get(id)
    if (prev) {
      if (p.is_bot === true) { prev.is_bot = true; prev.note = `Bot · ${prev.note.toLowerCase()}` }
      continue
    }
    const canMessage = typeof p.can_message === 'boolean' ? p.can_message : null
    const isBot = p.is_bot === true
    byId.set(id, {
      user_id: id,
      username: str(p.username),
      full_name: str(p.full_name) || `${str(p.first_name)} ${str(p.last_name)}`.trim(),
      avatar_url: str(p.avatar_url),
      is_online: p.is_online === true,
      linked: false,
      canMessage,
      is_bot: isBot,
      note: canMessage === false ? 'Add as friend first' : isBot ? 'Bot' : '',
    })
  }
  const q = query.trim().toLowerCase()
  const all = [...byId.values()].filter(c => !q || c.username.toLowerCase().includes(q) || c.full_name.toLowerCase().includes(q))
  // Stable sort: the server order is kept inside each rank.
  return all
    .map((c, i) => ({ c, i }))
    .sort((a, b) => candidateRank(a.c) - candidateRank(b.c) || a.i - b.i)
    .map(x => x.c)
    .slice(0, Math.max(0, limit))
}

// ── People (C2 profiles + C3 friends) → the chat Friends/Discover cards ──────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** A server user id (uuid). Sample ids look like `user_005` and never reach the server. */
export function isServerUserId(id: unknown): boolean {
  return typeof id === 'string' && UUID_RE.test(id)
}

/** GET /api/v1/social/friends/ row (C3). */
export interface ServerFriend { id: string; public_name?: string | null; is_bot?: boolean; since?: string | null }

/** The PersonCard row (CommunityUser shape) for a server profile. Numbers the server did not send stay 0. */
export function serverPersonCard(p: ServerProfile & Record<string, unknown>, isFriend: boolean) {
  const markets = Array.isArray(p.preferred_markets) ? (p.preferred_markets as unknown[]).map(String) : []
  const classes = ['fiat', 'crypto', 'stocks', 'commodities']
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0)
  const winRate = n(p.win_rate)
  return {
    id: str(p.user_id),
    username: str(p.username),
    handle: str(p.username),
    avatar_url: str(p.avatar_url),
    bio: str(p.bio) || (p.is_bot ? 'Society bot — trades and talks on its own.' : ''),
    is_friend: isFriend,
    online: p.is_online === true,
    timezone: str(p.timezone),
    specialization: markets.filter(m => classes.includes(m)) as Array<'fiat' | 'crypto' | 'stocks' | 'commodities'>,
    trading_style: str(p.trading_style),
    // The server sends 0–100; the card expects 0–1.
    win_rate: winRate > 1 ? winRate / 100 : winRate,
    last_30d_pnl_pct: n(p.performance_30d),
    followers: n(p.followers_count),
    match_score: 0,
    last_active_at: str(p.last_seen),
    is_bot: p.is_bot === true,
    can_message: typeof p.can_message === 'boolean' ? p.can_message : null,
    source: 'server' as const,
  }
}

// ── Share into chat (C4 `share`, C9 <ChatShareTo>) ───────────────────────────

export type ShareKind = 'article' | 'strategy' | 'call' | 'bot' | 'asset'
export interface ShareItem { kind: ShareKind; id: string; title: string; url?: string }
export interface ShareCard { kind: ShareKind; title: string; url: string; note: string }

const SHARE_PATHS: Array<[ShareKind, string]> = [
  ['article', '/articles/'], ['strategy', '/strategy/'], ['bot', '/bots/'], ['asset', '/assets/'], ['call', '/predict'],
]

/** The in-app page of a shared object (`item.url` wins when it is an in-app path). */
export function shareUrl(item: ShareItem): string {
  if (item.url && item.url.startsWith('/')) return item.url
  const id = encodeURIComponent(item.id)
  switch (item.kind) {
    case 'article': return `/articles/${id}`
    case 'strategy': return `/strategy/${id}`
    case 'bot': return `/bots/${id}`
    case 'asset': return `/assets/${id}`
    default: return `/predict`
  }
}

function kindOfUrl(url: string): ShareKind {
  for (const [kind, prefix] of SHARE_PATHS) if (url.startsWith(prefix)) return kind
  return 'article'
}

/**
 * The POST body for sharing `item` into a conversation: `share` for a C4 server (it builds the attachment), and a
 * readable `content` line so an older server (which ignores `share`) still stores a message with the link.
 */
export function shareMessageBody(item: ShareItem, note = ''): { content: string; share: { kind: ShareKind; id: string } } {
  const line = `📎 ${item.title.trim() || item.kind} ${shareUrl(item)}`
  const n = note.trim()
  return { content: n ? `${n} — ${line}` : line, share: { kind: item.kind, id: item.id } }
}

const SHARE_LINE = /(?:^|\s—\s)📎\s(.+?)\s(\/(?:articles|strategy|bots|assets|predict)[^\s]*)\s*$/u

/**
 * A message that carries a shared object → the card to draw, or null. Reads C4 attachments
 * (`content_type='attachment'` + an in-app `attachment_url`) and the fallback text line from `shareMessageBody`.
 */
export function shareCardOf(m: Pick<Message, 'content' | 'content_type' | 'attachment_url' | 'attachment_name'>): ShareCard | null {
  const url = str(m.attachment_url)
  const content = str(m.content)
  if (url.startsWith('/')) {
    const parsed = content.match(SHARE_LINE)
    // The server's own text when the sender wrote none: "Shared article: <title>".
    const serverLine = parsed ? null : content.match(/^Shared [a-z]+: (.+)$/u)
    const name = str(m.attachment_name)
    // attachment_name may be a `kind:id` key rather than a title: never show that as the title.
    const nameTitle = /^(article|strategy|call|bot|asset):/.test(name) ? '' : name
    const note = parsed ? content.slice(0, parsed.index).trim() : serverLine || content === name ? '' : content
    return { kind: kindOfUrl(url), title: parsed?.[1] || serverLine?.[1] || nameTitle || 'Shared', url, note }
  }
  const match = content.match(SHARE_LINE)
  if (!match) return null
  return { kind: kindOfUrl(match[2]!), title: match[1]!, url: match[2]!, note: content.slice(0, match.index).trim() }
}

/** One-line quote of a message for the reply bar and the reply preview. */
export function quoteOf(text: string, max = 90): string {
  const t = str(text).replace(/\s+/g, ' ').trim()
  return t.length > max ? `${t.slice(0, max - 1)}…` : t
}

// ── Display ────────────────────────────────────────────────────────────────

export interface UserLookup {
  (id: string): { username?: string | null; full_name?: string | null; avatar_url?: string | null } | null | undefined
}

export interface ConversationDisplay {
  /** Row / header title: the room name, or the other person's name. */
  name: string
  /** Second line: topic, then the last message preview, then who is in it. */
  subtitle: string
  avatar: string
  /** Profile link for a direct chat; null for rooms (no single person to open). */
  profileId: string | null
  isGroup: boolean
  /** "Room · 3 people" or "" for a direct chat. */
  kind: string
}

const FALLBACK_AVATAR = '/avatars/Ellipse5.png'
const nameOf = (p: { username?: string | null; full_name?: string | null } | null | undefined) =>
  (p?.full_name || p?.username || '').trim()

/** Names and avatar for a conversation row/header. `lookup` resolves ids the conversation does not describe (sample users). */
export function conversationDisplay(conv: Conversation, meId: string, lookup: UserLookup = () => null): ConversationDisplay {
  const others = conv.participants.filter(id => id !== meId)
  const detail = (id: string) => conv.participantDetails?.find(p => p.user_id === id) ?? lookup(id) ?? null
  const isGroup = conv.type === 'group' || others.length > 1
  const people = conv.participants.length
  const otherNames = others.map(id => nameOf(detail(id))).filter(Boolean)
  const preview = (conv.last_message_preview ?? '').trim()
  // Sample topics are slugs ("trading_strategies").
  const topic = (conv.metadata?.topic ?? '').replace(/_/g, ' ').trim()
  if (isGroup) {
    return {
      name: conv.title || (otherNames.length ? otherNames.slice(0, 3).join(', ') : 'Room'),
      subtitle: topic || conv.description || preview || (otherNames.length ? `With ${otherNames.slice(0, 3).join(', ')}` : 'No messages yet'),
      avatar: conv.avatar_url || FALLBACK_AVATAR,
      profileId: null,
      isGroup: true,
      kind: `Room · ${people} ${people === 1 ? 'person' : 'people'}`,
    }
  }
  const otherId = others[0] ?? null
  const other = otherId ? detail(otherId) : null
  return {
    name: conv.title || nameOf(other) || 'Unknown user',
    subtitle: topic || conv.description || preview || 'No messages yet',
    avatar: other?.avatar_url || conv.avatar_url || FALLBACK_AVATAR,
    profileId: otherId,
    isGroup: false,
    kind: '',
  }
}
