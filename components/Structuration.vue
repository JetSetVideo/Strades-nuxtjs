<script setup></script>
<template>
  <div class="structuration-container">
    <h1>Structuration</h1>
    <div><ul>
        <li class="button">Main Data</li>
        <li class="button">Model</li>
        <li class="button">Connections</li>
        <li class="button">Entities</li>
    </ul></div>
    <div><ul>
        <li class="button">Link</li>
        <li class="button">Add</li>
        <li class="button">Delete</li>
        <li class="button">Share</li>
    </ul></div>
  </div>
</template>
<style scoped>
.structuration-container{
  background-color: rgba(50, 50, 50, 0.8);
  border-radius: 8px;
  box-shadow: inset 0 0 10px rgba(0, 0, 0, 0.8);
  padding: 1rem;
}

.button {
    display: inline-block;
    padding: 0.5em 1em;
    text-decoration: none;
    background: #ef7777;
    color: #FFF;
    border-bottom: solid 4px #400000;
    border-radius: 3px;
}
</style>