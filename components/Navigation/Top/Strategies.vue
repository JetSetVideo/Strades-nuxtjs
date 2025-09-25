<script setup>

</script>
<template>
 <header class="font-[kanit]">
    <ButtonShop />
    <SearchBar />
    <!-- <p>Strategies</p> -->
    <ButtonNotification />
  </header>
</template>

<style scoped>
header {
  display: flex;
  position: sticky; /* Fix the navbar to the top of the viewport */
  top: 0; /* Position the navbar at the top of the viewport */
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  width: 100%; /* Make the navbar full-width */
  height: 3rem;
  padding: 1rem 5rem;
  background: linear-gradient(270deg, #111 0%, rgba(33, 33, 33, 0.5) 50.06%, #111 100%);
  box-shadow: 1rem 0px 0.5rem 0px rgba(0, 0, 0, 0.25);
  color: #ffffff;
  z-index: 2;
}
</style>