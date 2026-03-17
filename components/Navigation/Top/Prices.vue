<script setup>

</script>
<template>
 <header>
    <span class="nav-title">NavigationTop</span>
    <SearchBar />
    <span class="nav-title">Prices</span>
    <ButtonLeaderboard />
  </header>
</template>

<style scoped>
header {
  display: flex;
  position: fixed;
  top: 0;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  height: 3.5rem;
  padding: 0.5rem 1rem;
  background: linear-gradient(270deg, #111 0%, rgba(33, 33, 33, 0.5) 50%, #111 100%);
  backdrop-filter: blur(10px);
  box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.25);
  color: #ffffff;
  z-index: 50;
}

.nav-title {
  font-size: 1.2rem;
  font-family: 'Poppins', sans-serif;
  font-weight: 600;
  display: none;
}

@media (min-width: 768px) {
  header {
    height: 4.5rem;
    padding: 1rem 3rem;
  }
  .nav-title {
    display: block;
  }
}
</style>
  