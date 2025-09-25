<script setup>
import * as d3 from 'd3';
import { ref, onMounted } from 'vue';

const colors = ['#ff9900', '#4caf50'];
const items = ref([
  { name: 'BTC', value: 0.303, color: '#ff9900' },
  { name: 'ETH', value: 0.303, color: '#4caf50' },
]);

onMounted(() => {
  const svg = d3.select("#d3-target")
    .append("svg")
    .attr("width", 300)
    .attr("height", 300);

  const pie = d3.pie().sort(null).value(d => d.value); // Create a pie layout
  const dataReady = pie(items.value);

  const arcs = svg.selectAll("g.arc")
    .data(dataReady)
    .enter()
    .append("g")
    .attr("class", "arc")
    .attr("transform", "translate(150,150)"); // Center the pie in the SVG

  const radius = Math.min(300, 300) / 2;
  const arc = d3.arc().innerRadius(radius * 0.5).outerRadius(radius * 0.8);

  const outerArc = d3.arc()
    .innerRadius(radius * 0.9)
    .outerRadius(radius * 0.9);

  arcs.append("path")
    .attr("d", arc)
    .attr("fill", d => d.data.color);

  arcs.append("text")
    .attr("transform", d => `translate(${arc.centroid(d)})`)
    .attr("text-anchor", "middle")
    .text(d => d.data.name);
});
</script>

<template>
  <div class="WalletDistribution">
    <h1>Wallet Distribution</h1>
    <div id="d3-target"></div>
  </div>
  <div class="WalletDistribution_container">
    <div class="WalletDistribution_item" v-for="(item,index) in items" :key="index">
        <div class="WalletDistribution_item_color" :style="{ backgroundColor: item.color }">
            <div class="WalletDistribution__item__name">{{ item.name }}</div>
            <div class="WalletDistribution__item__value">{{ item.value }}</div>
        </div>
    </div>
    </div>
</template>

<style scoped>
.WalletDistribution{
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  margin: 1rem;
  background-color: rgba(20, 20, 20, 0.1);
  border-radius: 0.5rem;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
}
.WalletDistribution_item{
  display: flex;
  justify-content: center;
  gap: 0.5rem;
  margin:auto;
  padding: 0.5rem;
  border-radius: 0.5rem;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
}
.WalletDistribution_item_color{
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  border-radius: 0.5rem;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
}
</style>