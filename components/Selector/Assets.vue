<script setup>
import { ref, onMounted } from 'vue';
import Asset from '@/components/Card/Asset.vue';
import axios from 'axios';

const props = defineProps({
  assets: {
    type: Array,
    required: true
  }
});

const assets = ref([]);

const selectedAssets = ref(new Set());

function toggleAssetSelection(assetId) {
  if (selectedAssets.value.has(assetId)) {
    selectedAssets.value.delete(assetId);
  } else {
    selectedAssets.value.add(assetId);
  }
}

async function fetchPrices() {
  try {
    const response = await axios.get('https://strades.app/api/get_prices/');
    const prices = response.data;
    assets.value = Object.keys(prices).map((key, index) => ({
      id: index + 1,
      name: key,
      symbol: key,
      sector: 'Cryptocurrency',
      stock_price_usd: prices[key],
      market_cap_usd: 0, // Assuming market cap is not provided
      urlIcon: `/images/${key.toLowerCase()}.png`
    }));
  } catch (error) {
    console.error('Failed to fetch prices:', error);
  }
}

onMounted(() => {
  fetchPrices();
  setInterval(fetchPrices, 60000); // Update prices every minute
});
</script>

<template>
  <div class="carousel-container">
    <div class="assets-carousel">
      <div v-for="asset in assets" :key="asset.id" class="asset-card-wrapper">
        <div 
          class="asset-card" 
          :class="{ 'asset-card-selected': selectedAssets.has(asset.id) }" 
          @click="toggleAssetSelection(asset.id)"
        >
          <img :src="asset.urlIcon" alt="asset.name" />
          <div class="asset-name">{{ asset.name }}</div>
          <div class="asset-details">
            <p>Symbol: {{ asset.symbol }}</p>
            <p>Price: ${{ asset.stock_price_usd }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.carousel-container {
  width: 100%;
  padding: 20px;
}

.assets-carousel {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
}

.asset-card-wrapper {
  flex: 1 1 calc(33.333% - 20px);
  box-sizing: border-box;
}

.asset-card {
  background-color: #333;
  color: white;
  padding: 20px;
  border-radius: 10px;
  cursor: pointer;
  text-align: center;
}

.asset-card-selected {
  border: 2px solid #fff;
}

.asset-name {
  font-size: 18px;
  font-weight: bold;
  margin-bottom: 10px;
}

.asset-details {
  font-size: 14px;
}
</style>