<script setup>
import { ref, onMounted } from 'vue';
import * as d3 from 'd3';

const userSentiment = ref(null);
const averageSentiment = ref(0.6); // Fake data representing the average sentiment of users
const numUsers = ref(100); // Fake data representing the number of users who gave their sentiment

onMounted(() => {
  const width = 400;
  const height = 200;
  const radius = Math.min(width, height) / 2;
  const margin = { top: 20, right: 20, bottom: 20, left: 20 };

  const svg = d3.select('.sentiment-container')
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .append('g')
    .attr('transform', `translate(${width / 2}, ${height - margin.bottom})`);

  const x = d3.scaleLinear()
    .domain([-1, 1])
    .range([-radius, radius]);

  const gradient = svg.append('defs')
    .append('linearGradient')
    .attr('id', 'sentiment-gradient')
    .attr('x1', '0%')
    .attr('y1', '0%')
    .attr('x2', '100%')
    .attr('y2', '0%');

  gradient.append('stop')
    .attr('offset', '0%')
    .attr('stop-color', 'red');

  gradient.append('stop')
    .attr('offset', '50%')
    .attr('stop-color', 'yellow');

  gradient.append('stop')
    .attr('offset', '100%')
    .attr('stop-color', 'green');

  const arc = d3.arc()
    .innerRadius(radius - 20)
    .outerRadius(radius)
    .startAngle(-Math.PI / 2)
    .endAngle(Math.PI / 2);

  const sentimentArc = svg.append('path')
    .attr('d', arc)
    .attr('fill', 'grey')
    .on('click', function (event) {
      const [xPos] = d3.pointer(event);
      const sentiment = x.invert(xPos);
      userSentiment.value = sentiment;
      sentimentArc.attr('fill', 'url(#sentiment-gradient)');
      updateArrows();
    });

  const userArrow = svg.append('path')
    .attr('d', d3.symbol().type(d3.symbolTriangle).size(100))
    .attr('transform', `translate(0, 0) rotate(90)`)
    .attr('fill', 'black');

  const averageArrow = svg.append('path')
    .attr('d', d3.symbol().type(d3.symbolTriangle).size(100))
    .attr('transform', `translate(${x(averageSentiment.value * 2 - 1)}, 0) rotate(90)`)
    .attr('fill', 'grey');

  function updateArrows() {
    userArrow.transition()
      .duration(500)
      .attr('transform', `translate(${x(userSentiment.value * 2 - 1)}, 0) rotate(90)`);

    averageArrow.transition()
      .duration(500)
      .attr('transform', `translate(${x(averageSentiment.value * 2 - 1)}, 0) rotate(90)`);
  }
});
</script>

<template>
  <div class="sentiment-container">
    <h1>Sentiment Widget</h1>
    <p v-if="userSentiment !== null">Number of users: {{ numUsers }}</p>
  </div>

  <ul>
    <li class="button">Asset</li>
    <li class="button">Graph</li>
    <li class="button">Grade</li>
    <li class="button">Direction</li>
    <li class="button">Period</li>
  </ul>
</template>

<style scoped>
.button {
  display: inline-block;
  padding: 0.5em 1em;
  text-decoration: none;
  background: #353535;
  color: #FFF;
  border-bottom: solid 4px #ffffff;
  border-radius: 3px;
}

.sentiment-container {
  background-color: rgba(50, 50, 50, 0.8);
  border-radius: 8px;
  box-shadow: inset 0 0 10px rgba(0, 0, 0, 0.8);
  padding: 1rem;
  text-align: center;
}

svg {
  width: 100%;
  height: auto;
}

path {
  cursor: pointer;
}
</style>