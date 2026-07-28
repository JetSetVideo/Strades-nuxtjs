import { describe, expect, it } from 'vitest'
import {
  cloneNewsFilters,
  filterNewsItems,
  parseNewsQuery,
  serializeNewsQuery,
  sortNewsItems,
} from '~/utils/newsWorkspace'
import type { NewsItem } from '~/types/news'

const baseItem = (overrides: Partial<NewsItem>): NewsItem => ({
  id: 'item-1',
  kind: 'social',
  title: 'BTC momentum builds',
  content: 'Macro liquidity improving for crypto risk assets.',
  excerpt: 'Macro liquidity improving for crypto risk assets.',
  category: 'crypto',
  type: 'analysis',
  assets: ['BTC'],
  currencies: ['USD'],
  commodities: [],
  tags: ['btc', 'macro'],
  source: { id: 'social:1', label: 'Community feed', type: 'social', provenance: 'seeded' },
  author: { id: 'user_001', handle: '@alice', displayName: 'Alice Morgan', kind: 'user' },
  politicalLeaning: 0.3,
  economicLeaning: 0.5,
  sentiment: 0.7,
  controversyIndex: 0.2,
  weight: 0.9,
  publishedAt: '2026-03-24T08:00:00.000Z',
  isPinned: false,
  savedByUser: false,
  readByUser: false,
  userReaction: { liked: false, disliked: false, politicalJudgment: null },
  comments: [],
  shares: [],
  counters: { likes: 1, dislikes: 0, comments: 2, shares: 0, bookmarks: 0, judgments: 0 },
  predictionSummary: [],
  ...overrides,
})

describe('newsWorkspace query sync', () => {
  it('serializes and parses filters deterministically', () => {
    const filters = cloneNewsFilters()
    filters.search = 'tesla'
    filters.companies = ['TSLA', 'NVDA']
    filters.sources = ['Reuters']
    filters.friends = ['user_002']
    filters.savedOnly = true
    filters.dateFrom = '2026-01-01'
    filters.areas = ['Tokyo']

    const query = serializeNewsQuery(filters, 'saved', 'hot')
    expect(query).toEqual({
      q: 'tesla',
      companies: 'TSLA,NVDA',
      sources: 'Reuters',
      friends: 'user_002',
      saved: '1',
      from: '2026-01-01',
      areas: 'Tokyo',
      view: 'saved',
      sort: 'hot',
    })

    expect(parseNewsQuery(query)).toEqual({
      filters,
      view: 'saved',
      sortMode: 'hot',
    })
  })
})

describe('newsWorkspace filtering and sorting', () => {
  const items = [
    baseItem({ id: 'btc-social', savedByUser: true, readByUser: true }),
    baseItem({
      id: 'tsla-editorial',
      kind: 'editorial',
      title: 'Tesla deliveries beat',
      category: 'stocks',
      assets: ['TSLA'],
      currencies: [],
      source: { id: 'editorial:reuters', label: 'Reuters', type: 'editorial', provenance: 'seeded' },
      author: { id: 'editor_1', handle: '@reuters', displayName: 'Reuters Desk', kind: 'editor' },
      weight: 0.7,
      controversyIndex: 0.6,
      publishedAt: '2026-03-24T09:00:00.000Z',
      predictionSummary: [{ assetId: 'TSLA', count: 3, bullishPercent: 67, averageChangePercent: 4.2 }],
    }),
    baseItem({
      id: 'xau-signal',
      kind: 'external',
      title: 'Gold catches a bid',
      category: 'commodities',
      assets: ['XAU'],
      commodities: ['XAU'],
      source: { id: 'external:bloomberg', label: 'Bloomberg', type: 'external', provenance: 'manual' },
      author: { id: 'inf_1', handle: '@goldhawk', displayName: 'Gold Hawk', kind: 'influencer' },
      controversyIndex: 0.91,
      weight: 0.6,
      publishedAt: '2026-03-24T07:00:00.000Z',
    }),
  ]

  it('applies AND-across facets and saved/history rules', () => {
    const filters = cloneNewsFilters()
    filters.companies = ['TSLA']
    filters.predictionOnly = true
    filters.sources = ['Reuters']

    expect(filterNewsItems(items, filters, 'feed').map(item => item.id)).toEqual(['tsla-editorial'])

    filters.savedOnly = true
    expect(filterNewsItems(items, filters, 'feed')).toEqual([])

    const historyFilters = cloneNewsFilters()
    expect(filterNewsItems(items, historyFilters, 'history').map(item => item.id)).toEqual(['btc-social'])

    const friendFilters = cloneNewsFilters()
    friendFilters.friends = ['editor_1']
    expect(filterNewsItems(items, friendFilters, 'feed').map(item => item.id)).toEqual(['tsla-editorial'])
  })

  it('sorts by hot and new deterministically', () => {
    expect(sortNewsItems(items, 'hot').map(item => item.id)[0]).toBe('xau-signal')
    expect(sortNewsItems(items, 'new').map(item => item.id)[0]).toBe('tsla-editorial')
    expect(sortNewsItems(items, 'top').map(item => item.id)[0]).toBe('btc-social')
  })
})
