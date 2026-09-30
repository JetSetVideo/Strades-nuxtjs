/**
 * Load a static JSON file from /public/data/{path}.
 * Returns empty array for list-shaped failures, empty object otherwise —
 * callers should treat empty fallbacks as "no data" not success.
 */
export async function useLocalJson<T>(path: string, fallback?: T): Promise<T> {
  // During SSR a relative $fetch is resolved by Nitro's internal router, which
  // doesn't serve /public files — it rendered the app's HTML instead, so every
  // server-side load fell back to [] (quests, notifications, search suggestions).
  // Resolve against the request origin so it reaches the static file server.
  // Must run before any await: useRequestURL needs the active Nuxt context.
  const url = import.meta.server ? new URL(`/data/${path}`, useRequestURL().origin).toString() : `/data/${path}`
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
