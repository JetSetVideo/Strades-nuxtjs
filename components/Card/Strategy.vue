<script setup>
import { computed } from 'vue';

const props = defineProps({
  strategy: {
    type: Object,
    required: true,
  },
});

const emit = defineEmits(['buy', 'rent', 'share']);

function getAssetIcon(asset) {
  const assetMap = {
    'BTC': 'btc.svg',
    'ETH': 'eth.png',
    'bitcoin': 'btc.svg',
    'ethereum': 'eth.png',
    'AAPL': 'apple.png',
    'GOOGL': 'google.png',
    'MSFT': 'msft.png',
    'XRP': 'xrp.png',
    'USD': 'average.png',
  };

  const iconFile = assetMap[asset] || assetMap[asset.toUpperCase()] || 'average.png';
  return `/logos/${iconFile}`;
}

function handleImageError(event) {
  // Create a gray placeholder div to maintain exact size
  const img = event.target;
  img.style.display = 'none';

  // Create placeholder if it doesn't exist
  let placeholder = img.parentNode.querySelector('.asset-placeholder');
  if (!placeholder) {
    placeholder = document.createElement('div');
    placeholder.className = 'asset-placeholder';
    img.parentNode.appendChild(placeholder);
  }
}

const profitColor = computed(() => {
  const gain = props.strategy.monthlyGain;
  if (gain > 0) return 'rgba(0, 255, 0, 1)';
  if (gain < 0) return 'rgba(255, 0, 0, 1)';
  return 'rgba(128, 128, 128, 1)';
});

const drawdownColor = computed(() => {
  const drawdown = props.strategy.monthlyDrawdown;
  if (drawdown > 0) return 'rgba(255, 0, 0, 1)';
  if (drawdown < 0) return 'rgba(0, 255, 0, 1)';
  return 'rgba(128, 128, 128, 1)';
});
</script>

<template>
    <div class="strategy-card" :class="{ 'selected': $attrs.selected }">
      <div class="card-header">
        <h2 class="strategy-name">{{ strategy.name }}</h2>
        <div class="status-indicator" :class="strategy.status || 'stopped'">
          {{ strategy.status || 'stopped' }}
        </div>
      </div>

      <p class="creator-name">Created by: {{ strategy.creator }}</p>
      <p class="creation-date">Created: {{ strategy.creationDate }}</p>

      <div class="assets">
        <div v-for="trade in strategy.trades" :key="trade.asset" class="asset">
          <div class="asset-icon-container">
            <img
              :src="getAssetIcon(trade.asset)"
              :alt="trade.asset"
              class="asset-icon"
              @error="handleImageError"
            >
          </div>
          <span>{{ trade.asset }}</span>
        </div>
      </div>

      <div class="performance-metrics">
        <div class="metric">
          <span class="label">Trades:</span>
          <span class="value">{{ strategy.numberOfTrades }}</span>
        </div>
        <div class="metric">
          <span class="label">Profit:</span>
          <span class="value" :style="{ color: profitColor }">{{ strategy.monthlyGain }}%</span>
        </div>
        <div class="metric">
          <span class="label">Drawdown:</span>
          <span class="value" :style="{ color: drawdownColor }">{{ strategy.monthlyDrawdown }}%</span>
        </div>
        <div class="metric">
          <span class="label">Win Rate:</span>
          <span class="value">{{ strategy.winRate }}%</span>
        </div>
      </div>

      <div class="card-actions">
        <button @click.stop="emit('buy')">Buy</button>
        <button @click.stop="emit('rent')">Rent</button>
        <button @click.stop="emit('share')">Share</button>
      </div>
    </div>
</template>

<style scoped>
.strategy-card {
  background-color: rgba(60, 60, 60, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  padding: 15px;
  margin: 10px;
  min-width: 280px;
  transition: all 0.3s ease;
  position: relative;
}

.strategy-card.selected {
  border-color: rgba(0, 123, 255, 0.5);
  box-shadow:
    0 0 20px rgba(255, 255, 255, 0.8),
    0 0 40px rgba(255, 255, 255, 0.4),
    inset 0 1px 3px rgba(255, 255, 255, 0.2);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.strategy-name {
  font-size: 18px;
  margin: 0;
  flex: 1;
  text-shadow:
    0 1px 2px rgba(255, 255, 255, 0.8),
    inset 0 1px 2px rgba(255, 255, 255, 0.3);
}

.status-indicator {
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: bold;
  text-transform: uppercase;
  min-width: 60px;
  text-align: center;
}

.status-indicator.active {
  background-color: rgba(0, 255, 0, 0.8);
  color: black;
}

.status-indicator.paused {
  background-color: rgba(255, 165, 0, 0.8);
  color: black;
}

.status-indicator.stopped {
  background-color: rgba(128, 128, 128, 0.8);
  color: white;
}

.creator-name {
  font-size: 14px;
  color: rgba(200, 200, 200, 1);
  margin-bottom: 5px;
  text-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.8);
}

.creation-date {
  font-size: 12px;
  color: rgba(180, 180, 180, 1);
  margin-bottom: 10px;
  text-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.8);
}

.assets {
  display: flex;
  flex-wrap: wrap;
  margin-bottom: 15px;
}

.asset {
  display: flex;
  align-items: center;
  margin-right: 10px;
  margin-bottom: 5px;
  background-color: rgba(80, 80, 80, 0.5);
  padding: 4px 8px;
  border-radius: 8px;
  font-size: 12px;
  box-shadow:
    inset 0 1px 3px rgba(255, 255, 255, 0.1),
    0 1px 2px rgba(0, 0, 0, 0.2);
}

.asset-icon-container {
  position: relative;
  width: 16px;
  height: 16px;
  margin-right: 5px;
}

.asset-icon {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background-color: rgba(128, 128, 128, 0.5);
}

.asset-placeholder {
  position: absolute;
  top: 0;
  left: 0;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(128, 128, 128, 0.8), rgba(160, 160, 160, 0.8));
  box-shadow:
    inset 0 1px 2px rgba(0, 0, 0, 0.5),
    0 1px 1px rgba(255, 255, 255, 0.1);
}

.performance-metrics {
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding-top: 10px;
}

.metric {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 5px;
  font-size: 14px;
}

.metric .label {
  color: rgba(200, 200, 200, 1);
  text-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.6);
}

.metric .value {
  font-weight: bold;
  text-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.6);
}

.card-actions {
  display: flex;
  justify-content: space-around;
  padding-top: 15px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  margin-top: 15px;
}

.card-actions button {
  background: var(--primary-gradient);
  color: var(--secondary-darker);
  border: none;
  padding: 8px 16px;
  border-radius: 5px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.card-actions button:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-accent);
}
</style>