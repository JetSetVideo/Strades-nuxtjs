/**
 * Card lab ROUND 2 — FINAL (combine lane): the size system is one table (utils/cardLabR2Fin.ts) and FinList.vue's CSS says
 * the same; the action row keeps the round-1 set with ONE "Details" label; the crowd line never invents a 0; the card
 * carries the judge's markers, the filled leaf with its status and the in-card Details layer.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  cardLabR2FinActions, cardLabR2FinClip, cardLabR2FinColumns, cardLabR2FinCounts, cardLabR2FinDevice, cardLabR2FinFlagCell,
  cardLabR2FinSize, cardLabR2FinSizes,
} from '~/utils/cardLabR2Fin'

const list = readFileSync('components/CardLab/R2/FinList.vue', 'utf8')
const card = readFileSync('components/CardLab/R2/FinCard.vue', 'utf8')
const style = card.slice(card.indexOf('<style'))

describe('cardLabR2FinSizes — one size system per device class', () => {
  it('covers every viewport once, in order, with min ≤ max, one height and a leaf ≥ 48 px', () => {
    expect(cardLabR2FinSizes.map(s => s.device)).toEqual(['mobile', 'tablet', 'laptop', 'large'])
    for (let i = 1; i < cardLabR2FinSizes.length; i++) expect(cardLabR2FinSizes[i].from).toBe(cardLabR2FinSizes[i - 1].to)
    for (const s of cardLabR2FinSizes) {
      expect(s.min).toBeLessThanOrEqual(s.max)
      expect(s.height).toBeGreaterThan(400)
      expect(s.leaf).toBeGreaterThanOrEqual(48)
    }
  })
  it('classifies the 12 bench widths', () => {
    expect([360, 390, 599].map(cardLabR2FinDevice)).toEqual(['mobile', 'mobile', 'mobile'])
    expect([600, 820, 1023].map(cardLabR2FinDevice)).toEqual(['tablet', 'tablet', 'tablet'])
    expect([1024, 1280, 1439].map(cardLabR2FinDevice)).toEqual(['laptop', 'laptop', 'laptop'])
    expect([1440, 1920, 2560].map(cardLabR2FinDevice)).toEqual(['large', 'large', 'large'])
  })
  it('FinList.vue CSS and its header table mirror the size table', () => {
    const mob = cardLabR2FinSize('mobile')
    expect(list).toContain(`--fin-min: ${mob.min}px; --fin-max: ${mob.max}px; --fin-h: ${mob.height}px; --fin-leaf: ${mob.leaf}px;`)
    for (const d of ['tablet', 'laptop', 'large'] as const) {
      const s = cardLabR2FinSize(d)
      expect(list).toContain(`@media (min-width: ${s.from}px) { .fin-grid { --fin-min: ${s.min}px; --fin-max: ${s.max}px; --fin-h: ${s.height}px; --fin-leaf: ${s.leaf}px; } }`)
    }
    for (const s of cardLabR2FinSizes) {
      expect(list).toMatch(new RegExp(`\\| ${s.device}\\s+\\|[^\\n]*\\| ${s.min} px\\s+\\| ${s.max} px\\s+\\| ${s.height} px\\s+\\| ${s.leaf} px`))
    }
  })
  it('tablet keeps ONE column until two cards are each ≥ 300 px (no 261-px cards at 600, D1 defect)', () => {
    const t = cardLabR2FinSize('tablet')
    expect(t.min).toBeGreaterThanOrEqual(300)
    expect(cardLabR2FinColumns(552, t.min)).toBe(1) // 600 viewport
    expect(cardLabR2FinColumns(762, t.min)).toBe(2) // 820 viewport
  })
  it('auto-fill columns: same maths as CSS', () => {
    expect(cardLabR2FinColumns(944, 362)).toBe(2) // laptop 1024
    expect(cardLabR2FinColumns(1212, 362)).toBe(3) // laptop 1280
    expect(cardLabR2FinColumns(1357, 392)).toBe(3) // large 1440
    expect(cardLabR2FinColumns(1612, 392)).toBe(4) // large 1920 (page max width)
    expect(cardLabR2FinColumns(100, 362)).toBe(1)
  })
})

describe('cardLabR2FinClip — budget at a word, never silent', () => {
  it('keeps short text whole and cuts long text at a word with …', () => {
    expect(cardLabR2FinClip('Buys BTC dips.', 130)).toEqual({ text: 'Buys BTC dips.', cut: false })
    expect(cardLabR2FinClip('alpha beta gamma delta epsilon', 18)).toEqual({ text: 'alpha beta gamma…', cut: true })
  })
  it('the five catalog descriptions fit the card budget (130) untouched', () => {
    const catalog = JSON.parse(readFileSync('public/data/core/strategies.json', 'utf8')) as Array<Record<string, any>>
    for (const s of catalog.slice(0, 5)) expect(cardLabR2FinClip(s.description, 130).cut).toBe(false)
  })
})

describe('cardLabR2FinActions — round-1 set, one "Details" label, an accent edge per action', () => {
  const st = (key: 'active' | 'paused' | 'stopped') => ({ key, label: key, title: '' })
  it('sample: Use as template · View · Details', () => {
    const a = cardLabR2FinActions({ sample: true, id: 'strategy_001', status: st('active') })
    expect(a.map(x => x.key)).toEqual(['copy', 'view', 'details'])
    expect(a.map(x => x.accent)).toEqual(['go', 'nav', 'plain'])
    expect(a[0].primary).toBe(true)
  })
  it('own: Edit · View · Start/Pause/Resume · Share · Details (no Share without an id)', () => {
    const own = (k: 'active' | 'paused' | 'stopped') => cardLabR2FinActions({ sample: false, id: 'x', status: st(k) })
    expect(own('stopped').map(x => x.key)).toEqual(['edit', 'view', 'toggle', 'share', 'details'])
    expect(own('active')[2]).toMatchObject({ label: 'Pause', accent: 'warn' })
    expect(own('paused')[2]).toMatchObject({ label: 'Resume', accent: 'go' })
    expect(own('stopped')[2]).toMatchObject({ label: 'Start', accent: 'go' })
    expect(cardLabR2FinActions({ sample: false, id: '', status: st('stopped') }).map(x => x.key)).not.toContain('share')
  })
  it('every card says "Details" (never "More")', () => {
    for (const sample of [true, false]) {
      const labels = cardLabR2FinActions({ sample, id: 'x', status: st('paused') }).map(x => x.label)
      expect(labels).toContain('Details')
      expect(labels).not.toContain('More')
    }
  })
})

describe('cardLabR2FinCounts — the recovered crowd line', () => {
  it('followers · likes · comments with singular / plural words', () => {
    expect(cardLabR2FinCounts({ followers: 42, likes: 1, comments: 0 }).map(c => `${c.n} ${c.word}`))
      .toEqual(['42 followers', '1 like', '0 comments'])
  })
  it('a missing count stays null (shown "—"), never a default 0', () => {
    const c = cardLabR2FinCounts({ followers: null, likes: undefined as unknown as null, comments: Number.NaN })
    expect(c.map(x => x.n)).toEqual([null, null, null])
    expect(c[1].title).toMatch(/not recorded/)
  })
})

describe('cardLabR2FinFlagCell — ⚠ marker beside the number it qualifies', () => {
  it('maps every round-1 flag key', () => {
    expect(['win', 'win-loss', 'sample', 'sharpe-sign', 'sharpe-gap', 'annual', 'beta-pair'].map(key => cardLabR2FinFlagCell({ key })))
      .toEqual(['win', 'return', 'trades', 'sharpe', 'sharpe', 'annual', 'beta'])
  })
})

describe('FinCard.vue — markers, leaf, steel row, Details layer', () => {
  it('marks card, title, corner icon, actions and details', () => {
    for (const k of ['card', 'title', 'corner-icon', 'actions', 'details']) expect(card).toContain(`data-r2="${k}"`)
  })
  it('the leaf has two pointed corners (TR + BL), sits 4 px in from the corner and carries the status badge on its round rim', () => {
    expect(style).toMatch(/\.leaf \{[^}]*position: absolute; top: 4px; right: 4px;/)
    expect(style).toContain('border-radius: 80% 0 80% 0;')
    expect(card).toContain('<span class="dot" aria-hidden="true">')
    expect(style).toMatch(/\.dot \{\s*position: absolute; left: calc\(77% - 9px\); top: calc\(77% - 9px\);/)
    expect(style).toMatch(/\.fin \{[^}]*border-radius: var\(--fin-r\) 0 var\(--fin-r\) 0;/)
  })
  it('steel plates with an accent edge; no raw hex literal outside var() fallbacks', () => {
    expect(style).toContain('inset 0 3px 0 var(--fin-acc)')
    const noFallbacks = style.replace(/var\([^()]*(\([^()]*\))?[^()]*\)/g, '')
    expect(noFallbacks.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).toEqual([])
  })
  it('Details is an absolute layer inside the card, Esc closes it, the title keeps its full name', () => {
    expect(style).toMatch(/\.layer \{\s*position: absolute; inset: 0;/)
    expect(card).toContain("e.key === 'Escape'")
    expect(card).toContain(':title="m.name"')
    expect(style).toMatch(/-webkit-line-clamp: 2/)
  })
  it('the Sample chip never wraps and a never-run card prints one line instead of an empty box', () => {
    expect(style).toMatch(/\.chip :deep\(\.chip\) \{[^}]*white-space: nowrap;/)
    expect(card).toContain('No trades recorded yet')
    expect(card).toContain('Followers, likes, comments: not recorded')
    expect(card).not.toContain('empty-note')
  })
})
