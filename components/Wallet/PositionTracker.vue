<script setup>
import { computed } from 'vue';

const props = defineProps(['assets']);

const totalValue = computed(() => {
  return props.assets.reduce((total, asset) => total + asset.value, 0);
});

const getAssetColor = (assetType) => {
  const colors = {
    Cryptocurrency: '#f7931a',
    Stablecoin: '#26a17b',
    Stock: '#0066cc',
    ETF: '#ff6600',
  };
  return colors[assetType] || '#000000';
};

const groupedAssets = computed(() => {
  return props.assets.reduce((groups, asset) => {
    if (!groups[asset.type]) {
      groups[asset.type] = [];
    }
    groups[asset.type].push(asset);
    return groups;
  }, {});
});
</script>

<template>
  <div class="position-tracker">
    <h3>Position Tracker</h3>
    <div v-for="(assets, type) in groupedAssets" :key="type">
      <h4>{{ type }}</h4>
      <ul>
        <li v-for="asset in assets" :key="asset.name" :style="{ color: getAssetColor(asset.type) }">
          {{ asset.name }}: {{ asset.amount }} (Value: ${{ asset.value.toFixed(2) }})
        </li>
      </ul>
    </div>
    <p>Total Value: ${{ totalValue.toFixed(2) }}</p>
  </div>
</template>

<style scoped>
.position-tracker {
  width: 100%;
  margin-bottom: 1rem;
}

ul {
  list-style-type: none;
  padding: 0;
}

li {
  margin-bottom: 0.5rem;
}

h4 {
  margin-top: 1rem;
  margin-bottom: 0.5rem;
}
</style>