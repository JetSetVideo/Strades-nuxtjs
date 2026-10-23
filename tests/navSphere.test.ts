import { describe, expect, it } from 'vitest'
import { agentSphere, type SpherePoint } from '~/utils/navIcons'
import {
  ACTIVE_ZOOM, GLOBE_RADIUS, GLOBE_RADIUS_ACTIVE, SPHERE_BREATHE_S, SPHERE_STATE_COLOR,
  dotDiameter, globeRadius, pickDots, rimColor, rosterKey, sphereDots, sphereTranslate,
} from '~/utils/navSphere'

const pt = (id: string, state: SpherePoint['state'], size = 0.7, x = 0, y = 0, z = 1): SpherePoint =>
  ({ id, name: id, state, x, y, z, size, lat: 0, lon: 0 })

describe('globe geometry', () => {
  it('zooms from the idle to the active radius with a single scale', () => {
    expect(globeRadius(40)).toBe(16)
    expect(ACTIVE_ZOOM).toBe(1.15)
    expect(globeRadius(40) * ACTIVE_ZOOM).toBeCloseTo(40 * GLOBE_RADIUS_ACTIVE, 6)
    expect(globeRadius(32)).toBeCloseTo(32 * GLOBE_RADIUS, 6)
  })

  it('sizes dots as (1.8 + 2.6·size) px at 40 px and scales them with the icon', () => {
    expect(dotDiameter(1, 40)).toBe(4.4)
    expect(dotDiameter(0.55, 40)).toBe(3.23)
    expect(dotDiameter(1, 32)).toBe(3.52)
    expect(dotDiameter(1, 48)).toBe(5.28)
    expect(dotDiameter(5, 40)).toBe(4.4)
    expect(dotDiameter(-1, 40)).toBe(1.8)
    expect(dotDiameter(Number.NaN, 40)).toBe(3.23)
  })

  it('flips y for CSS, rounds to 0.01 px and never prints -0', () => {
    expect(sphereTranslate({ x: 0.5, y: 0.5, z: -0.25 }, 16)).toBe('translate3d(8px, -8px, -4px)')
    expect(sphereTranslate({ x: 1 / 3, y: -0, z: 0 }, 16)).toBe('translate3d(5.33px, 0px, 0px)')
    expect(sphereTranslate({ x: -1e-9, y: 1e-9, z: 0 }, 16)).toBe('translate3d(0px, 0px, 0px)')
  })
})

describe('pickDots', () => {
  it('keeps every point, in order, when under the cap', () => {
    const pts = [pt('a', 'running'), pt('b', 'waiting'), pt('c', 'error')]
    expect(pickDots(pts, 5).map(p => p.id)).toEqual(['a', 'b', 'c'])
  })

  it('over the cap keeps errors, then waiting, then the busiest running agents', () => {
    const pts = [
      pt('r-small', 'running', 0.55), pt('r-big', 'running', 1), pt('w', 'waiting', 0.55),
      pt('e', 'error', 0.55), pt('r-mid', 'running', 0.8),
    ]
    expect(pickDots(pts, 3).map(p => p.id)).toEqual(['e', 'w', 'r-big'])
    expect(pickDots(pts, 4).map(p => p.id)).toEqual(['e', 'w', 'r-big', 'r-mid'])
  })
})

describe('sphereDots', () => {
  const demo = agentSphere([
    ...Array.from({ length: 10 }, (_, i) => ({
      id: `live-${i}`, status: 'live', risk: i / 9, patience: (i * 37 % 10) / 10, contrarian: 0.5, trades: 10 + i * 20,
    })),
    { id: 'trainer', status: 'training', risk: 0.4, patience: 0.2, contrarian: 0.9, trades: 0 },
  ])

  it('draws the 11 demo agents as green running dots inside the globe', () => {
    const dots = sphereDots(demo, 40)
    expect(dots).toHaveLength(11)
    expect(dots.every(d => d.state === 'running' && d.color === SPHERE_STATE_COLOR.running)).toBe(true)
    for (const d of dots) {
      const [x = NaN, y = NaN, z = NaN] = d.transform.match(/-?[\d.]+(?=px)/g)!.map(Number)
      expect(Math.hypot(x, y, z)).toBeLessThanOrEqual(16.05)
      expect(d.d).toBeGreaterThanOrEqual(3.23)
      expect(d.d).toBeLessThanOrEqual(4.4)
      expect(d.breatheDelay).toBeLessThanOrEqual(0)
      expect(d.breatheDelay).toBeGreaterThan(-SPHERE_BREATHE_S)
    }
  })

  it('colours waiting orange and error red with distinct tokens', () => {
    const dots = sphereDots([pt('w', 'waiting'), pt('e', 'error'), pt('r', 'running')], 40)
    expect(dots.map(d => d.color)).toEqual([
      'var(--warning-orange, #ffa500)', 'var(--app-color-down, #ff4444)', 'var(--app-color-up, #00ff88)',
    ])
    expect(new Set(dots.map(d => d.color)).size).toBe(3)
  })

  it('is deterministic (same input → identical markup data)', () => {
    expect(sphereDots(demo, 32)).toEqual(sphereDots(demo, 32))
  })
})

describe('rosterKey / rimColor', () => {
  it('changes only when the set of ids changes', () => {
    expect(rosterKey([pt('a', 'running'), pt('b', 'waiting')])).toBe('a|b')
    expect(rosterKey([pt('a', 'error', 1, 1, 0, 0), pt('b', 'running')])).toBe('a|b')
    expect(rosterKey([])).toBe('')
  })

  it('tints the atmosphere green when anyone runs, orange when only waiting', () => {
    expect(rimColor(3, 1)).toContain('--app-color-up')
    expect(rimColor(0, 2)).toContain('--warning-orange')
    expect(rimColor(0, 0)).toMatch(/^rgba/)
  })
})
