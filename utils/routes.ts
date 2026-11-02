/**
 * The one list of app pages: path → label, area, icon, hint.
 *
 * Every place that names a page reads it from here, so a menu label always
 * equals the page title (board-users U4, board-design D7–D9):
 *   - Navigation/DrawerMenu.vue   groups = areas, items = routes with `drawer`
 *   - composables/useNavPanels.ts dock tab label + `match` (which tab lights up)
 *   - Navigation/SearchBar.vue    "Pages" results
 *   - page titles                 `routeLabel(path)` (definePageMeta / UIPageHeader / UIScreenShell)
 *
 * Six areas (DESIGN-AUDIT.md §2.2). Five have a dock tab; "You" lives behind the
 * top-bar avatar and the drawer. Help / About / Contact sit in the drawer footer.
 * No route is moved or deleted here: this is labels + grouping only.
 *
 * Paths are what links use. Vue Router matches case-insensitively, so '/shop'
 * opens pages/Shop.vue (tests/routes.test.ts checks every path has a page file).
 */

export type AreaId = 'markets' | 'news' | 'portfolio' | 'lab' | 'community' | 'you'
/** Dock tab ids (utils/navIcons.ts PanelId). */
export type DockId = 'prices' | 'news' | 'wallet' | 'lab' | 'chat'

export interface AppArea {
  id: AreaId
  label: string
  blurb: string
  /** Bottom-bar tab that lights up for every page of the area; null = no dock tab. */
  dock: DockId | null
  /** The area's home page (the dock tab opens it). */
  home: string
}

export interface RouteEntry {
  /** Link path; dynamic segments written as `[id]` (same as the pages/ file name). */
  path: string
  /** The page's one name: menu label, search entry and page title. */
  label: string
  area: AreaId
  icon?: string
  hint?: string
  /** 'main' = a drawer item in its area; 'footer' = drawer footer link; omitted = not in the drawer (detail pages). */
  drawer?: 'main' | 'footer'
  /** Listed in the search "Pages" results. Defaults to true for drawer pages. */
  search?: boolean
}

export const ROUTE_AREAS: readonly AppArea[] = [
  { id: 'markets', label: 'Markets', dock: 'prices', home: '/prices', blurb: 'Prices, prediction markets, the chart, the calendar' },
  { id: 'news', label: 'News', dock: 'news', home: '/news', blurb: 'Stories and sentiment' },
  { id: 'portfolio', label: 'Portfolio', dock: 'wallet', home: '/wallet', blurb: 'Your wallets, paper trades, exposure and history' },
  { id: 'lab', label: 'Lab', dock: 'lab', home: '/strategies', blurb: 'Strategies, bots and avatars: yours and other people\u2019s' },
  { id: 'community', label: 'Community', dock: 'chat', home: '/chat', blurb: 'Chat, standings, challenges and quests' },
  { id: 'you', label: 'You', dock: null, home: '/profile', blurb: 'Profile, insights, alerts, settings and connections' },
]

export const ROUTES: readonly RouteEntry[] = [
  // ── Markets ──
  { path: '/prices', label: 'Prices', area: 'markets', icon: '↗', hint: 'Live markets', drawer: 'main' },
  { path: '/predict', label: 'Predict', area: 'markets', icon: '◐', hint: 'Prediction markets, paper bot on a market', drawer: 'main' },
  { path: '/CandleChart', label: 'Candle Chart', area: 'markets', icon: '▥', hint: 'Full-screen chart', drawer: 'main' },
  { path: '/calendar', label: 'Calendar', area: 'markets', icon: '▣', hint: 'Sessions and event days', drawer: 'main' },
  { path: '/deals', label: 'Deal Pipeline', area: 'markets', icon: '⟷', hint: 'Sample pipeline from idea to fill', drawer: 'main' },
  { path: '/assets/[id]', label: 'Asset', area: 'markets', icon: '◇' },
  // ── News ──
  { path: '/news', label: 'News', area: 'news', icon: '◯', hint: 'Sentiment and editorial', drawer: 'main' },
  { path: '/articles/[id]', label: 'Article', area: 'news', icon: '▤' },
  // ── Portfolio ──
  { path: '/wallet', label: 'Wallet', area: 'portfolio', icon: '◔', hint: 'Balances and 100% allocation', drawer: 'main' },
  { path: '/trade', label: 'Trade with bots', area: 'portfolio', icon: '⇅', hint: 'Paper wallet, bots and the ledger', drawer: 'main' },
  { path: '/risk', label: 'Risk & Exposure', area: 'portfolio', icon: '⚠', hint: 'Exposure across the book', drawer: 'main' },
  { path: '/historic', label: 'History', area: 'portfolio', icon: '⌖', hint: 'Calls, trades and opinions that printed', drawer: 'main' },
  // ── Lab ──
  { path: '/strategies', label: 'Lab', area: 'lab', icon: '◈', hint: 'Your strategies, bots and agents', drawer: 'main' },
  { path: '/creator', label: 'Strategy Creator', area: 'lab', icon: '✎', hint: 'Build rules and backtest them', drawer: 'main' },
  { path: '/agents', label: 'Avatar Marketplace', area: 'lab', icon: '☰', hint: 'People, agents and strategies to follow', drawer: 'main' },
  { path: '/community', label: 'Community bots', area: 'lab', icon: '◎', hint: 'Public bots from other traders', drawer: 'main' },
  { path: '/bots', label: 'Your bots', area: 'lab', icon: '⬡', hint: 'Your paper bots and the sample catalog', drawer: 'main' },
  { path: '/shop', label: 'Strategy Shop', area: 'lab', icon: '◫', hint: 'Strategies to buy or rent', drawer: 'main' },
  { path: '/strategy/[id]', label: 'Strategy', area: 'lab', icon: '⧉' },
  { path: '/summarizer/[id]', label: 'Review', area: 'lab', icon: '≡' },
  { path: '/bots/[id]', label: 'Bot', area: 'lab', icon: '◆' },
  { path: '/agents/[id]', label: 'Agent', area: 'lab', icon: '◭' },
  // ── Community ──
  { path: '/chat', label: 'Chat', area: 'community', icon: '◴', hint: 'Conversations and rooms', drawer: 'main' },
  { path: '/leaderboard', label: 'Leaderboard', area: 'community', icon: '☷', hint: 'Who is ahead on paper', drawer: 'main' },
  { path: '/arena', label: 'Arena', area: 'community', icon: '⚔', hint: 'Post a read, stake credits', drawer: 'main' },
  { path: '/quest', label: 'Quests', area: 'community', icon: '✦', hint: 'Shared drills', drawer: 'main' },
  { path: '/conversations/[id]', label: 'Conversation', area: 'community', icon: '❝' },
  { path: '/profile/[id]', label: 'Trader profile', area: 'community', icon: '○' },
  // ── You ──
  { path: '/profile', label: 'Profile', area: 'you', icon: '◉', hint: 'Your record and trained avatars', drawer: 'main' },
  { path: '/insights', label: 'Insights', area: 'you', icon: '◍', hint: 'How you trade, who you trade well with', drawer: 'main' },
  { path: '/notifications', label: 'Notifications', area: 'you', icon: '◑', hint: 'Alerts from avatars and the desk', drawer: 'main' },
  { path: '/settings', label: 'Settings', area: 'you', icon: '⚙', hint: 'Primary values, risk budget, appearance', drawer: 'main' },
  { path: '/apis', label: 'API Connections', area: 'you', icon: '⇄', hint: 'Broker feeds that train avatars', drawer: 'main' },
  { path: '/data', label: 'Data Catalog', area: 'you', icon: '▦', hint: 'Series an avatar can pull', drawer: 'main' },
  { path: '/help', label: 'Help', area: 'you', icon: '?', hint: 'How to train an avatar', drawer: 'footer' },
  { path: '/about', label: 'About', area: 'you', icon: '★', hint: 'What Strades is', drawer: 'footer' },
  { path: '/contact', label: 'Contact', area: 'you', icon: '✉', hint: 'Reach the desk', drawer: 'footer' },
  // Dev gallery of the components no page uses (red button in the drawer footer, not a drawer group item).
  { path: '/test', label: 'Test', area: 'you', icon: '⚗', hint: 'Gallery of the 19 components no page uses', search: true },
]

/** Pages outside the app shell (sign-in). Listed so the page-file test knows they are deliberate. */
export const ROUTES_OUTSIDE_APP: readonly string[] = ['/auth']

const lower = (p: string) => p.toLowerCase()
const isDynamic = (seg: string) => seg.startsWith('[') && seg.endsWith(']')

/** Does a concrete URL path match a registry path ('/strategy/[id]' matches '/strategy/42')? */
export function pathMatches(entryPath: string, path: string): boolean {
  const a = lower(entryPath).split('/').filter(Boolean)
  const b = lower(path.split(/[?#]/)[0] ?? '').split('/').filter(Boolean)
  if (a.length !== b.length) return false
  return a.every((seg, i) => isDynamic(seg) || seg === b[i])
}

/** The registry entry for a URL path, or null. Static entries win over dynamic ones. */
export function findRoute(path: string): RouteEntry | null {
  const hits = ROUTES.filter(r => pathMatches(r.path, path))
  return hits.find(r => !r.path.includes('[')) ?? hits[0] ?? null
}

/** The page's one name. Throws on an unknown registry path so a typo fails loudly in dev/tests. */
export function routeLabel(path: string): string {
  const r = findRoute(path)
  if (!r) throw new Error(`routes.ts: no page registered for "${path}"`)
  return r.label
}

/** Area of a URL path (also for detail pages); null outside the registry. */
export function areaOf(path: string): AreaId | null {
  return findRoute(path)?.area ?? null
}

export function areaById(id: AreaId): AppArea {
  return ROUTE_AREAS.find(a => a.id === id)!
}

/** Drawer groups: one per area, items = the area's 'main' pages, in registry order. */
export function drawerGroups(): Array<AppArea & { items: RouteEntry[] }> {
  return ROUTE_AREAS.map(area => ({ ...area, items: ROUTES.filter(r => r.area === area.id && r.drawer === 'main') }))
}

/** Drawer footer links (Help, About, Contact). */
export function drawerFooter(): RouteEntry[] {
  return ROUTES.filter(r => r.drawer === 'footer')
}

/** Pages listed by global search: every drawer page unless `search: false`, plus `search: true`. */
export function searchPages(): RouteEntry[] {
  return ROUTES.filter(r => r.search ?? !!r.drawer)
}

// ── Search: features that live inside a page (board-ia IA-6/IA-7) ─────────

/**
 * A search-only entry: a feature that is a SECTION of a page, so its words are
 * not a page label ("directive", "mirror", "risk budget"). Search lists these in
 * the "Pages" group; they are not routes (the page-file test ignores them).
 * `to` must start with a registered page path (tests/nav-routes.test.ts).
 */
export interface SearchShortcut {
  id: string
  label: string
  /** Lower-case words people type for this feature (substring match). */
  keywords: readonly string[]
  to: string
  icon: string
  hint: string
}

export const SEARCH_SHORTCUTS: readonly SearchShortcut[] = [
  { id: 'sc-directive', label: 'Agent directive', keywords: ['directive', 'direction', 'give direction', 'instruct'], to: '/insights', icon: '➤', hint: 'What your agent is told to do' },
  { id: 'sc-mirror', label: 'Your avatar mirror', keywords: ['your avatar', 'avatar', 'mirror', 'twin'], to: '/profile#intelligence', icon: '◐', hint: 'What your avatar learned from you' },
  { id: 'sc-primary', label: 'Primary values', keywords: ['primary values', 'primary', 'starting capital', 'fees', 'slippage'], to: '/settings#primary', icon: '⚙', hint: 'Capital, fees, slippage: the roots of every number' },
  { id: 'sc-risk', label: 'Risk budget', keywords: ['risk budget', 'max position', 'stop loss', 'take profit', 'risk'], to: '/settings#set-max_position_pct', icon: '⚠', hint: 'Max position, stop loss, take profit' },
  { id: 'sc-ledger', label: 'Ledger and history', keywords: ['ledger', 'history', 'my trades', 'past calls'], to: '/historic', icon: '⌖', hint: 'Every call, trade and opinion that printed' },
  { id: 'sc-call', label: 'Make a call', keywords: ['make a call', 'call', 'predict', 'prediction', 'forecast'], to: '/prices', icon: '◒', hint: 'Open an asset, click its chart' },
  { id: 'sc-message', label: 'New message', keywords: ['new message', 'message', 'dm', 'write to'], to: '/chat', icon: '✉', hint: 'Chat › + New message' },
]

/**
 * Forgiving match score (moved from SearchBar.vue so it is testable): an exact
 * substring ranks by how early it starts; otherwise an in-order subsequence
 * match ranks at 1000 + spread. −1 = no match.
 */
export function fuzzyMatchScore(term: string, target: string): number {
  if (!term) return 0
  const t = target.toLowerCase()
  const q = term.toLowerCase()
  const idx = t.indexOf(q)
  if (idx !== -1) return idx
  let cursor = 0
  let first = -1
  for (const ch of q) {
    const found = t.indexOf(ch, cursor)
    if (found === -1) return -1
    if (first === -1) first = found
    cursor = found + 1
  }
  return 1000 + (cursor - first)
}

/** Hint and keyword hits rank behind any label substring hit, ahead of fuzzy label hits. */
const HINT_OFFSET = 500

/**
 * Score of a page or shortcut for a search term: label (substring or fuzzy),
 * then hint and keywords (substring only: a fuzzy match on a long hint matches
 * almost anything). Lower is better; −1 = no match.
 */
export function pageMatchScore(term: string, entry: { label: string, hint?: string, keywords?: readonly string[] }): number {
  const q = term.trim().toLowerCase()
  if (!q) return 0
  const label = fuzzyMatchScore(q, entry.label)
  if (label !== -1 && label < 1000) return label
  let best = -1
  for (const text of [entry.hint, ...(entry.keywords ?? [])]) {
    if (!text) continue
    const i = text.toLowerCase().indexOf(q)
    if (i !== -1 && (best === -1 || HINT_OFFSET + i < best)) best = HINT_OFFSET + i
  }
  if (best !== -1) return best
  return label
}

// ── Back links and area links (contract C10) ─────────────────────────────

/**
 * The 1-click way back for a page: its area home, labelled with the home's name.
 * null on an area home itself and outside the registry. '/profile/[id]' (a
 * Community page) goes back to Chat, not to your own Profile.
 */
export function areaHomeLink(path: string): { to: string, label: string } | null {
  const r = findRoute(path)
  if (!r) return null
  const home = areaById(r.area).home
  if (pathMatches(home, path)) return null
  return { to: home, label: routeLabel(home) }
}

/** The area's drawer pages in drawer order (for <NavigationAreaLinks>). */
export function areaPageLinks(area: AreaId): RouteEntry[] {
  return ROUTES.filter(r => r.area === area && r.drawer === 'main')
}

/**
 * Prefixes that keep a dock tab lit (for utils/navIcons.ts `activePanelFor`):
 * every page of the tab's area, detail routes cut at their first `[id]`.
 * A prefix that is a static page of ANOTHER area is skipped ('/profile/[id]'
 * is Community, but '/profile' is You and must not light Chat).
 */
export function dockMatch(dock: DockId): string[] {
  const area = ROUTE_AREAS.find(a => a.dock === dock)
  if (!area) return []
  const foreignStatic = new Set(ROUTES.filter(r => r.area !== area.id && !r.path.includes('[')).map(r => lower(r.path)))
  const out: string[] = []
  for (const r of ROUTES) {
    if (r.area !== area.id) continue
    const segs = r.path.split('/').filter(Boolean)
    const cut = segs.findIndex(isDynamic)
    const prefix = `/${(cut === -1 ? segs : segs.slice(0, cut)).join('/')}`
    if (cut !== -1 && foreignStatic.has(lower(prefix))) continue
    if (!out.includes(prefix)) out.push(prefix)
  }
  return out
}

/** Dock tab label = its area's home page label (Prices, News, Wallet, Lab, Chat). */
export function dockLabel(dock: DockId): string {
  const area = ROUTE_AREAS.find(a => a.dock === dock)
  return area ? routeLabel(area.home) : dock
}

/**
 * The dock tab lit for a URL path: the dock of the page's area (exact, also for
 * '/profile/[id]' which prefixes cannot separate from '/profile'). null = no tab.
 */
export function dockFor(path: string): DockId | null {
  const area = areaOf(path)
  return area ? areaById(area).dock : null
}

// ── View state in the URL (so browser Back restores it) ──────────────────

export type TriState = 'neutral' | 'include' | 'exclude'

/**
 * Tri-state chip map → one query value: includes as ids, excludes as "-id",
 * sorted so the same state always gives the same URL. Empty → undefined (no param).
 *   { crypto: 'include', bet: 'exclude' } → "crypto,-bet"
 */
export function tabQueryFrom(states: Record<string, TriState | undefined>): string | undefined {
  const inc = Object.keys(states).filter(k => states[k] === 'include').sort()
  const exc = Object.keys(states).filter(k => states[k] === 'exclude').sort().map(k => `-${k}`)
  const all = [...inc, ...exc]
  return all.length ? all.join(',') : undefined
}

/** Inverse of tabQueryFrom. Accepts the raw route.query value (string, array or missing). */
export function tabStatesFrom(q: unknown): Record<string, TriState> {
  const raw = Array.isArray(q) ? q.join(',') : typeof q === 'string' ? q : ''
  const out: Record<string, TriState> = {}
  for (const part of raw.split(',')) {
    const t = part.trim()
    if (!t || t === '-') continue
    if (t.startsWith('-')) out[t.slice(1)] = 'exclude'
    else out[t] = 'include'
  }
  return out
}
