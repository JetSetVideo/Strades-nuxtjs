<script setup>
import imageUrl from "../assets/Logo_Color.png";
</script>
<template>
  <NuxtLink to="/help" class="button">
    <img :src="imageUrl" alt="about logo" width="100" height="100" />
    <h1>Help</h1>
  </NuxtLink>
</template>
<style scoped>
.button {
    width: 100%;
    height: 4rem;
    color:#ffffff;
    background-color: rgb(121, 121, 121);
}
</style>