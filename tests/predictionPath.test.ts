import { describe, expect, it } from 'vitest'
import { dropStop, extendStops, pathPattern, splitStops, userStops } from '~/utils/predictionPath'

const H = 3_600_000

describe('prediction path', () => {
  const call = { predictedPrice: 110, targetTs: 10 * H, legs: [{ t: 4 * H, price: 90 }] }

  it('reads legs then the final target, in time order', () => {
    expect(userStops(call)).toEqual([{ t: 4 * H, price: 90 }, { t: 10 * H, price: 110 }])
  })

  it('accepts a point only when it is further right', () => {
    const stops = userStops(call)
    expect(extendStops(stops, { t: 12 * H, price: 120 }, H)).toEqual([...stops, { t: 12 * H, price: 120 }])
    expect(extendStops(stops, { t: 10 * H + H / 2, price: 130 }, H)).toBeNull()
    expect(extendStops(stops, { t: 10 * H, price: 110 }, 0)).toBeNull()
    expect(extendStops([], { t: 2 * H, price: 100 }, 0)).toEqual([{ t: 2 * H, price: 100 }])
  })

  it('drops a middle point and reconnects the path', () => {
    const stops = [
      { t: 2 * H, price: 80 },
      { t: 5 * H, price: 90 },
      { t: 9 * H, price: 120 },
    ]
    const left = dropStop(stops, 1)
    expect(left.map(s => s.t)).toEqual([2 * H, 9 * H])
    expect(splitStops(left)).toEqual({ legs: [{ t: 2 * H, price: 80 }], end: { t: 9 * H, price: 120 } })
    expect(dropStop(stops, 0).map(s => s.price)).toEqual([90, 120])
    expect(dropStop([{ t: 1, price: 1 }], 0)).toEqual([])
  })

  it('classifies a straight move, one reversal, and a longer path', () => {
    expect(pathPattern(100, [{ t: 1, price: 110 }])).toBe('up')
    expect(pathPattern(100, [{ t: 1, price: 90 }])).toBe('down')
    expect(pathPattern(100, [{ t: 1, price: 80 }, { t: 2, price: 120 }])).toBe('down-up')
    expect(pathPattern(100, [{ t: 1, price: 130 }, { t: 2, price: 90 }])).toBe('up-down')
    expect(pathPattern(100, [{ t: 1, price: 80 }, { t: 2, price: 120 }, { t: 3, price: 90 }])).toBe('mixed')
  })
})