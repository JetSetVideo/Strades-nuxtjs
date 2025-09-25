// Create a centralized API client
export const createApiClient = () => {
  const config = useRuntimeConfig()
  
  return {
    baseURL: config.public.apiBase,
    headers: {
      'Content-Type': 'application/json'
    },
    // Add interceptors for auth tokens
    onRequest: (config) => {
      const token = localStorage.getItem('access_token')
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }
      return config
    }
  }
}

export default defineNuxtPlugin(() => {
  const { $api } = useNuxtApp()
  const runtimeConfig = useRuntimeConfig()
  const auth = useAuth()
  
  const api = $fetch.create({
    baseURL: runtimeConfig.public.apiUrl,
    headers: {
      'Content-Type': 'application/json',
    },
    onRequest({ options }) {
      if (auth.token.value) {
        options.headers = {
          ...options.headers,
          Authorization: `Bearer ${auth.token.value}`
        }
      }
    }
  })

  return {
    provide: {
      api
    }
  }
}) 