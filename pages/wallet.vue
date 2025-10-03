<script setup>
import { ref, computed } from 'vue';
import { useWalletsStore } from '@/stores/wallets';
import SelectStrats from '@/components/Wallet/SelectStrats.vue';

definePageMeta({
    title: "wallet",
    description: "Wallet",
    layout: "wallet",
});

const walletsStore = useWalletsStore();
const selectedCurrency = ref('BTC');
const selectedAsset = ref('All');
const strategies = ref([
  { name: 'Strategy 1' },
  { name: 'Strategy 2' },
  { name: 'Strategy 3' }
]);
const selectedStrategies = ref(strategies.value.map(s => s.name));

const filteredWalletData = computed(() => {
  // Filter wallet data based on selected strategies
  // This is a placeholder implementation. You'll need to adjust this based on your actual data structure
  return selectedStrategies.value.length === strategies.value.length
    ? walletData.value
    : {
        ...walletData.value,
        assets: walletData.value.assets.filter(asset => 
          selectedStrategies.value.some(strategy => asset.strategy === strategy)
        ),
        trades: walletData.value.trades.filter(trade => 
          selectedStrategies.value.some(strategy => trade.strategy === strategy)
        ),
      };
});

const walletData = computed(() => walletStore.getWalletData(selectedCurrency.value));

const filteredData = computed(() => {
  if (selectedAsset.value === 'All') {
    return walletData.value;
  } else {
    return {
      ...walletData.value,
      assets: walletData.value.assets.filter(asset => asset.name === selectedAsset.value),
      trades: walletData.value.trades.filter(trade => trade.asset === selectedAsset.value),
    };
  }
});

const selectedPeriod = ref(null);

const updatePeriod = (period) => {
  selectedPeriod.value = period;
};

const updateCurrency = (newCurrency) => {
  selectedCurrency.value = newCurrency;
};

const selectAsset = (asset) => {
  selectedAsset.value = asset;
};
</script>

<template>
    <div class="body-wallet">
      <WalletCapitalCounter 
        :total-balance="filteredData.totalBalance" 
        :selected-currency="selectedCurrency"
        @update-currency="updateCurrency"
      />
      <div class="strategy-selection">
        <SelectStrats
          :strategies="strategies"
          v-model:selectedStrategies="selectedStrategies"
        />
      </div>
      <Chart :trades="filteredData.trades" :assets="filteredData.assets" :prices="walletStore.prices" />
        <WalletPortfolio :assets="filteredData.assets" @select-asset="selectAsset" />
        <WalletEvolution 
        :trades="filteredData.trades" 
        :assets="filteredData.assets" 
        :prices="walletStore.prices"
        :selected-period="selectedPeriod"
        />
        <WalletEvolutionAllocation 
        :trades="filteredData.trades" 
        :assets="filteredData.assets"
        @update-period="updatePeriod"
        />
        <WalletPositionTracker :assets="filteredData.assets" />
        <TradesHistory :trades="filteredData.trades" />
    </div>
  </template>

<style scoped>
.body-wallet {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    min-height: 100vh;
    margin: 1rem;
    padding: 1rem 1rem 8rem;
    background-color: rgba(20, 20, 20, 0.2);
    border-radius: 0.5rem;
}
.strategy-selection {
  display: flex;
  justify-content: flex-start;
  width: 100%;
  margin-bottom: 1rem;
}
</style>