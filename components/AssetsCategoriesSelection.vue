<script setup>
import { ref } from 'vue';

const props = defineProps(['categories', 'modelValue']);
const emit = defineEmits(['update:modelValue']);

const selectedCategory = ref(props.modelValue);

const updateCategory = (category) => {
  selectedCategory.value = category;
  emit('update:modelValue', category);
};
</script>

<template>
  <div class="categories-selection">
    <button 
      v-for="category in categories" 
      :key="category.name"
      @click="updateCategory(category.name)"
      :class="{ 'selected': category.name === selectedCategory }"
    >
      {{ category.name }}
    </button>
  </div>
</template>

<style scoped>
.categories-selection {
  display: flex;
  justify-content: center;
  gap: 1rem;
  margin: 1rem 0;
  padding: 0 1rem;
}

button {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  background-color: rgba(49, 49, 49, 0.5);
  color: white;
  cursor: pointer;
  transition: all 0.3s ease;
}

button.selected {
  background-color: rgba(0, 128, 0, 0.7);
  font-weight: bold;
  font-size: 1.1em;
  text-shadow: 0 0 5px white;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% {
    text-shadow: 0 0 5px white;
  }
  50% {
    text-shadow: 0 0 15px white;
  }
  100% {
    text-shadow: 0 0 5px white;
  }
}
</style>