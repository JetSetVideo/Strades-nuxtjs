import { computed, type Ref } from 'vue'

/**
 * Equirectangular projection — the simplest lat/lng → x/y mapping.
 *
 * It's not area-accurate but it's stable, fast, and matches a flat
 * grid background visually. Good enough for the in-app "where does
 * this asset live" view.
 */
export function useWorldProjection(width: Ref<number>, height: Ref<number>) {
  const project = (lat: number, lng: number): { x: number; y: number } => {
    // Clamp to valid ranges
    const lng_ = Math.max(-180, Math.min(180, lng))
    const lat_ = Math.max(-85, Math.min(85, lat))
    const x = ((lng_ + 180) / 360) * width.value
    const y = ((90 - lat_) / 180) * height.value
    return { x, y }
  }

  // Cubic-bezier curved path between two points — control point pulled up so
  // long routes arc above the equator instead of cutting flat across.
  const route = (from: { lat: number; lng: number }, to: { lat: number; lng: number }): string => {
    const a = project(from.lat, from.lng)
    const b = project(to.lat, to.lng)
    const mx = (a.x + b.x) / 2
    const my = (a.y + b.y) / 2
    // Arc height proportional to horizontal distance
    const dx = Math.abs(b.x - a.x)
    const lift = Math.min(120, dx * 0.18)
    const cx = mx
    const cy = my - lift
    return `M ${a.x.toFixed(1)} ${a.y.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`
  }

  return { project, route }
}
