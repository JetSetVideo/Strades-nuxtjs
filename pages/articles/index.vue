<script setup>
import imageUrl from "../assets/Logo_Color.png";
const color = "rgba(21, 22, 21,0.5)";
</script>
<template>
  <div :style="{backgroundColor: color}">
    <h1 class="article-title">Article</h1>
    <img :src="imageUrl" alt="article logo" width="120" height="120" />
    <p> Body of the article.</p>
    <p class="article-body">Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. 
        Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. 
        Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. 
        Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
    </p>
    <ul>
        <li class="button">Source</li>
        <li class="button">Author</li>
        <li class="button">Political Compas</li>
        <li class="button">Grade</li>
        <li class="button">Tags</li>
        <li class="button">Publication Date</li>
        <li class="button">Price Impact</li>
    </ul>
  </div>
</template>
<style scoped>
.article-title {
    align-content: center;
    color: rgb(255, 255, 255);
    background-color: rgba(16, 16, 16,0.16);
    padding: 0.5rem;
    margin: 1rem;
}
.button {
    display: inline-block;
    padding: 0.5em 1em;
    align-items: center;
    align-content: center;
    text-decoration: none;
    background: #1baa78;
    color: #FFF;
    border-bottom: solid 4px #074633;
    border-radius: 3px;
}
</style>