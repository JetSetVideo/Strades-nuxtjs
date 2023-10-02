<script setup lang="ts">
</script>

<template>
    <div class="container">
      <header>
        <h1>My Strades Application</h1>
        <p>This is a paragraph of text.</p>
      </header>
      <main></main>
      <footer>
        <p>Copyright &copy; 2023 My Strades Application</p>
      </footer>
    </div>
</template>
  
<style scoped>
  .container {
    height: 100vh;
    background-color: #212529;
    color: white;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }
  
  header {
    text-align: center;
  }
  
  footer {
    position: absolute;
    bottom: 0;
    width: 100%;
    text-align: center;
  }
  </style>
  