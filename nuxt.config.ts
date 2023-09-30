export default {
  nitro: {
    preset: 'vercel-edge',
  },
  // Define your routes
  router: {
    routes: [
      {
        name: 'home',
        path: '/',
        component: 'pages/index.vue' // Path to your component in the pages directory
      },
      {
        name: 'about',
        path: '/about',
        component: '~/pages/about.vue'
      },
      // Add more routes as needed
    ]
  },
};
