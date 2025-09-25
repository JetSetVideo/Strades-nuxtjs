<script setup>
import { ref } from 'vue';

const showOptions = ref(false);

function toggleOptions() {
    showOptions.value = !showOptions.value;
}
</script>

<template>
<div class="options-container">
    <button class="options-btn" @click="toggleOptions">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="1"></circle>
            <circle cx="12" cy="5" r="1"></circle>
            <circle cx="12" cy="19" r="1"></circle>
        </svg>
    </button>
    <div v-if="showOptions" class="options-menu">
        <button>Option 1</button>
        <button>Option 2</button>
        <button>Option 3</button>
    </div>
</div>
</template>

<style scoped>
.options-container {
    position: relative;
}

.options-btn {
    background: none;
    border: none;
    cursor: pointer;
    padding: 5px;
    color: white;
}

.options-menu {
    position: absolute;
    right: 0;
    top: 100%;
    background-color: rgba(24, 24, 24, 0.9);
    border-radius: 4px;
    padding: 5px;
    display: flex;
    flex-direction: column;
}

.options-menu button {
    background: none;
    border: none;
    color: white;
    padding: 5px 10px;
    text-align: left;
    cursor: pointer;
}

.options-menu button:hover {
    background-color: rgba(255, 255, 255, 0.1);
}
</style>
