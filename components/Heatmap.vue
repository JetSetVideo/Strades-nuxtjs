<script setup>

</script>
<template>
  <div style="background-color: rgb(217, 145, 145)">
    <h1>Heatmap</h1>
    <img :src="imageUrl" alt="article logo" width="120" height="120" />
    <ul>
        <li class="button">Stock Market</li>
        <li class="button">Filter</li>
        <li class="button">Categories</li>
        <li class="button">Value</li>
    </ul>
  </div>
</template>
<style scoped>
.button {
    display: inline-block;
    padding: 0.5em 1em;
    text-decoration: none;
    background: #b42929;
    color: #FFF;
    border-bottom: solid 4px #3d0000;
    border-radius: 3px;
}
</style>