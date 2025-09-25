<script setup>

</script>
<template>
    <div class="section">
      <h1>Chart Analyse</h1>
      <h2>Price Chart</h2>
      <p>$Asset1/$Asset2</p>
      <p>Current Price</p>
      <p>DrawingToolsBar</p>
      <p>Period</p>
  </div>
  <div style="background-color: rgb(159, 178, 194)">
    <h1>Chart Analysis</h1>
    <img :src="imageUrl" alt="article logo" width="120" height="120" />
    <ul>
        <li class="button">Asset1/Asset2</li>
        <li class="button">Tools</li>
        <li class="button">Graph</li>
        <li class="button">Date</li>
    </ul>
  </div>
</template>
<style scoped>
.button {
    display: inline-block;
    padding: 0.5em 1em;
    text-decoration: none;
    background: #3b7fbd;
    color: #FFF;
    border-bottom: solid 4px #192255;
    border-radius: 3px;
}
</style>