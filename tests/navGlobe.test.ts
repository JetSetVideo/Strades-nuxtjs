import { describe, expect, it } from 'vitest'
import { decodeLand, globeDots, parallelPath } from '~/utils/navGlobe'

/** base64 of raw bytes, the same way the generator packs the mask. */
const b64 = (...bytes: number[]) => btoa(String.fromCharCode(...bytes))

/** Every `M x y` of a dot path as [x, y]. */
const dots = (d: string) => [...d.matchAll(/M(-?[\d.]+) (-?[\d.]+)h0/g)].map(m => [Number(m[1]), Number(m[2])] as const)

describe('decodeLand', () => {
  it('reads bits row-major, north to south, west to east, MSB first', () => {
    // 4 × 2 grid of 90° cells: lon centres -135 -45 45 135, lat centres 45 -45.
    // 0b1000_0010 → cell 0 (row 0, col 0) and cell 6 (row 1, col 2).
    const p = decodeLand(b64(0b1000_0010), 4, 2, 90)
    expect(Array.from(p)).toEqual([-135, 45, 45, -45])
  })

  it('returns one lon/lat pair per set bit and ignores padding past cols × rows', () => {
    const p = decodeLand(b64(0xff, 0xff), 4, 3, 30) // 12 cells, 16 bits all set
    expect(p.length).toBe(24)
    expect(p[0]).toBe(-165)
    expect(p[1]).toBe(75)
    expect(decodeLand(b64(0, 0), 4, 3, 30).length).toBe(0)
  })
})

describe('globeDots', () => {
  const R = 9.5, CX = 12, CY = 12

  it('puts the point at the view centre in front, at (cx, cy)', () => {
    const g = globeDots(Float32Array.from([30, 18]), 30, 18, R, CX, CY)
    expect(g.front).toBe('M12 12h0')
    expect(g.mid).toBe('')
    expect(g.rim).toBe('')
  })

  it('drops a point on the far side of the globe', () => {
    const g = globeDots(Float32Array.from([-150, -18]), 30, 18, R, CX, CY)
    expect(g.front + g.mid + g.rim).toBe('')
  })

  it('buckets by depth: 70° from centre is mid, 85° is rim', () => {
    expect(globeDots(Float32Array.from([70, 0]), 0, 0, R, CX, CY).mid).not.toBe('')
    expect(globeDots(Float32Array.from([85, 0]), 0, 0, R, CX, CY).rim).not.toBe('')
  })

  it('keeps every dot inside the globe radius and shows about half the sphere', () => {
    const all = decodeLand(b64(...Array(Math.ceil((90 * 45) / 8)).fill(0xff)), 90, 45, 4)
    const g = globeDots(all, -73.5, 18, R, CX, CY)
    const pts = [...dots(g.front), ...dots(g.mid), ...dots(g.rim)]
    for (const [x, y] of pts) expect(Math.hypot(x - CX, y - CY)).toBeLessThanOrEqual(R + 0.01)
    expect(pts.length / (all.length / 2)).toBeGreaterThan(0.4)
    expect(pts.length / (all.length / 2)).toBeLessThan(0.6)
  })

  it('rounds coordinates to 2 decimals', () => {
    const g = globeDots(Float32Array.from([10, 10]), 0, 18, R, CX, CY)
    for (const [x, y] of dots(g.front)) {
      expect(Math.round(x * 100) / 100).toBe(x)
      expect(Math.round(y * 100) / 100).toBe(y)
    }
  })
})

describe('parallelPath', () => {
  it('draws the near half of the equator from limb to limb, below the centre when tilted', () => {
    const d = parallelPath(0, 18, 9.5, 12, 12)
    expect(d.startsWith('M2.5 12L')).toBe(true)
    expect(d.endsWith('L21.5 12')).toBe(true)
    const mid = [...d.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map(m => Number(m[2]))
    expect(Math.max(...mid)).toBeGreaterThan(12)
  })
})
