<script setup>

</script>
<template>
 <header class="font-[kanit]">
    <ButtonAvatar />
    <SearchBar class="center-title" />
    <ButtonShop />
  </header>
</template>

<style scoped>
header {
  display: flex;
  position: sticky;
  top: 0;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  height: 3.5rem;
  padding: 0.5rem 1rem;
  background: linear-gradient(135deg, rgba(15, 15, 15, 0.95) 0%, rgba(25, 25, 25, 0.95) 50%, rgba(15, 15, 15, 0.95) 100%);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
  z-index: 1000;
  color: #ffffff;
}

header > * {
  flex-shrink: 0;
}

.center-title {
  flex: 1;
  text-align: center;
}

@media (min-width: 768px) {
  header {
    height: 4rem;
    padding: 0.75rem 2rem;
  }
}
</style>