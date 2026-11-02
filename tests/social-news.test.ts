import { describe, it, expect } from 'vitest'
import {
  alignCacheWithServer,
  baseCounters,
  commentAuthorName,
  ownContribution,
  serverBaseItem,
  type NewsCacheState,
  type ServerNewsRow,
} from '../utils/socialNews'
import type { NewsCounters, NewsItem } from '../types/news'

const empty = (): NewsCacheState => ({ bookmarks: [], readItems: [], reactions: {}, comments: [], shares: [] })
const counters = (o: Partial<NewsCounters> = {}): NewsCounters => ({ likes: 0, dislikes: 0, comments: 0, shares: 0, bookmarks: 0, judgments: 0, ...o })

// Same arithmetic as stores/news.ts mergePersistedItem (base + my cached contribution).
const reAdd = (base: NewsCounters, own: NewsCounters): NewsCounters => ({
  likes: base.likes + own.likes, dislikes: base.dislikes + own.dislikes, comments: base.comments + own.comments,
  shares: base.shares + own.shares, bookmarks: base.bookmarks + own.bookmarks, judgments: base.judgments + own.judgments,
})

const row: ServerNewsRow = {
  id: 'post_006',
  title: 'Brent +2.4%',
  savedByUser: true,
  readByUser: true,
  userReaction: { liked: true, disliked: false, politicalJudgment: null },
  comments: [
    { id: 'seed_c_011', itemId: 'post_006', userId: '', authorName: 'Bob Chen', content: 'x', createdAt: '2026-03-24T07:04:00Z' },
    { id: 'srv-1', itemId: 'post_006', userId: 'me-uuid', authorName: 'demo', content: 'mine', createdAt: '2026-11-02T10:00:00Z' },
  ],
  shares: [],
  counters: counters({ likes: 10, comments: 46, bookmarks: 3 }),
}

describe('news cache mirrors the server', () => {
  it('aligns bookmark / read / reaction / my comments, keeps pending local rows and unknown items', () => {
    const state: NewsCacheState = {
      ...empty(),
      bookmarks: ['other_item'],
      comments: [
        { id: 'comment_123_ab', itemId: 'post_006', userId: 'me-uuid', authorName: 'demo', content: 'pending', createdAt: '' },
        { id: 'stale-old-id', itemId: 'post_006', userId: 'me-uuid', authorName: 'demo', content: 'gone', createdAt: '' },
      ],
    }
    const out = alignCacheWithServer(state, [row], 'me-uuid')
    expect(out.bookmarks.sort()).toEqual(['other_item', 'post_006'])
    expect(out.readItems).toEqual(['post_006'])
    expect(out.reactions.post_006).toEqual({ liked: true, disliked: false, politicalJudgment: null })
    expect(out.comments.map(c => c.id).sort()).toEqual(['comment_123_ab', 'srv-1'])
  })

  it('base item + my contribution lands exactly on the server counters (plus pending local rows)', () => {
    const cache = alignCacheWithServer(empty(), [row], 'me-uuid')
    const base = serverBaseItem(undefined, row, cache)
    expect(base.comments.map(c => c.id)).toEqual(['seed_c_011'])
    expect(reAdd(base.counters, ownContribution(cache, row.id))).toEqual(row.counters)
  })

  it('a pending local comment (never sent) adds one on top of the server count', () => {
    const pending = { id: 'comment_1_x', itemId: 'post_006', userId: 'me-uuid', authorName: 'demo', content: 'p', createdAt: '' }
    const cache = alignCacheWithServer({ ...empty(), comments: [pending] }, [row], 'me-uuid')
    const base = serverBaseItem(undefined, row, cache)
    expect(reAdd(base.counters, ownContribution(cache, row.id)).comments).toBe(47)
  })

  it('keeps seed fields the server row lacks', () => {
    const local = { id: 'post_006', predictionSummary: [{ asset: 'BRN' }], assets: ['BRN'] } as unknown as NewsItem
    const base = serverBaseItem(local, { id: 'post_006', counters: counters() }, empty())
    expect(base.assets).toEqual(['BRN'])
    expect(base.predictionSummary).toHaveLength(1)
  })

  it('never goes below zero', () => {
    expect(baseCounters({ likes: 0 }, counters({ likes: 1 })).likes).toBe(0)
    expect(baseCounters(undefined, counters()).comments).toBe(0)
  })
})

describe('comment author precedence (SOCIAL-9)', () => {
  it("prefers the comment's own author over an id-index name", () => {
    expect(commentAuthorName({ authorName: 'Noah Williams' }, 'Arthuro Benali')).toBe('Noah Williams')
    expect(commentAuthorName({ authorName: ' ' }, 'Arthuro Benali')).toBe('Arthuro Benali')
    expect(commentAuthorName(null, null, 'user_9')).toBe('user_9')
  })
})
