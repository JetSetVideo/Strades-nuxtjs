<script setup lang="ts">

</script>

<template>
  <nav class="navbar">
    <div class="navbar-left">
      <span class="company-name">Strades</span>
    </div>
    <div class="navbar-center">
      <nuxt-link to="/">Home</nuxt-link>
      <nuxt-link to="/about">About</nuxt-link>
      <nuxt-link to="/contact">Contact Us</nuxt-link>
    </div>
  </nav>
</template>

<style scoped>
.navbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  background-color: #333; /* Change this to your desired background color */
  color: #fff; /* Change this to your desired text color */
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 20px;
}

.company-name {
  font-size: 24px;
  margin-right: 20px;
}

.navbar-center {
  display: flex;
}

.navbar-center nuxt-link {
  margin-right: 20px;
  color: #fff; /* Change this to your desired link color */
  text-decoration: none;
  font-weight: bold;
}

.navbar-center nuxt-link:hover {
  text-decoration: underline;
}
</style>
