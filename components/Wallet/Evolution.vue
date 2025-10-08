<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useWalletsStore } from '@/stores/wallets';
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
  },
  walletId: {
    type: String,
    default: 'wallet_001'
  }
});

const emit = defineEmits(['update-period', 'select-asset']);

const walletsStore = useWalletsStore();
const chartContainer = ref(null);
const timelineContainer = ref(null);
const tooltip = ref(null);
const tooltipData = ref({
  visible: false,
  symbol: '',
  value: 0,
  percentage: 0
});
const selectedDate = ref('');
const hoveredDate = ref('');

const totalValue = computed(() => {
  return props.assets.reduce((total, asset) => total + (asset.current_value || 0), 0);
});

// Get historical data for the current wallet
const walletHistory = computed(() => {
  return walletsStore.getWalletHistory(props.walletId);
});

// Get available dates for timeline
const availableDates = computed(() => {
  const history = walletHistory.value;
  return Object.keys(history).sort();
});

// Get asset composition for selected date or current
const assetComposition = computed(() => {
  let data;
  if (selectedDate.value && walletHistory.value[selectedDate.value]) {
    data = walletHistory.value[selectedDate.value];
  } else {
    // Use current data
    const total = totalValue.value;
    data = {
      total_value: total,
      assets: props.assets.reduce((acc, asset) => {
        acc[asset.symbol] = {
          amount: asset.amount,
          value: asset.current_value || 0,
          allocation: ((asset.current_value || 0) / total) * 100
        };
        return acc;
      }, {})
    };
  }

  const result = [];
  Object.entries(data.assets).forEach(([symbol, info]) => {
    result.push({
      name: symbol,
      value: info.allocation / 100,
      color: getAssetColor(symbol)
    });
  });
  return result;
});

const percentageChange = computed(() => {
  if (!props.transactions || props.transactions.length < 2) return 0;
  return 5.2; // Placeholder value
});

const selectAsset = (assetName) => {
  emit('select-asset', assetName);
};

const selectDate = (date) => {
  selectedDate.value = date;
  drawChart();
};

const getDisplayValue = () => {
  if (selectedDate.value && walletHistory.value[selectedDate.value]) {
    return walletHistory.value[selectedDate.value].total_value;
  }
  return totalValue.value;
};

onMounted(() => {
  drawTimeline();
  drawChart();
});

watch(() => props.selectedPeriod, () => {
  drawTimeline();
  drawChart();
});

function getAssetColor(symbol) {
  const colorMap = {
    'BTC': 'var(--asset-btc)',
    'ETH': 'var(--asset-eth)',
    'AAPL': 'var(--asset-aapl)',
    'TSLA': 'var(--asset-tsla)',
    'ADA': 'var(--asset-ada)',
    'SOL': 'var(--asset-sol)',
    'DOT': 'var(--asset-dot)',
    'LINK': 'var(--asset-link)'
  };
  return colorMap[symbol] || 'var(--asset-default)';
}

function drawTimeline() {
  if (!timelineContainer.value || availableDates.value.length === 0) return;

  d3.select(timelineContainer.value).selectAll('*').remove();

  const margin = { top: 20, right: 30, bottom: 40, left: 50 };
  const width = 400 - margin.left - margin.right;
  const height = 100 - margin.top - margin.bottom;

  const svg = d3.select(timelineContainer.value)
    .append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  // Parse dates and get values
  const data = availableDates.value.map(date => ({
    date: new Date(date),
    value: walletHistory.value[date].total_value
  }));

  // Create scales
  const xScale = d3.scaleTime()
    .domain(d3.extent(data, d => d.date))
    .range([0, width]);

  const yScale = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.value)])
    .range([height, 0]);

  // Create line
  const line = d3.line()
    .x(d => xScale(d.date))
    .y(d => yScale(d.value))
    .curve(d3.curveMonotoneX);

  // Add line
  svg.append('path')
    .datum(data)
    .attr('fill', 'none')
    .attr('stroke', 'var(--primary-blue)')
    .attr('stroke-width', 2)
    .attr('d', line);

  // Add points
  svg.selectAll('circle')
    .data(data)
    .enter()
    .append('circle')
    .attr('cx', d => xScale(d.date))
    .attr('cy', d => yScale(d.value))
    .attr('r', 4)
    .attr('fill', d => selectedDate.value === d.date.toISOString().split('T')[0] ? 'var(--primary-green)' : 'var(--primary-blue)')
    .attr('stroke', 'white')
    .attr('stroke-width', 2)
    .style('cursor', 'pointer')
    .on('click', function(event, d) {
      selectDate(d.date.toISOString().split('T')[0]);
    })
    .on('mouseover', function(event, d) {
      d3.select(this)
        .transition()
        .duration(200)
        .attr('r', 6);
    })
    .on('mouseout', function() {
      d3.select(this)
        .transition()
        .duration(200)
        .attr('r', 4);
    });

  // Add axes
  svg.append('g')
    .attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(xScale).ticks(4).tickFormat(d3.timeFormat('%b %Y')))
    .style('color', 'rgba(255, 255, 255, 0.7)')
    .style('font-size', '10px');
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
      tooltipData.value = {
        visible: true,
        symbol: d.data.name,
        value: d.data.value * (selectedDate.value ? walletHistory.value[selectedDate.value]?.total_value || totalValue.value : totalValue.value),
        percentage: (d.data.value * 100).toFixed(1)
      };
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

  const displayValue = selectedDate.value && walletHistory.value[selectedDate.value]
    ? walletHistory.value[selectedDate.value].total_value
    : totalValue.value;

  centerGroup.append('text')
    .attr('dy', '-0.5em')
    .style('font-family', 'Poppins, sans-serif')
    .style('font-size', '14px')
    .style('font-weight', '600')
    .style('fill', 'rgba(255, 255, 255, 0.7)')
    .text(selectedDate.value ? 'Historical Value' : 'Total Value');

  centerGroup.append('text')
    .attr('dy', '0.5em')
    .style('font-family', 'Poppins, sans-serif')
    .style('font-size', '20px')
    .style('font-weight', '700')
    .style('fill', 'white')
    .text(`$${displayValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`);
}

</script>

<template>
  <div class="wallet-evolution">
    <div class="evolution-header">
      <h3>Portfolio Evolution</h3>
      <div class="evolution-stats">
        <div class="stat">
          <span class="stat-label">{{ selectedDate ? 'Historical Value' : 'Current Value' }}</span>
          <span class="stat-value">${{ getDisplayValue().toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) }}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Period</span>
          <span class="stat-value">{{ selectedDate || 'Current' }}</span>
        </div>
      </div>
    </div>

    <!-- Interactive Timeline -->
    <div class="timeline-section">
      <h4>Portfolio Value Over Time</h4>
      <div ref="timelineContainer" class="timeline-wrapper"></div>
      <div class="timeline-controls">
        <button
          v-if="selectedDate"
          @click="selectedDate = ''"
          class="reset-button"
        >
          Show Current
        </button>
        <p class="timeline-info">
          Click on any point to see portfolio composition at that time
        </p>
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

.timeline-section {
  margin-bottom: 25px;
  padding: 20px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.timeline-section h4 {
  font-family: "Poppins", sans-serif;
  font-size: 1.1rem;
  font-weight: 600;
  color: white;
  margin: 0 0 15px 0;
  text-align: center;
}

.timeline-wrapper {
  width: 100%;
  height: 120px;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  margin-bottom: 10px;
}

.timeline-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 15px;
}

.reset-button {
  background: var(--primary-blue);
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  font-family: "Poppins", sans-serif;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
}

.reset-button:hover {
  background: var(--primary-green);
  transform: translateY(-1px);
}

.timeline-info {
  font-family: "Poppins", sans-serif;
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.6);
  margin: 0;
  flex: 1;
  text-align: right;
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