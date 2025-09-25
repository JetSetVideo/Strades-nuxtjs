export default defineNuxtRouteMiddleware((to) => {
  const auth = useAuth()
  const publicRoutes = ['/auth/login', '/auth/register', '/market-data']
  
  if (!auth.token.value && !publicRoutes.includes(to.path)) {
    return navigateTo('/auth/login')
  }
  
  if (auth.token.value && to.path.startsWith('/auth')) {
    return navigateTo('/dashboard')
  }
})