<script setup>
  import { ref, onMounted, watch } from 'vue';
  import * as d3 from 'd3';
  
  const props = defineProps(['trades', 'assets', 'prices']);
  const chart = ref(null);
  const chartType = ref('candle');

  const toggleChartType = () => {
    chartType.value = chartType.value === 'candle' ? 'line' : 'candle';
  };

  onMounted(() => {
    drawChart();
  });

  watch(() => props.trades, drawChart);
  watch(chartType, drawChart);

  function drawChart() {
    // Clear previous chart
    d3.select(chart.value).selectAll('*').remove();

    const margin = { top: 20, right: 30, bottom: 30, left: 40 };
    const width = chart.value.clientWidth - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    const svg = d3.select(chart.value)
      .append('svg')
      .attr('width', '100%')
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3.scaleBand()
      .range([0, width])
      .padding(0.1);

    const y = d3.scaleLinear()
      .range([height, 0]);

    x.domain(props.trades.map(d => d.date));
    y.domain([0, d3.max(props.trades, d => d.price)]);

    svg.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x));

    svg.append('g')
      .call(d3.axisLeft(y));

    if (chartType.value === 'candle') {
      svg.selectAll('.candle')
        .data(props.trades)
        .enter().append('rect')
        .attr('class', 'candle')
        .attr('x', d => x(d.date))
        .attr('y', d => y(Math.max(d.price, d.price)))
        .attr('height', d => Math.abs(y(d.price) - y(d.price)))
        .attr('width', x.bandwidth())
        .attr('fill', d => d.type === 'buy' ? 'green' : 'red');
    } else {
      const line = d3.line()
        .x(d => x(d.date) + x.bandwidth() / 2)
        .y(d => y(d.price));

      svg.append('path')
        .datum(props.trades)
        .attr('fill', 'none')
        .attr('stroke', 'steelblue')
        .attr('stroke-width', 1.5)
        .attr('d', line);
    }

    // Add dots for trades
    svg.selectAll('.dot')
      .data(props.trades)
      .enter().append('circle')
      .attr('class', 'dot')
      .attr('cx', d => x(d.date) + x.bandwidth() / 2)
      .attr('cy', d => y(d.price))
      .attr('r', 5)
      .attr('fill', d => d.type === 'buy' ? 'green' : 'red');
  }
</script>

<template>
  <div class="chart-container">
    <button @click="toggleChartType">
      {{ chartType === 'candle' ? 'Switch to Line Chart' : 'Switch to Candle Chart' }}
    </button>
    <div ref="chart" class="chart"></div>
  </div>
</template>

<style scoped>
.chart-container {
  width: 100%;
  margin-bottom: 1rem;
}

.chart {
  width: 100%;
  height: 400px;
}
</style>