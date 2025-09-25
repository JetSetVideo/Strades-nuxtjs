<script setup>

</script>
<template>
 <header>
    <h1>NavigationTop</h1>
    <SearchBar />
    <p>Messages</p>
    <ButtonNotification />
  </header>
</template>



<style scoped>
header {
  display: flex;
  position: fixed; /* Fix the navbar to the top of the viewport */
  top: 0; /* Position the navbar at the top of the viewport */
  width: 100%; /* Make the navbar full-width */
  flex-direction: row;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;
  height: 2rem;
  padding: 1rem 5rem;
  background: linear-gradient(270deg, #111 0%, rgba(33, 33, 33, 0.5) 50.06%, #111 100%);
  box-shadow: 1rem 0px 0.5rem 0px rgba(0, 0, 0, 0.25);
  color: #ffffff;
}
</style>