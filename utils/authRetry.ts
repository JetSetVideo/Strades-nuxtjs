/**
 * 401 → refresh once → retry once, as a wrapper around a fetch function (plugins/api.ts `$api`).
 *
 * Why a wrapper and not ofetch's `onResponseError` hook: ofetch awaits its hooks and ignores their
 * return value, then throws the original error (board-perf PERF-2). A request retried inside the hook
 * was sent, and its answer thrown away; the caller still got the 401.
 *
 * Rules:
 *  - only an HTTP 401 triggers a refresh; any other status, and a network error (no status), is
 *    re-thrown untouched: a network error must never sign the user out;
 *  - concurrent 401s share ONE refresh (one promise);
 *  - the request is retried at most once; the retry's own result (or error) is returned as is;
 *  - when the refresh fails, the original 401 is re-thrown (the refresh decides on sign-out).
 */

type AnyFetch = (request: any, options?: any) => Promise<any>

/** HTTP status carried by an ofetch / $fetch error (0 = no answer: network error). */
function statusOf(e: unknown): number {
  const err = e as { response?: { status?: number }; statusCode?: number; status?: number } | null
  return err?.response?.status ?? err?.statusCode ?? err?.status ?? 0
}

export function withAuthRetry<F extends AnyFetch>(fetcher: F, refresh: () => Promise<boolean>): F {
  let refreshing: Promise<boolean> | null = null
  const refreshOnce = () => {
    if (!refreshing) {
      refreshing = refresh()
        .catch(() => false)
        .finally(() => { refreshing = null })
    }
    return refreshing
  }
  const wrapped = (async (request: unknown, options?: unknown) => {
    try {
      return await fetcher(request, options)
    } catch (e) {
      if (statusOf(e) !== 401) throw e
      if (!(await refreshOnce())) throw e
      return fetcher(request, options)
    }
  }) as unknown as F
  // Keep the rest of the $Fetch surface ($api.raw / .native / .create) callable.
  for (const key of ['raw', 'native', 'create'] as const) {
    const v = (fetcher as unknown as Record<string, unknown>)[key]
    if (v !== undefined) (wrapped as unknown as Record<string, unknown>)[key] = v
  }
  return wrapped
}
