import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Every backend business call goes through /api/v1/ — the unversioned /api/<x> alias is deprecated
 * (Strades-backend strades_backend/middleware.py marks it with a `Deprecation` header) and can only be
 * removed once no client calls it (board-backend BACKEND-6, swarm 2026-11-02 wave 2 lane perf).
 * Allowed prefixes: /api/v1/ (business), /api/auth/ (auth, unversioned by design), /api/market/ and
 * /api/predict/ (this app's own Nitro routes, server/api/*).
 */
const ROOT = join(__dirname, '..')
const DIRS = ['composables', 'stores', 'pages', 'plugins', 'components', 'layouts', 'middleware', 'utils']
const ALLOWED = /^\/api\/(?:v1|auth|market|predict)\//

/**
 * Still pending in a lane that owns the file (wave 2). Each entry is file → the exact legacy paths
 * allowed there; anything else in that file still fails. Remove an entry once its lane lands the fix.
 *  - stores/news.ts (lane `social`): NEWS_API_CONTRACT, a descriptor of the news routes kept in state;
 *    the live calls in that file already use /api/v1/news/.
 */
const PENDING: Record<string, string[]> = {
  'stores/news.ts': [
    '/api/news/', '/api/news/:id/bookmark/', '/api/news/:id/reaction/', '/api/news/:id/comments/',
    '/api/news/:id/share/', '/api/news/import/', '/api/news/publish/',
  ],
}

function walk(dir: string, out: string[] = []): string[] {
  let names: string[] = []
  try { names = readdirSync(dir) } catch { return out }
  for (const n of names) {
    if (n === 'node_modules' || n.startsWith('.')) continue
    const p = join(dir, n)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(ts|vue|js|mjs)$/.test(n)) out.push(p)
  }
  return out
}

/** Drop comments so a doc line mentioning a legacy route is not a call. */
export function stripComments(src: string): string {
  return src
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map(l => (/^\s*\/\//.test(l) ? '' : l.replace(/(^|[\s;,{}()])\/\/\s.*$/, '$1')))
    .join('\n')
}

/** Legacy /api/<x> paths in source: quoted literals, and `${base}/api…` concatenations. */
export function legacyApiPaths(src: string): string[] {
  const code = stripComments(src)
  const found: string[] = []
  for (const m of code.matchAll(/['"`](\/api\/[^'"`\s]*)/g)) {
    if (!ALLOWED.test(m[1])) found.push(m[1])
  }
  for (const m of code.matchAll(/\}(\/api(?:\/[^'"`\s]*)?)(?![\w-])/g)) {
    const p = m[1].endsWith('/') ? m[1] : `${m[1]}/`
    if (!ALLOWED.test(p)) found.push(m[1])
  }
  return found
}

describe('legacyApiPaths (the scanner itself)', () => {
  it('flags unversioned business paths and base concatenations, keeps the allowed prefixes', () => {
    const src = [
      "$api('/api/portfolio/')",
      'const base = `${apiBase}/api`',
      '$fetch(`${apiBase}/api/wallets/${id}/`)',
      "$api('/api/v1/portfolio/')",
      '$fetch(`${apiBase}/api/auth/me/`)',
      "$fetch('/api/market/quotes')",
      "$fetch('/api/predict/markets')",
      '// $api(\'/api/old/\') in a comment',
      '/* `/api/assets/` in a block comment */',
      "const u = 'https://api.binance.com/api/v3/klines'",
    ].join('\n')
    expect(legacyApiPaths(src)).toEqual(['/api/portfolio/', '/api', '/api/wallets/${id}/'])
  })
})

describe('frontend calls the versioned API only', () => {
  it('has no /api/<x> literal outside /api/v1|auth|market|predict (pending lanes listed)', () => {
    const offenders: string[] = []
    for (const d of DIRS) {
      for (const file of walk(join(ROOT, d))) {
        const rel = relative(ROOT, file)
        const allowed = PENDING[rel] ?? []
        for (const p of legacyApiPaths(readFileSync(file, 'utf8'))) {
          if (!allowed.includes(p)) offenders.push(`${rel}: ${p}`)
        }
      }
    }
    expect(offenders).toEqual([])
  })
})
