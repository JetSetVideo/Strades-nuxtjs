import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { activePanelFor, type PanelId } from '~/utils/navIcons'
import {
  ROUTES, ROUTES_OUTSIDE_APP, ROUTE_AREAS, areaOf, dockFor, dockLabel, dockMatch, drawerFooter, drawerGroups, findRoute,
  pathMatches, routeLabel, searchPages, tabQueryFrom, tabStatesFrom, type DockId,
} from '~/utils/routes'

const PAGES_DIR = fileURLToPath(new URL('../pages/', import.meta.url))

/** pages/agents/index.vue → /agents · pages/profile/[id].vue → /profile/[id] (lower-case: the router is case-insensitive). */
function pageRoutes(dir = PAGES_DIR): string[] {
  const out: string[] = []
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name)
    if (e.isDirectory()) out.push(...pageRoutes(full))
    else if (e.name.endsWith('.vue')) {
      const rel = relative(PAGES_DIR, full).replace(/\\/g, '/').replace(/\.vue$/, '').replace(/(^|\/)index$/, '')
      out.push(`/${rel}`.toLowerCase().replace(/\/$/, '') || '/')
    }
  }
  return out
}

const DOCKS: DockId[] = ['prices', 'news', 'wallet', 'lab', 'chat']

describe('route registry ↔ pages/', () => {
  const files = pageRoutes()

  it('every registry path has a page file', () => {
    const missing = ROUTES.map(r => r.path).filter(p => !files.includes(p.toLowerCase()))
    expect(missing).toEqual([])
  })

  it('every page file is in the registry (or deliberately outside the app)', () => {
    const known = new Set([...ROUTES.map(r => r.path.toLowerCase()), ...ROUTES_OUTSIDE_APP.map(p => p.toLowerCase())])
    expect(files.filter(f => !known.has(f))).toEqual([])
  })

  it('has no duplicate paths, labels or icons', () => {
    const dup = (xs: string[]) => xs.filter((x, i) => xs.indexOf(x) !== i)
    expect(dup(ROUTES.map(r => r.path.toLowerCase()))).toEqual([])
    expect(dup(ROUTES.map(r => r.label))).toEqual([])
    expect(dup(ROUTES.map(r => r.icon ?? ''))).toEqual([])
  })

  it('uses the six areas, each with its home in the registry', () => {
    expect(ROUTE_AREAS.map(a => a.label)).toEqual(['Markets', 'News', 'Portfolio', 'Lab', 'Community', 'You'])
    for (const a of ROUTE_AREAS) expect(findRoute(a.home)?.area).toBe(a.id)
  })
})

describe('one name per page', () => {
  it('fixes the known mismatches', () => {
    expect(routeLabel('/agents')).toBe('Avatar Marketplace')
    expect(routeLabel('/strategies')).toBe('Lab')
    expect(dockLabel('lab')).toBe(routeLabel('/strategies'))
    expect(searchPages().find(p => p.path === '/strategies')?.label).toBe('Lab')
  })
  it('lists /strategies in the drawer', () => {
    const lab = drawerGroups().find(g => g.id === 'lab')!
    expect(lab.items.map(i => i.path)).toContain('/strategies')
  })
  it('has a /bots index in the Lab (board-optimization O9: it was a 404)', () => {
    expect(routeLabel('/bots')).toBe('Your bots')
    expect(areaOf('/bots')).toBe('lab')
    expect(findRoute('/bots/bot_001')?.label).toBe('Bot')
    expect(drawerGroups().find(g => g.id === 'lab')!.items.map(i => i.path)).toContain('/bots')
    const src = readFileSync(join(PAGES_DIR, 'bots/index.vue'), 'utf8')
    expect(src.match(/definePageMeta\(\{ title: '([^']+)'/)?.[1]).toBe(routeLabel('/bots'))
  })
  it('puts every drawer page in exactly one group; help pages in the footer', () => {
    const items = drawerGroups().flatMap(g => g.items.map(i => i.path))
    expect(new Set(items).size).toBe(items.length)
    expect(drawerFooter().map(r => r.path)).toEqual(['/help', '/about', '/contact'])
    expect(drawerGroups().map(g => g.items.length).every(n => n > 0)).toBe(true)
  })
  it('throws on an unknown path', () => {
    expect(() => routeLabel('/monitor')).toThrow()
  })
  it('/agents page title literal (definePageMeta cannot call routeLabel) equals the registry', () => {
    const src = readFileSync(join(PAGES_DIR, 'agents/index.vue'), 'utf8')
    expect(src).toMatch(/definePageMeta\(\{ title: '([^']+)'/)
    expect(src.match(/definePageMeta\(\{ title: '([^']+)'/)![1]).toBe(routeLabel('/agents'))
    expect(src).not.toContain('title="Follow"')
  })
})

describe('path matching', () => {
  it('matches dynamic segments, ignores query and case', () => {
    expect(pathMatches('/strategy/[id]', '/strategy/42')).toBe(true)
    expect(pathMatches('/strategy/[id]', '/strategy')).toBe(false)
    expect(pathMatches('/shop', '/Shop')).toBe(true)
    expect(findRoute('/prices?tab=crypto')?.label).toBe('Prices')
    expect(findRoute('/profile')?.label).toBe('Profile')
    expect(findRoute('/profile/u_2')?.label).toBe('Trader profile')
    expect(areaOf('/summarizer/strategy_001')).toBe('lab')
    expect(areaOf('/nowhere')).toBeNull()
  })
})

describe('dock ownership comes from the area', () => {
  const panels = DOCKS.map(id => ({ id: id as PanelId, match: dockMatch(id) }))
  const lit = (p: string) => activePanelFor(p, panels)

  it('lights the tab of the page area', () => {
    expect(lit('/summarizer/strategy_001')).toBe('lab')
    expect(lit('/strategy/42')).toBe('lab')
    expect(lit('/agents/a1')).toBe('lab')
    expect(lit('/articles/9')).toBe('news')
    expect(lit('/assets/btc')).toBe('prices')
    expect(lit('/predict')).toBe('prices')
    expect(lit('/historic')).toBe('wallet')
    expect(lit('/arena')).toBe('chat')
    expect(lit('/conversations/c1')).toBe('chat')
    // prefixes cannot split /profile (You) from /profile/[id] (Community): dockFor is exact
    expect(lit('/profile/u_2')).toBeNull()
    expect(dockFor('/profile/u_2')).toBe('chat')
    expect(dockFor('/profile')).toBeNull()
    for (const r of ROUTES) {
      const sample = r.path.replace(/\[id\]/g, 'x1')
      expect(dockFor(sample)).toBe(ROUTE_AREAS.find(a => a.id === r.area)!.dock)
      // where prefixes do answer, they agree with the area
      const viaPrefix = lit(sample)
      if (viaPrefix) expect(viaPrefix).toBe(dockFor(sample))
    }
  })
  it('lights nothing for You pages and unknown paths', () => {
    expect(lit('/profile')).toBeNull()
    expect(lit('/settings')).toBeNull()
    expect(lit('/monitor')).toBeNull()
  })
  it('never lists a path without a page', () => {
    const files = pageRoutes()
    for (const id of DOCKS) {
      for (const m of dockMatch(id)) {
        expect(files.some(f => f === m.toLowerCase() || f.startsWith(`${m.toLowerCase()}/`))).toBe(true)
      }
    }
    expect(DOCKS.flatMap(dockMatch)).not.toContain('/monitor')
  })
})

describe('tab state in the URL', () => {
  it('round-trips include and exclude chips', () => {
    const q = tabQueryFrom({ crypto: 'include', bet: 'exclude', stock: 'neutral' })
    expect(q).toBe('crypto,-bet')
    expect(tabStatesFrom(q)).toEqual({ crypto: 'include', bet: 'exclude' })
  })
  it('is stable and empty when nothing is picked', () => {
    expect(tabQueryFrom({ stock: 'include', crypto: 'include' })).toBe('crypto,stock')
    expect(tabQueryFrom({})).toBeUndefined()
    expect(tabQueryFrom({ crypto: 'neutral' })).toBeUndefined()
  })
  it('tolerates junk and arrays', () => {
    expect(tabStatesFrom(undefined)).toEqual({})
    expect(tabStatesFrom(',, -,')).toEqual({})
    expect(tabStatesFrom(['crypto', '-bet'])).toEqual({ crypto: 'include', bet: 'exclude' })
    expect(tabStatesFrom(42)).toEqual({})
  })
})
