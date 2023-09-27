<script setup lang="ts">

import navbar from '@/components/NavigationBar.vue'
</script>

<template>
  <div>
    <NuxtWelcome />
  </div>
  <div>
    <NavigationBar />
  </div>

  <h1 class="hello">Hello Strades!</h1>
</template>

<style scoped>
.hello {
  font-family: Arial, Helvetica, sans-serif;
  font-size: 3rem;
  padding: 2rem;
}
</style>