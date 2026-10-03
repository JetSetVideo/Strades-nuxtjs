/**
 * Absolute URL for a file under /public.
 * A relative fetch during SSR is resolved by Nitro's router, which does not
 * serve /public — it returns the app HTML. Call this before any await.
 */
export function publicAssetUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  if (import.meta.server) {
    return new URL(normalized, useRequestURL().origin).toString()
  }
  return normalized
}

/**
 * Load a static JSON file from /public/data/{path}.
 * Returns empty array for list-shaped failures, empty object otherwise —
 * callers should treat empty fallbacks as "no data" not success.
 */
export async function useLocalJson<T>(path: string, fallback?: T): Promise<T> {
  const url = publicAssetUrl(`/data/${path}`)
  try {
    const result = await $fetch<T>(url)
    if (typeof result === 'string' && (result as string).trim().startsWith('<')) {
      throw new Error(`useLocalJson: received HTML instead of JSON for /data/${path}`)
    }
    return result
  } catch (err) {
    console.warn(`useLocalJson: failed to load /data/${path}`, err)
    if (fallback !== undefined) return fallback
    // Heuristic: path ending with plural-ish names default to []
    const wantsArray = /s\.json$/i.test(path) || path.includes('list')
    return (wantsArray ? [] : {}) as T
  }
}
