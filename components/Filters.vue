<script setup>
import { ref } from 'vue';

const filters = ref({
  profitRange: [0, 100],
  drawdownRange: [0, 100],
  assets: [],
});

const emit = defineEmits(['filter-changed']);

function updateFilters() {
  emit('filter-changed', filters.value);
}
</script>

<template>
  <div class="filters">
    <h3>Filters</h3>
    <div class="filter-group">
      <label>Profit Range:</label>
      <input type="range" v-model="filters.profitRange[0]" min="0" max="100" @input="updateFilters">
      <input type="range" v-model="filters.profitRange[1]" min="0" max="100" @input="updateFilters">
      <span>{{ filters.profitRange[0] }}% - {{ filters.profitRange[1] }}%</span>
    </div>
    <div class="filter-group">
      <label>Drawdown Range:</label>
      <input type="range" v-model="filters.drawdownRange[0]" min="0" max="100" @input="updateFilters">
      <input type="range" v-model="filters.drawdownRange[1]" min="0" max="100" @input="updateFilters">
      <span>{{ filters.drawdownRange[0] }}% - {{ filters.drawdownRange[1] }}%</span>
    </div>
    <!-- Add more filter options as needed -->
  </div>
</template>

<style scoped>
.filters {
  background-color: rgba(40, 40, 40, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  padding: 15px;
  margin-bottom: 20px;
}

.filter-group {
  margin-bottom: 10px;
}

label {
  display: block;
  margin-bottom: 5px;
}

input[type="range"] {
  width: 100%;
  margin-bottom: 5px;
}
</style>