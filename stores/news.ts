import { defineStore } from 'pinia'
// Stores are not auto-imported in this project (see nuxt.config pinia note).
import { useOpinionProfileStore } from '~/stores/opinionProfile'
import { userGet, userSet } from '~/utils/userStorage'
import { publicAssetUrl } from '~/composables/useLocalJson'
import { normalizeAllocationPie, type AllocationPie } from '~/types/allocation'
import type { Prediction } from '~/stores/predictions'
import type { UserProfile } from '~/types/user'
import type { Influencer } from '~/stores/influencers'
import type { CommunityUser } from '~/stores/community'
import {
  type NewsApiContract,
  type NewsAuthor,
  type NewsComment,
  type NewsCounters,
  type NewsFacetSummary,
  type NewsFilterOption,
  EMPTY_NEWS_EXCLUDES,
  type NewsFacetExcludes,
  type NewsFilters,
  type NewsHistoryEvent,
  type NewsItem,
  type NewsPoliticalScale,
  type NewsReactionState,
  type NewsPoll,
  type NewsShare,
  type NewsSource,
  type NewsSortMode,
  type NewsViewMode,
} from '~/types/news'
import {
  alignCacheWithServer,
  isLocalNewsId,
  serverBaseItem,
  type ServerNewsRow,
} from '~/utils/socialNews'
import {
  cloneNewsFilters,
  filterNewsItems,
  parseNewsQuery,
  serializeNewsQuery,
  sortNewsItems,
} from '~/utils/newsWorkspace'
import { castPollVote } from '~/utils/newsPoll'

interface SocialPostSeed {
  id: string
  author_id: string
  title?: string
  content: string
  type?: string
  category?: string
  assets?: string[]
  geographic_origin?: { lat: number; lng: number; name?: string }
  political_leaning: number
  economic_leaning?: number
  sentiment?: number
  controversy_index: number
  weight?: number
  embedded_allocation?: AllocationPie
  published_at: string
  interactions: { likes: number; dislikes?: number; comments: number; shares: number; bookmarks?: number }
  tags?: string[]
  is_pinned?: boolean
}

interface EditorialArticleSeed {
  id: string
  title: string
  content: string
  source?: string
  imageUrl?: string
  author?: string
  publishing_date?: string
  category: string
  data_affiliated?: string
  tags?: string[]
  sentiment?: string
  impact_score?: number
  financial_impact?: {
    asset?: string
    price_change_percent?: number
    volume_spike?: boolean
  }
  event_details?: {
    event_type?: string
    next_meeting?: string
    expected_outcome?: string
    probability?: number
  }
}

interface EditorialFeedSeed {
  name: string
  categories: Array<{ name: string; articles: EditorialArticleSeed[] }>
}

interface PersistedNewsState {
  bookmarks: string[]
  readItems: string[]
  reactions: Record<string, NewsReactionState>
  comments: NewsComment[]
  shares: NewsShare[]
  history: NewsHistoryEvent[]
  importedItems: NewsItem[]
  publishedItems: NewsItem[]
  followedAuthors: string[]
}

interface NewsStoreState {
  items: NewsItem[]
  hydrated: boolean
  loading: boolean
  error: string | null
  sortMode: NewsSortMode
  view: NewsViewMode
  filters: NewsFilters
  apiContract: NewsApiContract
  persistedByUser: Record<string, PersistedNewsState>
  friendIds: string[]
  /** Signed in: ids the server knows (GET /api/v1/news/); their comments/reactions/bookmarks/reads go to the server. */
  serverIds: string[]
  /** One sentence when a server write failed (the change is kept in this browser). */
  syncNote: string | null
  /** Whose server sync is applied (user id), null = none. */
  serverFor: string | null
}

let serverSyncInflight: string | null = null

/** The API client + whether the session is signed in, resolved synchronously (before any await). */
function newsApi(): { call: typeof $fetch; signedIn: boolean } | null {
  if (!import.meta.client) return null
  try {
    const { $api } = useNuxtApp()
    return { call: $api as typeof $fetch, signedIn: useAuth().isAuthenticated.value }
  } catch {
    return null
  }
}

const STORAGE_KEY = 'strades_news_workspace_v2'
const NEWS_API_CONTRACT: NewsApiContract = {
  load: { path: '/api/news/', response: 'NewsItem[]' },
  mutate: {
    bookmark: '/api/news/:id/bookmark/',
    reaction: '/api/news/:id/reaction/',
    comment: '/api/news/:id/comments/',
    share: '/api/news/:id/share/',
    import: '/api/news/import/',
    publish: '/api/news/publish/',
  },
}

const emptyPersistedState = (): PersistedNewsState => ({
  bookmarks: [],
  readItems: [],
  reactions: {},
  comments: [],
  shares: [],
  history: [],
  importedItems: [],
  publishedItems: [],
  followedAuthors: [],
})

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const toIso = (value?: string) => {
  if (!value) return new Date().toISOString()
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString()
}

const slug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const displaySentimentToValue = (value?: string) => {
  if (!value) return 0
  if (value === 'positive') return 0.7
  if (value === 'negative') return -0.7
  return 0
}

const deriveCommodityTickers = (assets: string[]) =>
  assets.filter(asset => ['XAU', 'XAG', 'HG', 'BRN', 'WTI', 'CL', 'NG'].some(token => asset.includes(token)))

const deriveCurrencies = (assets: string[]) =>
  assets.filter(asset =>
    ['USD', 'EUR', 'JPY', 'GBP', 'CHF', 'CAD', 'AUD', 'NZD'].some(code => asset.includes(code))
  )

const deriveExcerpt = (content: string) => {
  const trimmed = content.trim()
  if (trimmed.length <= 180) return trimmed
  return `${trimmed.slice(0, 177).trimEnd()}...`
}

const bumpCounters = (base: NewsCounters, updates: Partial<NewsCounters>): NewsCounters => ({
  likes: Math.max(0, base.likes + (updates.likes ?? 0)),
  dislikes: Math.max(0, base.dislikes + (updates.dislikes ?? 0)),
  comments: Math.max(0, base.comments + (updates.comments ?? 0)),
  shares: Math.max(0, base.shares + (updates.shares ?? 0)),
  bookmarks: Math.max(0, base.bookmarks + (updates.bookmarks ?? 0)),
  judgments: Math.max(0, base.judgments + (updates.judgments ?? 0)),
})

function normalizeAuthor(author: Partial<NewsAuthor>, fallbackId: string, fallbackName: string): NewsAuthor {
  return {
    id: author.id ?? fallbackId,
    handle: author.handle ?? fallbackName,
    displayName: author.displayName ?? fallbackName,
    avatarUrl: author.avatarUrl,
    kind: author.kind ?? 'user',
    role: author.role,
    isVerified: author.isVerified ?? false,
    isOwner: author.isOwner ?? false,
    country: author.country,
    city: author.city,
  }
}

function buildUserAuthorIndex(users: UserProfile[]) {
  return new Map(users.map(user => [user.id, normalizeAuthor({
    id: user.id,
    handle: `@${user.username}`,
    displayName: `${user.first_name} ${user.last_name}`.trim() || user.username,
    avatarUrl: user.avatar_url,
    kind: 'user',
    role: user.role,
    isVerified: user.is_verified,
    isOwner: user.is_owner,
    country: user.country,
    city: user.city,
  }, user.id, user.username)]))
}

function buildInfluencerAuthorIndex(influencers: Influencer[]) {
  return new Map(influencers.map(inf => [inf.id, normalizeAuthor({
    id: inf.id,
    handle: inf.handle,
    displayName: inf.name,
    avatarUrl: inf.avatar_url,
    kind: 'influencer',
    isVerified: true,
  }, inf.id, inf.name)]))
}

function buildPredictionSummary(assetIds: string[], predictions: Prediction[]) {
  return assetIds.flatMap(assetId => {
    const matching = predictions.filter(pred => pred.assetId.toUpperCase() === assetId.toUpperCase() && pred.status === 'pending')
    if (!matching.length) return []
    const bullishCount = matching.filter(pred => pred.direction === 'bullish').length
    const avgChange = matching.reduce((sum, pred) => sum + pred.predictedChangePct, 0) / matching.length
    return [{
      assetId,
      count: matching.length,
      bullishPercent: Math.round((bullishCount / matching.length) * 100),
      averageChangePercent: Number(avgChange.toFixed(2)),
    }]
  })
}

function socialSource(post: SocialPostSeed): NewsSource {
  return {
    id: `social:${post.author_id}`,
    label: 'Community feed',
    type: 'social',
    provenance: 'seeded',
  }
}

function editorialSource(article: EditorialArticleSeed): NewsSource {
  const domain = article.source ? slug(article.source) : 'editorial'
  return {
    id: `editorial:${domain}`,
    label: article.source ?? 'Editorial',
    type: 'editorial',
    provenance: 'seeded',
  }
}

function normalizeSocialPost(
  post: SocialPostSeed,
  userAuthors: Map<string, NewsAuthor>,
  predictions: Prediction[],
): NewsItem {
  const assets = (post.assets ?? []).map(asset => asset.toUpperCase())
  return {
    id: post.id,
    kind: 'social',
    title: post.title ?? post.content.split('.').shift()?.trim() ?? 'Untitled signal',
    content: post.content,
    excerpt: deriveExcerpt(post.content),
    category: post.category ?? 'macro',
    type: post.type ?? 'analysis',
    assets,
    currencies: deriveCurrencies(assets),
    commodities: deriveCommodityTickers(assets),
    tags: post.tags ?? [],
    source: socialSource(post),
    author: userAuthors.get(post.author_id) ?? normalizeAuthor({}, post.author_id, post.author_id),
    geographicOrigin: post.geographic_origin ? {
      lat: post.geographic_origin.lat,
      lng: post.geographic_origin.lng,
      name: post.geographic_origin.name,
      area: post.geographic_origin.name,
    } : undefined,
    politicalLeaning: clamp(post.political_leaning, -1, 1),
    economicLeaning: post.economic_leaning ?? null,
    sentiment: post.sentiment ?? null,
    controversyIndex: clamp(post.controversy_index, 0, 1),
    weight: clamp(post.weight ?? 0.5, 0, 1),
    publishedAt: toIso(post.published_at),
    allocation: post.embedded_allocation ? normalizeAllocationPie(post.embedded_allocation) : undefined,
    isPinned: Boolean(post.is_pinned),
    savedByUser: false,
    readByUser: false,
    userReaction: { liked: false, disliked: false, politicalJudgment: null },
    comments: [],
    shares: [],
    counters: {
      likes: post.interactions.likes ?? 0,
      dislikes: post.interactions.dislikes ?? Math.max(1, Math.round((post.interactions.likes ?? 0) * post.controversy_index * 0.08)),
      comments: post.interactions.comments ?? 0,
      shares: post.interactions.shares ?? 0,
      bookmarks: post.interactions.bookmarks ?? 0,
      judgments: 0,
    },
    predictionSummary: buildPredictionSummary(assets, predictions),
  }
}

function normalizeEditorialArticle(
  article: EditorialArticleSeed,
  categoryName: string,
  predictions: Prediction[],
): NewsItem {
  const affiliated = article.data_affiliated ? [article.data_affiliated.toUpperCase()] : []
  const sentimentValue = displaySentimentToValue(article.sentiment)
  return {
    id: article.id,
    kind: 'editorial',
    title: article.title,
    content: article.content,
    excerpt: deriveExcerpt(article.content),
    category: categoryName,
    type: article.event_details?.event_type ?? 'editorial',
    assets: affiliated,
    currencies: deriveCurrencies(affiliated),
    commodities: deriveCommodityTickers(affiliated),
    tags: article.tags ?? [],
    source: editorialSource(article),
    author: normalizeAuthor({
      id: `editor:${slug(article.author ?? 'editorial')}`,
      handle: article.author ? `@${slug(article.author)}` : '@editorial',
      displayName: article.author ?? 'Editorial desk',
      kind: 'editor',
      isVerified: true,
    }, `editor:${article.id}`, article.author ?? 'Editorial desk'),
    politicalLeaning: clamp((article.impact_score ?? 0) / 10, -1, 1),
    economicLeaning: article.financial_impact?.price_change_percent
      ? clamp(article.financial_impact.price_change_percent / 10, -1, 1)
      : null,
    sentiment: sentimentValue,
    controversyIndex: clamp(Math.abs(article.impact_score ?? 4) / 10, 0.05, 0.95),
    weight: clamp(Math.abs(article.impact_score ?? 5) / 10, 0.4, 0.98),
    publishedAt: toIso(article.publishing_date),
    imageUrl: article.imageUrl,
    isPinned: Boolean(article.event_details),
    dataAffiliated: article.data_affiliated,
    eventType: article.event_details?.event_type,
    eventProbability: article.event_details?.probability,
    savedByUser: false,
    readByUser: false,
    userReaction: { liked: false, disliked: false, politicalJudgment: null },
    comments: [],
    shares: [],
    counters: {
      likes: Math.max(0, Math.round(Math.abs(article.impact_score ?? 4) * 18)),
      dislikes: 0,
      comments: Math.max(0, Math.round(Math.abs(article.impact_score ?? 4) * 6)),
      shares: Math.max(0, Math.round(Math.abs(article.impact_score ?? 4) * 8)),
      bookmarks: Math.max(0, Math.round(Math.abs(article.impact_score ?? 4) * 4)),
      judgments: 0,
    },
    predictionSummary: buildPredictionSummary(affiliated, predictions),
  }
}

function mergePersistedItem(item: NewsItem, persisted: PersistedNewsState): NewsItem {
  const persistedComments = persisted.comments.filter(comment => comment.itemId === item.id)
  const persistedShares = persisted.shares.filter(share => share.itemId === item.id)
  const comments = [...item.comments, ...persistedComments]
    .filter((comment, index, all) => all.findIndex(candidate => candidate.id === comment.id) === index)
  const shares = [...item.shares, ...persistedShares]
    .filter((share, index, all) => all.findIndex(candidate => candidate.id === share.id) === index)
  const reaction = persisted.reactions[item.id] ?? { liked: false, disliked: false, politicalJudgment: null }
  const savedByUser = persisted.bookmarks.includes(item.id)
  const readByUser = persisted.readItems.includes(item.id)
  const judgments = Object.values(persisted.reactions).filter(value => value.politicalJudgment && value === persisted.reactions[item.id]).length
  return {
    ...item,
    savedByUser,
    readByUser,
    userReaction: reaction,
    comments,
    shares,
    counters: bumpCounters(item.counters, {
      comments: persistedComments.length,
      shares: persistedShares.length,
      bookmarks: savedByUser ? 1 : 0,
      likes: reaction.liked ? 1 : 0,
      dislikes: reaction.disliked ? 1 : 0,
      judgments: reaction.politicalJudgment ? 1 : 0,
    }),
  }
}

function facetOptions(values: string[]): NewsFilterOption[] {
  const counts = new Map<string, number>()
  for (const value of values.filter(Boolean)) {
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, label: value, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
}

export const useNewsStore = defineStore('newsStore', {
  state: (): NewsStoreState => ({
    items: [],
    hydrated: false,
    loading: false,
    error: null,
    sortMode: 'top',
    view: 'feed',
    filters: cloneNewsFilters(),
    apiContract: NEWS_API_CONTRACT,
    persistedByUser: {},
    friendIds: [],
    serverIds: [],
    syncNote: null,
    serverFor: null,
  }),

  getters: {
    currentUserId: () => {
      const { getUserId } = useCurrentUser()
      return getUserId()
    },

    currentUserState(state): PersistedNewsState {
      return state.persistedByUser[this.currentUserId] ?? emptyPersistedState()
    },

    allItems: (state): NewsItem[] => state.items,

    getById: (state) => (id: string) => state.items.find(item => item.id === id) ?? null,

    viewItems(): NewsItem[] {
      if (this.view === 'saved') return this.items.filter(item => item.savedByUser)
      if (this.view === 'history') return this.items.filter(item => item.readByUser)
      if (this.view === 'editorial') return this.items.filter(item => item.kind === 'editorial')
      if (this.view === 'signals') return this.items.filter(item => item.author.kind === 'influencer')
      return this.items.filter(item => item.kind !== 'editorial' || this.view === 'feed')
    },

    filteredItems(): NewsItem[] {
      return sortNewsItems(filterNewsItems(this.items, this.filters, this.view), this.sortMode)
    },

    facetSummary(): NewsFacetSummary {
      return {
        companies: facetOptions(this.items.flatMap(item => item.assets)),
        currencies: facetOptions(this.items.flatMap(item => item.currencies)),
        commodities: facetOptions(this.items.flatMap(item => item.commodities)),
        owners: facetOptions(this.items.map(item => item.author.displayName)),
        users: facetOptions(this.items.map(item => item.author.id)),
        friends: facetOptions(
          this.items
            .filter(item => this.friendIds.includes(item.author.id))
            .map(item => item.author.id)
        ).map(option => ({
          ...option,
          label: this.items.find(item => item.author.id === option.value)?.author.displayName ?? option.value,
        })),
        sources: facetOptions(this.items.map(item => item.source.label)),
        kinds: facetOptions(this.items.map(item => item.kind)),
        categories: facetOptions(this.items.map(item => item.category)),
        areas: facetOptions(this.items.map(item => item.geographicOrigin?.area ?? item.geographicOrigin?.name ?? '')),
      }
    },

    history(): NewsHistoryEvent[] {
      return [...this.currentUserState.history].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    },

    activeFilterCount(): number {
      const f = this.filters
      const x = f.excluded ?? EMPTY_NEWS_EXCLUDES()
      return [
        f.search ? 1 : 0,
        f.companies.length, x.companies.length,
        f.currencies.length, x.currencies.length,
        f.commodities.length, x.commodities.length,
        f.owners.length, x.owners.length,
        f.users.length, x.users.length,
        f.friends.length, x.friends.length,
        f.sources.length, x.sources.length,
        f.kinds.length, x.kinds.length,
        f.categories.length, x.categories.length,
        f.political.length, x.political.length,
        f.economic.length, x.economic.length,
        f.sentiment.length, x.sentiment.length,
        f.savedOnly ? 1 : 0,
        f.historyOnly ? 1 : 0,
        f.predictionOnly ? 1 : 0,
        f.dateFrom ? 1 : 0,
        f.dateTo ? 1 : 0,
        f.areas.length, x.areas.length,
      ].reduce((sum, value) => sum + value, 0)
    },
  },

  actions: {
    ensureUserState(userId = useCurrentUser().getUserId()) {
      if (!this.persistedByUser[userId]) {
        this.persistedByUser[userId] = emptyPersistedState()
      }
      return this.persistedByUser[userId]!
    },

    async initializeStore(force = false) {
      if (this.hydrated && !force) {
        // Hydrated during SSR (no session there): the server sync runs once in the browser.
        if (import.meta.client) void this.loadServer()
        return
      }
      this.loading = true
      this.error = null
      try {
        // Resolve the session before any await. After the fetch, this action
        // no longer has a Nuxt instance, and useCurrentUser() throws on the server.
        const currentUserId = useCurrentUser().getUserId()
        this.hydratePersisted()
        const postsUrl = publicAssetUrl('/data/social/posts.json')
        const editorialUrl = publicAssetUrl('/news.json')
        const usersUrl = publicAssetUrl('/data/user/users.json')
        const influencersUrl = publicAssetUrl('/data/core/influencers.json')
        const predictionsUrl = publicAssetUrl('/data/predictions.json')
        const bookmarksUrl = publicAssetUrl('/data/social/bookmarks.json')
        const commentsUrl = publicAssetUrl('/data/social/news_comments.json')
        const communityUrl = publicAssetUrl('/data/core/community.json')
        const [posts, editorial, users, influencers, predictions, bookmarkSeed, seededComments, community] = await Promise.all([
          $fetch<SocialPostSeed[]>(postsUrl),
          $fetch<EditorialFeedSeed>(editorialUrl),
          $fetch<UserProfile[]>(usersUrl).catch(() => []),
          $fetch<Influencer[]>(influencersUrl).catch(() => []),
          $fetch<Prediction[]>(predictionsUrl).catch(() => []),
          $fetch<string[]>(bookmarksUrl).catch(() => []),
          $fetch<NewsComment[]>(commentsUrl).catch(() => []),
          $fetch<CommunityUser[]>(communityUrl).catch(() => []),
        ])
        const currentUser = users.find(user => user.id === currentUserId)
        this.friendIds = currentUser?.friends ?? users.filter(user => user.id !== currentUserId).slice(0, 6).map(user => user.id)
        const currentState = this.ensureUserState(currentUserId)
        if (!currentState.bookmarks.length) {
          currentState.bookmarks = bookmarkSeed.filter(id => [...posts.map(post => post.id), ...editorial.categories.flatMap(cat => cat.articles.map(article => article.id))].includes(id))
          if (currentState.bookmarks.length === 0) currentState.bookmarks = ['post_003', 'news_event_001']
        }

        const userAuthors = buildUserAuthorIndex(users)
        // Some post authors (user_006, user_007) exist only in the community roster.
        for (const member of community) {
          if (userAuthors.has(member.id)) continue
          userAuthors.set(member.id, normalizeAuthor({
            id: member.id,
            handle: `@${member.username.toLowerCase()}`,
            displayName: member.username,
            avatarUrl: member.avatar_url,
            kind: 'user',
          }, member.id, member.username))
        }
        const influencerAuthors = buildInfluencerAuthorIndex(influencers)
        const normalizedSocial = posts.map(post => {
          const author = influencerAuthors.get(post.author_id) ?? userAuthors.get(post.author_id) ?? normalizeAuthor({}, post.author_id, post.author_id)
          return {
            ...normalizeSocialPost(post, userAuthors, predictions),
            author,
            comments: seededComments.filter(comment => comment.itemId === post.id),
          }
        })
        const normalizedEditorial = editorial.categories.flatMap(category =>
          category.articles.map(article => normalizeEditorialArticle(article, category.name, predictions))
        )

        const merged = [...normalizedSocial, ...normalizedEditorial, ...currentState.importedItems, ...currentState.publishedItems]
          .reduce<NewsItem[]>((acc, item) => {
            if (!acc.find(existing => existing.id === item.id)) acc.push(item)
            return acc
          }, [])

        this.items = merged
          .map(item => mergePersistedItem(item, currentState))
          .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
        this.persist()
        this.hydrated = true
        // Signed in: counters, comments and my reactions come from the server (seed stays the fallback).
        void this.loadServer()
      } catch (error) {
        this.error = (error as Error).message
        console.error('news.initializeStore', error)
      } finally {
        this.loading = false
      }
    },

    /**
     * Signed in: GET /api/v1/news/?limit=50 and lay the server truth over the seed items with the same id
     * (counters, comments, shares, my bookmark/read/reaction). The localStorage cache then mirrors the server,
     * so the optimistic local arithmetic lands on the server counters. Signed out or failing: nothing changes.
     */
    async loadServer(force = false) {
      const api = newsApi()
      if (!api?.signedIn) { this.serverIds = []; this.serverFor = null; return }
      const meId = useCurrentUser().getUserId()
      if (!force && (this.serverFor === meId || serverSyncInflight === meId)) return
      serverSyncInflight = meId
      try {
        const data = await api.call<ServerNewsRow[] | { results?: ServerNewsRow[] }>('/api/v1/news/', { query: { limit: 50 } })
        const rows = (Array.isArray(data) ? data : data?.results ?? []).filter(r => r && typeof r.id === 'string')
        if (!rows.length) return
        const cache = alignCacheWithServer(this.ensureUserState(meId), rows, meId)
        this.persistedByUser[meId] = cache
        const byId = new Map(rows.map(r => [r.id, r]))
        const known = new Set(this.items.map(i => i.id))
        const merged = this.items.map(item => {
          const row = byId.get(item.id)
          return row ? mergePersistedItem(serverBaseItem(item, row, cache), cache) : item
        })
        // Server-only items (e.g. published by another user) join the feed.
        for (const row of rows) {
          if (!known.has(row.id) && row.title && row.author && row.source) {
            merged.push(mergePersistedItem(serverBaseItem(undefined, row, cache), cache))
          }
        }
        this.items = merged.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
        this.serverIds = rows.map(r => r.id)
        this.serverFor = meId
        this.persist()
      } catch (e) {
        console.warn('news: GET /api/v1/news/ failed — seed feed kept', e)
      } finally {
        serverSyncInflight = null
      }
    },

    /** Signed in: GET the article's comments (public list) so another user's comment shows after a reload. */
    async refreshComments(itemId: string) {
      const api = newsApi()
      if (!api) return
      try {
        const rows = await api.call<NewsComment[]>(`/api/v1/news/${encodeURIComponent(itemId)}/comments/`)
        if (!Array.isArray(rows)) return
        const meId = useCurrentUser().getUserId()
        const state = this.ensureUserState(meId)
        const item = this.items.find(i => i.id === itemId)
        if (!item) return
        // Base = what is shown minus my cached contribution (re-added by mergePersistedItem below).
        const ownBefore = state.comments.filter(c => c.itemId === itemId).length
        if (api.signedIn) {
          // My server comments live in the cache (they count as my contribution).
          state.comments = [
            ...state.comments.filter(c => c.itemId !== itemId || isLocalNewsId(c.id)),
            ...rows.filter(c => c.userId === meId),
          ]
        }
        const mineIds = new Set(state.comments.filter(c => c.itemId === itemId).map(c => c.id))
        const others = rows.filter(c => !mineIds.has(c.id))
        const mine = state.comments.filter(c => c.itemId === itemId)
        // Only the comment list and its counter change here (other counters already carry my contribution).
        const next = {
          ...item,
          comments: [...others, ...mine],
          counters: { ...item.counters, comments: Math.max(0, item.counters.comments - ownBefore) + mine.length },
        }
        // The server counter can be higher than the list (seeded counts), never lower than what is listed.
        next.counters.comments = Math.max(next.counters.comments, next.comments.length)
        this.items = this.items.map(i => (i.id === itemId ? next : i))
        if (!this.serverIds.includes(itemId)) this.serverIds = [...this.serverIds, itemId]
        this.persist()
      } catch (e) {
        // 404: the server does not know this seed article — the local comments stay.
        console.warn(`news: GET comments of ${itemId} failed`, e)
      }
    },

    /** Signed in: POST /api/v1/news/<id>/read/ {dwellMs} (article open → 0, leave → time spent). No local side effects. */
    postRead(itemId: string, dwellMs: number) {
      return this.pushServer(itemId, 'read', { dwellMs: Math.max(0, Math.round(dwellMs)) }, 'read', true)
    },

    /** Replace an item's counters with the server's answer (bookmark / reaction responses). */
    applyServerCounters(itemId: string, counters: Partial<NewsItem['counters']> | undefined) {
      if (!counters) return
      this.items = this.items.map(i => (i.id === itemId ? { ...i, counters: { ...i.counters, ...counters } } : i))
    },

    /** Server write for an item the server knows (signed in); failures keep the local change and say so. */
    async pushServer(itemId: string, path: string, body: Record<string, unknown>, what: string, quiet = false) {
      const api = newsApi()
      // `quiet` writes (read receipts) are tried even before the feed sync finished; a 404 then says nothing.
      if (!api?.signedIn || (!quiet && !this.serverIds.includes(itemId))) return null
      try {
        const res = await api.call<Record<string, any>>(`/api/v1/news/${encodeURIComponent(itemId)}/${path}/`, { method: 'POST', body })
        this.syncNote = null
        return res
      } catch (e) {
        console.warn(`news: POST ${path} on ${itemId} failed`, e)
        if (quiet) return null
        this.syncNote = `Your ${what} was kept in this browser but not saved on the server. It will not be visible to others.`
        return null
      }
    },

    hydratePersisted() {
      if (!import.meta.client) return
      try {
        const raw = userGet(STORAGE_KEY)
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<NewsStoreState>
          this.persistedByUser = parsed.persistedByUser ?? {}
        }
      } catch {
        this.persistedByUser = {}
      }
    },

    /** Apply browser bookmarks after SSR markup has hydrated, without a loading flash. */
    adoptBrowserPersistence() {
      if (!import.meta.client || !this.hydrated) return
      this.hydratePersisted()
      const currentState = this.ensureUserState()
      this.items = this.items.map(item => mergePersistedItem(item, currentState))
    },

    persist() {
      if (!import.meta.client) return
      try {
        userSet(STORAGE_KEY, JSON.stringify({
          persistedByUser: this.persistedByUser,
        }))
      } catch {
        // Ignore quota failures in demo mode.
      }
    },

    syncItemsForCurrentUser() {
      const persisted = this.ensureUserState()
      this.items = this.items.map(item => {
        const persistedCommentIds = new Set(persisted.comments.filter(comment => comment.itemId === item.id).map(comment => comment.id))
        const persistedShareIds = new Set(persisted.shares.filter(share => share.itemId === item.id).map(share => share.id))
        // Subtract only what was merged before: a comment/share added since then must raise the counter.
        const mergedComments = item.comments.filter(comment => persistedCommentIds.has(comment.id)).length
        const mergedShares = item.shares.filter(share => persistedShareIds.has(share.id)).length
        return mergePersistedItem({
          ...item,
          comments: item.comments.filter(comment => !persistedCommentIds.has(comment.id)),
          shares: item.shares.filter(share => !persistedShareIds.has(share.id)),
          counters: {
            ...item.counters,
            likes: Math.max(0, item.counters.likes - (item.userReaction.liked ? 1 : 0)),
            dislikes: Math.max(0, item.counters.dislikes - (item.userReaction.disliked ? 1 : 0)),
            bookmarks: Math.max(0, item.counters.bookmarks - (item.savedByUser ? 1 : 0)),
            judgments: Math.max(0, item.counters.judgments - (item.userReaction.politicalJudgment ? 1 : 0)),
            comments: Math.max(0, item.counters.comments - mergedComments),
            shares: Math.max(0, item.counters.shares - mergedShares),
          },
        }, persisted)
      })
    },

    pushHistory(itemId: string, kind: NewsHistoryEvent['kind'], extras: Partial<NewsHistoryEvent> = {}) {
      const userId = useCurrentUser().getUserId()
      const state = this.ensureUserState(userId)
      state.history.unshift({
        id: `hist_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        itemId,
        userId,
        kind,
        createdAt: new Date().toISOString(),
        ...extras,
      })
      state.history = state.history.slice(0, 250)
      this.persist()
    },

    setView(view: NewsViewMode) {
      this.view = view
    },

    setSortMode(mode: NewsSortMode) {
      this.sortMode = mode
    },

    resetFilters() {
      this.filters = cloneNewsFilters()
    },

    updateFilter<K extends keyof NewsFilters>(key: K, value: NewsFilters[K]) {
      this.filters[key] = value
    },

    cycleFacet(key: keyof NewsFacetExcludes, value: string) {
      if (!this.filters.excluded) this.filters.excluded = EMPTY_NEWS_EXCLUDES()
      const include = [...(this.filters[key] as string[])]
      const exclude = [...(this.filters.excluded[key] as string[])]
      const write = (nextIn: string[], nextOut: string[]) => {
        ;(this.filters as unknown as Record<string, string[]>)[key] = nextIn
        ;(this.filters.excluded as unknown as Record<string, string[]>)[key] = nextOut
      }
      if (include.includes(value)) write(include.filter(entry => entry !== value), [...exclude, value])
      else if (exclude.includes(value)) write(include, exclude.filter(entry => entry !== value))
      else write([...include, value], exclude)
    },

    toggleFilterValue(key: 'companies' | 'currencies' | 'commodities' | 'owners' | 'users' | 'friends' | 'sources' | 'categories' | 'areas', value: string) {
      this.cycleFacet(key, value)
    },

    toggleEnumFilterValue(key: 'kinds' | 'political' | 'economic' | 'sentiment', value: string) {
      this.cycleFacet(key, value)
    },

    applyQuery(query: Record<string, string | string[] | undefined>) {
      const parsed = parseNewsQuery(query)
      this.filters = parsed.filters
      this.view = parsed.view
      this.sortMode = parsed.sortMode
    },

    toQuery() {
      return serializeNewsQuery(this.filters, this.view, this.sortMode)
    },

    recordRead(itemId: string, dwellMs = 0) {
      const state = this.ensureUserState()
      if (!state.readItems.includes(itemId)) state.readItems.unshift(itemId)
      state.readItems = state.readItems.slice(0, 200)
      this.pushHistory(itemId, 'read', { dwellMs })
      this.syncItemsForCurrentUser()
      // Signed in: the read receipt (with dwell) feeds the avatar lane (news_reads).
      void this.pushServer(itemId, 'read', { dwellMs: Math.max(0, Math.round(dwellMs)) }, 'read', true)

      const item = this.getById(itemId)
      if (item) {
        const opinionStore = useOpinionProfileStore()
        const tracker = useAgentTracker()
        const userId = useCurrentUser().getUserId()
        opinionStore.recordRead(userId, {
          id: item.id,
          author_id: item.author.id,
          category: item.category,
          political_leaning: item.politicalLeaning,
          economic_leaning: item.economicLeaning ?? undefined,
          sentiment: item.sentiment ?? undefined,
          weight: item.weight,
        })
        tracker.track('article_dwell', { id: item.id, dwell_ms: dwellMs, page: '/news', component: 'news-item-card' })
        tracker.track('article_political_view', { id: item.id, leaning: item.politicalLeaning, controversy: item.controversyIndex })
      }

      this.persist()
    },

    toggleBookmark(itemId: string) {
      const state = this.ensureUserState()
      const saved = !state.bookmarks.includes(itemId)
      if (!saved) {
        state.bookmarks = state.bookmarks.filter(entry => entry !== itemId)
      } else {
        state.bookmarks.unshift(itemId)
        this.pushHistory(itemId, 'save')
      }
      this.syncItemsForCurrentUser()
      this.persist()
      void this.pushServer(itemId, 'bookmark', { saved }, 'bookmark')
        .then(res => this.applyServerCounters(itemId, res?.counters))
    },

    setReaction(itemId: string, type: 'like' | 'dislike' | 'clear') {
      const state = this.ensureUserState()
      const current = state.reactions[itemId] ?? { liked: false, disliked: false, politicalJudgment: null }
      state.reactions[itemId] = {
        ...current,
        liked: type === 'like' ? !current.liked : false,
        disliked: type === 'dislike' ? !current.disliked : false,
      }
      if (type === 'clear') {
        state.reactions[itemId] = { ...current, liked: false, disliked: false }
      }
      this.syncItemsForCurrentUser()
      this.persist()
      const next = state.reactions[itemId]!
      void this.pushServer(itemId, 'reaction', { liked: next.liked, disliked: next.disliked }, 'reaction')
        .then(res => this.applyServerCounters(itemId, res?.counters))
    },

    setPoliticalJudgment(itemId: string, judgment: NewsPoliticalScale | null) {
      const state = this.ensureUserState()
      const current = state.reactions[itemId] ?? { liked: false, disliked: false, politicalJudgment: null }
      state.reactions[itemId] = { ...current, politicalJudgment: judgment }
      this.pushHistory(itemId, 'judge')
      this.syncItemsForCurrentUser()
      void this.pushServer(itemId, 'reaction', { politicalJudgment: judgment }, 'judgment')
        .then(res => this.applyServerCounters(itemId, res?.counters))

      const item = this.getById(itemId)
      if (item) {
        const tracker = useAgentTracker()
        tracker.track('article_political_view', {
          id: item.id,
          leaning: item.politicalLeaning,
          judgment,
          controversy: item.controversyIndex,
          component: 'news-judgment-widget',
          page: '/news',
        })
      }
      this.persist()
    },

    /**
     * Optimistic local comment; signed in and the server knows the item → POST /api/v1/news/<id>/comments/ and the
     * local row takes the server's id and author (the counter already moved by one, like the server's recount).
     */
    addComment(itemId: string, content: string) {
      const trimmed = content.trim()
      if (!trimmed) return
      const user = useCurrentUser()
      const state = this.ensureUserState()
      const localId = `comment_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
      state.comments.unshift({
        id: localId,
        itemId,
        userId: user.getUserId(),
        authorName: user.profile.value.username,
        authorAvatarUrl: user.profile.value.avatar_url,
        content: trimmed,
        createdAt: new Date().toISOString(),
      })
      this.pushHistory(itemId, 'comment')
      this.syncItemsForCurrentUser()
      this.persist()
      void this.pushServer(itemId, 'comments', { content: trimmed }, 'comment').then(res => {
        if (!res?.id) return
        const saved = res as NewsComment
        const cache = this.ensureUserState()
        cache.comments = cache.comments.map(c => (c.id === localId ? { ...c, ...saved } : c))
        this.items = this.items.map(i => (i.id === itemId
          ? { ...i, comments: i.comments.map(c => (c.id === localId ? { ...c, ...saved } : c)) }
          : i))
        this.persist()
      })
    },

    /**
     * Record a share. The delivery itself goes through chat (<ChatShareTo>, C4 `share`); signed in, the server
     * counts it (POST /api/v1/news/<id>/share/ with no recipients, so C5 never delivers it a second time).
     */
    shareItem(itemId: string, recipients: string[], note = '') {
      const userId = useCurrentUser().getUserId()
      const state = this.ensureUserState(userId)
      const localId = `share_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
      void this.pushServer(itemId, 'share', { recipients: [], note: note.trim() }, 'share').then(res => {
        if (!res?.id) return
        const cache = this.ensureUserState(userId)
        cache.shares = cache.shares.map(s => (s.id === localId ? { ...s, id: String(res.id) } : s))
        this.items = this.items.map(i => (i.id === itemId
          ? { ...i, shares: i.shares.map(s => (s.id === localId ? { ...s, id: String(res.id) } : s)) }
          : i))
        this.persist()
      })
      state.shares.unshift({
        id: localId,
        itemId,
        userId,
        recipients,
        note: note.trim() || undefined,
        createdAt: new Date().toISOString(),
      })
      this.pushHistory(itemId, 'share')
      this.syncItemsForCurrentUser()

      const item = this.getById(itemId)
      if (item) {
        const opinionStore = useOpinionProfileStore()
        opinionStore.recordShare(userId, {
          id: item.id,
          author_id: item.author.id,
          category: item.category,
          political_leaning: item.politicalLeaning,
          economic_leaning: item.economicLeaning ?? undefined,
          sentiment: item.sentiment ?? undefined,
          weight: item.weight,
        })
        const tracker = useAgentTracker()
        tracker.track('share_article', {
          id: item.id,
          controversy: item.controversyIndex,
          recipient_ids: recipients,
          page: '/news',
          component: 'news-share-panel',
          intent: 'share_article',
        })
      }

      this.persist()
    },

    publishPost(input: {
      content: string
      category: string
      sentiment: number
      allocation?: AllocationPie
      title?: string
      assets?: string[]
      geographicOrigin?: NewsItem['geographicOrigin']
      poll?: NewsPoll
    }) {
      const user = useCurrentUser()
      const profile = user.profile.value
      const item: NewsItem = {
        id: `post_local_${Date.now()}`,
        kind: 'social',
        title: input.title?.trim() || deriveExcerpt(input.content),
        content: input.content.trim(),
        excerpt: deriveExcerpt(input.content),
        category: input.category,
        type: 'opinion',
        assets: (input.assets ?? []).map(asset => asset.toUpperCase()),
        currencies: deriveCurrencies(input.assets ?? []),
        commodities: deriveCommodityTickers(input.assets ?? []),
        tags: [],
        source: {
          id: 'social:composer',
          label: 'Your note',
          type: 'social',
          provenance: 'manual',
        },
        author: normalizeAuthor({
          id: profile.id,
          handle: `@${profile.username}`,
          displayName: profile.username,
          avatarUrl: profile.avatar_url,
          kind: 'user',
        }, profile.id, profile.username),
        geographicOrigin: input.geographicOrigin,
        politicalLeaning: 0,
        economicLeaning: clamp(input.sentiment * 0.5, -1, 1),
        sentiment: clamp(input.sentiment, -1, 1),
        controversyIndex: Math.abs(input.sentiment) * 0.35,
        weight: 0.62,
        publishedAt: new Date().toISOString(),
        allocation: input.allocation ? normalizeAllocationPie(input.allocation) : undefined,
        isPinned: false,
        savedByUser: false,
        readByUser: false,
        userReaction: { liked: false, disliked: false, politicalJudgment: null },
        comments: [],
        shares: [],
        counters: { likes: 0, dislikes: 0, comments: 0, shares: 0, bookmarks: 0, judgments: 0 },
        predictionSummary: buildPredictionSummary(input.assets ?? [], []),
        poll: input.poll,
      }

      const state = this.ensureUserState()
      state.publishedItems.unshift(item)
      this.pushHistory(item.id, 'publish')
      this.items.unshift(mergePersistedItem(item, state))
      this.persist()
      return item
    },

    /** One opinion per person. Choosing another option moves the earlier vote. */
    voteOnPoll(itemId: string, optionId: string) {
      const userId = useCurrentUser().getUserId()
      const apply = (item: NewsItem): NewsItem => (
        item.id === itemId && item.poll
          ? { ...item, poll: castPollVote(item.poll, userId, optionId) }
          : item
      )
      this.items = this.items.map(apply)
      const state = this.ensureUserState()
      state.publishedItems = state.publishedItems.map(apply)
      this.persist()
    },

    importExternalLink(input: {
      url: string
      title: string
      summary: string
      sourceLabel?: string
      company?: string
      currencies?: string[]
      commodities?: string[]
      category?: string
      politicalLeaning?: number
      sentiment?: number
      area?: string
    }) {
      const url = input.url.trim()
      if (!/^https?:\/\//i.test(url)) {
        throw new Error('External links must start with http:// or https://')
      }
      const state = this.ensureUserState()
      if (state.importedItems.some(item => item.importedUrl === url)) {
        return state.importedItems.find(item => item.importedUrl === url) ?? null
      }
      const sourceHost = (() => {
        try {
          return new URL(url).hostname.replace(/^www\./, '')
        } catch {
          return 'external'
        }
      })()
      const assets = input.company ? [input.company.toUpperCase()] : []
      const item: NewsItem = {
        id: `external_${Date.now()}`,
        kind: 'external',
        title: input.title.trim(),
        content: input.summary.trim(),
        excerpt: deriveExcerpt(input.summary),
        category: input.category ?? 'macro',
        type: 'external_link',
        assets,
        currencies: (input.currencies ?? []).map(value => value.toUpperCase()),
        commodities: (input.commodities ?? []).map(value => value.toUpperCase()),
        tags: [sourceHost, 'external'],
        source: {
          id: `external:${sourceHost}`,
          label: input.sourceLabel?.trim() || sourceHost,
          type: 'external',
          provenance: 'manual',
          url,
          domain: sourceHost,
        },
        author: normalizeAuthor({
          id: `source:${sourceHost}`,
          handle: `@${sourceHost}`,
          displayName: input.sourceLabel?.trim() || sourceHost,
          kind: 'source',
        }, `source:${sourceHost}`, sourceHost),
        geographicOrigin: input.area ? { lat: 0, lng: 0, name: input.area, area: input.area } : undefined,
        politicalLeaning: clamp(input.politicalLeaning ?? 0, -1, 1),
        economicLeaning: null,
        sentiment: input.sentiment ?? null,
        controversyIndex: 0.42,
        weight: 0.58,
        publishedAt: new Date().toISOString(),
        importedUrl: url,
        isPinned: false,
        savedByUser: false,
        readByUser: false,
        userReaction: { liked: false, disliked: false, politicalJudgment: null },
        comments: [],
        shares: [],
        counters: { likes: 0, dislikes: 0, comments: 0, shares: 0, bookmarks: 0, judgments: 0 },
        predictionSummary: [],
      }
      state.importedItems.unshift(item)
      this.pushHistory(item.id, 'import')
      this.items.unshift(mergePersistedItem(item, state))
      this.persist()
      return item
    },

    toggleFollowAuthor(authorId: string) {
      const state = this.ensureUserState()
      if (state.followedAuthors.includes(authorId)) {
        state.followedAuthors = state.followedAuthors.filter(id => id !== authorId)
      } else {
        state.followedAuthors.unshift(authorId)
      }
      this.persist()
    },

    isAuthorFollowed(authorId: string) {
      return this.currentUserState.followedAuthors.includes(authorId)
    },

    isBookmarked(itemId: string) {
      return this.currentUserState.bookmarks.includes(itemId)
    },
  },
})