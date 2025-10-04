<script setup>
  import { ref, onMounted, watch } from 'vue';
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
  const chart = ref(null);
  const chartType = ref('candle');

  const toggleChartType = () => {
    chartType.value = chartType.value === 'candle' ? 'line' : 'candle';
  };

  onMounted(() => {
    drawChart();
  });

  watch(() => props.transactions, drawChart);
  watch(() => props.assets, drawChart);
  watch(chartType, drawChart);

  function drawChart() {
    // Clear previous chart
    d3.select(chart.value).selectAll('*').remove();

    if (!props.transactions || props.transactions.length === 0) {
      // Show empty state
      const svg = d3.select(chart.value)
        .append('svg')
        .attr('width', '100%')
        .attr('height', '200')
        .append('g')
        .attr('transform', 'translate(50,50)');

      svg.append('text')
        .attr('x', 0)
        .attr('y', 0)
        .attr('fill', 'rgba(255, 255, 255, 0.5)')
        .attr('font-family', 'Poppins, sans-serif')
        .attr('font-size', '14px')
        .text('No transaction data available');

      return;
    }

    const margin = { top: 20, right: 30, bottom: 40, left: 50 };
    const width = chart.value.clientWidth - margin.left - margin.right;
    const height = 300 - margin.top - margin.bottom;

    const svg = d3.select(chart.value)
      .append('svg')
      .attr('width', '100%')
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Process transaction data for timeline chart
    const transactions = props.transactions
      .filter(t => t.timestamp)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    if (transactions.length === 0) return;

    // Create time-based data points
    const timeData = [];
    let cumulativeValue = 0;

    transactions.forEach((transaction, index) => {
      if (transaction.type === 'buy') {
        cumulativeValue += transaction.total_value;
      } else if (transaction.type === 'sell') {
        cumulativeValue -= transaction.total_value;
      }

      timeData.push({
        date: new Date(transaction.timestamp),
        value: cumulativeValue,
        type: transaction.type,
        amount: transaction.total_value
      });
    });

    // Add current portfolio value as latest point
    const currentValue = props.assets?.reduce((sum, asset) => sum + (asset.current_value || 0), 0) || 0;
    if (timeData.length > 0) {
      timeData.push({
        date: new Date(),
        value: currentValue,
        type: 'current',
        amount: currentValue
      });
    }

    const x = d3.scaleTime()
      .range([0, width])
      .domain(d3.extent(timeData, d => d.date));

    const y = d3.scaleLinear()
      .range([height, 0])
      .domain([0, d3.max(timeData, d => d.value) * 1.1]);

    // Add gradient
    const gradient = svg.append('defs')
      .append('linearGradient')
      .attr('id', 'line-gradient')
      .attr('gradientUnits', 'userSpaceOnUse')
      .attr('x1', 0).attr('y1', y(d3.min(timeData, d => d.value)))
      .attr('x2', 0).attr('y2', y(d3.max(timeData, d => d.value)));

    gradient.append('stop').attr('offset', '0%').attr('stop-color', '#00aaff');
    gradient.append('stop').attr('offset', '100%').attr('stop-color', '#00ccff');

    if (chartType.value === 'line') {
      // Line chart
      const line = d3.line()
        .x(d => x(d.date))
        .y(d => y(d.value))
        .curve(d3.curveMonotoneX);

      svg.append('path')
        .datum(timeData)
        .attr('fill', 'none')
        .attr('stroke', 'url(#line-gradient)')
        .attr('stroke-width', 3)
        .attr('d', line);

      // Add area under the line
      const area = d3.area()
        .x(d => x(d.date))
        .y0(height)
        .y1(d => y(d.value))
        .curve(d3.curveMonotoneX);

      svg.append('path')
        .datum(timeData)
        .attr('fill', 'url(#line-gradient)')
        .attr('fill-opacity', 0.1)
        .attr('d', area);

    } else {
      // Bar chart showing transaction amounts
      svg.selectAll('.bar')
        .data(timeData.filter(d => d.type !== 'current'))
        .enter().append('rect')
        .attr('class', 'bar')
        .attr('x', d => x(d.date) - 8)
        .attr('y', d => d.type === 'buy' ? y(d.amount) : y(0))
        .attr('height', d => Math.abs(y(0) - y(d.amount)))
        .attr('width', 16)
        .attr('fill', d => d.type === 'buy' ? '#4CAF50' : '#f44336')
        .attr('rx', 2);
    }

    // Add axes
    svg.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x)
        .ticks(5)
        .tickFormat(d3.timeFormat('%b %d')))
      .selectAll('text')
      .attr('fill', 'rgba(255, 255, 255, 0.7)')
      .attr('font-family', 'Poppins, sans-serif')
      .attr('font-size', '10px');

    svg.append('g')
      .call(d3.axisLeft(y)
        .ticks(5)
        .tickFormat(d => `$${d.toLocaleString()}`))
      .selectAll('text')
      .attr('fill', 'rgba(255, 255, 255, 0.7)')
      .attr('font-family', 'Poppins, sans-serif')
      .attr('font-size', '10px');

    // Style axes
    svg.selectAll('.domain, .tick line')
      .attr('stroke', 'rgba(255, 255, 255, 0.2)');

    // Add gridlines
    svg.append('g')
      .attr('class', 'grid')
      .call(d3.axisLeft(y)
        .tickSize(-width)
        .tickFormat(''))
      .selectAll('.tick line')
      .attr('stroke', 'rgba(255, 255, 255, 0.1)')
      .attr('stroke-dasharray', '2,2');
  }
</script>

<template>
  <div class="chart-widget">
    <div class="chart-header">
      <h3>Portfolio Evolution</h3>
      <div class="chart-controls">
        <button
          @click="toggleChartType"
          :class="{ 'active': chartType === 'line' }"
          class="chart-toggle line-toggle"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 12L21 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <path d="M8 7L3 12L8 17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Line
        </button>
        <button
          @click="toggleChartType"
          :class="{ 'active': chartType === 'candle' }"
          class="chart-toggle bar-toggle"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" stroke-width="2"/>
            <rect x="8" y="8" width="2" height="8" fill="currentColor"/>
            <rect x="12" y="6" width="2" height="12" fill="currentColor"/>
            <rect x="16" y="10" width="2" height="4" fill="currentColor"/>
          </svg>
          Bars
        </button>
      </div>
    </div>

    <div ref="chart" class="chart-canvas"></div>

    <div class="chart-footer">
      <div class="chart-legend">
        <div class="legend-item">
          <div class="legend-color" style="background: linear-gradient(135deg, #00aaff, #00ccff);"></div>
          <span class="legend-text">Portfolio Value</span>
        </div>
        <div class="legend-item" v-if="chartType === 'candle'">
          <div class="legend-color buy"></div>
          <span class="legend-text">Buy Orders</span>
        </div>
        <div class="legend-item" v-if="chartType === 'candle'">
          <div class="legend-color sell"></div>
          <span class="legend-text">Sell Orders</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chart-widget {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%);
  backdrop-filter: blur(20px);
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
  padding: 25px;
  min-width: 400px;
  transition: all 0.3s ease;
}

.chart-widget:hover {
  transform: translateY(-3px);
  box-shadow:
    0 15px 45px rgba(0, 0, 0, 0.15),
    inset 0 1px 0 rgba(255, 255, 255, 0.3);
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.chart-header h3 {
  font-family: "Poppins", sans-serif;
  font-size: 1.4rem;
  font-weight: 700;
  color: white;
  margin: 0;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.chart-controls {
  display: flex;
  gap: 8px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 4px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.chart-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.7);
  font-family: "Poppins", sans-serif;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
}

.chart-toggle:hover {
  color: white;
  background: rgba(255, 255, 255, 0.1);
}

.chart-toggle.active {
  background: linear-gradient(135deg, rgba(0, 170, 255, 0.8) 0%, rgba(0, 204, 255, 0.8) 100%);
  color: white;
  box-shadow: 0 2px 8px rgba(0, 170, 255, 0.3);
}

.chart-toggle svg {
  transition: transform 0.3s ease;
}

.chart-toggle.active svg {
  transform: scale(1.1);
}

.chart-canvas {
  width: 100%;
  height: 280px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  position: relative;
  overflow: hidden;
}

.chart-footer {
  margin-top: 20px;
  padding-top: 15px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.chart-legend {
  display: flex;
  gap: 20px;
  justify-content: center;
  flex-wrap: wrap;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.legend-color {
  width: 12px;
  height: 12px;
  border-radius: 2px;
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.legend-color.buy {
  background-color: #4CAF50;
}

.legend-color.sell {
  background-color: #f44336;
}

.legend-text {
  font-family: "Poppins", sans-serif;
  font-size: 0.8rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.8);
}

/* Responsive design */
@media (max-width: 768px) {
  .chart-widget {
    padding: 20px;
    min-width: 320px;
  }

  .chart-header {
    flex-direction: column;
    gap: 15px;
    text-align: center;
  }

  .chart-canvas {
    height: 220px;
  }

  .chart-controls {
    width: 100%;
    justify-content: center;
  }

  .chart-toggle {
    flex: 1;
    justify-content: center;
  }
}

/* Touch-friendly adjustments */
@media (pointer: coarse) {
  .chart-toggle {
    padding: 12px;
    min-height: 44px;
  }
}
</style>