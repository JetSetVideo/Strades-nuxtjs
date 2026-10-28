import { describe, expect, it } from 'vitest'
import {
  capitalShare, capitalTone, chainFrames, flagEmoji, foldColumn, formatCapital, globeAnchor, separatePins,
  lerp, linkPath, maxRailScroll, parsePartnerSlug, partnerSlug, placeCountry, toneWeight, usdPerUnit, wireframe,
} from '~/utils/supplyDesk'

const red = (fill: string) => Number(fill.match(/rgba\((\d+)/)?.[1])

describe('supply desk', () => {
  it('lerps halfway and clamps the ends', () => {
    expect(lerp(0, 10, 0.5)).toBe(5)
    expect(lerp(4, 10, 0)).toBe(4)
    expect(lerp(4, 10, 1)).toBe(10)
  })

  it('converts a US dollar capital with the live quote, then the demo book', () => {
    expect(formatCapital(4.2e9, 'USD', 1)).toBe('$4.2B')
    expect(formatCapital(4.2e9, 'EUR', 1.086)).toContain('3.9')
    expect(formatCapital(4.2e9, 'EUR', 1.086)).toContain('B')
    expect(formatCapital(0, 'USD', 1)).toBe('')
    expect(usdPerUnit('EUR', [{ symbol: 'EUR', current_price: 1.1 }])).toBe(1.1)
    expect(usdPerUnit('EUR', [])).toBe(1.086)
    expect(usdPerUnit('CNY', [])).toBe(0.139)
    expect(usdPerUnit('USD', [])).toBe(1)
    expect(usdPerUnit('GBP', [])).toBe(1)
  })

  it('paints the largest capitalisation the brightest gold', () => {
    const values = [4.2e9, 3.7e9, 0.21e9]
    const shares = values.map(v => capitalShare(v, values))
    const max = Math.max(...shares)
    expect(toneWeight(shares[0]!, max)).toBe(1)
    expect(toneWeight(shares[2]!, max)).toBeLessThan(0.1)
    expect(red(capitalTone(1).fill)).toBeGreaterThan(red(capitalTone(0.15).fill))
    expect(capitalTone(1).gold).toBe(1)
    expect(capitalTone(0).ink).toBe('#f4f6f8')
    expect(capitalTone(1).ink).toBe('#1a1404')
  })

  it('keeps supplier and client columns from overlapping, and stacks on a phone width', () => {
    const wide = chainFrames(554, 8, 5, 3)
    expect(wide.mode).toBe('columns')
    expect(wide.left).toHaveLength(8)
    expect(wide.left[0]!.x + wide.left[0]!.w).toBeLessThanOrEqual(wide.center.x)
    expect(wide.center.x + wide.center.w).toBeLessThanOrEqual(wide.right[0]!.x)
    expect(wide.peers).toHaveLength(3)
    expect(wide.peers[1]!.x).toBeGreaterThan(wide.peers[0]!.x)
    expect(wide.peers[0]!.y).toBe(wide.peers[2]!.y)
    expect(maxRailScroll(wide)).toBeGreaterThan(0)

    const phone = chainFrames(360, 2, 2, 2)
    expect(phone.mode).toBe('stack')
    expect(phone.left[0]!.w).toBeLessThan(360)
    expect(phone.left[0]!.x + phone.left[0]!.w).toBe(phone.center.x + phone.center.w)
    expect(phone.center.y).toBeGreaterThan(phone.left[1]!.y)
    expect(phone.right[0]!.y).toBeGreaterThan(phone.rail.y)
    expect(phone.peers[0]!.y).toBe(phone.peers[1]!.y)
  })

  it('draws a link that meets each card side at a right angle', () => {
    expect(linkPath(0, 10, 100, 40)).toBe('M0,10 C50,10 50,40 100,40')
    // A tall gap still leaves and arrives horizontally.
    expect(linkPath(0, 0, 40, 200)).toBe('M0,0 C20,0 20,200 40,200')
    // A shared side rail bows outward and still meets the edge flat.
    expect(linkPath(100, 10, 100, 90)).toBe('M100,10 C116,10 116,90 100,90')
  })

  it('folds a long column into the leaders plus a tail, and keeps a short one whole', () => {
    const values = [10, 40, 5, 30, 8, 50, 3, 20, 1]
    const fold = foldColumn(values, n => n)
    expect(fold.main.map(r => r.item)).toEqual([10, 40, 30, 50, 20])
    expect(fold.rest.map(r => r.item)).toEqual([5, 8, 3, 1])
    expect(fold.main.map(r => r.index)).toEqual([0, 1, 3, 5, 7])
    expect(foldColumn([1, 2, 3, 4, 5, 6], n => n).rest).toEqual([])
  })

  it('builds a stable route id for a supply partner', () => {
    expect(partnerSlug('AMZN', 'lego')).toBe('p-amzn-lego')
    expect(parsePartnerSlug('p-amzn-aws_netflix')).toEqual({ parentId: 'amzn', nodeId: 'aws_netflix' })
    expect(parsePartnerSlug('amzn')).toBeNull()
  })

  it('puts the view centre on the near side of the wireframe globe', () => {
    const pin = globeAnchor(12, 20, 20, 12, 100, 80, 40)
    expect(pin.depth).toBeCloseTo(1, 5)
    expect(pin.x).toBeCloseTo(100, 4)
    expect(pin.y).toBeCloseTo(80, 4)
    expect(globeAnchor(12, 20, 200, 12, 100, 80, 40).depth).toBeLessThan(0)
    const wire = wireframe(20, 12, 100, 80, 40)
    expect(wire.parallels.length).toBeGreaterThan(10)
    expect(wire.meridians.length).toBeGreaterThan(10)
  })

  it('reads a country from a headquarters line', () => {
    expect(placeCountry('Austin, Texas, USA')).toEqual({ code: 'US', name: 'United States' })
    expect(placeCountry('Cupertino, CA, USA')?.code).toBe('US')
    expect(flagEmoji('JP')).toBe('🇯🇵')
    expect(flagEmoji('Tesla')).toBe('')
  })

  it('spreads pins that would sit on the same city', () => {
    const pins = separatePins(
      [{ x: 100, y: 80, depth: 1 }, { x: 101, y: 80, depth: 1 }, { x: 10, y: 10, depth: -1 }],
      40, 100, 80, 90,
    )
    expect(Math.hypot(pins[0]!.x - pins[1]!.x, pins[0]!.y - pins[1]!.y)).toBeGreaterThan(36)
    expect(pins[2]).toEqual({ x: 10, y: 10 })
  })
})
