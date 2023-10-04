<script setup></script>
<template>
  <div style="background-color: rgb(233, 213, 184)">
    <h1>Sentiment</h1>
    <img :src="imageUrl" alt="article logo" width="120" height="120" />
    <ul>
        <li class="button">Asset</li>
        <li class="button">Graph</li>
        <li class="button">Grade</li>
        <li class="button">Direction</li>
        <li class="button">Period</li>
    </ul>
  </div>
</template>
<style scoped>
.button {
    display: inline-block;
    padding: 0.5em 1em;
    text-decoration: none;
    background: #cf9d60;
    color: #FFF;
    border-bottom: solid 4px #533408;
    border-radius: 3px;
}
</style>