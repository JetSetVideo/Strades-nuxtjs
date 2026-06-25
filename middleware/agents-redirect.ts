export default defineNuxtRouteMiddleware((to) => {
  if (to.path === '/agents' || to.path === '/agents/') {
    return navigateTo('/strategies')
  }
})
