/**
 * Plugged agents ↔ GET/PUT /api/v1/settings/plugs/ (backend apps/users/plugs_views.py).
 *
 * Before wave 4 "+ PLUG" on /agents changed a Pinia store only: no request, a reload undid it
 * (swarm audit 2026-10-30, trading P0 #5 / T15). These pure helpers map the store state to the
 * server payload (same rules as the server's clean_plugs, so a save is never refused for a shape
 * the UI could have fixed) and read the answer back defensively.
 */

export interface PlugRow { agent_id: string; weight: number; enabled: boolean }
export type PlugMode = 'advisory' | 'auto'
export interface PlugsPayload { plugs: PlugRow[]; mode: PlugMode }

/** Same limits as the server (plugs_views.py MAX_PLUGS / _ID). */
export const MAX_PLUGS = 50
export const PLUG_ID_RE = /^[A-Za-z0-9_.:-]{1,64}$/
/** Wait this long after the last change before saving (one PUT for a dragged weight slider). */
export const PLUG_SAVE_DEBOUNCE_MS = 600

const clampWeight = (v: unknown, fallback = 0.5): number => {
  const n = Number(v)
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : fallback
}

/** Store state → PUT body: valid ids only, first occurrence wins, weight 0–1, at most MAX_PLUGS. */
export function toPlugsPayload(plugs: readonly Partial<PlugRow>[], mode: unknown): PlugsPayload {
  const out: PlugRow[] = []
  const seen = new Set<string>()
  for (const p of plugs) {
    const id = typeof p?.agent_id === 'string' ? p.agent_id : ''
    if (!PLUG_ID_RE.test(id) || seen.has(id)) continue
    seen.add(id)
    out.push({ agent_id: id, weight: clampWeight(p.weight), enabled: p.enabled !== false })
    if (out.length >= MAX_PLUGS) break
  }
  return { plugs: out, mode: mode === 'auto' ? 'auto' : 'advisory' }
}

/**
 * Server answer → store state, or null when it is not a plugs payload (an error body handed back
 * instead of thrown, an HTML page, …) so the caller never mistakes a refusal for "saved".
 */
export function fromPlugsPayload(data: unknown): PlugsPayload | null {
  if (!data || typeof data !== 'object') return null
  const d = data as { plugs?: unknown; mode?: unknown }
  if (!Array.isArray(d.plugs)) return null
  if (d.mode !== undefined && d.mode !== 'advisory' && d.mode !== 'auto') return null
  return toPlugsPayload(d.plugs as Partial<PlugRow>[], d.mode)
}

/** Same plugs and mode (order-sensitive, weights compared to 1e-9). */
export function samePlugs(a: PlugsPayload, b: PlugsPayload): boolean {
  if (a.mode !== b.mode || a.plugs.length !== b.plugs.length) return false
  return a.plugs.every((p, i) => {
    const q = b.plugs[i]!
    return p.agent_id === q.agent_id && p.enabled === q.enabled && Math.abs(p.weight - q.weight) < 1e-9
  })
}

export type PlugSync = 'signed-out' | 'loading' | 'saving' | 'saved' | 'error'

/** One short line for the /agents and /agents/[id] status note ('' = nothing to say). */
export function plugSyncNote(sync: PlugSync, error = ''): string {
  switch (sync) {
    case 'signed-out': return 'Signed out: plugs stay in this tab only and are gone after a reload. Sign in to keep them.'
    case 'loading': return 'Loading your plugged agents…'
    case 'saving': return 'Saving…'
    case 'error': return error || "Couldn't save your plugged agents: the change was undone."
    default: return ''
  }
}

/** Message of a failed $fetch (server detail when there is one). */
export function plugsErrorOf(e: unknown, fallback: string): string {
  const detail = (e as { data?: { detail?: unknown } })?.data?.detail
  return typeof detail === 'string' && detail ? `${fallback} (${detail})` : fallback
}
