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
    <div class="navbar-right">
      <img src="~/assets/Logo_Black.png" alt="Logo" class="logo">
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
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2); /* Outer shadow */
}

.company-name {
  font-size: 24px;
  margin-left: 20px; /* Move the company name to the left */
}

.navbar-center {
  display: flex;
  align-items: center;
  gap: 20px; /* Add space between the links */
  margin-right: auto; /* Push the links to the left for centering */
}

.navbar-center nuxt-link {
  color: #fff; /* Change this to your desired link color */
  text-decoration: none;
  font-weight: bold;
  padding: 10px; /* Add padding around the links */
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2); /* Inner shadow for the links */
}

.navbar-center nuxt-link:hover {
  text-decoration: underline;
}

/* Style the logo */
.logo {
  max-width: 50px; /* Adjust the logo size as needed */
  height: auto;
  margin-right: 20px; /* Add space between the logo and company name */
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2); /* Inner shadow for the logo */
}
</style>
