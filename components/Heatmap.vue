<script setup>
import * as d3 from 'd3';
import imageUrl from '../assets/Logo_Color.png';


const data = [
  [12, 42, 56, 24],
  [32, 74, 18, 52],
  [64, 16, 82, 38],
  [48, 22, 34, 76],
];

if (process.client) {
  const width = 600;
  const height = 400;

const svg = d3.select('#heatmap')
  .append('svg')
  .attr('width', width)
  .attr('height', height);

const colorScale = d3.scaleLinear()
  .domain([0, d3.max(data, d => d3.max(d))])
  .range(['lightblue', 'darkred']);

const heatmap = svg.append('g')
  .selectAll('rect')
  .data(data)
  .enter()
  .append('rect')
  .attr('x', (d, i) => i * width / data.length)
  .attr('y', (d, i) => i * height / data.length)
  .attr('width', width / data.length - 1)
  .attr('height', height / data.length - 1)
  .attr('fill', d => colorScale(d3.max(d)));

const xAxis = d3.scaleBand()
  .domain(data.map((d, i) => i))
  .range([0, width]);

const yAxis = d3.scaleBand()
  .domain(data.map((d, i) => i))
  .range([0, height]);

svg.append('g')
  .attr('class', 'x-axis')
  .call(d3.axisBottom(xAxis))
  .attr('transform', `translate(0, ${height})`);

svg.append('g')
  .attr('class', 'y-axis')
  .call(d3.axisLeft(yAxis));
}
</script>

<template>
  <div style="background-color: rgb(68, 35, 35)">
    <h1>Heatmap</h1>
    <img :src="imageUrl" alt="article logo" width="120" height="120" />
    <ul>
        <li class="button">Stock Market</li>
        <li class="button">Filter</li>
        <li class="button">Categories</li>
        <li class="button">Value</li>
    </ul>
  </div>
  <div id="heatmap"></div>
</template>
<style scoped>
.button {
    display: inline-block;
    padding: 0.5em 1em;
    text-decoration: none;
    background-color: rgba(121, 36, 36, 0.5);
    color: #FFF;
    border-bottom: solid 4px rgba(61, 10, 10, 0.6);
    border-radius: 6px;
}
.x-axis, .y-axis {
  font-size: 10px;
}
</style>