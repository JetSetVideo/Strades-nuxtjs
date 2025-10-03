<script setup>
import { ref, computed } from 'vue';
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
const selectedCategory = ref(assetsStore.assets.categories[0]?.name);
const selectedCompanyId = ref(null);
const showMoreAssets = ref(false);

const filteredAssets = computed(() => {
  const category = assetsStore.assets.categories.find(c => c.name === selectedCategory.value);
  return category ? category.companies : [];
});

const displayedAssets = computed(() => {
  return filteredAssets.value.slice(0, 5);
});

const remainingAssets = computed(() => {
  return filteredAssets.value.slice(5);
});

function toggleShowMoreAssets() {
  showMoreAssets.value = !showMoreAssets.value;
}

function selectCompany(id) {
  selectedCompanyId.value = id;
}
</script>

<template>
  <div class="prices-page">
    <h1>Market Prices</h1>
    <AssetsSelector :assets="assetsStore.assets.categories" @select="selectedCategory = $event" />
    <Heatmap :companyId="selectedCompanyId" v-if="selectedCompanyId" />
    <div class="asset-list">
      <DisplayAsset
        v-for="asset in displayedAssets"
        :key="asset.id"
        :assetName="asset.name"
        :tagName="asset.symbol"
        :nominalPrice="asset.stock_price_usd"
        :percentagePrice="asset.change_percent"
        :profileIcon="asset.profileIcon"
        :dailyChart="asset.dailyChart"
        @click="selectCompany(asset.id)"
      />
    </div>
    <button @click="toggleShowMoreAssets" v-if="remainingAssets.length > 0">
      {{ showMoreAssets ? 'Show Less' : 'Show More' }}
    </button>
    <div v-if="showMoreAssets" class="asset-list">
      <DisplayAsset
        v-for="asset in remainingAssets"
        :key="asset.id"
        :assetName="asset.name"
        :tagName="asset.symbol"
        :nominalPrice="asset.stock_price_usd"
        :percentagePrice="asset.change_percent"
        :profileIcon="asset.profileIcon"
        :dailyChart="asset.dailyChart"
        @click="selectCompany(asset.id)"
      />
    </div>
  </div>
</template>

<style scoped>
.prices-page {
  padding: 20px;
  background-color: rgba(18, 18, 18, 0.9);
  color: white;
}

.asset-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 10px;
  margin-top: 20px;
}

button {
  margin-top: 20px;
  padding: 10px 20px;
  background-color: #333;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
}
</style>
