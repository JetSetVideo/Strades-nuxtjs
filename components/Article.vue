<script setup>
import imageUrl from "../../src/assets/StradeLogoPrototype_icon.svg";
</script>
<template>
  <div style="background-color: rgb(214, 229, 211)">
    <h1>Article</h1>
    <img :src="imageUrl" alt="article logo" width="120" height="120" />
    <p> Body of the article</p>
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
.button {
    display: inline-block;
    padding: 0.5em 1em;
    text-decoration: none;
    background: #1baa78;
    color: #FFF;
    border-bottom: solid 4px #074633;
    border-radius: 3px;
}
</style>