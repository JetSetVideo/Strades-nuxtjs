<script setup>
import { onMounted, reactive, ref, computed } from 'vue';
import * as d3 from 'd3';

const props = defineProps({
  data: {
    type: Object,
    required: true
  },
  width: {
    type: Number,
    default: 600
  },
  height: {
    type: Number,
    default: 400
  }
});

const maxValue = computed(() => {
  return Math.max(...props.data.children.map(d => d.value));
});

const totalValue = computed(() => {
  return props.data.children.reduce((acc, item) => acc + item.value, 0);
});

onMounted(() => {
  if (process.client) {
    renderTreemap();
  }
});

function renderTreemap() {
  const svg = d3.select('#treemap')
    .append('svg')
    .attr('width', props.width)
    .attr('height', props.height);

  const root = d3.hierarchy(props.data)
    .sum(d => d.value)
    .sort((a, b) => b.value - a.value);

  const treemap = d3.treemap()
    .size([props.width, props.height])
    .padding(1)
    .round(true);

  treemap(root);

  const cells = svg.selectAll('g')
    .data(root.leaves())
    .enter()
    .append('g')
    .attr('transform', d => `translate(${d.x0},${d.y0})`);

  cells.append('rect')
    .attr('width', d => d.x1 - d.x0)
    .attr('height', d => d.y1 - d.y0)
    .attr('fill', d => getColor(d.value))
    .attr('stroke', '#fff');

  cells.append('text')
    .selectAll('tspan')
    .data(d => d.data.name.split(/(?=[A-Z][^A-Z])/g))
    .enter()
    .append('tspan')
    .attr('x', 4)
    .attr('y', (d, i) => 13 + i * 10)
    .text(d => d);

  cells.append('title')
    .text(d => `${d.data.name}\n${formatValue(d.value)}`);
}

function getColor(value) {
  const intensity = value / maxValue.value;
  return d3.interpolateViridis(intensity);
}

function getSize(value) {
  const size = (value / totalValue.value) * (props.width * props.height);
  return Math.sqrt(size);
}

function formatValue(value) {
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}
</script>

<template>
  <div>
    <div id="treemap" class="treemap-container"></div>
    <div class="legend">
      <div v-for="item in props.data.children" :key="item.name" class="legend-item">
        <div class="color-box" :style="{ backgroundColor: getColor(item.value) }"></div>
        <span>{{ item.name }}: {{ formatValue(item.value) }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.treemap-container {
  background-color: #f5f5f5;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.legend {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  margin-top: 20px;
}

.legend-item {
  display: flex;
  align-items: center;
  margin: 5px 10px;
}

.color-box {
  width: 20px;
  height: 20px;
  margin-right: 5px;
  border-radius: 4px;
}

text {
  font-size: 12px;
  fill: white;
  pointer-events: none;
}
</style>
