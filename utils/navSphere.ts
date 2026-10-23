/**
 * Pure geometry for the Lab nav icon (components/Navigation/Icons/LabSphereIcon.vue).
 *
 * The icon is real CSS 3-D: every agent dot is translated once to its place on
 * the globe and a single container spins. Nothing here runs per frame — these
 * helpers turn `SpherePoint`s (utils/navIcons → agentSphere) into static CSS.
 */
import type { AgentRunState, SpherePoint } from '~/utils/navIcons'

/** Globe radius as a fraction of the icon box, idle and when the tab is selected. */
export const GLOBE_RADIUS = 0.40
export const GLOBE_RADIUS_ACTIVE = 0.46
/** `.world` scale when active: the zoom is a transform, positions are never recomputed. */
export const ACTIVE_ZOOM = Math.round((GLOBE_RADIUS_ACTIVE / GLOBE_RADIUS) * 1000) / 1000
/** Camera distance (CSS `perspective`) in icon sizes. */
export const SPHERE_PERSPECTIVE = 3.5
/** Most dots drawn; beyond this the busiest / most urgent agents win. */
export const SPHERE_MAX_DOTS = 24
/** Breathing period (s) of running dots while the tab is active. */
export const SPHERE_BREATHE_S = 2.6

/** CSS colour per run state (design tokens with fallbacks). */
export const SPHERE_STATE_COLOR: Record<AgentRunState, string> = {
  running: 'var(--app-color-up, #00ff88)',
  waiting: 'var(--warning-orange, #ffa500)',
  error: 'var(--app-color-down, #ff4444)',
}

/** Rounds to 2 decimals and never prints "-0" (stable, byte-identical CSS strings). */
function round2(n: number): number {
  const r = Math.round(n * 100) / 100
  return r === 0 ? 0 : r
}

/** Idle globe radius in px for an icon of `size` px. */
export function globeRadius(size: number): number {
  return round2(size * GLOBE_RADIUS)
}

/** Dot diameter in px: (1.8 + 2.6 · point.size) at a 40 px icon, scaled with the icon. */
export function dotDiameter(pointSize: number, size: number): number {
  const s = Number.isFinite(pointSize) ? Math.max(0, Math.min(1, pointSize)) : 0.55
  return round2((1.8 + 2.6 * s) * (size / 40))
}

/** Unit-sphere point (y up, z toward viewer) → CSS translate3d (CSS y points down). */
export function sphereTranslate(p: Pick<SpherePoint, 'x' | 'y' | 'z'>, radius: number): string {
  return `translate3d(${round2(p.x * radius)}px, ${round2(-p.y * radius)}px, ${round2(p.z * radius)}px)`
}

const URGENCY: Record<AgentRunState, number> = { error: 0, waiting: 1, running: 2 }

/**
 * At most `max` points: errors first, then waiting, then running, busiest
 * (largest) first inside a state, id as the tie-break — so a crowded roster
 * never hides an agent that needs the founder.
 */
export function pickDots(points: readonly SpherePoint[], max = SPHERE_MAX_DOTS): SpherePoint[] {
  if (points.length <= max) return points.slice()
  return points
    .slice()
    .sort((a, b) => URGENCY[a.state] - URGENCY[b.state] || b.size - a.size || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .slice(0, max)
}

export interface SphereDot {
  id: string
  state: AgentRunState
  /** Static placement on the globe. */
  transform: string
  /** Diameter in px. */
  d: number
  color: string
  /** Negative delay (s) so running dots don't breathe in unison. */
  breatheDelay: number
}

/** Everything the template needs per dot, from the agent points and the icon size. */
export function sphereDots(points: readonly SpherePoint[], size: number, max = SPHERE_MAX_DOTS): SphereDot[] {
  const r = globeRadius(size)
  return pickDots(points, max).map((p, i) => ({
    id: p.id,
    state: p.state,
    transform: sphereTranslate(p, r),
    d: dotDiameter(p.size, size),
    color: SPHERE_STATE_COLOR[p.state],
    breatheDelay: round2(-((i * 0.61) % SPHERE_BREATHE_S)),
  }))
}

/** Restart key for the spinning subtree: changes only when the roster (ids) changes. */
export function rosterKey(points: readonly Pick<SpherePoint, 'id'>[]): string {
  return points.map(p => p.id).join('|')
}

/** Faint atmosphere colour around the globe: green if anyone runs, else orange if anyone waits. */
export function rimColor(running: number, waiting: number): string {
  if (running > 0) return 'var(--app-color-up, #00ff88)'
  if (waiting > 0) return 'var(--warning-orange, #ffa500)'
  return 'rgba(255, 255, 255, 0.35)'
}
