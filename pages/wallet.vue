<script setup>
import { ref, computed, onMounted } from 'vue';
import { useWalletsStore } from '@/stores/wallets';
import SelectStrats from '@/components/Wallet/SelectStrats.vue';
import WalletCapitalCounter from '@/components/Wallet/CapitalCounter.vue';
import WalletPortfolio from '@/components/Wallet/Portfolio.vue';
import WalletEvolution from '@/components/Wallet/Evolution.vue';
import WalletPositionTracker from '@/components/Wallet/PositionTracker.vue';
import TradesHistory from '@/components/Transactions/History.vue';
import Chart from '@/components/Chart.vue';
import WalletEvolutionAllocation from '@/components/Wallet/EvolutionAllocation.vue';

definePageMeta({
    title: "wallet",
    description: "Wallet",
    layout: "wallet",
});

const walletsStore = useWalletsStore();
const selectedCurrency = ref('USD');
const selectedAsset = ref('All');
const selectedWalletId = ref('wallet_001');

// Strategies for filtering (placeholder - would come from strategies store)
const strategies = ref([
  { name: 'All Assets', id: 'all' },
  { name: 'High Value', id: 'high_value' },
  { name: 'Crypto Only', id: 'crypto' }
]);
const selectedStrategies = ref(['all']);

// Initialize store data
onMounted(async () => {
  await walletsStore.initializeStore();
});

// Get the current wallet data
const currentWallet = computed(() => {
  return walletsStore.getWalletById(selectedWalletId.value) ||
         walletsStore.getDefaultWallet('user_001') ||
         walletsStore.wallets[0];
});

// Filter assets based on selected strategy
const filteredAssets = computed(() => {
  if (!currentWallet.value?.assets) return [];

  let assets = currentWallet.value.assets;

  // Filter by strategy selection
  if (!selectedStrategies.value.includes('all')) {
    if (selectedStrategies.value.includes('crypto')) {
      assets = assets.filter(asset => asset.symbol === 'BTC' || asset.symbol === 'ETH' || asset.symbol === 'ADA');
    }
    if (selectedStrategies.value.includes('high_value')) {
      assets = assets.filter(asset => asset.current_value > 10000);
    }
  }

  // Filter by selected asset
  if (selectedAsset.value !== 'All') {
    assets = assets.filter(asset => asset.symbol === selectedAsset.value);
  }

  return assets;
});

// Get transactions for the current wallet
const walletTransactions = computed(() => {
  return currentWallet.value?.transactions || [];
});

// Available assets for filtering
const availableAssets = computed(() => {
  if (!currentWallet.value?.assets) return ['All'];
  return ['All', ...currentWallet.value.assets.map(asset => asset.symbol)];
});

// Wallet summary data
const walletSummary = computed(() => {
  if (!currentWallet.value) return null;

  return {
    totalValue: currentWallet.value.total_value,
    availableBalance: currentWallet.value.available_balance,
    investedAmount: currentWallet.value.invested_amount,
    totalReturn: currentWallet.value.total_return,
    totalReturnPercentage: currentWallet.value.total_return_percentage,
    dailyChange: currentWallet.value.daily_change,
    dailyChangePercentage: currentWallet.value.daily_change_percentage,
    currency: currentWallet.value.currency
  };
});

const selectedPeriod = ref('30d');

const updatePeriod = (period) => {
  selectedPeriod.value = period;
};

const updateCurrency = (newCurrency) => {
  selectedCurrency.value = newCurrency;
};

const selectAsset = (asset) => {
  selectedAsset.value = asset;
};

// Computed properties for classes
const totalReturnClass = computed(() => ({
  'positive': (walletSummary.value?.totalReturn || 0) >= 0,
  'negative': (walletSummary.value?.totalReturn || 0) < 0
}));

const dailyChangeClass = computed(() => ({
  'positive': (walletSummary.value?.dailyChangePercentage || 0) >= 0,
  'negative': (walletSummary.value?.dailyChangePercentage || 0) < 0
}));

// Switch to next wallet
const switchWallet = () => {
  const currentIndex = walletsStore.wallets.findIndex(w => w.id === selectedWalletId.value);
  const nextIndex = (currentIndex + 1) % walletsStore.wallets.length;
  selectedWalletId.value = walletsStore.wallets[nextIndex].id;
};
</script>

<template>
  <div class="body-wallet">
    <!-- Wallet Header with Summary -->
    <div class="wallet-header">
      <div class="wallet-info">
        <h2>{{ currentWallet?.name || 'Portfolio' }}</h2>
        <div class="wallet-metrics">
          <span class="metric">
            <span class="metric-label">Total Return:</span>
            <span class="metric-value" :class="totalReturnClass">
              {{ walletSummary?.totalReturn >= 0 ? '+' : '' }}{{ walletSummary?.totalReturn?.toFixed(2) || '0.00' }} {{ walletSummary?.currency }}
            </span>
          </span>
          <span class="metric">
            <span class="metric-label">Daily Change:</span>
            <span class="metric-value" :class="dailyChangeClass">
              {{ walletSummary?.dailyChangePercentage >= 0 ? '+' : '' }}{{ walletSummary?.dailyChangePercentage?.toFixed(2) || '0.00' }}%
            </span>
          </span>
        </div>
      </div>
    </div>

    <!-- Strategy Selection -->
    <div class="strategy-selection">
      <SelectStrats
        :strategies="strategies"
        v-model:selectedStrategies="selectedStrategies"
      />
    </div>

    <!-- Asset Filter -->
    <div class="asset-filter">
      <select v-model="selectedAsset" @change="selectAsset(selectedAsset)">
        <option v-for="asset in availableAssets" :key="asset" :value="asset">
          {{ asset }}
        </option>
      </select>
    </div>

    <!-- Main Content -->
    <div class="wallet-content">
      <!-- Row 1: Capital Counter (Full Width) -->
      <div class="wallet-row single">
        <div class="wallet-component">
          <WalletCapitalCounter
            :total-value="walletSummary?.totalValue"
            :currency="walletSummary?.currency"
            :return-percentage="walletSummary?.totalReturnPercentage"
            @switch-wallet="switchWallet"
          />
        </div>
      </div>

      <!-- Row 2: Portfolio and Evolution -->
      <div class="wallet-row double">
        <div class="wallet-component">
          <WalletPortfolio
            :assets="filteredAssets"
            :total-value="walletSummary?.totalValue"
            @select-asset="selectAsset"
          />
        </div>
        <div class="wallet-component">
          <WalletEvolution
            :assets="filteredAssets"
            :transactions="walletTransactions"
            :selected-period="selectedPeriod"
            :wallet-id="selectedWalletId"
            @update-period="updatePeriod"
            @select-asset="selectAsset"
          />
        </div>
      </div>

      <!-- Row 3: Position Tracker and Trades History -->
      <div class="wallet-row double">
        <div class="wallet-component">
          <WalletPositionTracker :assets="filteredAssets" />
        </div>
        <div class="wallet-component">
          <TradesHistory :trades="walletTransactions" />
        </div>
      </div>

      <!-- Row 4: Charts and Allocation -->
      <div class="wallet-row double">
        <div class="wallet-component">
          <Chart
            :assets="filteredAssets"
            :transactions="walletTransactions"
            :selected-period="selectedPeriod"
          />
        </div>
        <div class="wallet-component">
          <WalletEvolutionAllocation
            :assets="filteredAssets"
            :transactions="walletTransactions"
            :selected-period="selectedPeriod"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.body-wallet {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    min-height: 100vh;
    margin: 0;
    padding: 4rem 1rem 2rem 1rem; /* Account for fixed topbar */
    background: linear-gradient(135deg, rgba(15, 15, 15, 0.98) 0%, rgba(20, 20, 20, 0.98) 100%);
    gap: 1.5rem;
}

.wallet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  margin-bottom: 1rem;
}

.wallet-info {
  text-align: center;
  color: white;
  width: 100%;
}

.wallet-info h2 {
  font-family: "Poppins", sans-serif;
  font-size: 2rem;
  font-weight: 700;
  margin: 0 0 1rem 0;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  background: linear-gradient(135deg, #ffffff 0%, rgba(255, 255, 255, 0.9) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.wallet-metrics {
  display: flex;
  justify-content: center;
  gap: 2rem;
}

.metric {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.metric-label {
  font-family: "Poppins", sans-serif;
  font-size: 0.9rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.7);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.metric-value {
  font-family: "Poppins", sans-serif;
  font-size: 1.3rem;
  font-weight: 700;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

.metric-value.positive {
  color: #4CAF50;
}

.metric-value.negative {
  color: #f44336;
}

/* Responsive design */
@media (max-width: 768px) {
  .wallet-metrics {
    flex-direction: column;
    gap: 1rem;
  }

  .wallet-info h2 {
    font-size: 1.5rem;
  }
}

.strategy-selection {
  display: flex;
  justify-content: flex-start;
  width: 100%;
  margin-bottom: 1rem;
}

.asset-filter {
  width: 100%;
  margin-bottom: 1rem;
}

.asset-filter select {
  background-color: rgba(30, 30, 30, 0.8);
  color: white;
  border: 1px solid #555;
  padding: 0.5rem;
  border-radius: 5px;
  font-size: 1rem;
}

.asset-filter select option {
  background-color: #333;
  color: white;
}

.wallet-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
  width: 100%;
  max-width: 1400px;
}

.wallet-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(450px, 1fr));
  gap: 1.5rem;
  width: 100%;
  align-items: start;
}

.wallet-row.single {
  grid-template-columns: 1fr;
  max-width: 600px;
}

.wallet-row.double {
  grid-template-columns: repeat(2, 1fr);
}

.wallet-component {
  width: 100%;
}

/* Compact spacing adjustments */
.strategy-selection {
  margin-bottom: 1rem;
  width: 100%;
  max-width: 300px;
}

.asset-filter {
  margin-bottom: 1rem;
  width: 100%;
  max-width: 300px;
}

/* Responsive design */
@media (max-width: 1024px) {
  .wallet-row {
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  .wallet-row.double {
    grid-template-columns: 1fr;
  }

  .body-wallet {
    padding: 4rem 1rem 2rem 1rem;
    gap: 1rem;
  }

  .wallet-content {
    gap: 1rem;
  }
}

@media (max-width: 768px) {
  .body-wallet {
    padding: 4rem 0.5rem 1rem 0.5rem;
  }

  .wallet-row {
    gap: 0.75rem;
  }

  .strategy-selection,
  .asset-filter {
    max-width: 100%;
  }
}
</style>