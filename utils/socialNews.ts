/**
 * News on the server (lane `social`): pure helpers that keep the store's per-user localStorage cache
 * (`PersistedNewsState`) and the server's truth in step. Rule: when signed in, the cache MIRRORS the server for the
 * items the server knows, so the store's existing "base counters + my own contribution" arithmetic
 * (`mergePersistedItem`) lands exactly on the server counters.
 */
import type { NewsComment, NewsCounters, NewsItem, NewsReactionState, NewsShare } from '~/types/news'

export interface NewsCacheState {
  bookmarks: string[]
  readItems: string[]
  reactions: Record<string, NewsReactionState>
  comments: NewsComment[]
  shares: NewsShare[]
}

/** Server row (GET /api/v1/news/): the NewsItem shape, possibly with fields missing. */
export type ServerNewsRow = Partial<NewsItem> & { id: string }

/** Optimistic local rows (not yet on the server) carry these id prefixes. */
export const isLocalNewsId = (id: string) => id.startsWith('comment_') || id.startsWith('share_')

/** What the cache adds on top of an item's base counters (mirrors `mergePersistedItem`). */
export function ownContribution(state: NewsCacheState, itemId: string): NewsCounters {
  const r = state.reactions[itemId]
  return {
    comments: state.comments.filter(c => c.itemId === itemId).length,
    shares: state.shares.filter(s => s.itemId === itemId).length,
    bookmarks: state.bookmarks.includes(itemId) ? 1 : 0,
    likes: r?.liked ? 1 : 0,
    dislikes: r?.disliked ? 1 : 0,
    judgments: r?.politicalJudgment ? 1 : 0,
  }
}

/** Server counters minus my own contribution (never below 0). */
export function baseCounters(server: Partial<NewsCounters> | undefined, own: NewsCounters): NewsCounters {
  const k = (key: keyof NewsCounters) => Math.max(0, Number(server?.[key] ?? 0) - own[key])
  return {
    likes: k('likes'), dislikes: k('dislikes'), comments: k('comments'),
    shares: k('shares'), bookmarks: k('bookmarks'), judgments: k('judgments'),
  }
}

/**
 * Make the cache mirror the server for `rows` (my bookmark / read / reaction, my comments and shares), keeping only
 * the optimistic local rows that never reached the server. Items the server does not know are left untouched.
 */
export function alignCacheWithServer<T extends NewsCacheState>(state: T, rows: readonly ServerNewsRow[], meId: string): T {
  const ids = new Set(rows.map(r => r.id))
  const next: T = {
    ...state,
    bookmarks: state.bookmarks.filter(id => !ids.has(id)),
    readItems: state.readItems.filter(id => !ids.has(id)),
    reactions: { ...state.reactions },
    comments: state.comments.filter(c => !ids.has(c.itemId) || isLocalNewsId(c.id)),
    shares: state.shares.filter(s => !ids.has(s.itemId) || isLocalNewsId(s.id)),
  }
  for (const row of rows) {
    if (row.savedByUser) next.bookmarks.push(row.id)
    if (row.readByUser) next.readItems.push(row.id)
    const ur = row.userReaction
    next.reactions[row.id] = {
      liked: !!ur?.liked, disliked: !!ur?.disliked, politicalJudgment: ur?.politicalJudgment ?? null,
    }
    for (const c of row.comments ?? []) if (meId && c.userId === meId) next.comments.push(c)
    for (const s of row.shares ?? []) if (meId && s.userId === meId) next.shares.push(s)
  }
  return next
}

/**
 * One server row → the item the store keeps BEFORE `mergePersistedItem` re-adds my cached contribution:
 * counters = server − mine, comments/shares = the server's minus mine (re-added from the cache).
 * `local` (the seed item with the same id) supplies fields the server row lacks.
 */
export function serverBaseItem(local: NewsItem | undefined, row: ServerNewsRow, cache: NewsCacheState): NewsItem {
  const mineC = new Set(cache.comments.filter(c => c.itemId === row.id).map(c => c.id))
  const mineS = new Set(cache.shares.filter(s => s.itemId === row.id).map(s => s.id))
  const merged = { ...(local ?? {}), ...row } as NewsItem
  return {
    ...merged,
    comments: (row.comments ?? local?.comments ?? []).filter(c => !mineC.has(c.id)),
    shares: (row.shares ?? local?.shares ?? []).filter(s => !mineS.has(s.id)),
    predictionSummary: merged.predictionSummary ?? [],
    assets: merged.assets ?? [],
    currencies: merged.currencies ?? [],
    commodities: merged.commodities ?? [],
    tags: merged.tags ?? [],
    // Pending local rows (never reached the server) are not in the server counters: subtract only confirmed ones.
    counters: baseCounters(row.counters, ownContribution({
      ...cache,
      comments: cache.comments.filter(c => !isLocalNewsId(c.id)),
      shares: cache.shares.filter(s => !isLocalNewsId(s.id)),
    }, row.id)),
  }
}

/** Name to show for a comment: the comment's own author first (ids collide between the seed directories). */
export function commentAuthorName(comment: Pick<NewsComment, 'authorName'> | null | undefined, indexName?: string | null, fallback = 'Someone'): string {
  return (comment?.authorName && comment.authorName.trim()) || (indexName && indexName.trim()) || fallback
}
