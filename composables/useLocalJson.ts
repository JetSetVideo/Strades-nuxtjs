export async function useLocalJson<T>(path: string): Promise<T> {
  try {
    const result = await $fetch<T>(`/data/${path}`)
    // Guard: if the server returned HTML instead of JSON (e.g. auth redirect), throw
    if (typeof result === 'string' && (result as string).trim().startsWith('<')) {
      throw new Error(`useLocalJson: received HTML instead of JSON for /data/${path}`)
    }
    return result
  } catch (err) {
    // Return a sensible empty fallback based on the expected shape.
    // Callers using `default: () => []` in useAsyncData will use that fallback,
    // but if called directly this prevents a crash.
    console.warn(`useLocalJson: failed to load /data/${path}`, err)
    return (Array.isArray([] as unknown as T) ? [] : {}) as T
  }
}
