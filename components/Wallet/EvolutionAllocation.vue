<script setup lang="ts">
import * as d3 from 'd3';
import { ref, computed, onMounted, watch } from 'vue';

const props = defineProps({
  assets: {
    type: Array,
    default: () => []
  },
  transactions: {
    type: Array,
    default: () => []
  },
  selectedPeriod: {
    type: String,
    default: '30d'
  }
});

const emit = defineEmits(['select-asset']);

const chartContainer = ref(null);
const tooltip = ref(null);
const tooltipData = ref({
  visible: false,
  symbol: '',
  value: 0,
  percentage: 0
});
const selectedAsset = ref('');

const items = computed(() => {
  const total = props.assets.reduce((sum, asset) => sum + (asset.current_value || 0), 0);
  return props.assets.map(asset => ({
    name: asset.symbol,
    value: total > 0 ? (asset.current_value || 0) / total : 0,
    color: getAssetColor(asset.symbol)
  }));
});

const percentageChange = computed(() => {
  // Placeholder: calculate percentage change from data
  return 0; // e.g., from transactions or props
});

function getAssetColor(symbol) {
  const colors = {
    'BTC': '#f7931a',
    'ETH': '#627eea',
    'AAPL': '#000000',
    'TSLA': '#cc0000',
    'ADA': '#0033ad'
  };
  return colors[symbol] || '#666666';
}

const selectAsset = (assetName) => {
  selectedAsset.value = assetName;
  emit('select-asset', assetName);
};

const categories = ['crypto', 'forex', 'stocks', 'futures', 'others'];
const assets = {
    crypto: ['Bitcoin', 'Ethereum', 'Solana'],
    forex: ['EUR/USD', 'GBP/USD', 'USD/JPY'],
    stocks: ['AAPL', 'GOOGL', 'AMZN'],
    futures: ['ES', 'NQ', 'YM'],
    others: ['Gold', 'Silver', 'Oil'],
};
const transactionsData = [
{ date: '2023-01-01', category: 'crypto', asset: 'Bitcoin', amount: 1000 },
{ date: '2023-01-05', category: 'stocks', asset: 'AAPL', amount: 500 },
{ date: '2023-01-10', category: 'forex', asset: 'EUR/USD', amount: 2000 },
{ date: '2023-01-15', category: 'futures', asset: 'ES', amount: 1500 },
{ date: '2023-01-20', category: 'others', asset: 'Gold', amount: 1000 },
// Add more transactions...
];

onMounted(setupChart);

function setupChart() {
  const width = 500;
  const height = 500;
  const radius = Math.min(width, height) / 2;

  const svg = d3
    .select(chartContainer.value)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .append('g')
    .attr('transform', `translate(${width / 2}, ${height / 2})`);

  const color = d3.scaleOrdinal().domain(categories).range(d3.schemeCategory10);
  const pie = d3.pie().value((d) => d.value);
  const dataReady = pie(items.value);
  const arc = d3.arc()
    .innerRadius(radius * 0.5)
    .outerRadius(radius * 0.8);

  // Create arcs with hover effects and clickability
  const arcs = svg.selectAll('path')
    .data(dataReady)
    .enter()
    .append('path')
    .attr('d', arc)
    .attr('fill', d => d.data.color)
    .attr('stroke', 'rgba(255, 255, 255, 0.2)')
    .attr('stroke-width', 2)
    .style('cursor', 'pointer')
    .style('transition', 'all 0.3s ease')
    .on('mouseover', function(event, d) {
      // Highlight the hovered segment
      d3.select(this)
        .transition()
        .duration(200)
        .attr('transform', 'scale(1.05)')
        .attr('stroke-width', 3);

      // Update tooltip data
      const asset = props.assets.find(a => a.symbol === d.data.name);
      tooltipData.value = {
        visible: true,
        symbol: d.data.name,
        value: asset?.current_value || 0,
        percentage: Number(d.data.value * 100 || 0).toFixed(1)
      };

      // Change background color to match the hovered segment
      d3.select(chartContainer.value)
        .style('background-color', d.data.color)
        .style('transition', 'background-color 0.3s ease');
    })
    .on('mouseout', function() {
      // Reset the segment
      d3.select(this)
        .transition()
        .duration(200)
        .attr('transform', 'scale(1)')
        .attr('stroke-width', 2);

      // Hide tooltip
      tooltipData.value.visible = false;

      // Reset background color
      d3.select(chartContainer.value)
        .style('background-color', 'transparent');
    })
    .on('click', function(event, d) {
      selectAsset(d.data.name);
    });

  const percentageText = svg
    .append('text')
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'middle')
    .style('fill', percentageChange.value > 0 ? 'green' : percentageChange.value < 0 ? 'red' : 'gray')
    .text(`${parseFloat(percentageChange.value).toFixed(2)}%`);

  watch(percentageChange, (newValue) => {
    percentageText
      .style('fill', newValue > 0 ? 'green' : newValue < 0 ? 'red' : 'gray')
      .text(`${parseFloat(newValue).toFixed(2)}%`);
  });

}
</script>

<template>
  <div class="allocation-widget">
    <div class="allocation-header">
      <h3>Asset Allocation</h3>
      <div class="allocation-stats">
        <div class="stat">
          <span class="stat-label">Total Assets</span>
          <span class="stat-value">{{ items.length }}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Change</span>
          <span class="stat-value" :class="{ 'positive': percentageChange > 0, 'negative': percentageChange < 0 }">
            {{ percentageChange > 0 ? '+' : '' }}{{ percentageChange.toFixed(2) }}%
          </span>
        </div>
      </div>
    </div>

    <div v-if="items.length > 0" class="chart-container">
      <div ref="chartContainer" class="chart-wrapper"></div>
      <div ref="tooltip" class="tooltip" :style="{ opacity: tooltipData.visible ? 1 : 0 }">
        <div class="tooltip-content">
          <div class="tooltip-symbol">{{ tooltipData.symbol }}</div>
          <div class="tooltip-value">${{ tooltipData.value?.toLocaleString() }}</div>
          <div class="tooltip-percentage">{{ tooltipData.percentage }}%</div>
        </div>
      </div>
    </div>
    <div v-else class="loading">Loading allocation...</div>

    <div class="legend">
      <div
        v-for="asset in items"
        :key="asset.name"
        class="legend-item"
        @click="selectAsset(asset.name)"
        :class="{ 'selected': selectedAsset === asset.name }"
      >
        <div class="legend-color" :style="{ backgroundColor: asset.color }"></div>
        <div class="legend-info">
          <span class="legend-name">{{ asset.name }}</span>
          <span v-if="Number.isFinite(asset.value)" class="legend-percentage">{{ (asset.value * 100).toFixed(1) }}%</span>
          <span v-else class="legend-percentage">0.0%</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.allocation-widget {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%);
  backdrop-filter: blur(20px);
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
  padding: 30px;
  min-width: 400px;
  transition: all 0.3s ease;
}

.allocation-widget:hover {
  transform: translateY(-3px);
  box-shadow:
    0 15px 45px rgba(0, 0, 0, 0.15),
    inset 0 1px 0 rgba(255, 255, 255, 0.3);
}

.allocation-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 25px;
  padding-bottom: 15px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.allocation-header h3 {
  font-family: "Poppins", sans-serif;
  font-size: 1.5rem;
  font-weight: 700;
  color: white;
  margin: 0;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.allocation-stats {
  display: flex;
  gap: 20px;
}

.stat {
  text-align: right;
}

.stat-label {
  font-family: "Poppins", sans-serif;
  font-size: 0.8rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.7);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  display: block;
}

.stat-value {
  font-family: "Poppins", sans-serif;
  font-size: 1.1rem;
  font-weight: 700;
  color: white;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  display: block;
}

.stat-value.positive {
  color: #4CAF50;
}

.stat-value.negative {
  color: #f44336;
}

.chart-container {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: 25px;
}

.chart-wrapper {
  position: relative;
  border-radius: 50%;
  transition: background-color 0.3s ease;
  padding: 20px;
}

.tooltip {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
  transition: opacity 0.3s ease;
  z-index: 10;
}

.tooltip-content {
  background: linear-gradient(135deg, rgba(0, 0, 0, 0.9) 0%, rgba(20, 20, 20, 0.9) 100%);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
  text-align: center;
  min-width: 120px;
}

.tooltip-symbol {
  font-family: "Poppins", sans-serif;
  font-size: 1.1rem;
  font-weight: 700;
  color: white;
  margin-bottom: 4px;
}

.tooltip-value {
  font-family: "Poppins", sans-serif;
  font-size: 1.2rem;
  font-weight: 600;
  color: #00aaff;
  margin-bottom: 2px;
}

.tooltip-percentage {
  font-family: "Poppins", sans-serif;
  font-size: 0.9rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.7);
}

.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: center;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  cursor: pointer;
  transition: all 0.3s ease;
}

.legend-item:hover {
  background: rgba(255, 255, 255, 0.08);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.legend-item.selected {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(0, 170, 255, 0.5);
  box-shadow: 0 0 15px rgba(0, 170, 255, 0.3);
}

.legend-color {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.legend-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.legend-name {
  font-family: "Poppins", sans-serif;
  font-size: 0.9rem;
  font-weight: 600;
  color: white;
}

.legend-percentage {
  font-family: "Poppins", sans-serif;
  font-size: 0.8rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.7);
}

/* Responsive design */
@media (max-width: 768px) {
  .allocation-widget {
    padding: 20px;
    min-width: 320px;
  }

  .allocation-header {
    flex-direction: column;
    gap: 15px;
    text-align: center;
  }

  .allocation-stats {
    gap: 15px;
  }

  .legend {
    gap: 8px;
  }

  .legend-item {
    padding: 6px 10px;
  }
}

/* Touch-friendly adjustments for mobile */
@media (pointer: coarse) {
  .legend-item {
    padding: 12px;
    min-height: 44px;
  }
}
</style>