/**
 * Card lab ROUND 2 — lane d3 (folded corner): the size system is one table that the list's CSS repeats; the grid maths
 * never puts a card above its class max-width; honesty flags keep a labelled chip + a marker on their metric; the action
 * plates are the round-1 set (samples 3, own strategy 5) in a fixed order.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  CARD_LAB_R2D3_SIZES, cardLabR2D3Class, cardLabR2D3CutPolygon, cardLabR2D3FlagChips, cardLabR2D3FlagTarget,
  cardLabR2D3Grid, cardLabR2D3Plates, cardLabR2D3Size,
} from '~/utils/cardLabR2D3'

describe('cardLabR2D3 size system', () => {
  it('maps viewport widths to the four device classes at their bounds', () => {
    expect([360, 390, 599].map(cardLabR2D3Class)).toEqual(['mobile', 'mobile', 'mobile'])
    expect([600, 820, 1023].map(cardLabR2D3Class)).toEqual(['tablet', 'tablet', 'tablet'])
    expect([1024, 1280, 1439].map(cardLabR2D3Class)).toEqual(['laptop', 'laptop', 'laptop'])
    expect([1440, 1920, 2560].map(cardLabR2D3Class)).toEqual(['large', 'large', 'large'])
  })

  it('has one height per class and sane min ≤ track ≤ max widths, a tile ≥ 32 px', () => {
    for (const s of CARD_LAB_R2D3_SIZES) {
      expect(s.h).toBeGreaterThan(400)
      expect(s.minW).toBeLessThanOrEqual(s.trackMin)
      expect(s.trackMin).toBeLessThan(s.maxW)
      expect(s.tile).toBeGreaterThanOrEqual(32)
    }
  })

  it('the list CSS repeats the table (heights, widths, tracks, tiles) in the same order', () => {
    const css = readFileSync('components/CardLab/R2/D3List.vue', 'utf8')
    const blocks = [...css.matchAll(/--d3-track: (\d+)px; --d3-minw: (\d+)px; --d3-maxw: (\d+)px; --d3-h: (\d+)px; --d3-tile: (\d+)px;/g)]
      .map(m => m.slice(1).map(Number))
    expect(blocks).toEqual(CARD_LAB_R2D3_SIZES.map(s => [s.trackMin, s.minW, s.maxW, s.h, s.tile]))
    for (const s of CARD_LAB_R2D3_SIZES) expect(css).toMatch(new RegExp(`${s.cls}\\s.*\\s${s.h}\\s`))
  })

  it('grid maths on the lab content boxes: columns as measured, never above the class max-width', () => {
    // content box widths measured on /test (vw → box): 360→312, 390→342, 599→548, 600→534, 820→747, 1023→943,
    // 1024→944, 1280→1198, 1439→1357, 1440→1358, 1920→1613, 2560→1613
    const cases: Array<[number, number, number]> = [
      [360, 312, 1], [390, 342, 1], [599, 548, 1], [600, 534, 1], [820, 747, 2], [1023, 943, 2],
      [1024, 944, 2], [1280, 1198, 3], [1439, 1357, 3], [1440, 1358, 3], [1920, 1613, 4], [2560, 1613, 4],
    ]
    for (const [vw, box, cols] of cases) {
      const g = cardLabR2D3Grid(box, vw)
      expect(g.columns, `vw ${vw}`).toBe(cols)
      expect(g.card).toBeLessThanOrEqual(cardLabR2D3Size(vw).maxW)
    }
    // a very wide box adds columns instead of stretching cards
    expect(cardLabR2D3Grid(2400, 2560).columns).toBe(6)
  })
})

describe('cardLabR2D3 honesty flags → chips', () => {
  it('targets the metric each flag qualifies', () => {
    expect(['win', 'win-loss', 'sample', 'sharpe-sign', 'sharpe-gap', 'annual', 'beta-pair', 'other'].map(cardLabR2D3FlagTarget))
      .toEqual(['win', 'win', 'trades', 'sharpe', 'sharpe', 'annual', 'beta', null])
  })

  it('leads a chip with its metric word unless the text already names it; keeps the long text', () => {
    const chips = cardLabR2D3FlagChips([
      { key: 'win-loss', short: 'won 72%, lost money', long: 'L1' },
      { key: 'sharpe-sign', short: 'Sharpe 0.42 yet annual −1.2%', long: 'L2' },
      { key: 'sample', short: 'thin sample', long: 'L3' },
      { key: 'beta-pair', short: 'beta 0.40 on a pair', long: 'L4' },
    ])
    expect(chips.map(c => c.text)).toEqual(['Win: won 72%, lost money', 'Sharpe 0.42 yet annual −1.2%', 'Trades: thin sample', 'beta 0.40 on a pair'])
    expect(chips.map(c => c.long)).toEqual(['L1', 'L2', 'L3', 'L4'])
  })
})

describe('cardLabR2D3 plates + corner', () => {
  it('samples: Use as template · View · Details', () => {
    expect(cardLabR2D3Plates(true, 'active').map(p => p.label)).toEqual(['⧉ Use as template', '→ View', 'Details'])
  })

  it('own strategy: Edit · View · Start/Pause/Resume · Share · Details', () => {
    expect(cardLabR2D3Plates(false, 'stopped').map(p => p.label)).toEqual(['✎ Edit', '→ View', 'Start', '⇪ Share', 'Details'])
    expect(cardLabR2D3Plates(false, 'active')[2].label).toBe('Pause')
    expect(cardLabR2D3Plates(false, 'paused')[2].label).toBe('Resume')
    for (const p of cardLabR2D3Plates(false, 'active')) expect(p.accent).toMatch(/^--[a-z-]+$/)
  })

  it('cuts only the top-right corner', () => {
    expect(cardLabR2D3CutPolygon(22.4)).toBe('polygon(0 0, calc(100% - 22px) 0, 100% 22px, 100% 100%, 0 100%)')
    expect(cardLabR2D3CutPolygon(-3)).toBe('polygon(0 0, calc(100% - 0px) 0, 100% 0px, 100% 100%, 0 100%)')
  })
})
