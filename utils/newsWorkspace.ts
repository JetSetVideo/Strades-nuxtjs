import {
  DEFAULT_NEWS_FILTERS,
  economicLabelFromValue,
  politicalScaleFromValue,
  sentimentLabelFromValue,
  type NewsFilters,
  type NewsItem,
  type NewsKind,
  type NewsPoliticalScale,
  type NewsSortMode,
  type NewsViewMode,
} from '~/types/news'

export const cloneNewsFilters = (): NewsFilters =>
  JSON.parse(JSON.stringify(DEFAULT_NEWS_FILTERS)) as NewsFilters

export function parseNewsQuery(query: Record<string, string | string[] | undefined>) {
  const parseArray = (value: string | string[] | undefined) => {
    if (!value) return []
    const normalized = Array.isArray(value) ? value.join(',') : value
    return normalized.split(',').map(entry => entry.trim()).filter(Boolean)
  }

  return {
    filters: {
      search: typeof query.q === 'string' ? query.q : '',
      companies: parseArray(query.companies),
      currencies: parseArray(query.currencies),
      commodities: parseArray(query.commodities),
      owners: parseArray(query.owners),
      users: parseArray(query.users),
      friends: parseArray(query.friends),
      sources: parseArray(query.sources),
      kinds: parseArray(query.kinds) as NewsKind[],
      categories: parseArray(query.categories),
      political: parseArray(query.political) as NewsPoliticalScale[],
      economic: parseArray(query.economic) as Array<'dovish' | 'neutral' | 'hawkish'>,
      sentiment: parseArray(query.sentiment) as Array<'bullish' | 'neutral' | 'bearish'>,
      savedOnly: query.saved === '1',
      historyOnly: query.history === '1',
      predictionOnly: query.predictions === '1',
      dateFrom: typeof query.from === 'string' ? query.from : null,
      dateTo: typeof query.to === 'string' ? query.to : null,
      areas: parseArray(query.areas),
    } satisfies NewsFilters,
    view: typeof query.view === 'string' ? query.view as NewsViewMode : 'feed',
    sortMode: typeof query.sort === 'string' ? query.sort as NewsSortMode : 'top',
  }
}

export function serializeNewsQuery(filters: NewsFilters, view: NewsViewMode, sortMode: NewsSortMode) {
  const query: Record<string, string> = {}
  const withArray = (key: string, values: string[]) => {
    if (values.length) query[key] = values.join(',')
  }
  if (filters.search) query.q = filters.search
  withArray('companies', filters.companies)
  withArray('currencies', filters.currencies)
  withArray('commodities', filters.commodities)
  withArray('owners', filters.owners)
  withArray('users', filters.users)
  withArray('friends', filters.friends)
  withArray('sources', filters.sources)
  withArray('kinds', filters.kinds)
  withArray('categories', filters.categories)
  withArray('political', filters.political)
  withArray('economic', filters.economic)
  withArray('sentiment', filters.sentiment)
  withArray('areas', filters.areas)
  if (filters.savedOnly) query.saved = '1'
  if (filters.historyOnly) query.history = '1'
  if (filters.predictionOnly) query.predictions = '1'
  if (filters.dateFrom) query.from = filters.dateFrom
  if (filters.dateTo) query.to = filters.dateTo
  query.view = view
  query.sort = sortMode
  return query
}

export function filterNewsItems(items: NewsItem[], filters: NewsFilters, view: NewsViewMode) {
  const text = filters.search.trim().toLowerCase()
  return items.filter(item => {
    if (view === 'saved' && !item.savedByUser) return false
    if (view === 'history' && !item.readByUser) return false
    if (view === 'editorial' && item.kind !== 'editorial') return false
    if (view === 'signals' && item.author.kind !== 'influencer') return false

    if (text) {
      const haystack = [
        item.title,
        item.content,
        item.author.displayName,
        item.author.handle,
        item.source.label,
        item.category,
        ...item.assets,
        ...item.tags,
      ].join(' ').toLowerCase()
      if (!haystack.includes(text)) return false
    }
    if (filters.companies.length && !item.assets.some(asset => filters.companies.includes(asset))) return false
    if (filters.currencies.length && !item.currencies.some(asset => filters.currencies.includes(asset))) return false
    if (filters.commodities.length && !item.commodities.some(asset => filters.commodities.includes(asset))) return false
    if (filters.owners.length && !filters.owners.includes(item.author.displayName)) return false
    if (filters.users.length && !filters.users.includes(item.author.id)) return false
    if (filters.friends.length && !filters.friends.includes(item.author.id)) return false
    if (filters.sources.length && !filters.sources.includes(item.source.label)) return false
    if (filters.kinds.length && !filters.kinds.includes(item.kind)) return false
    if (filters.categories.length && !filters.categories.includes(item.category)) return false
    if (filters.political.length && !filters.political.includes(politicalScaleFromValue(item.politicalLeaning))) return false
    if (filters.economic.length && !filters.economic.includes(economicLabelFromValue(item.economicLeaning))) return false
    if (filters.sentiment.length && !filters.sentiment.includes(sentimentLabelFromValue(item.sentiment))) return false
    if (filters.savedOnly && !item.savedByUser) return false
    if (filters.historyOnly && !item.readByUser) return false
    if (filters.predictionOnly && item.predictionSummary.length === 0) return false
    if (filters.areas.length) {
      const area = item.geographicOrigin?.area ?? item.geographicOrigin?.name ?? ''
      if (!filters.areas.includes(area)) return false
    }
    if (filters.dateFrom && item.publishedAt < `${filters.dateFrom}T00:00:00.000Z`) return false
    if (filters.dateTo && item.publishedAt > `${filters.dateTo}T23:59:59.999Z`) return false
    return true
  })
}

export function sortNewsItems(items: NewsItem[], sortMode: NewsSortMode) {
  const ranked = [...items]
  if (sortMode === 'hot') {
    ranked.sort((a, b) => (b.controversyIndex + b.counters.comments / 1000) - (a.controversyIndex + a.counters.comments / 1000))
  } else if (sortMode === 'new') {
    ranked.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
  } else {
    ranked.sort((a, b) => (b.weight + (b.isPinned ? 0.1 : 0)) - (a.weight + (a.isPinned ? 0.1 : 0)))
  }
  return ranked
}
