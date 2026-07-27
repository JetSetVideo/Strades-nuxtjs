import type { FetchContext, FetchResponse } from 'ofetch'

/**
 * $api — authenticated Django REST client.
 * Injects Bearer token and retries once after a 401 via refreshAccessToken.
 */
export default defineNuxtPlugin(() => {
  const runtimeConfig = useRuntimeConfig()
  const auth = useAuth()

  let refreshing: Promise<boolean> | null = null

  const api = $fetch.create({
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
    async onResponseError(ctx: {
      request: FetchContext['request']
      response: FetchResponse<unknown>
      options: FetchContext['options']
    }) {
      if (ctx.response?.status !== 401) return

      // Avoid infinite retry loops
      const opts = ctx.options as FetchContext['options'] & { _retried?: boolean }
      if (opts._retried) return

      if (!refreshing) {
        refreshing = auth.refreshAccessToken().finally(() => { refreshing = null })
      }
      const ok = await refreshing
      if (!ok) return

      opts._retried = true
      const headers = new Headers(opts.headers as HeadersInit)
      if (auth.accessToken.value) {
        headers.set('Authorization', `Bearer ${auth.accessToken.value}`)
      }
      opts.headers = headers

      // Re-issue the request with the new token
      return $fetch(ctx.request as string, opts as Parameters<typeof $fetch>[1])
    },
  })

  return {
    provide: { api },
  }
})
