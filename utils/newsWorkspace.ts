import { allowsAny, allowsValue, statesFromLists } from '~/utils/priceFilters'
import {
  DEFAULT_NEWS_FILTERS,
  EMPTY_NEWS_EXCLUDES,
  economicLabelFromValue,
  politicalScaleFromValue,
  sentimentLabelFromValue,
  type NewsFacetExcludes,
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
      excluded: {
        ...EMPTY_NEWS_EXCLUDES(),
        companies: parseArray(query.companiesOut),
        currencies: parseArray(query.currenciesOut),
        commodities: parseArray(query.commoditiesOut),
        owners: parseArray(query.ownersOut),
        users: parseArray(query.usersOut),
        friends: parseArray(query.friendsOut),
        sources: parseArray(query.sourcesOut),
        kinds: parseArray(query.kindsOut) as NewsKind[],
        categories: parseArray(query.categoriesOut),
        political: parseArray(query.politicalOut) as NewsPoliticalScale[],
        economic: parseArray(query.economicOut) as NewsFacetExcludes['economic'],
        sentiment: parseArray(query.sentimentOut) as NewsFacetExcludes['sentiment'],
        areas: parseArray(query.areasOut),
      },
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
  const excluded = filters.excluded ?? EMPTY_NEWS_EXCLUDES()
  withArray('companiesOut', excluded.companies)
  withArray('currenciesOut', excluded.currencies)
  withArray('commoditiesOut', excluded.commodities)
  withArray('ownersOut', excluded.owners)
  withArray('usersOut', excluded.users)
  withArray('friendsOut', excluded.friends)
  withArray('sourcesOut', excluded.sources)
  withArray('kindsOut', excluded.kinds)
  withArray('categoriesOut', excluded.categories)
  withArray('politicalOut', excluded.political)
  withArray('economicOut', excluded.economic)
  withArray('sentimentOut', excluded.sentiment)
  withArray('areasOut', excluded.areas)
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
    const excluded = filters.excluded ?? EMPTY_NEWS_EXCLUDES()
    if (!allowsAny(item.assets, statesFromLists(filters.companies, excluded.companies))) return false
    if (!allowsAny(item.currencies, statesFromLists(filters.currencies, excluded.currencies))) return false
    if (!allowsAny(item.commodities, statesFromLists(filters.commodities, excluded.commodities))) return false
    if (!allowsValue(item.author.displayName, statesFromLists(filters.owners, excluded.owners))) return false
    if (!allowsValue(item.author.id, statesFromLists(filters.users, excluded.users))) return false
    if (!allowsValue(item.author.id, statesFromLists(filters.friends, excluded.friends))) return false
    if (!allowsValue(item.source.label, statesFromLists(filters.sources, excluded.sources))) return false
    if (!allowsValue(item.kind, statesFromLists(filters.kinds, excluded.kinds))) return false
    if (!allowsValue(item.category, statesFromLists(filters.categories, excluded.categories))) return false
    if (!allowsValue(politicalScaleFromValue(item.politicalLeaning), statesFromLists(filters.political, excluded.political))) return false
    if (!allowsValue(economicLabelFromValue(item.economicLeaning), statesFromLists(filters.economic, excluded.economic))) return false
    if (!allowsValue(sentimentLabelFromValue(item.sentiment), statesFromLists(filters.sentiment, excluded.sentiment))) return false
    if (filters.savedOnly && !item.savedByUser) return false
    if (filters.historyOnly && !item.readByUser) return false
    if (filters.predictionOnly && item.predictionSummary.length === 0) return false
    {
      const area = item.geographicOrigin?.area ?? item.geographicOrigin?.name ?? ''
      if (!allowsValue(area, statesFromLists(filters.areas, excluded.areas))) return false
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
