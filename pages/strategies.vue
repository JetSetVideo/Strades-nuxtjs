<script setup>
import { ref, onMounted } from 'vue'
import Carousel from '@/components/Carousel.vue'
import Filters from '@/components/Filters.vue'
import NavigationCreator from '@/components/Navigation/Creator.vue'
import Comparator from '@/components/Comparator.vue'

const strategies = ref([])
const selectedStrategies = ref([])
const showComparator = ref(false)

async function fetchStrategies() {
  try {
    const strategyFiles = import.meta.glob('/data/strategies/*.json')

    const strategyPromises = []
    for (const path in strategyFiles) {
      strategyPromises.push(strategyFiles[path]())
    }

    const strategyModules = await Promise.all(strategyPromises)
    strategies.value = strategyModules.map((module) => module.default)
    
    console.log('Fetched strategies:', strategies.value)
  } catch (error) {
    console.error('Error fetching strategies:', error)
  }
}

function handleStrategySelect(strategy) {
  const index = selectedStrategies.value.findIndex(s => s.name === strategy.name)
  if (index > -1) {
    selectedStrategies.value.splice(index, 1)
  } else {
    selectedStrategies.value.push(strategy)
  }
  
  if (selectedStrategies.value.length === 2) {
    showComparator.value = true
  } else {
    showComparator.value = false
  }
}

onMounted(fetchStrategies)
</script>

<template>
  <div class="strategies-page">
    <h1>My Strategies</h1>
    <div class="content-container">
      <Filters />
      <Carousel 
        :strategies="strategies" 
        @select-strategy="handleStrategySelect"
        :selectedStrategies="selectedStrategies"
      />
      <p v-if="strategies.length === 0">
        No strategies found. Create your first strategy!
      </p>
      <NavigationCreator :selectedStrategies="selectedStrategies" />
      <Comparator v-if="showComparator" :strategies="selectedStrategies" />
    </div>
  </div>
</template>

<style scoped>
.strategies-page {
  padding: 20px;
  background-color: rgba(30, 30, 30, 0.8);
  border-radius: 10px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

.content-container {
  margin-top: 20px;
}
</style>