<script setup>
import { ref } from 'vue';

// Simple state to toggle up arrow status
const isUp = ref(false);

function toggleUp() {
    isUp.value = !isUp.value;
}
</script>

<template>
<button class="uparrow-btn" @click="toggleUp">
<!-- SVG for an up arrow icon (active state) -->
<svg v-if="isUp"
    xmlns="http://www.w3.org/2000/svg"
    width="1.2em"
    height="1.2em"
    viewBox="0 0 24 24"
    fill="currentColor" >
    <!-- Adjusted fill to use currentColor for dynamic coloring -->

    <path fill="white" d="M15 20H9v-8H4.16L12 4.16L19.84 12H15z" />
    
</svg>
<!-- SVG for an up arrow icon (inactive state) -->
<svg
    v-else
    xmlns="http://www.w3.org/2000/svg"
    width="1.2em"
    height="1.2em"
    viewBox="0 0 24 24"
    fill="currentColor" 
>

    <path fill="white" d="M16 13v8H8v-8H2L12 3l10 10zm-9-2h3v8h4v-8h3l-5-5z" />
</svg>
</button>
</template>

<style scoped>
.uparrow-btn {
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
.uparrow-btn:hover {
    background-color: rgba(24, 24, 24, 0.7);
}

.icon {
    display: block;
    margin-right: 5px;
}
</style>