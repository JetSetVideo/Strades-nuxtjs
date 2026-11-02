import { describe, expect, it } from 'vitest'
import {
  applyReactionResult, CHAT_REACTIONS, chatActionError, conversationDisplay, directCandidates, isServerConversationId,
  mapServerConversation, mapServerConversationDetail, mapServerMessage, mergeServerConversation, messageCountLabel,
  reactionSummary, replaceConversationMessages, serverMessageCount, toggleOwnReaction, upsertConversation,
  type Conversation, type ServerConversation,
} from '~/utils/chatMap'

const ME = '11111111-1111-4111-8111-111111111111'
const BOB = '22222222-2222-4222-8222-222222222222'
const CAROL = '33333333-3333-4333-8333-333333333333'
const DAVE = '44444444-4444-4444-8444-444444444444'
const ROOM = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const DM = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

const part = (user_id: string, username: string, full_name = '', unread = 0) => ({
  user_id, username, full_name, avatar_url: `/a/${username}.png`, is_online: username === 'bob',
  unread_count: unread, last_read_at: null, joined_at: '2026-10-01T00:00:00Z', is_admin: false,
})

// Exact ConversationListSerializer shape (apps/social/serializers.py).
const room: ServerConversation = {
  id: ROOM, type: 'group', name: 'Macro desk', topic: 'Rates and FX', avatar_url: '',
  participants: [part(ME, 'me', 'Me Myself', 3), part(BOB, 'bob', 'Bob B'), part(CAROL, 'carol')],
  last_message_at: '2026-11-01T10:00:00Z', last_message_preview: 'See you at the open', unread_count: 3,
  created_at: '2026-10-01T00:00:00Z',
}
const dm: ServerConversation = {
  id: DM, type: 'direct', name: '', topic: '', avatar_url: '',
  participants: [part(ME, 'me'), part(BOB, 'bob', 'Bob B')],
  last_message_at: null, last_message_preview: '', unread_count: 0, created_at: '2026-10-02T00:00:00Z',
}

describe('mapServerConversation', () => {
  it('maps a group room: ids, details, title, topic, unread for me (nav badge key)', () => {
    const c = mapServerConversation(room, ME)
    expect(c).toMatchObject({
      id: ROOM, type: 'group', title: 'Macro desk', description: 'Rates and FX', source: 'server',
      participants: [ME, BOB, CAROL], unread_count: 3, last_message_preview: 'See you at the open',
      last_message_at: '2026-11-01T10:00:00Z', created_at: '2026-10-01T00:00:00Z', message_count: 0,
    })
    expect(c[`unread_count_${ME}`]).toBe(3)
    expect(c.participantDetails[1]).toEqual({ user_id: BOB, username: 'bob', full_name: 'Bob B', avatar_url: '/a/bob.png', is_online: true, unread_count: 0 })
  })
  it('a direct chat with no message yet falls back to created_at and has no title', () => {
    const c = mapServerConversation(dm, ME)
    expect(c.title).toBeNull()
    expect(c.last_message_at).toBe('2026-10-02T00:00:00Z')
    expect(c.metadata.topic).toBeUndefined()
  })
  it('tolerates missing fields', () => {
    const c = mapServerConversation({ id: DM, type: 'weird' }, '')
    expect(c).toMatchObject({ type: 'direct', participants: [], unread_count: 0, title: null, last_message_at: '' })
  })
})

describe('mapServerConversationDetail', () => {
  const msg = (id: string, sender: string, at: string, content = 'hi') => ({
    id, conversation_id: ROOM, sender_id: sender, sender_username: sender === BOB ? 'bob' : 'me', sender_full_name: '',
    sender_avatar_url: '', content, content_type: 'text', reply_to_id: null, reply_to_preview: null,
    attachment_url: '', attachment_name: '', edited_at: null, is_deleted: false, created_at: at,
    reactions: [{ id: 1, user_id: ME, username: 'me', emoji: '👍', created_at: at }],
  })
  it('returns the room, read (the GET marks it read), messages oldest-first with recipients', () => {
    const { conversation, messages } = mapServerConversationDetail(
      { ...room, messages: [msg('m2', BOB, '2026-11-01T10:00:00Z'), msg('m1', ME, '2026-11-01T09:00:00Z', 'gm')] }, ME)
    expect(conversation.unread_count).toBe(0)
    expect(conversation[`unread_count_${ME}`]).toBe(0)
    expect(conversation.message_count).toBe(2)
    expect(messages.map(m => m.id)).toEqual(['m1', 'm2'])
    expect(messages[0]).toMatchObject({ content: 'gm', timestamp: '2026-11-01T09:00:00Z', recipient_ids: [BOB, CAROL], is_edited: false })
    expect(messages[1].reactions[0]).toMatchObject({ user_id: ME, emoji: '👍', reaction: '👍' })
  })
  it('maps an attachment message to a file attachment', () => {
    const m = mapServerMessage({ ...msg('m3', BOB, '2026-11-01T11:00:00Z'), content_type: 'attachment', attachment_url: '/f.pdf', attachment_name: 'f.pdf', edited_at: '2026-11-01T11:05:00Z' })
    expect(m).toMatchObject({ message_type: 'file', content_type: 'attachment', is_edited: true, attachments: [{ type: 'file', url: '/f.pdf', filename: 'f.pdf' }] })
  })
})

describe('list helpers', () => {
  it('upsert replaces by id or puts the new conversation first', () => {
    const a = mapServerConversation(room, ME)
    const b = mapServerConversation(dm, ME)
    expect(upsertConversation([b], a).map(c => c.id)).toEqual([ROOM, DM])
    const renamed = { ...a, title: 'Renamed' }
    expect(upsertConversation([b, a], renamed).map(c => c.title)).toEqual([null, 'Renamed'])
  })
  it('replaces one conversation\'s messages only', () => {
    const keep = mapServerMessage({ id: 'x', conversation_id: DM, sender_id: BOB, sender_username: 'bob', content: 'k', created_at: '2026-11-01T00:00:00Z' })
    const old = mapServerMessage({ id: 'o', conversation_id: ROOM, sender_id: BOB, sender_username: 'bob', content: 'o', created_at: '2026-11-01T00:00:00Z' })
    const fresh = mapServerMessage({ id: 'n', conversation_id: ROOM, sender_id: BOB, sender_username: 'bob', content: 'n', created_at: '2026-11-01T00:00:00Z' })
    expect(replaceConversationMessages([keep, old], ROOM, [fresh]).map(m => m.id)).toEqual(['x', 'n'])
  })
  it('tells server ids (UUID) from sample ids', () => {
    expect(isServerConversationId(ROOM)).toBe(true)
    expect(isServerConversationId('conv_001')).toBe(false)
    expect(isServerConversationId('')).toBe(false)
  })
})

describe('message counts', () => {
  it('the list count is exact; the detail window is exact only below 100', () => {
    expect(serverMessageCount({ message_count: 42 })).toEqual({ value: 42, known: true })
    expect(serverMessageCount({ message_count: null, messages: [] })).toEqual({ value: 0, known: true })
    const hundred = Array.from({ length: 100 }, () => ({}) as never)
    expect(serverMessageCount({ messages: hundred })).toEqual({ value: 100, known: false })
    expect(serverMessageCount({})).toEqual({ value: 0, known: false })
    expect(mapServerConversation({ ...room, message_count: 7 }, ME)).toMatchObject({ message_count: 7, message_count_known: true })
    expect(mapServerConversation(room, ME).message_count_known).toBe(false)
  })
  it('a detail without message_count keeps the list\'s exact count', () => {
    const listed = mapServerConversation({ ...dm, message_count: 250 }, ME)
    const msgs = Array.from({ length: 100 }, (_, i) => ({
      id: `m${i}`, conversation_id: DM, sender_id: BOB, sender_username: 'bob', content: 'x', created_at: '2026-11-01T00:00:00Z',
    }))
    const { conversation: detail } = mapServerConversationDetail({ ...dm, messages: msgs }, ME)
    expect(detail).toMatchObject({ message_count: 100, message_count_known: false })
    expect(mergeServerConversation(listed, detail)).toMatchObject({ message_count: 250, message_count_known: true, unread_count: 0 })
    expect(mergeServerConversation(undefined, detail)).toBe(detail)
    const exact = mapServerConversation({ ...dm, message_count: 3 }, ME)
    expect(mergeServerConversation(listed, exact).message_count).toBe(3)
  })
  it('labels: exact, singular, lower bound, unknown, sample', () => {
    expect(messageCountLabel({ source: 'server', message_count: 1234, message_count_known: true })).toBe('1,234 messages')
    expect(messageCountLabel({ source: 'server', message_count: 1, message_count_known: true })).toBe('1 message')
    expect(messageCountLabel({ source: 'server', message_count: 0, message_count_known: true })).toBe('0 messages')
    expect(messageCountLabel({ source: 'server', message_count: 100, message_count_known: false })).toBe('100+ messages')
    expect(messageCountLabel({ source: 'server', message_count: 0, message_count_known: false })).toBe('')
    expect(messageCountLabel({ source: 'sample', message_count: 45 })).toBe('45 messages')
  })
})

describe('reactions', () => {
  const base = { reactions: [
    { user_id: BOB, emoji: '👍', reaction: '👍' },
    { user_id: CAROL, emoji: '👍', reaction: '👍' },
    { user_id: ME, emoji: '❤️', reaction: '❤️' },
  ] }
  it('summary: per-emoji counts in first-seen order, mine flagged; sample rows use `reaction`', () => {
    expect(reactionSummary(base, ME)).toEqual([
      { emoji: '👍', count: 2, mine: false },
      { emoji: '❤️', count: 1, mine: true },
    ])
    expect(reactionSummary({ reactions: [{ user_id: 'user_001', reaction: '😂' }] }, 'user_001')).toEqual([{ emoji: '😂', count: 1, mine: true }])
    expect(reactionSummary({ reactions: [] }, ME)).toEqual([])
  })
  it('summary: the server totals win over the tally; zero totals vanish', () => {
    const s = reactionSummary({ ...base, reaction_counts: { '👍': 5, '😮': 1, '❤️': 1, '😂': 0 } }, ME)
    expect(s).toEqual([
      { emoji: '👍', count: 5, mine: false },
      { emoji: '❤️', count: 1, mine: true },
      { emoji: '😮', count: 1, mine: false },
    ])
  })
  it('optimistic toggle adds/removes mine and is its own undo', () => {
    const on = toggleOwnReaction(base, ME, '👍', 'me')
    expect(reactionSummary(on, ME)[0]).toEqual({ emoji: '👍', count: 3, mine: true })
    const off = toggleOwnReaction(on, ME, '👍', 'me')
    expect(reactionSummary(off, ME)).toEqual(reactionSummary(base, ME))
    // With server totals present, the totals move too.
    const withCounts = { ...base, reaction_counts: { '👍': 5, '❤️': 1 } }
    expect(toggleOwnReaction(withCounts, ME, '❤️').reaction_counts).toEqual({ '👍': 5 })
    expect(toggleOwnReaction(withCounts, ME, '👍').reaction_counts).toEqual({ '👍': 6, '❤️': 1 })
    expect(base.reactions).toHaveLength(3) // inputs untouched
  })
  it('reconcile: my state and the totals are the server\'s', () => {
    const optimistic = toggleOwnReaction(base, ME, '👍')
    // The server says it was NOT recorded (e.g. raced with another tab): mine is removed, totals replaced.
    const r = applyReactionResult(optimistic, ME, { message_id: 'm', emoji: '👍', reacted: false, counts: { '👍': 2, '❤️': 1, '🔥': 4, bad: -1 } as never })
    expect(r.reaction_counts).toEqual({ '👍': 2, '❤️': 1, '🔥': 4 })
    expect(reactionSummary(r, ME)).toEqual([
      { emoji: '👍', count: 2, mine: false },
      { emoji: '❤️', count: 1, mine: true },
      { emoji: '🔥', count: 4, mine: false },
    ])
    const added = applyReactionResult(base, ME, { message_id: 'm', emoji: '😮', reacted: true, counts: { '👍': 2, '❤️': 1, '😮': 1 } }, 'me')
    expect(added.reactions.at(-1)).toMatchObject({ user_id: ME, emoji: '😮', username: 'me' })
  })
  it('the reaction buttons are single emoji (no letters or digits: the server refuses those)', () => {
    for (const e of CHAT_REACTIONS) expect(/[\p{L}\p{N}]/u.test(e)).toBe(false)
  })
})

describe('chatActionError', () => {
  it('start: the server\'s 403 sentence, or a fallback', () => {
    expect(chatActionError('start', 403, 'You can message friends, bots and people you share a room with.'))
      .toBe('You can message friends, bots and people you share a room with.')
    expect(chatActionError('start', 403)).toMatch(/friends, bots/)
    expect(chatActionError('start', 400, 'user_id must be another existing user.')).toBe('user_id must be another existing user.')
  })
  it('react / send / generic statuses', () => {
    expect(chatActionError('react', 400)).toMatch(/single emoji/)
    expect(chatActionError('react', 404)).toMatch(/no longer in this conversation/)
    expect(chatActionError('react', 503)).toBe('Reaction not saved: the chat server failed (HTTP 503).')
    expect(chatActionError('send', 0)).toBe('Not sent: could not reach the chat server.')
    expect(chatActionError('start', 401)).toMatch(/session expired/)
  })
})

describe('directCandidates', () => {
  const convs = [mapServerConversation(room, ME), mapServerConversation(dm, ME)]
  const profiles = [
    { user_id: BOB, username: 'bob', full_name: 'Bob B' },
    { user_id: ME, username: 'me' },
    { user_id: DAVE, username: 'dave', first_name: 'Dave', last_name: 'D', full_name: '' },
  ]
  it('people from my conversations first (linked, room wins over chat), then the directory; never me', () => {
    const c = directCandidates(convs, profiles, ME)
    expect(c.map(x => [x.username, x.linked, x.note])).toEqual([
      ['bob', true, 'In a room with you'],
      ['carol', true, 'In a room with you'],
      ['dave', false, ''],
    ])
    expect(c[2].full_name).toBe('Dave D')
  })
  it('search by username or name; limit; sample rows ignored', () => {
    expect(directCandidates(convs, profiles, ME, 'DAVE').map(x => x.user_id)).toEqual([DAVE])
    expect(directCandidates(convs, profiles, ME, 'bob b').map(x => x.user_id)).toEqual([BOB])
    expect(directCandidates(convs, profiles, ME, '', 1)).toHaveLength(1)
    const sample = { ...convs[1], source: 'sample' as const }
    expect(directCandidates([sample], [], ME)).toEqual([])
  })
})

describe('conversationDisplay', () => {
  it('a room shows its name, size and topic; no single profile link', () => {
    const d = conversationDisplay(mapServerConversation(room, ME), ME)
    expect(d).toMatchObject({ name: 'Macro desk', kind: 'Room · 3 people', subtitle: 'Rates and FX', isGroup: true, profileId: null })
  })
  it('an unnamed room is named after the others', () => {
    const d = conversationDisplay(mapServerConversation({ ...room, name: '', topic: '' }, ME), ME)
    expect(d.name).toBe('Bob B, carol')
    expect(d.subtitle).toBe('See you at the open')
  })
  it('a direct chat shows the other person (server details) and links their profile', () => {
    const d = conversationDisplay(mapServerConversation(dm, ME), ME)
    expect(d).toMatchObject({ name: 'Bob B', avatar: '/a/bob.png', profileId: BOB, isGroup: false, kind: '', subtitle: 'No messages yet' })
  })
  it('a sample row resolves people through the lookup and un-slugs the topic', () => {
    const sample = {
      id: 'conv_001', participants: ['user_001', 'user_002'], participantDetails: undefined, type: 'direct', title: null,
      description: 'Direct conversation', created_by: 'user_001', created_at: '', last_message_at: '', is_active: true,
      message_count: 45, unread_count: 0, metadata: { topic: 'trading_strategies' },
    } as unknown as Conversation
    const d = conversationDisplay(sample, 'user_001', id => (id === 'user_002' ? { username: 'sarah', avatar_url: '/s.png' } : null))
    expect(d).toMatchObject({ name: 'sarah', avatar: '/s.png', profileId: 'user_002', subtitle: 'trading strategies' })
  })
})
