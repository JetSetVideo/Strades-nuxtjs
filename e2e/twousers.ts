/// <reference lib="dom" />
/**
 * Two users, each with their own account and a PUBLIC Kalshi bot, each seeing the other's bot.
 *
 *   deno task e2e:twousers A      # user A (driven by Claude)
 *   deno task e2e:twousers B      # user B (driven by Hermes, in its own browser)
 *   deno task e2e:twousers both   # both users in two isolated browser contexts (automated proof)
 *
 * Mouse only after the sign-in page. Paper trading: real Kalshi prices, simulated fills.
 * A takes the 1st tradable market on /predict, B the 2nd, so the two bots differ.
 * Output: ~/Desktop/Strades-comms/twousers/<stamp>/<A|B>/NN-step.png + report.json
 */
import { chromium, type Browser, type Page } from 'npm:playwright-core@1.49'

const BASE = Deno.env.get('STRADES_URL') ?? 'http://localhost:3000'
const CHROME = Deno.env.get('CHROME_PATH') ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const ROOT = Deno.env.get('TWOUSERS_OUT') ?? `${Deno.env.get('HOME')}/Desktop/Strades-comms/twousers/${stamp}`
const WAIT_FOR_OTHER_MS = Number(Deno.env.get('WAIT_FOR_OTHER_MS') ?? 15 * 60_000)
const mode = (Deno.args[0] ?? 'both').toUpperCase()
/** prediction = Kalshi bot from /predict (needs K2); behaviour = bot from /trade (visibility proof). */
const KIND = (Deno.env.get('KIND') ?? 'prediction').toLowerCase()

type Role = 'A' | 'B'
interface Step { role: Role; n: number; title: string; ok: boolean; note: string; shot: string }
const steps: Step[] = []
const rand = () => crypto.getRandomValues(new Uint32Array(2)).join('')
/** Unique per run (or shared via env when A and B run in different processes / agents). */
const RUN_TAG = Deno.env.get('RUN_TAG') ?? stamp.slice(11, 19).replace(/-/g, '')
const label = (r: Role) => (r === 'A' ? 'claude-agent' : 'hermes-agent')

const counters: Record<Role, number> = { A: 0, B: 0 }
function stepper(page: Page, role: Role) {
  return async (title: string, fn: () => Promise<string | void>) => {
    const n = ++counters[role]
    let ok = true, note = ''
    try { note = (await fn()) ?? '' } catch (e) { ok = false; note = String((e as Error).message).split('\n')[0]! }
    await page.waitForTimeout(600)
    const shot = `${String(n).padStart(2, '0')}-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}.png`
    await page.screenshot({ path: `${ROOT}/${role}/${shot}` }).catch(() => {})
    steps.push({ role, n, title, ok, note, shot: `${role}/${shot}` })
    console.log(`${ok ? '✔' : '✘'} [${role}] ${String(n).padStart(2)} ${title}${note ? ' — ' + note : ''}`)
    if (!ok) throw new Error(`[${role}] ${title}: ${note}`)
  }
}

async function menu(page: Page, item: string) {
  await page.locator('.brand-btn').click()
  await page.locator('aside.drawer a', { has: page.locator('.item-label', { hasText: new RegExp(`^${item}$`) }) }).click()
}

/** Everything a user does up to their own public bot. Returns the bot's market title. */
async function setup(page: Page, role: Role): Promise<string> {
  const step = stepper(page, role)
  const email = `${label(role)}-${rand()}@example.test`
  const pw = `pw-${rand()}-Strades!`
  await step('Open sign-in', async () => { await page.goto(`${BASE}/auth`) })
  await step('Register', async () => {
    await page.getByText('Need an account? Register').click()
    await page.locator('input[placeholder="First name"]').fill(role === 'A' ? 'Claude' : 'Hermes').catch(() => {})
    await page.locator('input[placeholder="Last name"]').fill(`Agent ${RUN_TAG}`).catch(() => {})
    await page.locator('input[type=email]').fill(email)
    await page.locator('.pw-wrap input').fill(pw)
    await page.locator('button.primary-btn').click()
    await page.waitForURL(u => !u.pathname.startsWith('/auth'), { timeout: 20000 })
    return email
  })
  await step('Menu → Trade', async () => { await menu(page, 'Trade'); await page.waitForSelector('.trade') })
  await step('Create paper wallet (words blurred)', async () => {
    const wpw = `wpw-${rand()}-Strades!`
    await page.locator('.onb input').first().fill(`${label(role)} wallet`)
    const p = page.locator('.onb input[type=password]')
    await p.nth(0).fill(wpw); await p.nth(1).fill(wpw)
    await page.locator('.onb input[type=number]').fill('2000')
    await page.locator('.onb button.primary').click()
    await page.waitForSelector('.words li', { timeout: 20000 })
    await page.addStyleTag({ content: '.words li { filter: blur(6px) }' })
    const words = (await page.locator('.words li').allInnerTexts()).map(w => w.replace(/^\d+\s*/, '').trim())
    const labels = await page.locator('.confirm label').allInnerTexts()
    for (let i = 0; i < labels.length; i++) await page.locator('.confirm input').nth(i).fill(words[Number(labels[i]!.match(/#(\d+)/)![1]) - 1]!)
    await page.getByText("I've written them down").click()
    await page.waitForSelector('.stats')
    return 'paper wallet $2,000'
  })
  let title = ''
  if (KIND === 'behaviour') {
    await step('Launch PUBLIC behaviour bot (Trade)', async () => {
      await page.locator('.launch input[type=number]').fill('500')
      await page.locator('.launch .vis input').check()
      await page.locator('.launch button.primary').click()
      await page.waitForSelector('.bot', { timeout: 15000 })
      title = 'behaviour bot'
      return 'public, $500, random mix'
    })
  } else {
    await step('Menu → Predict', async () => { await menu(page, 'Predict'); await page.waitForSelector('.mkt', { timeout: 30000 }) })
    await step(`Pick the ${role === 'A' ? '1st' : '2nd'} tradable market`, async () => {
      const rows = page.locator('.mkt')
      const count = await rows.count()
      let seen = 0
      for (let i = 0; i < count; i++) {
        await rows.nth(i).locator('.mkt-main').click()
        await page.waitForTimeout(500)
        const ready = await rows.nth(i).locator('.bf .actions button:not([disabled])').count()
        if (ready) {
          if (seen === (role === 'A' ? 0 : 1)) {
            title = (await rows.nth(i).locator('.mkt-title').innerText()).replace(/\s+/g, ' ')
            return title
          }
          seen++
        }
        await rows.nth(i).locator('.mkt-main').click()
      }
      throw new Error('no tradable market (needs bid, ask and spread ≤ 10¢)')
    })
    await step('Launch PUBLIC bot', async () => {
      const form = page.locator('.mkt.open .bf')
      await form.locator('input[type=number]').nth(1).fill('500')
      await form.locator('input[value="public"]').check()
      await form.locator('.actions button').click()
      await page.waitForSelector('.ok[role=status]', { timeout: 20000 }).catch(async () => {
        throw new Error(await form.locator('.err').innerText().catch(() => 'no confirmation'))
      })
      return 'public, $500'
    })
  }
  if (KIND === 'prediction') {
    await step('Menu → Trade → check Kalshi (entry fill)', async () => {
      await menu(page, 'Trade'); await page.waitForSelector('.bot', { timeout: 20000 })
      await page.locator('.poll').click()
      await page.waitForFunction(() => [...document.querySelectorAll('.bot .pm')].some(e => /contracts @/.test(e.textContent ?? '')), null, { timeout: 30000 })
      const pm = await page.locator('.bot .pm').first().innerText()
      return pm.replace(/\s+/g, ' ').slice(0, 140)
    })
  }
  await step('Menu → Community (mine listed)', async () => {
    await menu(page, 'Community bots')
    await page.waitForSelector('.card.mine', { timeout: 20000 })
    return `${await page.locator('.card').count()} public bot(s)`
  })
  return title
}

/** Wait until a public bot that is NOT mine (i.e. the other user's) shows on /community. */
async function seeOther(page: Page, role: Role) {
  const step = stepper(page, role)
  await step("Other user's bot visible on Community", async () => {
    const t0 = Date.now()
    while (Date.now() - t0 < WAIT_FOR_OTHER_MS) {
      await page.locator('.refresh').click().catch(() => {})
      await page.waitForTimeout(3000)
      const others = page.locator('.card:not(.mine)')
      for (let i = 0; i < await others.count(); i++) {
        const owner = await others.nth(i).locator('.owner').innerText()
        // Only THIS run's other user counts (older runs left public bots behind).
        const other = role === 'A' ? 'hermes' : 'claude'
        if (owner.toLowerCase().includes(other) && owner.includes(RUN_TAG)) {
          return `${owner}: ${(await others.nth(i).locator('h3').innerText()).slice(0, 60)}`
        }
      }
    }
    throw new Error(`no bot from the other user within ${Math.round(WAIT_FOR_OTHER_MS / 60000)} min`)
  })
}

async function runRole(browser: Browser, role: Role) {
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage()
  page.setDefaultTimeout(20000)
  await setup(page, role)
  return page
}

await Deno.mkdir(`${ROOT}/A`, { recursive: true }); await Deno.mkdir(`${ROOT}/B`, { recursive: true })
const browser = await chromium.launch({ executablePath: CHROME, headless: true })
let failed = false
try {
  if (mode === 'BOTH') {
    const [a, b] = await Promise.all([runRole(browser, 'A'), runRole(browser, 'B')])
    await Promise.all([seeOther(a, 'A'), seeOther(b, 'B')])
  } else {
    const role = mode as Role
    const page = await runRole(browser, role)
    await seeOther(page, role)
  }
} catch (e) {
  failed = true
  console.error(String(e))
} finally {
  await browser.close()
  await Deno.writeTextFile(`${ROOT}/report.json`, JSON.stringify({ base: BASE, stamp, mode, steps }, null, 2))
  console.log(`\n${steps.filter(s => s.ok).length} ok · ${steps.filter(s => !s.ok).length} failed → ${ROOT}`)
}
if (failed) Deno.exit(1)
