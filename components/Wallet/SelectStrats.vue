<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
  strategies: {
    type: Array,
    required: true
  },
  selectedStrategies: {
    type: Array,
    required: true
  }
});

const emit = defineEmits(['update:selectedStrategies']);

const allSelected = computed({
  get: () => props.selectedStrategies.length === props.strategies.length,
  set: (value) => {
    if (value) {
      emit('update:selectedStrategies', props.strategies.map(s => s.name));
    } else {
      emit('update:selectedStrategies', []);
    }
  }
});

const toggleStrategy = (strategyName) => {
  const updatedSelection = props.selectedStrategies.includes(strategyName)
    ? props.selectedStrategies.filter(s => s !== strategyName)
    : [...props.selectedStrategies, strategyName];
  emit('update:selectedStrategies', updatedSelection);
};
</script>

<template>
  <div class="select-strats">
    <h3>Select Strategies</h3>
    <div class="strategy-options">
      <label>
        <input type="checkbox" v-model="allSelected" />
        All
      </label>
      <label v-for="strategy in strategies" :key="strategy.name">
        <input
          type="checkbox"
          :checked="selectedStrategies.includes(strategy.name)"
          @change="toggleStrategy(strategy.name)"
        />
        {{ strategy.name }}
      </label>
    </div>
  </div>
</template>

<style scoped>
.select-strats {
  background-color: rgba(30, 30, 30, 0.8);
  border-radius: 15px;
  padding: 15px;
  margin-top: 10px;
  width: 100%;
  max-width: 300px;
}

h3 {
  color: #ffffff;
  font-size: 1.2rem;
  margin-bottom: 10px;
}

.strategy-options {
  display: flex;
  flex-direction: column;
}

label {
  color: #a0a0a0;
  margin-bottom: 5px;
  display: flex;
  align-items: center;
}

input[type="checkbox"] {
  margin-right: 10px;
}
</style>