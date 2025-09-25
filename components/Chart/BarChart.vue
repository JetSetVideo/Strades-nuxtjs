<script setup>
import * as d3 from "d3";

const props = defineProps({ index: String });
var outputFormat = d3.timeFormat("%b %Y"); // 30 June 2015
var parseDate = d3.timeParse("%Y%m"); // 20150630

const data = [
  { date: parseDate(202201), value: Math.random() * 100 },
  { date: parseDate(202202), value: Math.random() * 100 },
  { date: parseDate(202203), value: Math.random() * 100 },
  { date: parseDate(202204), value: Math.random() * 100 },
  { date: parseDate(202205), value: Math.random() * 100 },
  { date: parseDate(202206), value: Math.random() * 100 },
  { date: parseDate(202207), value: Math.random() * 100 },
  { date: parseDate(202208), value: Math.random() * 100 },
  { date: parseDate(202209), value: Math.random() * 100 },
  { date: parseDate(202210), value: Math.random() * 100 },
  { date: parseDate(202211), value: Math.random() * 100 },
  { date: parseDate(202212), value: Math.random() * 100 },
  { date: parseDate(202301), value: Math.random() * 100 },
  { date: parseDate(202302), value: Math.random() * 100 },
  { date: parseDate(202303), value: Math.random() * 100 },
  { date: parseDate(202304), value: Math.random() * 100 },
  { date: parseDate(202305), value: Math.random() * 100 },
  { date: parseDate(202306), value: Math.random() * 100 },
  { date: parseDate(202307), value: Math.random() * 100 },
  { date: parseDate(202308), value: Math.random() * 100 },
  { date: parseDate(202309), value: Math.random() * 100 },
  { date: parseDate(202310), value: Math.random() * 100 },
  { date: parseDate(202311), value: Math.random() * 100 },
  { date: parseDate(202312), value: Math.random() * 100 },
  { date: parseDate(202401), value: Math.random() * 100 },
  { date: parseDate(202402), value: Math.random() * 100 },
];

const width = 1600;
const height = 300;
const marginTop = 20;
const marginRight = 0;
const marginBottom = 30;
const marginLeft = 40;

onMounted(() => {
  // Create the horizontal scale and its axis generator.
  const x = d3
    .scaleBand()
    .domain(
      data.map(function (d) {
        return d.date;
      })
    )
    .range([marginLeft, width - marginRight])
    .padding(0.4);

  const xAxis = d3.axisBottom(x).tickFormat(outputFormat).tickSizeOuter(0);

  // Create the vertical scale.
  const y = d3
    .scaleLinear()
    .domain([0, d3.max(data, (d) => d.value)])
    .nice()
    .range([height - marginBottom, marginTop]);

  const svg = d3
    .select(".svg-container" + props.index)
    .append("svg")
    .attr("class", "mx-auto transition-[display] duration-200")
    .attr("style", "width: 85vw; height: 330px;");

  // Append the bars.
  svg
    .append("g")
    .attr("class", "bars")
    .attr("fill", "#a881fc")
    .selectAll("rect")
    .data(data)
    .join("rect")
    .transition()
    .duration(1500)
    .attr("x", (d) => x(d.date))
    .attr("y", (d) => y(d.value))
    .attr("height", (d) => y(0) - y(d.value))
    .attr("width", x.bandwidth());

  // Append the axes.
  const xTicks = svg
    .append("g")
    .attr("class", "x-axis")
    .attr("transform", `translate(0,${height - 30})`)
    .attr("fill", "green")
    .call(xAxis);

  xTicks
    .selectAll("text")
    .attr("transform", "translate(0, 20) rotate(-40)")
    .attr("class", "overflow-visible");

  svg
    .append("g")
    .attr("class", "y-axis")
    .attr("transform", `translate(${44},0)`)
    .call(d3.axisLeft(y));
});
</script>
<template>
  <div
    class="transition-[display] duration-200"
    :class="'svg-container' + props.index"
  ></div>
</template>
<style></style>
