/**
 * Deterministic seeded RNG helpers.
 *
 * Used by pages that need stable synthetic data (equity curves, trade lists,
 * heatmap fillers) that should look the same on every render for a given id.
 *
 * `cyrb53` hashes a string → 32-bit seed; `mulberry32` is a fast PRNG seeded
 * with that hash. Together they let callers generate the same pseudo-random
 * sequence for `(strategy.id + 'trades')` or `(bot.id + 'pnl')`.
 */

export function cyrb53(str: string): number {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  return ((h1 ^ h2) >>> 0)
}

export function mulberry32(seed: number) {
  let t = seed >>> 0
  return () => {
    t = (t + 0x6D2B79F5) >>> 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Convenience: hash a string + return a primed PRNG.
 *   const rand = seededRandom(strategy.id + 'trades')
 *   rand()  // 0..1, deterministic for this id
 */
export function seededRandom(key: string) {
  return mulberry32(cyrb53(key))
}

export function useSeededRandom() {
  return { cyrb53, mulberry32, seededRandom }
}
