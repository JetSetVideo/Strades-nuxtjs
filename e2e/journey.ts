/// <reference lib="dom" />
/**
 * Visual end-to-end journey — a screenshot after EVERY user action.
 *
 *   deno task e2e:journey            # both paths
 *   deno task e2e:journey create     # demo account → create wallet
 *   deno task e2e:journey import     # register → import 12 words
 *
 * Drives the real UI in system Chrome (playwright-core, no bundled browser).
 * Mouse only: the sign-in page is the only URL typed; every other screen is reached
 * through the STRADES menu button or on-page buttons, like a real user.
 * Output: ~/Desktop/Strades-comms/journey/<stamp>/  (NN-step.png + index.html + report.json)
 *
 * Secrets: generated passwords live only in this process; a freshly created
 * wallet's 12 words are read from the DOM to answer the confirmation, and are
 * BLURRED before that screenshot is taken. The import path uses the public
 * BIP39 test vector, which holds nothing.
 *
 * Env: STRADES_URL (default http://localhost:3000), CHROME_PATH, JOURNEY_OUT.
 */
import { chromium, type Page } from 'npm:playwright-core@1.49'

const BASE = Deno.env.get('STRADES_URL') ?? 'http://localhost:3000'
const CHROME = Deno.env.get('CHROME_PATH') ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const OUT = Deno.env.get('JOURNEY_OUT') ?? `${Deno.env.get('HOME')}/Desktop/Strades-comms/journey/${stamp}`
const which = Deno.args[0] ?? 'both'
const TEST_VECTOR = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const TEST_ADDRESS = '0x9858EfFD232B4033E47d90003D41EC34EcaEda94'

type Status = 'pass' | 'fail' | 'gap'
interface Step { n: number; path: string; title: string; status: Status; url: string; shot: string; notes: string[]; ms: number }
const steps: Step[] = []
let n = 0

const rand = () => crypto.getRandomValues(new Uint32Array(2)).join('')
const secret = () => `pw-${rand()}-Strades!`

const broken = new Set<string>()

async function step(page: Page, path: string, title: string, act: () => Promise<string[] | void>, gap = false) {
  // After a real failure the rest of the path would only cascade; report it once and stop.
  if (broken.has(path)) return false
  n++
  const t0 = performance.now()
  const notes: string[] = []
  let status: Status = gap ? 'gap' : 'pass'
  try {
    const r = await act()
    if (r) notes.push(...r)
    await page.waitForTimeout(700)
  } catch (e) {
    status = gap ? 'gap' : 'fail'  // a known missing feature is reported, not counted as a regression
    notes.push(String((e as Error).message ?? e).split('\n')[0]!)
  }
  const shot = `${String(n).padStart(2, '0')}-${path}-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}.png`
  await page.screenshot({ path: `${OUT}/${shot}`, fullPage: false }).catch(() => {})
  if (status === 'fail') broken.add(path)
  steps.push({ n, path, title, status, url: page.url().replace(BASE, ''), shot, notes, ms: Math.round(performance.now() - t0) })
  console.log(`${status === 'pass' ? '✔' : status === 'gap' ? '◌' : '✘'} ${String(n).padStart(2)} [${path}] ${title}${notes.length ? ' — ' + notes.join(' · ') : ''}`)
  return status !== 'fail'
}

const expect = (cond: boolean, msg: string) => { if (!cond) throw new Error(msg) }
const text = (page: Page, sel: string) => page.locator(sel).first().innerText({ timeout: 8000 })

/** Mouse only: STRADES menu button → drawer item (no typed URLs after the sign-in page). */
async function openFromMenu(page: Page, label: string) {
  await page.locator('.brand-btn').click()
  await page.locator('aside.drawer a', { has: page.locator('.item-label', { hasText: new RegExp(`^${label}$`) }) }).click()
}

async function openTrade(page: Page) {
  await openFromMenu(page, 'Trade')
  await page.waitForSelector('.trade', { timeout: 20000 })
  await page.waitForTimeout(2500)
}

/** Shared tail: balance → creator → backtest → deploy → bot → replay → stop → ledger. */
async function tradeAndStrategy(page: Page, path: string, expectedCash: string) {
  await step(page, path, 'Balance shown', async () => {
    const stats = await text(page, '.stats')
    expect(stats.includes(expectedCash), `expected free cash ${expectedCash}, saw: ${stats.replace(/\s+/g, ' ').slice(0, 120)}`)
    return [`free cash ${expectedCash}`]
  })

  // ── Strategy creator ──────────────────────────────────────────────
  await step(page, path, 'Open strategy creator (menu)', async () => {
    await openFromMenu(page, 'Strategy Creator')
    await page.waitForSelector('.creator-page', { timeout: 20000 })
    await page.waitForTimeout(2000)
  })
  await step(page, path, 'Name the strategy', async () => {
    await page.getByPlaceholder('e.g. BTC → ETH RSI Rebalancer').fill(`Journey ${path} momentum`)
    await page.getByPlaceholder('Describe the logic and goal of this strategy…').fill('Buy BTC on strength, rotate to ETH; stop 5%, take profit 15%.')
  })
  await step(page, path, 'Pick source asset (BTC)', async () => {
    await page.locator('.asset-sel').nth(0).locator('.trigger').click()
    await page.locator('.asset-sel').nth(0).locator('.search-input').fill('BTC')
    await page.locator('.asset-sel').nth(0).locator('.asset-item').first().click()
  })
  await step(page, path, 'Pick target asset (ETH)', async () => {
    await page.locator('.asset-sel').nth(1).locator('.trigger').click()
    await page.locator('.asset-sel').nth(1).locator('.search-input').fill('ETH')
    await page.locator('.asset-sel').nth(1).locator('.asset-item').first().click()
  })
  await step(page, path, 'Pick a data source', async () => {
    await page.locator('.ds-card').first().click()
  })
  await step(page, path, 'Add IF rule: price > 50,000', async () => {
    await page.locator('.add-block-btn.cond-btn').click()
    const value = page.locator('.block-card.condition .num-input:not(.small)').first()
    await value.fill('50000')
    return ['entry rule added (BTC trades ~83k, so it fires)']
  })
  const backtested = await step(page, path, 'Click Backtest', async () => {
    await page.locator('.cta-btn.backtest').click()
    const err = await page.locator('.action-error, .error').first().innerText({ timeout: 1500 }).catch(() => '')
    if (err) throw new Error(`creator refused: ${err}`)
  })
  if (backtested) {
    await step(page, path, 'Backtest result', async () => {
      await page.waitForURL(/\/strategy\//, { timeout: 60000 })
      await page.waitForTimeout(3000)
      const real = page.locator('.real-bt')
      expect(await real.count() > 0, 'no "Backtest on real prices" panel (strategy not saved server-side?)')
      const kpis = (await real.locator('.real-kpis').innerText()).replace(/\s+/g, ' ')
      const verdict = (await real.locator('.real-verdict').innerText()).replace(/\s+/g, ' ')
      return [kpis.slice(0, 170), verdict.slice(0, 120)]
    })
  }
  await step(page, path, 'Run strategy on this wallet', async () => {
    await page.locator('.deploy-card input[type=number]').fill('1000')
    await page.locator('.deploy-card .deploy-btn').click()
    const err = await page.locator('.deploy-err').innerText({ timeout: 2500 }).catch(() => '')
    if (err) throw new Error(`launch refused: ${err}`)
    await page.waitForURL(/\/trade/, { timeout: 15000 })
    await page.waitForSelector('.bot', { timeout: 15000 })
    const names = await page.locator('.bot h4').allInnerTexts()
    expect(names.some(n => n.startsWith('Journey')), `no bot running the strategy (cards: ${names.join(', ')})`)
    return [`bot running "${names.find(n => n.startsWith('Journey'))}"`]
  })

  // ── Trading agents on the wallet ──────────────────────────────────
  await step(page, path, 'Launch bot (random mix)', async () => {
    await page.locator('.launch input[type=number]').fill('1000')
    await page.locator('.launch button.primary').click()
    await page.waitForSelector('.bot', { timeout: 15000 })
  })
  await step(page, path, 'Launch bot (own mix)', async () => {
    await page.getByText('My own mix').click()
    await page.locator('.launch input[type=number]').fill('1000')
    await page.locator('.launch button.primary').click()
    await page.waitForFunction(() => document.querySelectorAll('.bot').length >= 3, null, { timeout: 15000 })
  })
  await step(page, path, 'Replay 200 hours of real prices', async () => {
    await page.getByText('+200').click()
    // Wait for the step AND the page's own refresh to finish, instead of a fixed
    // delay. The step duration scales with how many bots the shared session holds
    // (measured 12.2s for {n:200} with accumulated bots, 0.02s after a reset), so a
    // fixed wait is wrong by construction. The replay button is disabled while
    // `stepping` is true, and `stepping` only clears AFTER refresh() resolves — so
    // waiting for it to re-enable covers both the step and the refetch.
    await page.waitForFunction(
      () => !!document.querySelector('.replay button:not([disabled])'),
      null, { timeout: 60000 }).catch(() => {})
    await page.waitForTimeout(1000)
    const pnl = await page.locator('.bot .pnl').allInnerTexts()
    return [`bot P&L: ${pnl.map(s => s.replace(/\s+/g, ' ')).join(' | ')}`]
  })
  await step(page, path, 'Bot vs buy & hold', async () => {
    // Belt and braces: also allow the page's 5s poll to land before judging.
    await page.waitForFunction(
      () => document.querySelectorAll('.bot .warm').length === 0,
      null, { timeout: 30000 }).catch(() => {})
    const waiting = await page.locator('.bot .warm').count()
    expect(waiting === 0, `${waiting} bot(s) processed 0 bars: the replay clock isn't advancing (engine window exhausted?)`)
    const bench = await page.locator('.bot .bench').allInnerTexts()
    expect(bench.length > 0, 'no benchmark line on bot cards')
    return [bench[0]!.replace(/\s+/g, ' ').slice(0, 110)]
  })
  await step(page, path, 'Stop bots, funds return', async () => {
    for (let i = 0; i < 6; i++) {
      const b = page.locator('.bot .stop:not([disabled])').first()
      if (!(await b.count())) break
      await b.click()
      await page.waitForTimeout(800)
    }
    // Wait for the wallet panel to reflect every release (each stop refreshes it asynchronously).
    await page.waitForFunction(() => {
      const s = document.querySelector('.stats')?.textContent ?? ''
      return !document.querySelector('.bot .stop') && /In bots\s*\$0\.00/.test(s)
    }, null, { timeout: 20000 })
    const stats = await text(page, '.stats')
    return [stats.replace(/\s+/g, ' ').slice(0, 140)]
  })
  await step(page, path, 'Ledger reconciles', async () => {
    await page.locator('.ledger').scrollIntoViewIfNeeded()
    const rows = await page.locator('.ledger tbody tr').allInnerTexts()
    expect(rows.length >= 5, `ledger has ${rows.length} rows`)
    return [`${rows.length} ledger rows`]
  })
}

async function pathCreate(page: Page) {
  const P = 'create'
  await step(page, P, 'Open sign-in', async () => { await page.goto(`${BASE}/auth`, { waitUntil: 'domcontentloaded' }) })
  await step(page, P, 'Continue in demo mode', async () => {
    await page.getByText('Continue in demo mode').click()
    await page.waitForURL(u => !u.pathname.startsWith('/auth'), { timeout: 20000 })
  })
  await step(page, P, 'Open Trade (menu)', async () => { await openTrade(page) })
  await step(page, P, 'Demo is create-only', async () => {
    expect(await page.getByText('Import a recovery phrase').count() === 0, 'import tab visible to a demo account')
    return [await text(page, '.demo-banner').catch(() => 'no banner')]
  })
  const pass = secret()
  await step(page, P, 'Fill new-wallet form', async () => {
    await page.locator('.onb input').first().fill('Journey paper wallet')
    const pw = page.locator('.onb input[type=password]')
    await pw.nth(0).fill(pass); await pw.nth(1).fill(pass)
    await page.locator('.onb input[type=number]').fill('10000')
  })
  await step(page, P, 'Create wallet → 12 words shown (blurred here)', async () => {
    await page.locator('.onb button.primary').click()
    await page.waitForSelector('.words li', { timeout: 20000 })
    const count = await page.locator('.words li').count()
    expect(count === 12, `expected 12 words, got ${count}`)
    await page.addStyleTag({ content: '.words li { filter: blur(6px) }' })
    return ['12 words displayed once (screenshot blurred on purpose)']
  })
  await step(page, P, 'Confirm 3 words', async () => {
    const words = (await page.locator('.words li').allInnerTexts()).map(w => w.replace(/^\d+\s*/, '').trim())
    const labels = await page.locator('.confirm label').allInnerTexts()
    for (let i = 0; i < labels.length; i++) {
      const pos = Number(labels[i]!.match(/#(\d+)/)![1]) - 1
      await page.locator('.confirm input').nth(i).fill(words[pos]!)
    }
  })
  await step(page, P, 'Finish → wallet ready', async () => {
    await page.getByText("I've written them down").click()
    await page.waitForSelector('.stats', { timeout: 15000 })
    expect(await page.locator('.words').count() === 0, 'words still in the DOM after confirmation')
  })
  await tradeAndStrategy(page, P, '$10,000.00')
}

async function pathImport(page: Page) {
  const P = 'import'
  const email = `journey-${rand()}@example.test`
  const pass = secret()
  await step(page, P, 'Open sign-in', async () => { await page.goto(`${BASE}/auth`, { waitUntil: 'domcontentloaded' }) })
  await step(page, P, 'Switch to Register', async () => { await page.getByText('Need an account? Register').click() })
  await step(page, P, 'Fill registration', async () => {
    await page.locator('input[type=email]').fill(email)
    await page.locator('.pw-wrap input').fill(pass)
  })
  await step(page, P, 'Create account', async () => {
    await page.locator('button.primary-btn').click()
    await page.waitForURL(u => !u.pathname.startsWith('/auth'), { timeout: 20000 })
  })
  await step(page, P, 'Open Trade (menu)', async () => { await openTrade(page) })
  await step(page, P, 'Choose "Import a recovery phrase"', async () => { await page.getByText('Import a recovery phrase').click() })
  const wpass = secret()
  await step(page, P, 'Enter 12 words + passphrase', async () => {
    await page.locator('.onb input').first().fill('Imported test wallet')
    await page.locator('.onb textarea').fill(TEST_VECTOR)
    const pw = page.locator('.onb input[type=password]')
    await pw.nth(0).fill(wpass); await pw.nth(1).fill(wpass)
    await page.locator('.onb input[type=number]').fill('5000')
    return ['public BIP39 test vector (holds nothing)']
  })
  await step(page, P, 'Import → address derived', async () => {
    await page.locator('.onb button.primary').click()
    await page.waitForSelector('.stats', { timeout: 20000 })
    const stats = await text(page, '.stats')
    expect(stats.includes(TEST_ADDRESS), 'derived address does not match the test vector')
    expect(await page.locator('.onb textarea').count() === 0, 'phrase field still on screen')
    return [`address ${TEST_ADDRESS}`]
  })
  await tradeAndStrategy(page, P, '$5,000.00')
}

await Deno.mkdir(OUT, { recursive: true })
const browser = await chromium.launch({ executablePath: CHROME, headless: true })
for (const p of which === 'both' ? ['create', 'import'] : [which]) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await ctx.newPage()
  page.setDefaultTimeout(15000)
  page.on('pageerror', e => steps.length && steps.at(-1)!.notes.push(`pageerror: ${e.message}`))
  await (p === 'create' ? pathCreate(page) : pathImport(page))
  await ctx.close()
}
await browser.close()

// ── Report ───────────────────────────────────────────────────────────
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
const count = (s: Status) => steps.filter(x => x.status === s).length
await Deno.writeTextFile(`${OUT}/report.json`, JSON.stringify({ base: BASE, stamp, steps }, null, 2))
await Deno.writeTextFile(`${OUT}/index.html`, `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Strades journey ${stamp}</title>
<style>:root{color-scheme:light dark}body{font:14px/1.5 system-ui;margin:0 auto;max-width:1100px;padding:16px}
.s{border:1px solid #8884;border-radius:10px;margin:14px 0;overflow:hidden}.h{padding:8px 12px;display:flex;gap:10px;align-items:baseline}
.pass .h{background:#1a7f3722}.fail .h{background:#cf222e22}.gap .h{background:#bf870022}img{width:100%;display:block}
code{font-size:12px}.n{font-weight:700}</style>
<h1>Strades — visual journey</h1>
<p>${esc(BASE)} · ${stamp} · <b>${count('pass')} pass</b> · <b>${count('fail')} fail</b> · <b>${count('gap')} gap</b></p>
${steps.map(s => `<section class="s ${s.status}"><div class="h"><span class="n">${s.n}</span><b>[${s.path}] ${esc(s.title)}</b>
<span>${s.status.toUpperCase()}</span><code>${esc(s.url)}</code><span>${s.ms} ms</span></div>
${s.notes.length ? `<div class="h">${s.notes.map(esc).join('<br>')}</div>` : ''}<img loading="lazy" src="${s.shot}" alt="${esc(s.title)}"></section>`).join('\n')}`)
console.log(`\n${count('pass')} pass · ${count('fail')} fail · ${count('gap')} gap → ${OUT}/index.html`)
if (count('fail')) Deno.exit(1)
