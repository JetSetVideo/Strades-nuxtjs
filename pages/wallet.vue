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
const selectedPeriod = ref('30d');
const selectedStrategies = ref(['all']); // This can be removed if not used, or managed in the page

// Initialize store data
onMounted(async () => {
  await walletsStore.initializeStore();
  // Set default wallet if none is selected
  if (!selectedWalletId.value) {
    const defaultWallet = walletsStore.getDefaultWallet('user_001');
    if (defaultWallet) {
      selectedWalletId.value = defaultWallet.id;
    } else if (walletsStore.wallets.length > 0) {
      selectedWalletId.value = walletsStore.wallets[0].id;
    }
  }
});

const currentWallet = computed(() => walletsStore.getWalletById(selectedWalletId.value));

const walletSummary = computed(() => {
  if (!currentWallet.value) return null;
  return {
    totalValue: currentWallet.value.total_value,
    currency: currentWallet.value.currency,
    totalReturnPercentage: currentWallet.value.total_return_percentage,
  };
});

const filteredAssets = computed(() => {
    if (!currentWallet.value) return [];
    if (selectedAsset.value === 'All') return currentWallet.value.assets;
    return currentWallet.value.assets.filter(asset => asset.symbol === selectedAsset.value);
});

const walletTransactions = computed(() => currentWallet.value?.transactions || []);

const availableAssets = computed(() => {
    if (!currentWallet.value) return ['All'];
    return ['All', ...currentWallet.value.assets.map(a => a.symbol)];
});

const handleAllocationUpdate = (payload) => {
    selectedAsset.value = payload.asset;
    selectedPeriod.value = payload.period;
};

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
        <WalletCapitalCounter
            :total-value="walletSummary?.totalValue"
            :currency="walletSummary?.currency"
            :return-percentage="walletSummary?.totalReturnPercentage"
            :wallet-name="currentWallet?.name"
            @switch-wallet="switchWallet"
          />
    </div>

    <!-- Main Content -->
    <div class="wallet-content">
      <!-- Row 2: Portfolio and Evolution -->
      <div class="wallet-row double">
        <div class="wallet-component">
          <WalletPortfolio
            :assets="filteredAssets"
            :total-value="walletSummary?.totalValue"
            @select-asset="selectedAsset = $event"
          />
        </div>
        <div class="wallet-component">
            <div class="evolution-allocation-container">
              <WalletEvolution
                :assets="filteredAssets"
                :transactions="walletTransactions"
                :selected-period="selectedPeriod"
                :wallet-id="selectedWalletId"
                @update-period="selectedPeriod = $event"
                @select-asset="selectedAsset = $event"
              />
              <WalletEvolutionAllocation
                :assets="filteredAssets"
                :transactions="walletTransactions"
                :selected-period="selectedPeriod"
                @update-selection="handleAllocationUpdate"
              />
            </div>
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
          <!-- This might be redundant now -->
        </div>
      </div>
    </div>
    <div style="height: 100px;"></div> <!-- Spacer -->
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
    padding-bottom: 100px;
}

.wallet-header {
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

.evolution-allocation-container {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
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