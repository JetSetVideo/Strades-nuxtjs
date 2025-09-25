<script setup>
import { ref, computed, watch } from 'vue'
import StrategyCard from '@/components/Card/Strategy.vue'

const props = defineProps({
  strategies: {
    type: Array,
    required: true,
  },
  selectedStrategies: {
    type: Array,
    required: true,
  },
})

watch(() => props.strategies, (newStrategies) => {
  console.log('Strategies in Carousel:', newStrategies)
}, { immediate: true })

const emit = defineEmits(['select-strategy'])

const visibleStrategies = ref(3)
const currentIndex = ref(0)

const displayedStrategies = computed(() => {
  return props.strategies.slice(currentIndex.value, currentIndex.value + visibleStrategies.value)
})

const showLeftArrow = computed(() => currentIndex.value > 0)
const showRightArrow = computed(() => currentIndex.value + visibleStrategies.value < props.strategies.length)

function moveLeft() {
  if (currentIndex.value > 0) {
    currentIndex.value--
  }
}

function moveRight() {
  if (currentIndex.value + visibleStrategies.value < props.strategies.length) {
    currentIndex.value++
  }
}

function selectStrategy(strategy) {
  emit('select-strategy', strategy)
}
</script>

<template>
  <div class="carousel">
    <div class="arrow left" v-if="showLeftArrow" @click="moveLeft">◀</div>
    <div class="carousel-container">
      <div
        v-for="strategy in displayedStrategies"
        :key="strategy.name"
        class="carousel-item"
        :class="{ 'selected': selectedStrategies.some(s => s.name === strategy.name) }"
        @click="selectStrategy(strategy)"
      >
        <StrategyCard :strategy="strategy" />
      </div>
    </div>
    <div class="arrow right" v-if="showRightArrow" @click="moveRight">▶</div>
  </div>
</template>

<style scoped>
.carousel {
  display: flex;
  align-items: center;
  padding: 20px;
  margin: 10px 0;
  background-color: rgba(50, 50, 50, 0.8);
  border-radius: 10px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

.carousel-container {
  display: flex;
  overflow-x: auto;
  scroll-behavior: smooth;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.carousel-container::-webkit-scrollbar {
  display: none;
}

.carousel-item {
  flex: 0 0 auto;
  width: calc(100% / 3 - 20px);
  margin: 0 10px;
  transition: all 0.3s ease;
}

.carousel-item.selected {
  transform: scale(1.05);
  box-shadow: 0 0 10px rgba(255, 255, 255, 0.5);
}

.arrow {
  font-size: 24px;
  cursor: pointer;
  user-select: none;
  padding: 10px;
  background-color: rgba(0, 0, 0, 0.5);
  border-radius: 50%;
}

@media (max-width: 768px) {
  .carousel-item {
    width: calc(100% - 20px);
  }
}
</style>