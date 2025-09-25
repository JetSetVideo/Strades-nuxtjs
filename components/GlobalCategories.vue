<script>
import { ref } from 'vue';

const categories = ref([
  {
    id: 1,
    name: 'Informations',
    color: '#FF6F91',
    isVisible: false,
    details: 'Specificities of the Informations category',
  },
  {
    id: 2,
    name: 'Strategy',
    color: '#8ACB88',
    isVisible: false,
    details: 'Specificities of the Strategy category',
  },
  {
    id: 3,
    name: 'Management',
    color: '#FFC14A',
    isVisible: false,
    details: 'Specificities of the Management category',
  },
  {
    id: 4,
    name: 'Psychology',
    color: '#5A77FF',
    isVisible: false,
    details: 'Specificities of the Psychology category',
  },
  {
    id: 5,
    name: 'Analysis',
    color: '#FF8D61',
    isVisible: false,
    details: 'Specificities of the Analysis category',
  },
  {
    id: 6,
    name: 'Results',
    color: '#B283EB',
    isVisible: false,
    details: 'Specificities of the Results category',
  },
]);

const toggleVisibility = (category) => {
  category.isVisible = !category.isVisible;
};
</script>

<template>
  <div class="glassmorphism-container">
    <div v-for="category in categories" :key="category.id" class="category" :style="{ backgroundColor: category.color }" @click="toggleVisibility(category)">
      <h2>{{ category.name }}</h2>
      <div v-if="category.isVisible" class="category-details">
        <p>{{ category.details }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.glassmorphism-container {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  max-width: 800px;
  margin: 0 auto;
}

.category {
  flex-basis: 48%;
  padding: 20px;
  margin-bottom: 20px;
  border-radius: 8px;
  box-shadow: 0 0 20px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(8px);
  cursor: pointer;
  transition: transform 0.3s ease;
}

.category:hover {
  transform: scale(1.05);
}

.category h2 {
  margin: 0;
  color: white;
  font-size: 24px;
}

.category-details {
  margin-top: 10px;
  color: white;
}
</style>
  