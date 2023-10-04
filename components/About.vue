<script setup>
import imageUrl from "../../src/assets/imgs/about.png";
</script>
<template>
  <div style="background-color: rgb(215, 215, 215)">
    <h1>About Page</h1>
    <h2>Presentation of the company</h2>
    <h2>Presentation of the team</h2>
    <img :src="imageUrl" alt="about logo" width="100" height="100" />
    <div><p> Contact us</p><br/>
      <p>Message</p></div>
  </div>
</template>