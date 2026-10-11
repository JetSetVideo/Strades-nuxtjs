/** Tri-state facet used by the prices type chips. */
export type FilterTriState = 'neutral' | 'include' | 'exclude'

export const TRI_STATE_CYCLE: FilterTriState[] = ['neutral', 'include', 'exclude']

export function cycleTriState(current: FilterTriState): FilterTriState {
  const i = TRI_STATE_CYCLE.indexOf(current)
  return TRI_STATE_CYCLE[(i + 1) % TRI_STATE_CYCLE.length] ?? 'neutral'
}

export function emptyTypeStates(types: string[]): Record<string, FilterTriState> {
  return Object.fromEntries(types.map(t => [t, 'neutral' as FilterTriState]))
}

/** Values currently highlighted. Neutral and missing keys are not included. */
export function includedKeys(states: Record<string, FilterTriState | undefined>): string[] {
  return Object.entries(states).filter(([, s]) => s === 'include').map(([k]) => k)
}

/**
 * One value against a tri-state group.
 * Any include turns the group into a whitelist. Exclude always removes that value.
 * All-neutral (or an empty map) lets every value through.
 */
export function allowsValue(
  value: string,
  states: Record<string, FilterTriState | undefined>,
): boolean {
  if (states[value] === 'exclude') return false
  const includes = includedKeys(states)
  if (includes.length && !includes.includes(value)) return false
  return true
}

/**
 * A record that carries several tags (a strategy's assets, a story's companies).
 * Exclude wins if any tag is excluded. Includes match when any tag is included.
 */
export function allowsAny(
  values: string[],
  states: Record<string, FilterTriState | undefined>,
): boolean {
  const present = values.filter(Boolean)
  if (present.some(v => states[v] === 'exclude')) return false
  const includes = includedKeys(states)
  if (includes.length && !present.some(v => includes.includes(v))) return false
  return true
}

/** Rebuild a state map from the include list and the exclude list. */
export function statesFromLists(include: readonly string[], exclude: readonly string[] = []): Record<string, FilterTriState> {
  const states: Record<string, FilterTriState> = {}
  for (const id of include) states[id] = 'include'
  for (const id of exclude) states[id] = 'exclude'
  return states
}

/** Walk include → exclude → neutral on one id inside a mutable state map. */
export function cycleKey(states: Record<string, FilterTriState>, id: string) {
  states[id] = cycleTriState(states[id] ?? 'neutral')
  if (states[id] === 'neutral') delete states[id]
}

/**
 * Include wins as a whitelist when any chip is included.
 * Exclude always hides. Neutral never constrains on its own.
 */
export function applyTypeFilters<T extends { type: string }>(
  list: T[],
  states: Record<string, FilterTriState>,
): T[] {
  return list.filter(item => allowsValue(item.type, states))
}

export type PriceSortKey = 'default' | 'gainers' | 'losers' | 'vol_high' | 'cap'

export function sortAssets<T extends {
  id: string
  fluctuation_velocity?: number
  psychology_profile?: { volatility_affinity?: number }
  market_cap?: number
}>(
  list: T[],
  sortBy: PriceSortKey,
  changes: Record<string, number>,
  reverse: boolean,
): T[] {
  const withChange = list.map(asset => ({ asset, pct: changes[asset.id] ?? 0 }))
  switch (sortBy) {
    case 'gainers':
      withChange.sort((a, b) => b.pct - a.pct)
      break
    case 'losers':
      withChange.sort((a, b) => a.pct - b.pct)
      break
    case 'vol_high':
      withChange.sort((a, b) => {
        const vb = b.asset.fluctuation_velocity
          ?? b.asset.psychology_profile?.volatility_affinity
          ?? 0
        const va = a.asset.fluctuation_velocity
          ?? a.asset.psychology_profile?.volatility_affinity
          ?? 0
        return vb - va
      })
      break
    case 'cap':
      withChange.sort((a, b) => (b.asset.market_cap ?? 0) - (a.asset.market_cap ?? 0))
      break
    default:
      break
  }
  const ordered = withChange.map(x => x.asset)
  return reverse ? ordered.slice().reverse() : ordered
}
