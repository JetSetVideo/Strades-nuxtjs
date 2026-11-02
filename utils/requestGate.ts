/**
 * Small pure helpers that stop the client from asking the same thing twice.
 * Used by stores/assets.ts, pages/community.vue and plugins/predictionsSync.client.ts.
 */

/** True when something fetched at `at` (ms epoch) is younger than `maxAgeMs`. */
export function isFreshAt(at: number | null | undefined, now: number, maxAgeMs: number): boolean {
  return typeof at === 'number' && at > 0 && now - at >= 0 && now - at < maxAgeMs
}

/**
 * Single-flight: while a call for `key` is running, every caller gets the same promise.
 * The slot frees itself when the call settles (success or failure).
 */
export function createSingleFlight<T>() {
  const running = new Map<string, Promise<T>>()
  return {
    run(key: string, fn: () => Promise<T>): Promise<T> {
      const existing = running.get(key)
      if (existing) return existing
      const p = fn().finally(() => { if (running.get(key) === p) running.delete(key) })
      running.set(key, p)
      return p
    },
    pending(key?: string): boolean {
      return key === undefined ? running.size > 0 : running.has(key)
    },
  }
}

/** A poll tick should fetch only when the tab is visible, nothing is loading and the last load is old enough. */
export function pollDue(o: { lastAt: number; now: number; everyMs: number; hidden: boolean; busy?: boolean }): boolean {
  if (o.hidden || o.busy) return false
  return !o.lastAt || o.now - o.lastAt >= o.everyMs
}

/** What the last predictions pull saw (persisted in localStorage). */
export interface PullMark {
  /** ms epoch of the last successful pull */
  at: number
  /** account the pull was for ('' when unknown) */
  uid: string
  /** number of local calls right after that pull */
  count: number
}

/**
 * Pull the server's calls again only when needed: never pulled for this account, the last pull is
 * older than `everyMs`, or local calls were lost since (fewer than after the last pull, e.g. a
 * cleared localStorage on this device).
 */
export function predictionPullDue(o: {
  mark: PullMark | null; uid: string; localCount: number; now: number; everyMs: number
}): boolean {
  const m = o.mark
  if (!m || !m.at) return true
  if ((m.uid || '') !== (o.uid || '')) return true
  if (o.now - m.at >= o.everyMs || o.now < m.at) return true
  return o.localCount < m.count
}

/**
 * `updated_since` for an incremental pull: the last pull time minus a clock-skew margin,
 * as ISO; null when there was no pull for this account (full pull).
 */
export function predictionPullSince(mark: PullMark | null, uid: string, skewMs = 60_000): string | null {
  if (!mark || !mark.at || (mark.uid || '') !== (uid || '')) return null
  return new Date(Math.max(0, mark.at - skewMs)).toISOString()
}
