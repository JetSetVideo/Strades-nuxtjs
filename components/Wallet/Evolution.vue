<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import * as d3 from 'd3';

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

const emit = defineEmits(['update-period', 'select-asset']);

const chartContainer = ref(null);
const tooltip = ref(null);
const tooltipData = ref({
  visible: false,
  symbol: '',
  value: 0,
  percentage: 0
});
const selectedAsset = ref('');

const totalValue = computed(() => {
  return props.assets.reduce((total, asset) => total + (asset.current_value || 0), 0);
});

const assetComposition = computed(() => {
  const total = totalValue.value;
  return props.assets.map(asset => ({
    name: asset.symbol,
    value: (asset.current_value || 0) / total,
    color: getAssetColor(asset.symbol)
  }));
});

const percentageChange = computed(() => {
  if (!props.transactions || props.transactions.length < 2) return 0;
  // Calculate percentage change based on transaction history
  // This is a simplified calculation - you might want to calculate based on portfolio value over time
  return 5.2; // Placeholder value
});

const selectAsset = (assetName) => {
  selectedAsset.value = assetName;
  emit('select-asset', assetName);
};

onMounted(() => {
  drawChart();
});

watch(() => props.selectedPeriod, drawChart);

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

function drawChart() {
  if (!chartContainer.value) return;

  d3.select(chartContainer.value).selectAll('*').remove();

  const width = 350;
  const height = 350;
  const radius = Math.min(width, height) / 2;

  const svg = d3.select(chartContainer.value)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .append('g')
    .attr('transform', `translate(${width / 2},${height / 2})`);

  const pie = d3.pie()
    .value(d => d.value)
    .sort(null);

  const arc = d3.arc()
    .innerRadius(radius * 0.5)
    .outerRadius(radius * 0.9);

  const outerArc = d3.arc()
    .innerRadius(radius * 0.95)
    .outerRadius(radius * 0.95);

  // Create arcs
  const arcs = svg.selectAll('path')
    .data(pie(assetComposition.value))
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
        percentage: (d.data.value * 100).toFixed(1)
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

  // Add center circle with total value
  svg.append('circle')
    .attr('cx', 0)
    .attr('cy', 0)
    .attr('r', radius * 0.45)
    .attr('fill', 'rgba(255, 255, 255, 0.1)')
    .attr('stroke', 'rgba(255, 255, 255, 0.2)')
    .attr('stroke-width', 2);

  // Add center text
  const centerGroup = svg.append('g')
    .attr('text-anchor', 'middle');

  centerGroup.append('text')
    .attr('dy', '-0.5em')
    .style('font-family', 'Poppins, sans-serif')
    .style('font-size', '14px')
    .style('font-weight', '600')
    .style('fill', 'rgba(255, 255, 255, 0.7)')
    .text('Total Value');

  centerGroup.append('text')
    .attr('dy', '0.5em')
    .style('font-family', 'Poppins, sans-serif')
    .style('font-size', '20px')
    .style('font-weight', '700')
    .style('fill', 'white')
    .text(`$${totalValue.value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`);
}

</script>

<template>
  <div class="wallet-evolution">
    <div class="evolution-header">
      <h3>Portfolio Composition</h3>
      <div class="evolution-stats">
        <div class="stat">
          <span class="stat-label">Total Value</span>
          <span class="stat-value">${{ totalValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) }}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Change</span>
          <span class="stat-value" :class="{ 'positive': percentageChange >= 0, 'negative': percentageChange < 0 }">
            {{ percentageChange >= 0 ? '+' : '' }}{{ percentageChange.toFixed(2) }}%
          </span>
        </div>
      </div>
    </div>

    <div class="chart-container">
      <div ref="chartContainer" class="chart-wrapper"></div>
      <div ref="tooltip" class="tooltip" :style="{ opacity: tooltipData.visible ? 1 : 0 }">
        <div class="tooltip-content">
          <div class="tooltip-symbol">{{ tooltipData.symbol }}</div>
          <div class="tooltip-value">${{ tooltipData.value?.toLocaleString() }}</div>
          <div class="tooltip-percentage">{{ tooltipData.percentage }}%</div>
        </div>
      </div>
    </div>

    <div class="legend">
      <div
        v-for="asset in assetComposition"
        :key="asset.name"
        class="legend-item"
        @click="selectAsset(asset.name)"
        :class="{ 'selected': selectedAsset === asset.name }"
      >
        <div class="legend-color" :style="{ backgroundColor: asset.color }"></div>
        <div class="legend-info">
          <span class="legend-name">{{ asset.name }}</span>
          <span class="legend-percentage">{{ (asset.value * 100).toFixed(1) }}%</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.wallet-evolution {
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
  position: relative;
  overflow: hidden;
}

.wallet-evolution:hover {
  transform: translateY(-3px);
  box-shadow:
    0 15px 45px rgba(0, 0, 0, 0.15),
    inset 0 1px 0 rgba(255, 255, 255, 0.3);
}

.evolution-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 25px;
  padding-bottom: 15px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  width: 100%;
}

.evolution-header h3 {
  font-family: "Poppins", sans-serif;
  font-size: 1.5rem;
  font-weight: 700;
  color: white;
  margin: 0;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.evolution-stats {
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
  font-size: 1.2rem;
  font-weight: 700;
  color: white;
  display: block;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
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
  border: 1px solid rgba(255, 255, 255, 0.2);
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
  .wallet-evolution {
    padding: 20px;
    min-width: 320px;
  }

  .evolution-header {
    flex-direction: column;
    gap: 15px;
    text-align: center;
  }

  .evolution-stats {
    gap: 15px;
  }

  .legend {
    gap: 8px;
  }

  .legend-item {
    padding: 6px 10px;
  }
}
</style>