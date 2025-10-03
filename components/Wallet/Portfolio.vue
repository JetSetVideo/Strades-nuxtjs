<script setup>
import { ref, computed } from 'vue';
import { useWalletsStore } from '@/stores/wallets';

const walletsStore = useWalletsStore();
const portfolioId = ref('Portfolio1');

const portfolioData = computed(() => walletsStore.getWalletById(portfolioId.value));

const totalValue = computed(() => {
  return portfolioData.value.allocations.reduce((total, allocation) => total + allocation.value, 0);
});

const changePortfolio = () => {
  // Implement portfolio switching logic
  const portfolios = walletStore.getAllPortfolios();
  const currentIndex = portfolios.findIndex(p => p.id === portfolioId.value);
  const nextIndex = (currentIndex + 1) % portfolios.length;
  portfolioId.value = portfolios[nextIndex].id;
};

const convertToPercentage = (value) => `${((value / totalValue.value) * 100).toFixed(2)}%`;

const remainingPercentage = computed(() => {
  const used = portfolioData.value.allocations.reduce((total, allocation) => total + allocation.value, 0);
  return ((1 - used / totalValue.value) * 100).toFixed(2);
});
</script>

<template>
  <div class="portfolio-widget">
    <div class="portfolio-header">
      <h2>Portfolio: {{ portfolioId }}</h2>
      <button @click="changePortfolio" class="change-portfolio-btn">
        Switch Portfolio
      </button>
    </div>
    
    <UMeterGroup :max="totalValue">
      <template #indicator>
        <div class="meter-indicator">
          <p>{{ (100 - Number(remainingPercentage)).toFixed(2) }}% allocated</p>
          <p class="remaining">{{ remainingPercentage }}% remaining</p>
        </div>
      </template>

      <UMeter 
        v-for="allocation in portfolioData.allocations" 
        :key="allocation.type" 
        :value="allocation.value" 
        :color="allocation.color" 
        :label="`${allocation.type}: ${convertToPercentage(allocation.value)}`" 
        :icon="allocation.icon"
      />
    </UMeterGroup>

    <div class="total-value">
      Total Value: ${{ totalValue.toFixed(2) }}
    </div>
  </div>
</template>

<style scoped>
.portfolio-widget {
  background-color: rgba(30, 30, 30, 0.8);
  border-radius: 10px;
  padding: 20px;
  color: white;
}

.portfolio-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.change-portfolio-btn {
  background-color: #4CAF50;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 5px;
  cursor: pointer;
  transition: background-color 0.3s;
}

.change-portfolio-btn:hover {
  background-color: #45a049;
}

.meter-indicator {
  display: flex;
  justify-content: space-between;
  font-size: 0.875rem;
  margin-bottom: 10px;
}

.remaining {
  color: #9ca3af;
}

.total-value {
  margin-top: 15px;
  font-weight: bold;
  font-size: 1.1rem;
}
</style>