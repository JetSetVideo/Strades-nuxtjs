<script setup>
import { ref, onMounted, watch } from 'vue';
import * as d3 from 'd3';

const chart = ref(null);
const isLineChart = ref(false);

const margin = { top: 20, right: 20, bottom: 30, left: 40 };
const width = 400 - margin.left - margin.right;
const height = 200 - margin.top - margin.bottom;

const data = [
  { date: new Date(2023, 10, 1), open: 100, high: 105, low: 98, close: 103 },
  { date: new Date(2023, 10, 2), open: 103, high: 106, low: 100, close: 103 },
  { date: new Date(2023, 10, 3), open: 103, high: 109, low: 99, close: 106 },
  { date: new Date(2023, 10, 4), open: 106, high: 110, low: 101, close: 105 },
  { date: new Date(2023, 10, 5), open: 105, high: 115, low: 98, close: 110 },
  { date: new Date(2023, 10, 6), open: 110, high: 115, low: 103, close: 111 },
  { date: new Date(2023, 10, 7), open: 111, high: 115, low: 105, close: 114 },
  { date: new Date(2023, 10, 8), open: 114, high: 115, low: 109, close: 117 },
  { date: new Date(2023, 10, 9), open: 117, high: 125, low: 115, close: 119 },
  { date: new Date(2023, 10, 10), open: 119, high: 125, low: 114, close: 118 },
  { date: new Date(2023, 10, 11), open: 118, high: 125, low: 120, close: 121 },
];

const hexGradient = (start, end, steps) => {
  const parseColor = (hex) => {
    const r = parseInt(hex.substring(1, 3), 16);
    const g = parseInt(hex.substring(3, 5), 16);
    const b = parseInt(hex.substring(5, 7), 16);
    return [r, g, b];
  };

  const interpolate = (a, c, t) => {
    const [r1, g1, b1] = parseColor(a);
    const [r2, g2, b2] = parseColor(c);
    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);
    return `rgb(${r}, ${g}, ${b})`;
  };

  const colors = [];
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    colors.push(interpolate(start, end, t));
  }
  return colors;
};

const updateChart = () => {
  const svg = d3.select(chart.value).select('svg');

  if (!svg.empty()) {
    svg.selectAll('*').remove(); // Clear the SVG content

    const chartContent = svg.append('g')
      .attr('transform', `translate(${margin.left}, ${margin.top})`);

    // Define scales
    const x = d3.scaleBand().range([0, width]).padding(0.1);
    const y = d3.scaleLinear().range([height, 0]);

    // Process data
    data.forEach(d => {
      d.date = new Date(d.date);
      d.high = +d.high;
      d.low = +d.low;
      d.open = +d.open;
      d.close = +d.close;
    });

    x.domain(data.map(d => d.date));
    y.domain([d3.min(data, d => d.low), d3.max(data, d => d.high)]);

    if (isLineChart.value) {
      // Line chart
      const line = d3.line()
        .x(d => x(d.date) + x.bandwidth() / 2)
        .y(d => y(d.close))
        .curve(d3.curveMonotoneX);

      chartContent.append('path')
        .datum(data)
        .attr('fill', 'none')
        .attr('stroke', 'url(#line-gradient)')
        .attr('stroke-width', 2)
        .attr('d', line);

      // Gradient for the line
      const gradient = svg.append('defs')
        .append('linearGradient')
        .attr('id', 'line-gradient')
        .attr('gradientUnits', 'userSpaceOnUse')
        .attr('x1', 0).attr('y1', y(d3.min(data, d => d.close)))
        .attr('x2', 0).attr('y2', y(d3.max(data, d => d.close)));
      gradient.append('stop').attr('offset', '0%').attr('stop-color', '#ff0000');
      gradient.append('stop').attr('offset', '100%').attr('stop-color', '#00ff00');

    } else {
      // Candlestick chart
      chartContent.selectAll('rect')
        .data(data)
        .enter().append('rect')
        .attr('x', d => x(d.date))
        .attr('y', d => y(Math.max(d.open, d.close)))
        .attr('height', d => Math.abs(y(d.open) - y(d.close)))
        .attr('width', x.bandwidth())
        .attr('fill', d => d.open > d.close ? '#ff0000' : '#00ff00');
      chartContent.selectAll('line.stem')
        .data(data)
        .enter().append('line')
        .attr('class', 'stem')
        .attr('x1', d => x(d.date) + x.bandwidth() / 2)
        .attr('x2', d => x(d.date) + x.bandwidth() / 2)
        .attr('y1', d => y(d.high))
        .attr('y2', d => y(d.low))
        .attr('stroke', d => d.open > d.close ? '#ff0000' : '#00ff00');
    }

    // Add X and Y axis
    chartContent.append('g')
      .attr('transform', `translate(0, ${height})`)
      .call(d3.axisBottom(x))
      .selectAll('text')
        .attr('transform', 'rotate(-45)')
        .style('text-anchor', 'end');

    chartContent.append('g')
      .call(d3.axisLeft(y));

    // Add gridlines
    chartContent.append('g')
      .attr('class', 'grid')
      .call(d3.axisLeft(y)
        .tickSize(-width)
        .tickFormat(''));
  }
};

onMounted(() => {
  d3.select(chart.value)
    .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom);

  updateChart();
});

watch(isLineChart, () => {
  updateChart();
});
</script>

<template>
<div ref="chart" class="chart-container">
    <button @click="isLineChart = !isLineChart" class="toggle-button">
        {{ isLineChart ? 'Show Candlestick Chart' : 'Show Line Chart' }}
    </button>
</div>
</template>

<style scoped>
.chart-container {
  background-color: rgba(0, 0, 0, 0.8);
  border-radius: 8px;
  box-shadow: inset 0 0 10px rgba(0, 0, 0, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.2);
  padding: 20px;
  margin: 20px;
}

button {
  margin: 10px;
  background-color: #353535;
  color: white;
  border: none;
  padding: 10px;
  border-radius: 5px;
  cursor: pointer;
}

button:hover {
  background-color: #555555;
}
.toggle-button {
    margin: 10px;
    background-color: #353535;
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 5px;
    cursor: pointer;
    transition: background-color 0.3s;
}
.toggle-button:hover {
    background-color: #555555;
}
.grid line {
    stroke: rgba(255, 255, 255, 0.1);
    stroke-opacity: 0.7;
    shape-rendering: crispEdges;
}
.grid path {
  stroke-width: 0;
}

.tooltip {
  position: absolute;
  background-color: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 5px;
  border-radius: 5px;
  pointer-events: none;
}
</style>