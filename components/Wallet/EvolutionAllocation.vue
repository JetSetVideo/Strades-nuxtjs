<script setup>
import * as d3 from 'd3';
import { ref, onMounted, watch } from 'vue';

const items = ref([
  { name: 'BTC', value: 0.303, color: '#ff9900' },
  { name: 'ETH', value: 0.303, color: '#4caf50' },
]);

const chartContainer = ref(null);
const selectionBarContainer = ref(null);
const percentageChange = ref(0);

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

  const arcs = svg
    .selectAll('g.arc')
    .data(dataReady)
    .enter()
    .append('g')
    .attr('class', 'arc')
    .attr('transform', `translate(0, 0)`);

  arcs
    .append('path')
    .attr('d', arc)
    .attr('fill', (d) => d.data.color);

  arcs
    .append('text')
    .attr('transform', (d) => `translate(${arc.centroid(d)})`)
    .attr('text-anchor', 'middle')
    .text((d) => d.data.name);

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

  setupTooltip(svg, chartContainer);
  setupLegend(svg, width, height);
}

function setupTooltip(svg, container) {
  const tooltip = d3.select(container.value)
    .append('div')
    .style('position', 'absolute')
    .style('visibility', 'hidden')
    .style('background', 'white')
    .style('border', '1px solid #ddd')
    .style('padding', '5px')
    .style('border-radius', '5px')
    .style('pointer-events', 'none');

  svg.selectAll('g.arc')
    .on('mouseover', (event, d) => {
      tooltip
        .html(`${d.data.name}: ${(d.data.value * 100).toFixed(2)}%`)
        .style('visibility', 'visible')
        .style('top', `${event.pageY + 10}px`)
        .style('left', `${event.pageX + 10}px`);
    })
    .on('mouseout', () => {
      tooltip.style('visibility', 'hidden');
    });
}

function setupLegend(svg, width, height) {
  const legend = svg.append('g')
    .attr('transform', `translate(${-width / 2},${height / 2 + 20})`);

  items.value.forEach((item, index) => {
    const legendItem = legend.append('g')
      .attr('transform', `translate(0, ${index * 20})`);

    legendItem.append('rect')
      .attr('width', 18)
      .attr('height', 18)
      .attr('fill', item.color);

    legendItem.append('text')
      .attr('x', 24)
      .attr('y', 9)
      .attr('dy', '.35em')
      .text(item.name);
  });
}
</script>

<template>
  <div>
    <div ref="chartContainer"></div>
    <div ref="selectionBarContainer"></div>
  </div>
</template>

<style>
/* ... (keep the existing styles) */
</style>