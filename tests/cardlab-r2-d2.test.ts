/**
 * Card lab ROUND 2 — lane d2: the size system is one table (utils/cardLabR2D2.ts) and D2List.vue's CSS says the same;
 * text budgets never lose words silently; the action row keeps the round-1 set; the card carries the judge's markers.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  cardLabR2D2Actions, cardLabR2D2Clip, cardLabR2D2Columns, cardLabR2D2Device, cardLabR2D2FlagCell, cardLabR2D2Size,
  cardLabR2D2Sizes,
} from '~/utils/cardLabR2D2'

const list = readFileSync('components/CardLab/R2/D2List.vue', 'utf8')
const card = readFileSync('components/CardLab/R2/D2Card.vue', 'utf8')

describe('cardLabR2D2Sizes — one size system per device class', () => {
  it('covers every viewport once, in order, with min ≤ max and one height', () => {
    expect(cardLabR2D2Sizes.map(s => s.device)).toEqual(['mobile', 'tablet', 'laptop', 'large'])
    for (let i = 1; i < cardLabR2D2Sizes.length; i++) expect(cardLabR2D2Sizes[i].from).toBe(cardLabR2D2Sizes[i - 1].to)
    for (const s of cardLabR2D2Sizes) {
      expect(s.min).toBeLessThanOrEqual(s.max)
      expect(s.height).toBeGreaterThan(400)
    }
  })
  it('classifies the 12 bench widths', () => {
    expect([360, 390, 599].map(cardLabR2D2Device)).toEqual(['mobile', 'mobile', 'mobile'])
    expect([600, 820, 1023].map(cardLabR2D2Device)).toEqual(['tablet', 'tablet', 'tablet'])
    expect([1024, 1280, 1439].map(cardLabR2D2Device)).toEqual(['laptop', 'laptop', 'laptop'])
    expect([1440, 1920, 2560].map(cardLabR2D2Device)).toEqual(['large', 'large', 'large'])
  })
  it('D2List.vue CSS mirrors the table (min, max, height per class; breakpoints 600 / 1024 / 1440)', () => {
    const mob = cardLabR2D2Size('mobile')
    expect(list).toContain(`--d2-min: ${mob.min}px; --d2-max: ${mob.max}px; --d2-h: ${mob.height}px;`)
    for (const d of ['tablet', 'laptop', 'large'] as const) {
      const s = cardLabR2D2Size(d)
      expect(list).toContain(`@media (min-width: ${s.from}px) { .d2-grid { --d2-min: ${s.min}px; --d2-max: ${s.max}px; --d2-h: ${s.height}px; } }`)
      expect(list).toMatch(new RegExp(`\\| ${d}\\s+\\|[^\\n]*\\| ${s.min} px\\s+\\| ${s.max} px\\s+\\| ${s.height} px`))
    }
  })
  it('auto-fill columns: same maths as CSS', () => {
    expect(cardLabR2D2Columns(762, 362)).toBe(2) // tablet 820
    expect(cardLabR2D2Columns(534, 362)).toBe(1) // tablet 600
    expect(cardLabR2D2Columns(944, 362)).toBe(2) // laptop 1024
    expect(cardLabR2D2Columns(1212, 362)).toBe(3) // laptop 1280
    expect(cardLabR2D2Columns(1357, 392)).toBe(3) // large 1440
    expect(cardLabR2D2Columns(1612, 392)).toBe(4) // large 1920 (page max width)
  })
})

describe('cardLabR2D2Clip — budget at a word, never silent', () => {
  it('keeps short text whole', () => {
    expect(cardLabR2D2Clip('Buys BTC dips.', 130)).toEqual({ text: 'Buys BTC dips.', cut: false })
  })
  it('cuts at a word boundary and marks the cut', () => {
    const r = cardLabR2D2Clip('alpha beta gamma delta epsilon', 18)
    expect(r.cut).toBe(true)
    expect(r.text).toBe('alpha beta gamma…')
  })
  it('the five catalog descriptions fit the card budget (130) untouched', () => {
    const catalog = JSON.parse(readFileSync('public/data/core/strategies.json', 'utf8')) as Array<Record<string, any>>
    for (const s of catalog.slice(0, 5)) expect(cardLabR2D2Clip(s.description, 130).cut).toBe(false)
  })
})

describe('cardLabR2D2Actions — round-1 action set kept', () => {
  it('sample: Use as template · View · Details', () => {
    const a = cardLabR2D2Actions({ sample: true, id: 'strategy_001', status: { key: 'active', label: 'Active', title: '' } })
    expect(a.map(x => x.key)).toEqual(['copy', 'view', 'details'])
    expect(a[0].primary).toBe(true)
  })
  it('own: Edit · View · Start/Pause/Resume · Share · Details', () => {
    const own = (k: 'active' | 'paused' | 'stopped') => cardLabR2D2Actions({ sample: false, id: 'x', status: { key: k, label: k, title: '' } })
    expect(own('stopped').map(x => x.key)).toEqual(['edit', 'view', 'toggle', 'share', 'details'])
    expect(own('active')[2].label).toBe('Pause')
    expect(own('paused')[2].label).toBe('Resume')
    expect(own('stopped')[2].label).toBe('Start')
    expect(cardLabR2D2Actions({ sample: false, id: '', status: { key: 'stopped', label: '', title: '' } }).map(x => x.key)).not.toContain('share')
  })
})

describe('cardLabR2D2FlagCell — ⚠ marker beside the number it qualifies', () => {
  it('maps every round-1 flag key', () => {
    expect(['win', 'win-loss', 'sample', 'sharpe-sign', 'sharpe-gap', 'annual', 'beta-pair'].map(key => cardLabR2D2FlagCell({ key })))
      .toEqual(['win', 'return', 'trades', 'sharpe', 'sharpe', 'annual', 'beta'])
  })
})

describe('D2Card.vue — judge markers and the in-card Details layer', () => {
  it('marks card, title, corner icon, actions and details', () => {
    for (const k of ['card', 'title', 'corner-icon', 'actions', 'details']) expect(card).toContain(`data-r2="${k}"`)
  })
  it('Details is an absolute layer inside the card, Esc closes it, the title keeps its full name', () => {
    expect(card).toMatch(/\.layer \{\s*position: absolute; inset: 0;/)
    expect(card).toContain("e.key === 'Escape'")
    expect(card).toContain(':title="m.name"')
    expect(card).toMatch(/-webkit-line-clamp: 2/)
  })
})
