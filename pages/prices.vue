<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { navigateTo } from '#app';
import { useAssetsStore } from "@/stores/assets";
import DisplayAsset from '@/components/Widget/DisplayAsset.vue';
import Heatmap from '@/components/Asset/Heatmap.vue';
import AssetsSelector from '@/components/Selector/Assets.vue';

definePageMeta({
    title: "Market Prices",
    description: "Live asset prices and market data",
    layout: "prices",
});

const assetsStore = useAssetsStore();
const selectedType = ref('all');
const selectedAssetId = ref(null);
const showMoreAssets = ref(false);
const loading = ref(false);

// Real-time price simulation
let priceInterval

function startRealTimeUpdates() {
  priceInterval = setInterval(() => {
    // Simulate random price changes for displayed assets
    displayedAssets.value.forEach(asset => {
      const change = getRandomChange();
      asset.current_price += asset.current_price * (change / 100);
      asset.current_price = Math.max(0.01, asset.current_price); // Prevent negative prices
    });
  }, 5000); // Update every 5 seconds
}

function stopRealTimeUpdates() {
  if (priceInterval) {
    clearInterval(priceInterval);
  }
}

// Initialize store on mount
onMounted(async () => {
  loading.value = true;
  await assetsStore.initializeStore();
  loading.value = false;

  // Start real-time price updates
  startRealTimeUpdates();
});

// Cleanup on unmount
onUnmounted(() => {
  stopRealTimeUpdates();
});

// Get unique asset types for filtering
const availableTypes = computed(() => {
  const types = new Set(assetsStore.assets.map(asset => asset.type));
  return ['all', ...Array.from(types)];
});

// Get unique categories for advanced filtering
const availableCategories = computed(() => {
  const categories = new Set(assetsStore.assets.map(asset => asset.category));
  return Array.from(categories);
});

// Filter assets based on selected type
const filteredAssets = computed(() => {
  if (selectedType.value === 'all') {
    return assetsStore.assets;
  }
  return assetsStore.assets.filter(asset => asset.type === selectedType.value);
});

// Display first 6 assets, with option to show more
const displayedAssets = computed(() => {
  return filteredAssets.value.slice(0, 6);
});

const remainingAssets = computed(() => {
  return filteredAssets.value.slice(6);
});

// Generate random price change for demo purposes
function getRandomChange() {
  return (Math.random() - 0.5) * 10; // Between -5% and +5%
}

function selectAsset(id) {
  selectedAssetId.value = id;
}

function toggleShowMoreAssets() {
  showMoreAssets.value = !showMoreAssets.value;
}

function navigateToAsset(assetId) {
  navigateTo(`/assets/${assetId}`);
}
</script>

<template>
  <div class="prices-page">
    <!-- Header -->
    <div class="page-header">
      <div class="last-updated" v-if="assetsStore.lastUpdated">
        Last updated: {{ new Date(assetsStore.lastUpdated).toLocaleTimeString() }}
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading-state">
      <div class="loading-spinner"></div>
      <p>Loading market data...</p>
    </div>

    <!-- Type Filters -->
    <div v-else class="filters-section">
      <div class="type-filters">
        <button
          v-for="type in availableTypes"
          :key="type"
          @click="selectedType = type"
          :class="['filter-btn', { active: selectedType === type }]"
        >
          {{ type === 'all' ? 'All Assets' : type.replace('_', ' ').toUpperCase() }}
        </button>
      </div>
    </div>

    <!-- Asset Display -->
    <div v-if="!loading" class="assets-section">
      <!-- Heatmap for selected asset -->
      <Heatmap :companyId="selectedAssetId" v-if="selectedAssetId" />

      <!-- Primary Assets Grid -->
      <div class="asset-grid">
        <DisplayAsset
          v-for="asset in displayedAssets"
          :key="asset.id"
          :assetName="asset.name"
          :tagName="asset.symbol"
          :nominalPrice="`$${asset.current_price.toFixed(asset.current_price < 1 ? 4 : 2)}`"
          :percentagePrice="`${getRandomChange().toFixed(2)}%`"
          :profileIcon="asset.icon_url"
          :dailyChart="'/backgrounds/DailyPriceChart.png'"
          :assetId="asset.id"
          @click="navigateToAsset"
        />
      </div>

      <!-- Show More Button -->
      <div class="show-more-section" v-if="remainingAssets.length > 0">
        <button @click="toggleShowMoreAssets" class="show-more-btn">
          {{ showMoreAssets ? 'Show Less' : `Show ${remainingAssets.length} More Assets` }}
        </button>
      </div>

      <!-- Additional Assets -->
      <div v-if="showMoreAssets" class="asset-grid additional-assets">
        <DisplayAsset
          v-for="asset in remainingAssets"
          :key="asset.id"
          :assetName="asset.name"
          :tagName="asset.symbol"
          :nominalPrice="`$${asset.current_price.toFixed(asset.current_price < 1 ? 4 : 2)}`"
          :percentagePrice="`${getRandomChange().toFixed(2)}%`"
          :profileIcon="asset.icon_url"
          :dailyChart="'/backgrounds/DailyPriceChart.png'"
          :assetId="asset.id"
          @click="navigateToAsset"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.prices-page {
  min-height: 100vh;
  background: var(--bg-primary);
  color: var(--text-white);
  padding: 5rem 1rem 6rem 1rem; /* Added top padding to account for Top Nav and bottom for Bottom Nav */
}

.page-header {
  display: flex;
  flex-direction: row;
  justify-content: flex-end; /* Align last-updated to the right */
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.last-updated {
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.75rem;
  font-family: 'Poppins', sans-serif;
}

/* Responsive Design */
@media (min-width: 768px) {
  .prices-page {
    padding: 6rem 2rem 6rem 2rem;
  }

  .last-updated {
    font-size: 0.85rem;
  }
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-xxl);
  color: var(--text-gray);
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--border-primary);
  border-top: 3px solid var(--primary-green);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: var(--spacing-lg);
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.filters-section {
  margin-bottom: var(--spacing-xl);
}

.type-filters {
  display: flex;
  gap: var(--spacing-sm);
  flex-wrap: wrap;
}

.filter-btn {
  padding: var(--spacing-xs) var(--spacing-md);
  background: var(--bg-secondary);
  border: 1px solid var(--border-secondary);
  border-radius: var(--radius-md);
  color: var(--text-white);
  cursor: pointer;
  transition: var(--transition-normal);
  text-transform: uppercase;
  font-size: 0.8rem;
  font-weight: 500;
  font-family: var(--font-family-secondary);
}

.filter-btn:hover {
  background: var(--bg-tertiary);
  border-color: var(--border-primary);
}

.filter-btn.active {
  background: var(--primary-gradient);
  border-color: var(--primary-green);
  color: var(--secondary-darker);
}

.assets-section {
  width: 100%;
}

.asset-grid {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-xl);
}

.additional-assets {
  opacity: 0.8;
  animation: fadeIn var(--transition-slow);
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(var(--spacing-lg));
  }
  to {
    opacity: 0.8;
    transform: translateY(0);
  }
}

.show-more-section {
  display: flex;
  justify-content: center;
  margin-bottom: var(--spacing-xl);
}

.show-more-btn {
  padding: var(--spacing-sm) var(--spacing-xl);
  background: var(--primary-gradient);
  border: none;
  border-radius: var(--radius-lg);
  color: var(--secondary-darker);
  font-weight: 600;
  cursor: pointer;
  transition: var(--transition-normal);
  text-transform: uppercase;
  font-size: 0.9rem;
  font-family: var(--font-family-secondary);
}

.show-more-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 20px var(--shadow-accent);
}

/* Responsive Design */
@media (max-width: 768px) {
  .prices-page {
    padding: var(--spacing-md);
  }

  .page-header {
    flex-direction: column;
    gap: var(--spacing-md);
    align-items: flex-start;
  }

  .page-title {
    font-size: 2rem;
  }

  .asset-grid {
    gap: var(--spacing-sm);
  }

  .type-filters {
    justify-content: center;
  }
}

@media (max-width: 480px) {
  .asset-grid {
    gap: var(--spacing-xs);
  }

  .filter-btn {
    flex: 1;
    min-width: 100px;
  }
}
</style>
