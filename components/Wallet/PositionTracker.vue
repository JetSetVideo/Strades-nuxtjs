<script setup>
import { computed } from 'vue';

const props = defineProps({
  assets: {
    type: Array,
    default: () => []
  }
});

const totalValue = computed(() => {
  return props.assets.reduce((total, asset) => total + (asset.current_value || 0), 0);
});

const getAssetColor = (symbol) => {
  const colors = {
    'BTC': '#f7931a',
    'ETH': '#627eea',
    'AAPL': '#000000',
    'TSLA': '#cc0000',
    'ADA': '#0033ad'
  };
  return colors[symbol] || '#666666';
};

const groupedAssets = computed(() => {
  return props.assets.reduce((groups, asset) => {
    // Group by asset type or symbol
    const groupKey = asset.symbol || 'Unknown';
    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(asset);
    return groups;
  }, {});
});
</script>

<template>
  <div class="position-tracker">
    <div class="tracker-header">
      <h3>Position Tracker</h3>
      <div class="total-summary">
        <span class="total-label">Portfolio Total</span>
        <span class="total-value">${{ totalValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) }}</span>
      </div>
    </div>

    <div class="positions-list">
      <div
        v-for="(assets, symbol) in groupedAssets"
        :key="symbol"
        class="position-group"
      >
        <div class="group-header">
          <div class="asset-icon" :style="{ backgroundColor: getAssetColor(symbol) }">
            {{ getAssetIcon(symbol) }}
          </div>
          <div class="group-info">
            <h4>{{ symbol }}</h4>
            <span class="asset-name">{{ symbol === 'BTC' ? 'Bitcoin' : symbol === 'ETH' ? 'Ethereum' : symbol === 'AAPL' ? 'Apple' : symbol === 'TSLA' ? 'Tesla' : 'Asset' }}</span>
          </div>
          <div class="group-total">
            <div class="total-amount">${{ assets.reduce((sum, asset) => sum + (asset.current_value || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) }}</div>
            <div class="total-return" :style="{ color: assets[0]?.return_percentage >= 0 ? '#4CAF50' : '#f44336' }">
              {{ assets[0]?.return_percentage >= 0 ? '+' : '' }}{{ assets[0]?.return_percentage?.toFixed(2) || '0.00' }}%
            </div>
          </div>
        </div>

        <div class="position-details">
          <div
            v-for="asset in assets"
            :key="asset.symbol"
            class="position-item"
          >
            <div class="position-info">
              <span class="position-amount">{{ asset.amount }} {{ asset.symbol }}</span>
              <span class="position-value">${{ asset.current_value?.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) || '0' }}</span>
            </div>
            <div class="position-return" :style="{ color: asset.return_percentage >= 0 ? '#4CAF50' : '#f44336' }">
              {{ asset.return_percentage >= 0 ? '+' : '' }}{{ asset.return_percentage?.toFixed(2) || '0.00' }}%
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.position-tracker {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%);
  backdrop-filter: blur(20px);
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
  padding: 30px;
  color: white;
  min-width: 400px;
  transition: all 0.3s ease;
}

.position-tracker:hover {
  transform: translateY(-3px);
  box-shadow:
    0 15px 45px rgba(0, 0, 0, 0.15),
    inset 0 1px 0 rgba(255, 255, 255, 0.3);
}

.tracker-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 25px;
  padding-bottom: 15px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.tracker-header h3 {
  font-family: "Poppins", sans-serif;
  font-size: 1.5rem;
  font-weight: 700;
  color: white;
  margin: 0;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.total-summary {
  text-align: right;
}

.total-label {
  font-family: "Poppins", sans-serif;
  font-size: 0.8rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.7);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  display: block;
}

.total-value {
  font-family: "Poppins", sans-serif;
  font-size: 1.3rem;
  font-weight: 700;
  color: white;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.positions-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.position-group {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  overflow: hidden;
  transition: all 0.3s ease;
}

.position-group:hover {
  background: rgba(255, 255, 255, 0.08);
  transform: translateY(-2px);
}

.group-header {
  display: flex;
  align-items: center;
  padding: 16px;
  background: rgba(255, 255, 255, 0.05);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.asset-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  color: white;
  margin-right: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.group-info {
  flex: 1;
}

.group-info h4 {
  font-family: "Poppins", sans-serif;
  font-size: 1.1rem;
  font-weight: 700;
  color: white;
  margin: 0 0 4px 0;
}

.asset-name {
  font-family: "Poppins", sans-serif;
  font-size: 0.8rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.7);
}

.group-total {
  text-align: right;
}

.total-amount {
  font-family: "Poppins", sans-serif;
  font-size: 1.1rem;
  font-weight: 700;
  color: white;
  margin-bottom: 2px;
}

.total-return {
  font-family: "Poppins", sans-serif;
  font-size: 0.8rem;
  font-weight: 600;
}

.position-details {
  padding: 16px;
}

.position-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.position-item:last-child {
  border-bottom: none;
}

.position-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.position-amount {
  font-family: "Poppins", sans-serif;
  font-size: 0.9rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.8);
}

.position-value {
  font-family: "Poppins", sans-serif;
  font-size: 0.8rem;
  font-weight: 600;
  color: white;
}

.position-return {
  font-family: "Poppins", sans-serif;
  font-size: 0.9rem;
  font-weight: 600;
}

/* Responsive design */
@media (max-width: 768px) {
  .position-tracker {
    padding: 20px;
    min-width: 320px;
  }

  .tracker-header {
    flex-direction: column;
    gap: 15px;
    text-align: center;
  }

  .group-header {
    flex-direction: column;
    gap: 10px;
    text-align: center;
  }

  .group-total {
    text-align: center;
  }
}
</style>