import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { routeLabel } from '~/utils/routes'

const ROOT = fileURLToPath(new URL('../', import.meta.url))
const read = (file: string) => readFileSync(ROOT + file, 'utf8')

/**
 * definePageMeta is hoisted out of setup and cannot call routeLabel, so these pages keep a
 * literal title. It must equal the registry label (menu, search and title say the same).
 */
const PAGES: [file: string, path: string][] = [
  ['pages/strategies.vue', '/strategies'],
  ['pages/prices.vue', '/prices'],
  ['pages/CandleChart.vue', '/CandleChart'],
  ['pages/trade.vue', '/trade'],
  ['pages/chat.vue', '/chat'],
  ['pages/summarizer/[id].vue', '/summarizer/[id]'],
  ['pages/articles/[id].vue', '/articles/[id]'],
  ['pages/about.vue', '/about'],
]

describe('page titles = utils/routes.ts labels', () => {
  for (const [file, path] of PAGES) {
    it(`${file} → "${routeLabel(path)}"`, () => {
      const src = read(file)
      const m = src.match(/definePageMeta\(\{\s*title:\s*['"]([^'"]+)['"]/)
      expect(m, `${file} has a literal definePageMeta title`).not.toBeNull()
      expect(m![1]).toBe(routeLabel(path))
    })
  }
  it('the strategy page links to the Review page by its name', () => {
    const src = read('pages/strategy/[id].vue')
    expect(src).toContain(`≡ ${routeLabel('/summarizer/[id]')}</NuxtLink>`)
    expect(src).not.toContain('≡ Summary')
  })
})
