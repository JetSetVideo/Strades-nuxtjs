<script setup>
import { ref, computed, onMounted } from 'vue';
import { useWalletsStore } from '@/stores/wallets';
import { useWalletStore } from '@/stores/wallet'; // Phase 3 store
import WalletCapitalCounter from '@/components/Wallet/CapitalCounter.vue';
import WalletPortfolio from '@/components/Wallet/Portfolio.vue';
import WalletEvolution from '@/components/Wallet/Evolution.vue';
import WalletPositionTracker from '@/components/Wallet/PositionTracker.vue';
import TradesHistory from '@/components/Transactions/History.vue';
import Chart from '@/components/Chart.vue';
import WalletEvolutionAllocation from '@/components/Wallet/EvolutionAllocation.vue';
import WalletAllocationSlider from '@/components/Wallet/AllocationSlider.vue';
import WalletFlowVisualizer from '@/components/Wallet/FlowVisualizer.vue';

definePageMeta({
    title: "wallet",
    description: "Wallet",
    layout: "wallet",
});

const walletsStore = useWalletsStore();
const allocationStore = useWalletStore(); // Global 100% allocation
const selectedCurrency = ref('USD');
const selectedAsset = ref('All');
const selectedWalletId = ref('wallet_001');
const selectedPeriod = ref('30d');

onMounted(async () => {
  await walletsStore.initializeStore();
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
  <WalletFlowVisualizer>
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
        <!-- New 100% Allocation Enforcer Row -->
        <div class="wallet-row single">
          <div class="wallet-component slider-container">
            <WalletAllocationSlider />
          </div>
        </div>

        <!-- Row 2: Portfolio and Evolution -->
        <div class="wallet-row double">
          <div class="wallet-component relative-z">
            <WalletPortfolio
              :assets="filteredAssets"
              :total-value="walletSummary?.totalValue"
              @select-asset="selectedAsset = $event"
            />
          </div>
          <div class="wallet-component relative-z">
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
        <div class="wallet-row double relative-z">
          <div class="wallet-component">
            <WalletPositionTracker :assets="filteredAssets" />
          </div>
          <div class="wallet-component">
            <TradesHistory :trades="walletTransactions" />
          </div>
        </div>
      </div>
      <div style="height: 100px;"></div> <!-- Spacer -->
    </div>
  </WalletFlowVisualizer>
</template>

<style scoped>
.body-wallet {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    min-height: 100vh;
    margin: 0;
    padding: 4rem 1rem 2rem 1rem; 
    gap: 1.5rem;
    padding-bottom: 100px;
    position: relative;
    z-index: 1; /* Above FlowVisualizer */
}

.relative-z {
  position: relative;
  z-index: 2;
}

.wallet-header {
  width: 100%;
  margin-bottom: 1rem;
  z-index: 2;
}

.slider-container {
  max-width: 800px;
  margin: 0 auto;
  z-index: 2;
  position: relative;
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
  width: 100%;
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
}

@media (max-width: 768px) {
  .body-wallet {
    padding: 4rem 0.5rem 1rem 0.5rem;
  }
  .wallet-row {
    gap: 0.75rem;
  }
}
</style>