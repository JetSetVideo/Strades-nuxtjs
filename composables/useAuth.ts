export const useAuth = () => {
  const token = useCookie('access_token')
  const user = ref<User | null>(null)
  
  interface LoginCredentials {
    username: string;
    password: string;
  }
  interface User {
    // Define user properties based on your schema
    id: string;
    username: string;
    // Add other fields as needed
  }
  
  const login = async (credentials: LoginCredentials) => {
    const { data } = await useFetch<{ access_token: string }>('/auth/login', {
      method: 'POST',
      body: credentials,
      baseURL: useRuntimeConfig().public.apiUrl as string
    })
    
    if (data.value) {
      token.value = data.value.access_token
      await fetchUserProfile()
    }
  }
  
  const fetchUserProfile = async () => {
    const { data } = await useFetch<User>('/users/me', {
      headers: {
        Authorization: `Bearer ${token.value}`
      },
      baseURL: useRuntimeConfig().public.apiUrl as string
    })
    
    if (data.value) {
      user.value = data.value
    }
  }
  
  const logout = () => {
    token.value = null
    user.value = null
  }
  
  return {
    token,
    user,
    login,
    logout,
    fetchUserProfile
  }
} 