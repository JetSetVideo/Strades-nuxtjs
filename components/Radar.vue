<script setup>

</script>
<template>
  <div class="container-radar">
    <h1>Radar: </h1>
    <h3 class="button">Asset1</h3>
    <ul>
        <li class="button">Sector</li>
        <li class="button">Market</li>
    </ul>
    <ul>
        <li class="button">Similar Assets</li>
        <li class="button">Competing Assets</li>
        <li class="button">Completing Assets</li>
    </ul>
  </div>
</template>
<style scoped>
.button {
    display: inline-block;
    padding: 0.5em 1em;
    text-decoration: none;
    background: rgba(75, 90, 138, 0.5);
    color: #FFF;
    border-bottom: solid 4px rgba(32, 39, 61, 0.8);
    border-radius: 3px;
}
.container-radar{
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 1rem;
    padding: 0.1rem 0.2rem;
    margin: 1rem;
    background-color: rgba(66, 55, 65, 0.5);
    border: 3px solid rgba(124, 124, 124, 0.3);
    border-radius: 8px;
    color:#ffffff;
}
</style>