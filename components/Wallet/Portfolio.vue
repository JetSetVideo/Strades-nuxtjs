<script setup>
import { computed } from 'vue';

const props = defineProps({
  assets: {
    type: Array,
    default: () => []
  },
  totalValue: {
    type: Number,
    default: 0
  }
});

const emit = defineEmits(['select-asset']);

const totalValue = computed(() => {
  return props.totalValue || props.assets.reduce((total, asset) => total + (asset.current_value || 0), 0);
});

const convertToPercentage = (value) => `${((value / totalValue.value) * 100).toFixed(2)}%`;

const remainingPercentage = computed(() => {
  const used = props.assets.reduce((total, asset) => total + (asset.current_value || 0), 0);
  return ((1 - used / totalValue.value) * 100).toFixed(2);
});

const getAssetColor = (symbol) => {
  // Simple color mapping based on symbol
  const colors = {
    'BTC': '#f7931a',
    'ETH': '#627eea',
    'AAPL': '#000000',
    'TSLA': '#cc0000'
  };
  return colors[symbol] || '#666666';
};

const getAssetIcon = (symbol) => {
  // Simple icon mapping - in a real app, you'd have actual icons
  const icons = {
    'BTC': '₿',
    'ETH': 'Ξ',
    'AAPL': '🍎',
    'TSLA': '🚗'
  };
  return icons[symbol] || '📊';
};
</script>

<template>
  <div class="portfolio-widget">
    <div class="portfolio-header">
      <h2>Portfolio Allocation</h2>
      <div class="portfolio-stats">
        <div class="stat-item">
          <span class="stat-label">Total</span>
          <span class="stat-value">${{ totalValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) }}</span>
        </div>
      </div>
    </div>

    <div class="allocation-overview">
      <div class="allocation-progress">
        <div class="progress-bar">
          <div
            v-for="asset in assets"
            :key="asset.symbol"
            class="progress-segment"
            :style="{
              width: `${(asset.current_value / totalValue) * 100}%`,
              backgroundColor: getAssetColor(asset.symbol)
            }"
            :title="`${asset.symbol}: ${convertToPercentage(asset.current_value)}`"
          ></div>
        </div>
        <div class="progress-labels">
          <span>{{ (100 - Number(remainingPercentage)).toFixed(1) }}% Allocated</span>
          <span class="remaining">{{ remainingPercentage }}% Available</span>
        </div>
      </div>
    </div>

    <div class="assets-list">
      <div
        v-for="asset in assets"
        :key="asset.symbol"
        class="asset-item"
        @click="$emit('select-asset', asset.symbol)"
      >
        <div class="asset-info">
          <div class="asset-icon" :style="{ backgroundColor: getAssetColor(asset.symbol) }">
            {{ getAssetIcon(asset.symbol) }}
          </div>
          <div class="asset-details">
            <div class="asset-symbol">{{ asset.symbol }}</div>
            <div class="asset-name">{{ asset.symbol === 'BTC' ? 'Bitcoin' : asset.symbol === 'ETH' ? 'Ethereum' : asset.symbol === 'AAPL' ? 'Apple' : asset.symbol === 'TSLA' ? 'Tesla' : 'Asset' }}</div>
          </div>
        </div>
        <div class="asset-value">
          <div class="value-amount">${{ asset.current_value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) }}</div>
          <div class="value-percentage">{{ convertToPercentage(asset.current_value) }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.portfolio-widget {
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

.portfolio-widget:hover {
  transform: translateY(-3px);
  box-shadow:
    0 12px 40px rgba(0, 0, 0, 0.15),
    inset 0 1px 0 rgba(255, 255, 255, 0.3);
}

.portfolio-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 25px;
  padding-bottom: 15px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.portfolio-header h2 {
  font-family: "Poppins", sans-serif;
  font-size: 1.5rem;
  font-weight: 700;
  color: white;
  margin: 0;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.portfolio-stats {
  display: flex;
  gap: 20px;
}

.stat-item {
  text-align: right;
}

.stat-label {
  font-family: "Poppins", sans-serif;
  font-size: 0.8rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.7);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat-value {
  font-family: "Poppins", sans-serif;
  font-size: 1.2rem;
  font-weight: 700;
  color: white;
  display: block;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.allocation-overview {
  margin-bottom: 30px;
}

.allocation-progress {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 20px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.progress-bar {
  display: flex;
  height: 12px;
  border-radius: 6px;
  overflow: hidden;
  margin-bottom: 12px;
  background: rgba(255, 255, 255, 0.1);
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.2);
}

.progress-segment {
  height: 100%;
  transition: all 0.3s ease;
  cursor: pointer;
}

.progress-segment:hover {
  opacity: 0.8;
  transform: scaleY(1.2);
}

.progress-labels {
  display: flex;
  justify-content: space-between;
  font-family: "Poppins", sans-serif;
  font-size: 0.9rem;
  font-weight: 500;
}

.progress-labels .remaining {
  color: rgba(255, 255, 255, 0.6);
}

.assets-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.asset-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  cursor: pointer;
  transition: all 0.3s ease;
}

.asset-item:hover {
  background: rgba(255, 255, 255, 0.08);
  transform: translateX(5px);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
}

.asset-info {
  display: flex;
  align-items: center;
  gap: 12px;
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
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  transition: all 0.3s ease;
}

.asset-item:hover .asset-icon {
  transform: scale(1.1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.asset-details {
  display: flex;
  flex-direction: column;
}

.asset-symbol {
  font-family: "Poppins", sans-serif;
  font-size: 1.1rem;
  font-weight: 700;
  color: white;
  margin-bottom: 2px;
}

.asset-name {
  font-family: "Poppins", sans-serif;
  font-size: 0.8rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.7);
}

.asset-value {
  text-align: right;
}

.value-amount {
  font-family: "Poppins", sans-serif;
  font-size: 1.1rem;
  font-weight: 700;
  color: white;
  margin-bottom: 2px;
}

.value-percentage {
  font-family: "Poppins", sans-serif;
  font-size: 0.8rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.7);
}

/* Responsive design */
@media (max-width: 768px) {
  .portfolio-widget {
    padding: 20px;
    min-width: 320px;
  }

  .portfolio-header {
    flex-direction: column;
    gap: 15px;
    text-align: center;
  }

  .asset-item {
    padding: 12px;
  }

  .asset-icon {
    width: 35px;
    height: 35px;
  }
}
</style>