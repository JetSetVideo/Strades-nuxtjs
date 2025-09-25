<script setup>
import { onMounted, ref } from 'vue';
import { defineComponent } from 'vue';
import * as d3 from 'd3';

const chartRef = ref(null);
const data = [
    { date: new Date(2023, 10, 1), open: 100, high: 105, low: 98, close: 103 },
    { date: new Date(2023, 10, 2), open: 103, high: 106, low: 100, close: 103 },
    { date: new Date(2023, 10, 3), open: 103, high: 109, low: 99, close: 106 },
    { date: new Date(2023, 10, 4), open: 106, high: 110, low: 101, close: 105 },
    { date: new Date(2023, 10, 5), open: 105, high: 115, low: 98, close: 110 },
    { date: new Date(2023, 10, 6), open: 110, high: 115, low: 98, close: 111 },
    { date: new Date(2023, 10, 7), open: 111, high: 115, low: 98, close: 114 },
    { date: new Date(2023, 10, 8), open: 114, high: 115, low: 98, close: 117 },
    { date: new Date(2023, 10, 9), open: 117, high: 125, low: 98, close: 119 },
    { date: new Date(2023, 10, 10), open: 119, high: 125, low: 98, close: 118 },
    { date: new Date(2023, 10, 11), open: 118, high: 125, low: 98, close: 121 },
    ];

const margin = { top: 20, right: 30, bottom: 30, left: 50 };
const width = 960 - margin.left - margin.right;
const height = 500 - margin.top - margin.bottom;
// Convert your data dates and set up scales
const parseDate = d3.timeParse("%Y-%m-%d");
data.forEach(function(d) {
    d.date = parseDate(d.date);
});

onMounted(() => {
  // Ensure this logic runs after the component has mounted
  const svg = d3.select(chartRef.value) // Use the ref value here
    .append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  const x = d3.scaleBand()
    .range([0, width])
    .padding(0.1);

  const y = d3.scaleLinear()
    .range([height, 0]);

  // Assuming your data has been correctly parsed and formatted
  x.domain(data.map(d => d.date));
  y.domain([0, d3.max(data, d => d.close)]); // Example, adjust according to your needs

  // Example of drawing bars, adjust according to your actual need for candlestick chart
  svg.selectAll(".bar")
    .data(data)
    .enter().append("rect")
    .attr("class", "bar")
    .attr("x", d => x(d.date))
    .attr("width", x.bandwidth())
    .attr("y", d => y(d.close)) // Example for bar top, adjust for candlestick
    .attr("height", d => height - y(d.close)); // Example for bar height, adjust for candlestick
});
</script>

<template>
    <div></div>
      <h1>Financial Chart</h1>
    <div id="chart" ref="chart"></div>
</template>

<style scoped>
/* Add your styling for the chart here */
</style>
  