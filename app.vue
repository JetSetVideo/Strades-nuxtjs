<script setup lang="ts">

import NavigationBar from './components/NavigationBar.vue'
//import NavigationBar from './components/Navbar.vue'
</script>

<template>
  <div>
    <Navbar />
  </div>
  <div>
    <NuxtWelcome />
  </div>
  <div>
    <NavigationBar />
  </div>


  <h1 class="hello">Hello Strades 3</h1>
</template>

<style scoped>
.hello {
  font-family: Arial, Helvetica, sans-serif;
  font-size: 3rem;
  padding: 2rem;
}
</style>