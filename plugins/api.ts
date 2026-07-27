import type { FetchContext } from 'ofetch'

export default defineNuxtPlugin(() => {
  const runtimeConfig = useRuntimeConfig()
  const auth = useAuth()

  const api = $fetch.create({
    baseURL: runtimeConfig.public.apiBase as string,
    headers: {
      'Content-Type': 'application/json',
    },
    onRequest(ctx: FetchContext) {
      const token = auth.accessToken.value
      if (token) {
        ctx.options.headers = ctx.options.headers || new Headers();
        (ctx.options.headers as Headers).set('Authorization', `Bearer ${token}`)
      }
    },
  })

  return {
    provide: { api },
  }
})
