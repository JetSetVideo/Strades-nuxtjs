<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import * as d3 from 'd3';

const props = defineProps(['trades', 'assets', 'prices', 'selectedPeriod']);

const chartContainer = ref(null);

const totalValue = computed(() => {
  return props.assets.reduce((total, asset) => total + asset.value, 0);
});

const assetComposition = computed(() => {
  const total = totalValue.value;
  return props.assets.map(asset => ({
    name: asset.name,
    value: asset.value / total,
    color: getAssetColor(asset.type)
  }));
});

const percentageChange = computed(() => {
  const firstValue = props.trades[0].value;
  const lastValue = props.trades[props.trades.length - 1].value;
  return ((lastValue - firstValue) / firstValue) * 100;
});

onMounted(() => {
  drawChart();
});

watch(() => props.selectedPeriod, drawChart);

function getAssetColor(assetType) {
  const colors = {
    Cryptocurrency: '#f7931a',
    Stablecoin: '#26a17b',
    Stock: '#0066cc',
    ETF: '#ff6600',
  };
  return colors[assetType] || '#000000';
}

function drawChart() {
  if (!chartContainer.value) return;

  d3.select(chartContainer.value).selectAll('*').remove();

  const width = 400;
  const height = 400;
  const radius = Math.min(width, height) / 2;

  const svg = d3.select(chartContainer.value)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .append('g')
    .attr('transform', `translate(${width / 2},${height / 2})`);

  const pie = d3.pie().value(d => d.value);
  const arc = d3.arc().innerRadius(radius * 0.6).outerRadius(radius);

  const arcs = svg.selectAll('arc')
    .data(pie(assetComposition.value))
    .enter()
    .append('g')
    .attr('class', 'arc');

  arcs.append('path')
    .attr('d', arc)
    .attr('fill', d => d.data.color);

  arcs.append('text')
    .attr('transform', d => `translate(${arc.centroid(d)})`)
    .attr('text-anchor', 'middle')
    .text(d => d.data.name);

  // Add center text for total value
  svg.append('text')
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'central')
    .style('font-size', '24px')
    .text(`$${totalValue.value.toFixed(2)}`);

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

  svg.selectAll('.arc')
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
    .attr('transform', `translate(${width / 2 - 50},${-height / 2 + 20})`);

  assetComposition.value.forEach((item, index) => {
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
  <div class="wallet-evolution">
    <h3>Wallet Composition</h3>
    <div ref="chartContainer"></div>
    <p>Total Value: ${{ totalValue.toFixed(2) }}</p>
    <p :class="{ 'positive': percentageChange >= 0, 'negative': percentageChange < 0 }">
      Percentage Change: {{ percentageChange.toFixed(2) }}%
    </p>
  </div>
</template>

<style scoped>
.wallet-evolution {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.positive {
  color: green;
}

.negative {
  color: red;
}
</style>