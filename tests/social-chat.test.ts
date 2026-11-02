import { describe, it, expect } from 'vitest'
import {
  directCandidates,
  mapServerMessage,
  replyOf,
  shareCardOf,
  shareMessageBody,
  shareUrl,
  quoteOf,
  type Conversation,
  type ServerProfile,
} from '../utils/chatMap'

const conv = (over: Partial<Conversation>): Conversation => ({
  id: 'c1', participants: [], participantDetails: [], type: 'direct', title: null, description: '', created_by: '',
  created_at: '2026-11-01T00:00:00Z', last_message_at: '2026-11-01T00:00:00Z', is_active: true, message_count: 0,
  unread_count: 0, source: 'server', metadata: {},
  ...over,
} as Conversation)

describe('directCandidates (C2 can_message)', () => {
  const profiles: ServerProfile[] = [
    { user_id: 'u-stranger', username: 'stranger', can_message: false },
    { user_id: 'u-old', username: 'old_server' },
    { user_id: 'u-bot', username: 'bot_ada', is_bot: true, can_message: true },
    { user_id: 'u-room', username: 'roommate', can_message: true },
  ]
  const rooms = [conv({ id: 'r1', type: 'group', participantDetails: [
    { user_id: 'me', username: 'me', full_name: '', avatar_url: '', is_online: false, unread_count: 0 },
    { user_id: 'u-room', username: 'roommate', full_name: 'Room Mate', avatar_url: '', is_online: true, unread_count: 0 },
  ] })]

  it('orders bots → room-mates → unknown → refused, and labels the refused ones', () => {
    const out = directCandidates(rooms, profiles, 'me')
    expect(out.map(c => c.user_id)).toEqual(['u-bot', 'u-room', 'u-old', 'u-stranger'])
    expect(out[1]!.note).toBe('In a room with you')
    expect(out[0]!.note).toBe('Bot')
    expect(out[0]!.is_bot).toBe(true)
    expect(out[2]!.canMessage).toBeNull()
    expect(out[3]!.canMessage).toBe(false)
    expect(out[3]!.note).toBe('Add as friend first')
  })

  it('puts direct chats, then bots, before nameless room-mates (other demo accounts)', () => {
    const p = (id: string, username: string) => ({ user_id: id, username, full_name: '', avatar_url: '', is_online: false, unread_count: 0 })
    const convs = [
      conv({ id: 'room', type: 'group', participantDetails: [p('me', 'me'), p('anon', ''), p('bot1', 'bot_kenji'), p('mate', 'mate')] }),
      conv({ id: 'dm', type: 'direct', participantDetails: [p('me', 'me'), p('pal', 'pal')] }),
    ]
    const out = directCandidates(convs, [{ user_id: 'bot1', username: 'bot_kenji', is_bot: true, can_message: true }], 'me')
    expect(out.map(c => c.user_id)).toEqual(['pal', 'bot1', 'mate', 'anon'])
    expect(out[1]!.note).toBe('Bot · in a room with you')
  })

  it('works without the new fields (older server): everyone unknown, server order kept', () => {
    const out = directCandidates([], [{ user_id: 'a', username: 'a' }, { user_id: 'b', username: 'b' }], 'me')
    expect(out.map(c => [c.user_id, c.canMessage])).toEqual([['a', null], ['b', null]])
  })
})

describe('reply_to (C4)', () => {
  it('reads the C4 object, the older id+preview pair, and nothing', () => {
    expect(replyOf({ reply_to: { id: 'm1', preview: 'hello', author: 'ada' } })).toEqual({ id: 'm1', content: 'hello', author: 'ada' })
    expect(replyOf({ reply_to_id: 'm2', reply_to_preview: { id: 'm2', content: 'hi' } })).toEqual({ id: 'm2', content: 'hi' })
    expect(replyOf({ reply_to: null })).toBeNull()
  })
  it('mapServerMessage carries the quote', () => {
    const m = mapServerMessage({
      id: 'm3', conversation_id: 'c', sender_id: 's', sender_username: 's', content: 'yes', created_at: '2026-11-02T10:00:00Z',
      reply_to: { id: 'm1', preview: 'Buy?', author: 'bob' },
    })
    expect(m.reply_to_id).toBe('m1')
    expect(m.reply_to_preview).toEqual({ id: 'm1', content: 'Buy?', author: 'bob' })
  })
})

describe('share into chat (C4 share, C9)', () => {
  it('builds the in-app url and a fallback text line', () => {
    expect(shareUrl({ kind: 'article', id: 'post_006', title: 't' })).toBe('/articles/post_006')
    expect(shareUrl({ kind: 'strategy', id: 's 1', title: 't' })).toBe('/strategy/s%201')
    expect(shareUrl({ kind: 'call', id: 'p1', title: 't', url: '/assets/btc' })).toBe('/assets/btc')
    const body = shareMessageBody({ kind: 'article', id: 'post_006', title: 'Brent +2.4%' }, 'look')
    expect(body).toEqual({ content: 'look — 📎 Brent +2.4% /articles/post_006', share: { kind: 'article', id: 'post_006' } })
  })

  it('renders a C4 attachment message as a card', () => {
    const card = shareCardOf({ content: 'Brent +2.4%', content_type: 'attachment', attachment_url: '/articles/post_006', attachment_name: 'Brent +2.4%' })
    expect(card).toEqual({ kind: 'article', title: 'Brent +2.4%', url: '/articles/post_006', note: '' })
  })

  it('takes the title from the text line or the server line, never from a kind:id attachment_name', () => {
    const live = shareCardOf({ content: '📎 Brent +2.4% /articles/post_006', content_type: 'attachment', attachment_url: '/articles/post_006', attachment_name: 'article:post_006' })
    expect(live).toEqual({ kind: 'article', title: 'Brent +2.4%', url: '/articles/post_006', note: '' })
    const bare = shareCardOf({ content: 'Shared strategy: Momentum', content_type: 'attachment', attachment_url: '/strategy/9', attachment_name: 'strategy:9' })
    expect(bare).toEqual({ kind: 'strategy', title: 'Momentum', url: '/strategy/9', note: '' })
  })

  it('renders the fallback text line (older server) as a card, keeping the note', () => {
    const card = shareCardOf({ content: 'look — 📎 Brent +2.4% /articles/post_006', content_type: 'text', attachment_url: '', attachment_name: '' })
    expect(card).toEqual({ kind: 'article', title: 'Brent +2.4%', url: '/articles/post_006', note: 'look' })
    expect(shareCardOf({ content: '📎 Momentum /strategy/42', content_type: 'text', attachment_url: '', attachment_name: '' })?.kind).toBe('strategy')
  })

  it('ignores plain messages and external links', () => {
    expect(shareCardOf({ content: 'hello there', content_type: 'text', attachment_url: '', attachment_name: '' })).toBeNull()
    expect(shareCardOf({ content: 'file', content_type: 'attachment', attachment_url: 'https://x.y/file.pdf', attachment_name: 'f' })).toBeNull()
  })

  it('quotes a message on one short line', () => {
    expect(quoteOf('a\n b   c')).toBe('a b c')
    expect(quoteOf('x'.repeat(100), 10)).toBe(`${'x'.repeat(9)}…`)
  })
})
