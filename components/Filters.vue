<script setup>
import { ref } from 'vue';

const filters = ref({
  profitRange: [0, 100],
  drawdownRange: [0, 100],
  assets: [],
});

const emit = defineEmits(['filter-changed']);

const availableAssets = [
  'BTC', 'ETH', 'AAPL', 'GOOGL', 'MSFT', 'USD', 'EUR', 'XRP'
];

function updateFilters() {
  emit('filter-changed', filters.value);
}

function toggleAsset(asset) {
  const index = filters.value.assets.indexOf(asset);
  if (index > -1) {
    filters.value.assets.splice(index, 1);
  } else {
    filters.value.assets.push(asset);
  }
  updateFilters();
}

function resetFilters() {
  filters.value = {
    profitRange: [0, 100],
    drawdownRange: [0, 100],
    assets: [],
  };
  updateFilters();
}
</script>

<template>
  <div class="filters">
    <div class="filters-header">
      <h3>Filters</h3>
      <button @click="resetFilters" class="reset-btn">Reset</button>
    </div>

    <div class="filter-group">
      <label>Profit Range:</label>
      <div class="range-inputs">
        <input type="range" v-model="filters.profitRange[0]" min="0" max="100" @input="updateFilters">
        <input type="range" v-model="filters.profitRange[1]" min="0" max="100" @input="updateFilters">
      </div>
      <span class="range-display">{{ filters.profitRange[0] }}% - {{ filters.profitRange[1] }}%</span>
    </div>

    <div class="filter-group">
      <label>Drawdown Range:</label>
      <div class="range-inputs">
        <input type="range" v-model="filters.drawdownRange[0]" min="0" max="100" @input="updateFilters">
        <input type="range" v-model="filters.drawdownRange[1]" min="0" max="100" @input="updateFilters">
      </div>
      <span class="range-display">{{ filters.drawdownRange[0] }}% - {{ filters.drawdownRange[1] }}%</span>
    </div>

    <div class="filter-group">
      <label>Assets:</label>
      <div class="asset-buttons">
        <button
          v-for="asset in availableAssets"
          :key="asset"
          @click="toggleAsset(asset)"
          :class="['asset-btn', { 'selected': filters.assets.includes(asset) }]"
        >
          {{ asset }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.filters {
  background-color: rgba(40, 40, 40, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 10px;
  margin-bottom: 15px;
  box-shadow:
    inset 0 1px 2px rgba(0, 0, 0, 0.5),
    0 2px 4px rgba(0, 0, 0, 0.2);
}

.filters-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.reset-btn {
  background-color: rgba(128, 128, 128, 0.8);
  color: white;
  border: none;
  padding: 4px 8px;
  border-radius: 3px;
  cursor: pointer;
  font-size: 0.8em;
  transition: background-color 0.3s ease;
}

.reset-btn:hover {
  background-color: rgba(100, 100, 100, 0.8);
}

.filter-group {
  margin-bottom: 12px;
}

label {
  display: block;
  margin-bottom: 4px;
  font-weight: bold;
  font-size: 0.9em;
}

.range-inputs {
  display: flex;
  gap: 8px;
  margin-bottom: 4px;
}

input[type="range"] {
  flex: 1;
  height: 4px;
  border-radius: 2px;
  background: rgba(100, 100, 100, 0.5);
  outline: none;
}

.range-display {
  font-size: 0.8em;
  color: rgba(200, 200, 200, 1);
  text-align: center;
  display: block;
}

.asset-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.asset-btn {
  padding: 4px 8px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 3px;
  background-color: rgba(60, 60, 60, 0.8);
  color: white;
  cursor: pointer;
  font-size: 0.8em;
  transition: all 0.3s ease;
}

.asset-btn:hover {
  background-color: rgba(80, 80, 80, 0.8);
}

.asset-btn.selected {
  background-color: rgba(0, 123, 255, 0.8);
  border-color: rgba(0, 123, 255, 1);
  box-shadow: 0 0 8px rgba(0, 123, 255, 0.4);
}
</style>