<script setup>

</script>
<template>
 <header>
  <ButtonAvatar />
  <SearchBar class="center-title" />
  <ButtonNotification />
  </header>
</template>



<style scoped>
header {
  display: flex;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  max-width: 100vw;
  box-sizing: border-box;
  height: 3.25rem;
  padding: 0.35rem 1rem;
  background: linear-gradient(135deg, rgba(15, 15, 15, 0.95) 0%, rgba(25, 25, 25, 0.95) 50%, rgba(15, 15, 15, 0.95) 100%);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
  z-index: 1000;
  color: #ffffff;
  overflow: hidden;
}

header > * {
  flex-shrink: 0;
}

.center-title {
  flex: 1;
  text-align: center;
}

/* Title styling */
header p {
  font-family: "Poppins", sans-serif;
  font-size: 1.1rem;
  font-weight: 600;
  color: white;
  margin: 0;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  display: none;
}

/* Responsive adjustments */
@media (min-width: 768px) {
  header {
    padding: 0.75rem 2rem;
    height: 4rem;
  }

  header p {
    font-size: 1.25rem;
    display: block;
  }
}
</style>