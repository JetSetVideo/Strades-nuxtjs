<script setup>
import { ref } from 'vue';

// Simple state to toggle bookmark status
const isBookmarked = ref(false);

function toggleBookmark() {
    isBookmarked.value = !isBookmarked.value;
}
</script>

<template>
<button class="bookmark-btn" @click="toggleBookmark">
<!-- SVG for a bookmark icon (bookmarked state) -->
<svg v-if="isBookmarked"
    xmlns="http://www.w3.org/2000/svg"
    width="1.2em"
    height="1.2em"
    viewBox="0 0 24 24"
    fill="currentColor" ><!-- Adjusted fill to use currentColor for dynamic coloring -->

    <path fill="white" d="M5 21V5q0-.825.588-1.412T7 3h10q.825 0 1.413.588T19 5v16l-7-3z" />
</svg>
<!-- SVG for a bookmark icon (unbookmarked state) -->
<svg
    v-else
    xmlns="http://www.w3.org/2000/svg"
    width="1.2em"
    height="1.2em"
    viewBox="0 0 24 24"
    fill="currentColor" 
><!-- Adjusted fill to use currentColor for dynamic coloring -->
    <path fill="white" d="M5 21V5q0-.825.588-1.412T7 3h6v2H7v12.95l5-2.15l5 2.15V11h2v10l-7-3zM7 5h6zm10 4V7h-2V5h2V3h2v2h2v2h-2v2z" />
</svg>
</button>
</template>

<style scoped>
.bookmark-btn {
    background: none;
    border: none;
    cursor: pointer;
    padding: 10px;
    display: flex;
    align-items: center;
    color: white; /* Set your preferred icon color */
    background-color: rgba(24, 24, 24, 0.5);
    border-radius: 0.5rem;
    transition: background-color 0.3s;
}
.bookmark-btn:hover {
    background-color: rgba(24, 24, 24, 0.7);
}

.icon {
    display: block;
    margin-right: 5px;
}
</style>
