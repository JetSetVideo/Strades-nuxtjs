<script setup>

</script>
<template>
 <header>
  <ButtonAvatar />
  <SearchBar />
  <p>Wallet</p>
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
  height: 3.5rem;
  padding: 0.75rem 2rem;
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

/* Override avatar button styles for topbar */
header .avatar-button {
  padding: 0.25rem;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 50%;
  border: none;
  width: 2.5rem;
  height: 2.5rem;
}

header .avatar-image-wrapper {
  width: 2.25rem;
  height: 2.25rem;
  border: 2px solid rgba(0, 170, 255, 0.5);
}

header .avatar-image-wrapper img {
  width: 2rem;
  height: 2rem;
}

header .tag-name {
  display: none; /* Hide name in topbar */
}

/* Title styling */
header p {
  font-family: "Poppins", sans-serif;
  font-size: 1.25rem;
  font-weight: 600;
  color: white;
  margin: 0;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}

/* Responsive adjustments */
@media (max-width: 768px) {
  header {
    padding: 0.5rem 1rem;
    height: 3rem;
  }

  header p {
    font-size: 1.1rem;
  }
}
</style>