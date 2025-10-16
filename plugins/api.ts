// Create a centralized API client
export const createApiClient = () => {
  const config = useRuntimeConfig()
  
  return {
    baseURL: config.public.apiBase,
    headers: {
      'Content-Type': 'application/json'
    },
    // Add interceptors for auth tokens
    onRequest: (config: any) => {
      const token = localStorage.getItem('access_token')
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }
      return config
    }
  }
}

import type { FetchContext } from 'ofetch';

export default defineNuxtPlugin(() => {
  const { $api } = useNuxtApp()
  const runtimeConfig = useRuntimeConfig()
  const auth = useAuth()
  
  const api = $fetch.create({
    baseURL: runtimeConfig.public.apiUrl as string,
    headers: {
      'Content-Type': 'application/json',
    },
    onRequest(ctx: FetchContext) {
      if (auth.token.value) {
        ctx.options.headers = ctx.options.headers || new Headers();
        (ctx.options.headers as Headers).set('Authorization', `Bearer ${auth.token.value}`);
      }
    }
  })

  return {
    provide: {
      api
    }
  }
}) 