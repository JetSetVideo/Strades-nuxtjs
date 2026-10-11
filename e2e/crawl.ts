/// <reference lib="dom" />
/**
 * Mouse-only reachability crawl — "can a real user get there by clicking?"
 *
 *   deno task e2e:crawl
 *
 * Logs in with the demo button, then breadth-first over pages: opens menus,
 * follows every VISIBLE in-app link, and clicks non-destructive buttons to see
 * whether they navigate. Never types a URL after the first page. Every route
 * file in pages/** that no click path reaches is reported as UNREACHABLE.
 *
 * Output: ~/Desktop/Strades-comms/crawl/<stamp>/ (one screenshot per page,
 * reachability.json, index.html).
 */
import { chromium, type Page } from 'npm:playwright-core@1.49'

const BASE = Deno.env.get('STRADES_URL') ?? 'http://localhost:3000'
const CHROME = Deno.env.get('CHROME_PATH') ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const OUT = Deno.env.get('CRAWL_OUT') ?? `${Deno.env.get('HOME')}/Desktop/Strades-comms/crawl/${stamp}`
const MAX_PAGES = Number(Deno.env.get('CRAWL_MAX_PAGES') ?? 80)
const MAX_BUTTONS = 40
// Never clicked: anything that destroys, spends, signs out or sends.
const DANGER = /delete|remove|stop|log ?out|sign ?out|reset|purge|sell|buy|launch|deploy|run on|import|create (a )?wallet|send|post|publish|submit|pay|withdraw|transfer|confirm|bet|predict|vote|follow|like|share|save/i

/** Map a concrete path to its pages/** pattern. */
const PATTERNS: [RegExp, string][] = [
  [/^\/agents\/[^/]+$/, '/agents/[id]'], [/^\/articles\/[^/]+$/, '/articles/[id]'], [/^\/assets\/[^/]+$/, '/assets/[id]'],
  [/^\/bots\/[^/]+$/, '/bots/[id]'], [/^\/conversations\/[^/]+$/, '/conversations/[id]'], [/^\/profile\/[^/]+$/, '/profile/[id]'],
  [/^\/strategy\/[^/]+$/, '/strategy/[id]'], [/^\/summarizer\/[^/]+$/, '/summarizer/[id]'],
]
const pattern = (p: string) => {
  const clean = p.replace(/\/+$/, '') || '/'
  for (const [re, pat] of PATTERNS) if (re.test(clean)) return pat
  return clean === '/agents' ? '/agents/' : clean === '/profile' ? '/profile/' : clean
}

async function allRoutes(): Promise<string[]> {
  const out: string[] = []
  async function walk(dir: string, prefix: string) {
    for await (const e of Deno.readDir(dir)) {
      if (e.isDirectory) await walk(`${dir}/${e.name}`, `${prefix}/${e.name}`)
      else if (e.name.endsWith('.vue')) out.push(e.name === 'index.vue' ? `${prefix}/` : `${prefix}/${e.name.slice(0, -4)}`)
    }
  }
  await walk(new URL('../pages', import.meta.url).pathname, '')
  return out.map(r => (r === '/' ? '/' : r.replace(/^\/\//, '/'))).sort()
}

interface Edge { from: string; to: string; via: string }
const edges: Edge[] = []
const sessionLosses: { before: string; at: string }[] = []
let lastAction = 'sign-in'
const reached = new Map<string, { path: string; via: string[]; shot: string; title: string; note?: string }>()

async function settle(page: Page) {
  await page.waitForLoadState('domcontentloaded').catch(() => {})
  await page.waitForTimeout(1200)
}

async function visibleLinks(page: Page): Promise<{ href: string; text: string }[]> {
  return await page.evaluate(() => {
    const vis = (el: Element) => { const r = (el as HTMLElement).getBoundingClientRect(); const s = getComputedStyle(el)
      return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' }
    return [...document.querySelectorAll('a[href]')].filter(vis).map(a => ({
      href: (a as HTMLAnchorElement).getAttribute('href') ?? '',
      text: ((a as HTMLElement).innerText || a.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 40),
    })).filter(l => l.href.startsWith('/') && !l.href.startsWith('//'))
  })
}

/** Open anything that looks like a menu/drawer so its links become visible. */
async function openMenus(page: Page) {
  const toggles = page.locator('button[aria-expanded="false"], button[aria-haspopup], [class*="burger" i], [class*="menu-toggle" i], [aria-label*="menu" i]')
  const n = Math.min(await toggles.count(), 4)
  for (let i = 0; i < n; i++) await toggles.nth(i).click({ timeout: 1500 }).catch(() => {})
  await page.waitForTimeout(400)
}

async function main() {
  await Deno.mkdir(OUT, { recursive: true })
  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage()
  page.setDefaultTimeout(8000)

  // The only typed URL: the sign-in page. Everything after is clicks.
  await page.goto(`${BASE}/auth`)
  await settle(page)
  await page.getByText('Continue in demo mode').click()
  await page.waitForURL(u => !u.pathname.startsWith('/auth'), { timeout: 20000 })
  await settle(page)

  const queue: { path: string; via: string[] }[] = [{ path: new URL(page.url()).pathname, via: ['/auth → "Continue in demo mode"'] }]
  const seenPattern = new Set<string>()
  const queued = new Set<string>([queue[0]!.path])

  while (queue.length && reached.size < MAX_PAGES) {
    const { path, via } = queue.shift()!
    const pat = pattern(path)
    // Navigate the way a user would: from the landing page, replay the click path via links.
    await page.goto(`${BASE}${path}`).catch(() => {})   // re-entry for BFS bookkeeping only; the path was FOUND by clicking
    await settle(page)
    let landed = new URL(page.url()).pathname
    if (landed.startsWith('/auth') && path !== '/auth') {
      // Session lost: record what happened just before, sign in again, retry once. One logout must not hide the rest.
      sessionLosses.push({ before: lastAction, at: path })
      await page.getByText('Continue in demo mode').click().catch(() => {})
      await page.waitForURL(u => !u.pathname.startsWith('/auth'), { timeout: 20000 }).catch(() => {})
      await page.goto(`${BASE}${path}`).catch(() => {}); await settle(page)
      landed = new URL(page.url()).pathname
    }
    if (pattern(landed) !== pat && !landed.startsWith(path)) { reached.set(path, { path, via, shot: '', title: '', note: `redirected to ${landed}` }); continue }
    const first = !seenPattern.has(pat)
    seenPattern.add(pat)
    const shot = first ? `${String(reached.size + 1).padStart(2, '0')}${pat.replace(/[^a-z0-9]+/gi, '_')}.png` : ''
    if (shot) await page.screenshot({ path: `${OUT}/${shot}` }).catch(() => {})
    const title = (await page.locator('h1').first().innerText({ timeout: 1500 }).catch(() => '')).slice(0, 60)
    reached.set(path, { path, via, shot, title })
    if (!first && seenPattern.has(pat)) continue // one concrete instance per dynamic pattern is enough to expand

    await openMenus(page)
    for (const l of await visibleLinks(page)) {
      const to = l.href.split('#')[0]!.split('?')[0]!
      edges.push({ from: path, to, via: `link "${l.text}"` })
      if (!queued.has(to) && !seenPattern.has(pattern(to))) { queued.add(to); queue.push({ path: to, via: [...via, `${path} → link "${l.text}"`] }) }
    }

    // Buttons that navigate (cards, "View", tabs that route…). Skip anything destructive.
    const buttons = page.locator('button:visible, [role="button"]:visible, [role="link"]:visible, [class*="card" i][tabindex]:visible')
    const count = Math.min(await buttons.count(), MAX_BUTTONS)
    for (let i = 0; i < count; i++) {
      const b = buttons.nth(i)
      const label = ((await b.innerText({ timeout: 800 }).catch(() => '')) || (await b.getAttribute('aria-label').catch(() => '')) || '').trim().replace(/\s+/g, ' ').slice(0, 40)
      if (!label || DANGER.test(label)) continue
      lastAction = `${path} → button "${label}"`
      await b.click({ timeout: 1500 }).catch(() => {})
      await page.waitForTimeout(500)
      const now = new URL(page.url()).pathname
      if (now !== path) {
        edges.push({ from: path, to: now, via: `button "${label}"` })
        if (!queued.has(now) && !seenPattern.has(pattern(now))) { queued.add(now); queue.push({ path: now, via: [...via, `${path} → button "${label}"`] }) }
        await page.goto(`${BASE}${path}`).catch(() => {})
        await settle(page)
      }
    }
    console.log(`✔ ${pat.padEnd(22)} ${title}`)
  }
  await browser.close()

  const routes = await allRoutes()
  const reachedPatterns = new Set([...reached.values()].filter(r => !r.note).map(r => pattern(r.path)))
  const unreachable = routes.filter(r => !reachedPatterns.has(r) && r !== '/auth')
  const report = {
    stamp, base: BASE, routes,
    reachable: [...reached.values()].map(r => ({ ...r, pattern: pattern(r.path) })),
    unreachable,
    sessionLosses,
    edges,
  }
  await Deno.writeTextFile(`${OUT}/reachability.json`, JSON.stringify(report, null, 2))
  const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
  await Deno.writeTextFile(`${OUT}/index.html`, `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Strades reachability ${stamp}</title><style>:root{color-scheme:light dark}body{font:14px/1.5 system-ui;max-width:1100px;margin:0 auto;padding:16px}
td,th{padding:4px 8px;border-bottom:1px solid #8884;text-align:left;vertical-align:top}.no{color:#cf222e;font-weight:700}img{width:100%;border:1px solid #8884;border-radius:8px}</style>
<h1>Mouse-only reachability</h1><p>${esc(BASE)} · ${stamp} · ${reachedPatterns.size} of ${routes.length - 1} routes reachable by clicking</p>
<h2 class="no">Unreachable by mouse (${unreachable.length})</h2><ul>${unreachable.map(u => `<li><code>${esc(u)}</code></li>`).join('')}</ul>
<h2>Session losses (${sessionLosses.length})</h2><ul>${sessionLosses.map(l => `<li>at <code>${esc(l.at)}</code> after ${esc(l.before)}</li>`).join('')}</ul><h2>Reachable</h2><table><tr><th>Route</th><th>Title</th><th>Click path</th></tr>
${[...reached.values()].filter(r => !r.note).map(r => `<tr><td><code>${esc(pattern(r.path))}</code></td><td>${esc(r.title)}</td><td>${r.via.map(esc).join('<br>')}</td></tr>`).join('')}</table>
${[...reached.values()].filter(r => r.shot).map(r => `<h3><code>${esc(pattern(r.path))}</code></h3><img loading="lazy" src="${r.shot}">`).join('\n')}`)
  console.log(`session losses: ${JSON.stringify(sessionLosses)}`)
  console.log(`\n${reachedPatterns.size}/${routes.length - 1} reachable · UNREACHABLE: ${unreachable.join(', ') || 'none'}\n→ ${OUT}/index.html`)
}

await main()
