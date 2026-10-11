/**
 * Global search — one query, shared by the top navigation bar and every
 * filterable view (Prices, News, Assets).
 *
 * The top-bar palette is the only place a user types a search. It publishes
 * here on every keystroke, and pages read `query` to filter their own content
 * live, so results update behind the open palette.
 *
 * State is module-scoped so all callers share one instance. That is safe on
 * the server because each request gets a fresh module registry in Nuxt's
 * per-request context; `resetGlobalSearch` exists for tests and for route
 * changes that should drop a stale filter.
 */
import { computed, ref } from 'vue'

/** What the user typed in the top bar, verbatim. */
const query = ref('')

/** Views that consume the global query, for labelling the active-filter chip. */
export type SearchScope = 'prices' | 'news' | 'assets' | 'other'

const scopeLabels: Record<SearchScope, string> = {
  prices: 'Prices',
  news: 'News',
  assets: 'Assets',
  other: 'this page',
}

export const useGlobalSearch = () => {
  /** Lower-cased and trimmed — what filters should actually match against. */
  const term = computed(() => query.value.trim().toLowerCase())
  const isActive = computed(() => term.value.length > 0)

  const setQuery = (value: string) => { query.value = value }
  const clear = () => { query.value = '' }

  /**
   * Case-insensitive match of a query against any number of fields.
   * Returns true when there is no active query so callers can use it directly
   * in a `.filter()` without special-casing the empty state.
   */
  const matches = (...fields: Array<string | null | undefined>) => {
    if (!isActive.value) return true
    return fields.some(field => field?.toLowerCase().includes(term.value))
  }

  const scopeLabel = (scope: SearchScope) => scopeLabels[scope]

  return { query, term, isActive, setQuery, clear, matches, scopeLabel }
}

/** Test/route-change helper — drops any active query. */
export const resetGlobalSearch = () => { query.value = '' }
