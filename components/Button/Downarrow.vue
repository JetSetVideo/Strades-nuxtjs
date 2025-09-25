<script setup>
import { ref } from 'vue';

// Simple state to toggle down arrow status
const isDown = ref(false);

function toggleDown() {
    isDown.value = !isDown.value;
}
</script>

<template>
<button class="downarrow-btn" @click="toggleDown">
<!-- SVG for a down arrow icon (active state) -->
<svg v-if="isDown"
    xmlns="http://www.w3.org/2000/svg"
    width="1.2em"
    height="1.2em"
    viewBox="0 0 24 24"
    fill="currentColor" ><!-- Adjusted fill to use currentColor for dynamic coloring -->

    <path fill="white" d="M9 4h6v8h5.84L12 19.84 4.16 12H9z" />
    
</svg>
<!-- SVG for a down arrow icon (inactive state) -->
<svg
    v-else
    xmlns="http://www.w3.org/2000/svg"
    width="1.2em"
    height="1.2em"
    viewBox="0 0 24 24"
    fill="currentColor" 
><!-- Adjusted fill to use currentColor for dynamic coloring -->
    <path fill="white" d="M8 11v-8h8v8h6L12 21 2 11zm9 2h-3v-8h-4v8h-3l5 5z" />
</svg>
</button>
</template>

<style scoped>
.downarrow-btn {
    min-width: 3rem;
    min-height: 3rem;
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
.downarrow-btn:hover {
    background-color: rgba(24, 24, 24, 0.7);
}

.icon {
    display: block;
    margin-right: 5px;
}
</style>