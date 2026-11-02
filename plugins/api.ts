import type { FetchContext } from 'ofetch'
import { withAuthRetry } from '~/utils/authRetry'

/**
 * $api — authenticated Django REST client.
 * Injects the Bearer token on every request (read at send time, so a retry carries the new one).
 * A 401 refreshes the access token once (shared by concurrent callers) and retries the request once;
 * the caller gets the retry's result (utils/authRetry.ts — ofetch ignores values returned from
 * onResponseError, so the old in-hook retry was thrown away: board-perf PERF-2).
 * A network error never signs the user out (useAuth.refreshAccessToken keeps the session on it).
 */
export default defineNuxtPlugin(() => {
  const runtimeConfig = useRuntimeConfig()
  const auth = useAuth()

  const raw = $fetch.create({
    baseURL: runtimeConfig.public.apiBase as string,
    headers: {
      'Content-Type': 'application/json',
    },
    onRequest(ctx: FetchContext) {
      const token = auth.accessToken.value
      if (token) {
        const headers = new Headers(ctx.options.headers as HeadersInit)
        headers.set('Authorization', `Bearer ${token}`)
        ctx.options.headers = headers
      }
    },
  })

  const api = withAuthRetry(raw, () => auth.refreshAccessToken())

  return {
    provide: { api },
  }
})
