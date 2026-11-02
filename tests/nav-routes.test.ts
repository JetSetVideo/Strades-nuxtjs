import { describe, expect, it } from 'vitest'
import {
  ROUTES, ROUTE_AREAS, SEARCH_SHORTCUTS, areaHomeLink, areaPageLinks, drawerGroups, findRoute, fuzzyMatchScore,
  pageMatchScore, routeLabel, searchPages,
} from '~/utils/routes'

/** What SearchBar.vue does for the "Pages" group: pages + shortcuts, scored, best first. */
function searchPagesFor(term: string): string[] {
  const entries = [
    ...searchPages().map(r => ({ id: r.path, label: r.label, hint: r.hint })),
    ...SEARCH_SHORTCUTS.map(s => ({ id: s.to, label: s.label, hint: s.hint, keywords: s.keywords })),
  ]
  return entries
    .map(e => ({ e, score: pageMatchScore(term, e) }))
    .filter(x => x.score !== -1)
    .sort((a, b) => a.score - b.score)
    .slice(0, 6)
    .map(x => x.e.id)
}

describe('search scorer (board-ia IA-6/IA-7)', () => {
  it('fuzzyMatchScore: substring by position, subsequence behind, -1 for none', () => {
    expect(fuzzyMatchScore('lab', 'Lab')).toBe(0)
    expect(fuzzyMatchScore('shop', 'Strategy Shop')).toBe(9)
    expect(fuzzyMatchScore('cgnprm', 'Cognis Prime')).toBeGreaterThanOrEqual(1000)
    expect(fuzzyMatchScore('zzz', 'Prices')).toBe(-1)
    expect(fuzzyMatchScore('', 'Prices')).toBe(0)
  })
  it('pageMatchScore: label hit < hint/keyword hit < fuzzy label hit', () => {
    const settings = findRoute('/settings')!
    expect(pageMatchScore('sett', settings)).toBe(0)
    const viaHint = pageMatchScore('risk budget', settings)
    expect(viaHint).toBeGreaterThanOrEqual(500)
    expect(viaHint).toBeLessThan(1000)
    expect(pageMatchScore('stg', settings)).toBeGreaterThanOrEqual(1000)
    expect(pageMatchScore('nothing-like-it', settings)).toBe(-1)
    // hints are substring-only: a long hint must not fuzzy-match random letters
    expect(pageMatchScore('xq', { label: 'Lab', hint: 'Your strategies, bots and agents' })).toBe(-1)
  })
  it('Settings hint names the risk inputs', () => {
    expect(findRoute('/settings')!.hint).toBe('Primary values, risk budget, appearance')
  })
  it('finds the features a newcomer types', () => {
    expect(searchPagesFor('directive')[0]).toBe('/insights')
    expect(searchPagesFor('mirror')[0]).toBe('/profile#intelligence')
    expect(searchPagesFor('primary')).toContain('/settings')
    expect(searchPagesFor('primary')).toContain('/settings#primary')
    expect(searchPagesFor('risk')).toContain('/settings')
    expect(searchPagesFor('risk')[0]).toBe('/risk') // "Risk & Exposure" label still wins
    expect(searchPagesFor('risk budget')).toContain('/settings#set-max_position_pct')
    expect(searchPagesFor('ledger')).toContain('/historic')
    expect(searchPagesFor('make a call')[0]).toBe('/prices')
    expect(searchPagesFor('new message')[0]).toBe('/chat')
  })
  it('every shortcut points at a registered page; anchors are the real ones', () => {
    for (const s of SEARCH_SHORTCUTS) {
      expect(findRoute(s.to.split('#')[0]!), s.to).not.toBeNull()
      expect(s.keywords.every(k => k === k.toLowerCase())).toBe(true)
    }
    const ids = SEARCH_SHORTCUTS.map(s => s.id)
    expect(new Set(ids).size).toBe(ids.length)
    // anchors: pages/settings.vue `UICard id="primary"`, Settings/PrimaryValues.vue `set-${key}`
    // (key from backend apps/users/primary.py), pages/profile/index.vue `section id="intelligence"`
    expect(SEARCH_SHORTCUTS.map(s => s.to)).toEqual(expect.arrayContaining([
      '/settings#primary', '/settings#set-max_position_pct', '/profile#intelligence',
    ]))
  })
})

describe('back links and area links (contract C10)', () => {
  it('detail and secondary pages go back to their area home', () => {
    expect(areaHomeLink('/strategy/42')).toEqual({ to: '/strategies', label: 'Lab' })
    expect(areaHomeLink('/bots/bot_001')).toEqual({ to: '/strategies', label: 'Lab' })
    expect(areaHomeLink('/agents/avatar_user_001')).toEqual({ to: '/strategies', label: 'Lab' })
    expect(areaHomeLink('/summarizer/strategy_001')).toEqual({ to: '/strategies', label: 'Lab' })
    expect(areaHomeLink('/calendar')).toEqual({ to: '/prices', label: 'Prices' })
    expect(areaHomeLink('/CandleChart')).toEqual({ to: '/prices', label: 'Prices' })
    expect(areaHomeLink('/articles/9')).toEqual({ to: '/news', label: 'News' })
    expect(areaHomeLink('/historic?x=1')).toEqual({ to: '/wallet', label: 'Wallet' })
    expect(areaHomeLink('/settings')).toEqual({ to: '/profile', label: 'Profile' })
    expect(areaHomeLink('/help')).toEqual({ to: '/profile', label: 'Profile' })
  })
  it('a trader profile goes back to Chat, not to your own Profile', () => {
    expect(areaHomeLink('/profile/user_002')).toEqual({ to: '/chat', label: 'Chat' })
  })
  it('nothing on area homes or unknown paths', () => {
    for (const a of ROUTE_AREAS) expect(areaHomeLink(a.home)).toBeNull()
    expect(areaHomeLink('/strategies?tab=x')).toBeNull()
    expect(areaHomeLink('/monitor')).toBeNull()
  })
  it('every registered page except the homes has a back link', () => {
    const homes = new Set(ROUTE_AREAS.map(a => a.home))
    for (const r of ROUTES) {
      const link = areaHomeLink(r.path.replace(/\[id\]/g, 'x1'))
      if (homes.has(r.path)) expect(link).toBeNull()
      else expect(link?.label).toBe(routeLabel(ROUTE_AREAS.find(a => a.id === r.area)!.home))
    }
  })
  it('area links = the drawer group of the area', () => {
    for (const g of drawerGroups()) expect(areaPageLinks(g.id).map(r => r.path)).toEqual(g.items.map(i => i.path))
    expect(areaPageLinks('lab').map(r => r.path)).toEqual(
      ['/strategies', '/creator', '/agents', '/community', '/bots', '/shop'],
    )
  })
})
