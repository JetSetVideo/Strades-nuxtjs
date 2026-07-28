import type { AllocationPie } from '~/types/allocation'

export const NEWS_KINDS = ['social', 'editorial', 'external'] as const
export type NewsKind = typeof NEWS_KINDS[number]

export const NEWS_CATEGORIES = ['crypto', 'stocks', 'forex', 'commodities', 'macro'] as const
export type NewsCategory = typeof NEWS_CATEGORIES[number] | string

export const NEWS_SENTIMENT_OPTIONS = ['bullish', 'neutral', 'bearish'] as const
export type NewsSentimentLabel = typeof NEWS_SENTIMENT_OPTIONS[number]

export const NEWS_POLITICAL_SCALE = ['left', 'center_left', 'center', 'center_right', 'right'] as const
export type NewsPoliticalScale = typeof NEWS_POLITICAL_SCALE[number]

export type NewsSortMode = 'top' | 'hot' | 'new'
export type NewsViewMode = 'feed' | 'editorial' | 'signals' | 'saved' | 'history'

export interface NewsGeo {
  lat: number
  lng: number
  name?: string
  area?: string
  country?: string
  continent?: string
}

export interface NewsAuthor {
  id: string
  handle: string
  displayName: string
  avatarUrl?: string
  kind: 'user' | 'editor' | 'influencer' | 'agent' | 'source'
  role?: string
  isVerified?: boolean
  isOwner?: boolean
  country?: string
  city?: string
}

export interface NewsSource {
  id: string
  label: string
  type: 'internal' | 'editorial' | 'external' | 'social'
  domain?: string
  url?: string
  provenance: 'seeded' | 'manual' | 'imported'
}

export interface NewsPredictionSummary {
  assetId: string
  count: number
  bullishPercent: number
  averageChangePercent: number
}

export interface NewsReactionState {
  liked: boolean
  disliked: boolean
  politicalJudgment: NewsPoliticalScale | null
}

export interface NewsCounters {
  likes: number
  dislikes: number
  comments: number
  shares: number
  bookmarks: number
  judgments: number
}

export interface NewsComment {
  id: string
  itemId: string
  userId: string
  authorName: string
  authorAvatarUrl?: string
  content: string
  createdAt: string
}

export interface NewsShare {
  id: string
  itemId: string
  userId: string
  recipients: string[]
  note?: string
  createdAt: string
}

export interface NewsHistoryEvent {
  id: string
  itemId: string
  userId: string
  kind: 'read' | 'save' | 'share' | 'comment' | 'judge' | 'publish' | 'import'
  createdAt: string
  dwellMs?: number
}

export interface NewsItem {
  id: string
  kind: NewsKind
  title: string
  content: string
  excerpt: string
  category: NewsCategory
  type: string
  assets: string[]
  currencies: string[]
  commodities: string[]
  tags: string[]
  source: NewsSource
  author: NewsAuthor
  geographicOrigin?: NewsGeo
  politicalLeaning: number
  economicLeaning: number | null
  sentiment: number | null
  controversyIndex: number
  weight: number
  publishedAt: string
  imageUrl?: string
  allocation?: AllocationPie
  isPinned: boolean
  dataAffiliated?: string
  eventType?: string
  eventProbability?: number
  importedUrl?: string
  savedByUser: boolean
  readByUser: boolean
  userReaction: NewsReactionState
  comments: NewsComment[]
  shares: NewsShare[]
  counters: NewsCounters
  predictionSummary: NewsPredictionSummary[]
}

export interface NewsFilters {
  search: string
  companies: string[]
  currencies: string[]
  commodities: string[]
  owners: string[]
  users: string[]
  friends: string[]
  sources: string[]
  kinds: NewsKind[]
  categories: string[]
  political: NewsPoliticalScale[]
  economic: Array<'dovish' | 'neutral' | 'hawkish'>
  sentiment: NewsSentimentLabel[]
  savedOnly: boolean
  historyOnly: boolean
  predictionOnly: boolean
  dateFrom: string | null
  dateTo: string | null
  areas: string[]
}

export interface NewsFilterOption {
  value: string
  label: string
  count: number
}

export interface NewsFacetSummary {
  companies: NewsFilterOption[]
  currencies: NewsFilterOption[]
  commodities: NewsFilterOption[]
  owners: NewsFilterOption[]
  users: NewsFilterOption[]
  friends: NewsFilterOption[]
  sources: NewsFilterOption[]
  kinds: NewsFilterOption[]
  categories: NewsFilterOption[]
  areas: NewsFilterOption[]
}

export interface NewsApiContract {
  load: {
    path: '/api/news/'
    response: 'NewsItem[]'
  }
  mutate: {
    bookmark: '/api/news/:id/bookmark/'
    reaction: '/api/news/:id/reaction/'
    comment: '/api/news/:id/comments/'
    share: '/api/news/:id/share/'
    import: '/api/news/import/'
    publish: '/api/news/publish/'
  }
}

export const DEFAULT_NEWS_FILTERS: NewsFilters = {
  search: '',
  companies: [],
  currencies: [],
  commodities: [],
  owners: [],
  users: [],
  friends: [],
  sources: [],
  kinds: [],
  categories: [],
  political: [],
  economic: [],
  sentiment: [],
  savedOnly: false,
  historyOnly: false,
  predictionOnly: false,
  dateFrom: null,
  dateTo: null,
  areas: [],
}

export function politicalScaleFromValue(value: number | null | undefined): NewsPoliticalScale {
  if (value === null || value === undefined) return 'center'
  if (value <= -0.5) return 'left'
  if (value <= -0.15) return 'center_left'
  if (value >= 0.5) return 'right'
  if (value >= 0.15) return 'center_right'
  return 'center'
}

export function sentimentLabelFromValue(value: number | null | undefined): NewsSentimentLabel {
  if (value === null || value === undefined) return 'neutral'
  if (value >= 0.2) return 'bullish'
  if (value <= -0.2) return 'bearish'
  return 'neutral'
}

export function economicLabelFromValue(value: number | null | undefined): 'dovish' | 'neutral' | 'hawkish' {
  if (value === null || value === undefined) return 'neutral'
  if (value <= -0.2) return 'dovish'
  if (value >= 0.2) return 'hawkish'
  return 'neutral'
}
