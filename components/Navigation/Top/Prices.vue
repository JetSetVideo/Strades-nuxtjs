<script setup>

</script>
<template>
 <header>
    <div class="center-title">
      <h1 class="header-title">Market Prices</h1>
    </div>
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
  display: flex;
  justify-content: center;
  align-items: center;
}

.header-title {
  font-size: 1.2rem;
  font-weight: 700;
  background: linear-gradient(45deg, #fff, var(--primary-blue, #00aaff));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin: 0;
  font-family: 'Poppins', sans-serif;
  letter-spacing: 0.5px;
}

@media (min-width: 768px) {
  header {
    height: 4rem;
    padding: 0.75rem 2rem;
  }
  .header-title {
    font-size: 1.5rem;
  }
}
</style>
  