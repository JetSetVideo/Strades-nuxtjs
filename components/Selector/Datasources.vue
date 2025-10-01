<script setup>
import { ref } from 'vue';

const props = defineProps(['modelValue']);
const emit = defineEmits(['update:modelValue']);

const dataSources = ref([
  { id: 1, name: 'Github Commits', image: '/logos/github.png' },
  { id: 2, name: 'Twitter Sentiment', image: '/logos/apple.png' },
  { id: 3, name: 'Reddit Posts', image: '/logos/amazon.png' },
  // Add more data sources as needed
]);

const selectedSources = ref(props.modelValue || []);

function toggleSource(source) {
  const index = selectedSources.value.findIndex(s => s === source.name);
  if (index === -1) {
    selectedSources.value.push(source.name);
  } else {
    selectedSources.value.splice(index, 1);
  }
  emit('update:modelValue', selectedSources.value);
}
</script>

<template>
<div class="datasources-selector">
    <h3>Data Sources</h3>
    <div class="datasources-grid">
    <div 
        v-for="source in dataSources" 
        :key="source.id" 
        class="datasource-item"
        :class="{ selected: selectedSources.includes(source.name) }"
        @click="toggleSource(source)"
    >
        <img :src="source.image" :alt="source.name">
        <span>{{ source.name }}</span>
    </div>
    </div>
</div>
</template>

<style scoped>
.datasources-selector {
background-color: #2c3e50;
border-radius: 15px;
padding: 20px;
margin: 20px 0;
box-shadow: inset 0 0 10px rgba(0, 0, 0, 0.5), 0 0 10px rgba(255, 255, 255, 0.5);
}

h3 {
font-size: 1.5em;
color: white;
text-align: center;
margin-bottom: 20px;
}

.datasources-grid {
display: flex;
justify-content: center;
flex-wrap: wrap;
gap: 20px;
}

.datasource-item {
display: flex;
flex-direction: column;
align-items: center;
background-color: #34495e;
border-radius: 10px;
padding: 10px;
cursor: pointer;
transition: all 0.3s ease;
border: 2px solid white;
box-shadow: 0 0 10px rgba(0, 0, 0, 0.3);
}

.datasource-item:hover {
box-shadow: inset 0 0 10px rgba(255, 255, 255, 0.5), 0 0 15px rgba(0, 0, 0, 0.5);
}

.datasource-item.selected {
background-color: #2980b9;
}

.datasource-item img {
width: 50px;
height: 50px;
object-fit: cover;
border-radius: 50%;
margin-bottom: 10px;
}

.datasource-item span {
color: white;
text-align: center;
}
</style>
