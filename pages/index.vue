<script setup>

</script>
<template>
    <main>
        <h1>Welcome to Strades</h1>
        <div class="board">
          <ConnectionTest />
        </div>
    </main>
</template>
<style>
.board {
  display: columns;
  justify-content: space-around;
  background-color: rgb(40, 40, 49);
  padding: 1rem;
}
.column {
  flex: 1;
  background-color: rgb(66, 63, 95);
  margin: 10px;
  padding: 10px;
  border: 1px solid #ccc;
}
.task {
  margin: 1rem;
  padding: 0.5rem;
  border: 1px solid #ddd;
}
</style>