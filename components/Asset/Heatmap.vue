<template>
  <div class="treemap-container"></div>
</template>

<script setup>
import * as d3 from "d3";
const props = defineProps({ companyId: String });
import { useAssetsStore } from "@/stores/assetsStore.ts";

const assetsStore = useAssetsStore();
const company = ref(null);
assetsStore.assets.categories.forEach((category) => {
  if (category.companies) {
    const foundCompany = category.companies.find(
      (c) => c.id === props.companyId
    );
    if (foundCompany) {
      company.value = foundCompany;
    }
  }
});
const data = company.value.heatmap;
onMounted(() => {
  const width = 1154;
  const height = 1154;

  // Specify the color scale.
  const color = d3.scaleOrdinal(
    data.children.map((d) => d.name),
    d3.schemeTableau10
  );

  // Compute the layout.
  const root = d3
    .treemap()
    .tile(d3.treemapSquarify) // e.g., d3.treemapSquarify
    .size([width, height])
    .padding(1)
    .round(true)(
    d3
      .hierarchy(data)
      .sum((d) => d.value)
      .sort((a, b) => b.value - a.value)
  );

  // Create the SVG container.
  const svg = d3
    .select(".treemap-container")
    .append("svg")
    .attr("viewBox", [0, 0, width, height])
    .attr("width", width)
    .attr("height", height)
    .attr("style", "max-width: 100%; height: auto; font: 10px sans-serif");

  // Add a cell for each leaf of the hierarchy.
  const leaf = svg
    .selectAll("g")
    .data(root.leaves())
    .join("g")
    .attr("transform", (d) => `translate(${d.x0},${d.y0})`);

  // Append a tooltip.
  const format = d3.format(",d");
  leaf.append("title").text(
    (d) =>
      `${d
        .ancestors()
        .reverse()
        .map((d) => d.data.name)
        .join(".")}\n${format(d.value)}`
  );

  // Append a color rectangle.
  leaf
    .append("rect")
    // .attr("id", (d) => (d.leafUid = DOM.uid("leaf")).id)
    .attr("fill", (d) => {
      while (d.depth > 1) d = d.parent;
      return color(d.data.name);
    })
    .attr("fill-opacity", 0.6)
    .attr("width", (d) => d.x1 - d.x0)
    .attr("height", (d) => d.y1 - d.y0);

  // Append a clipPath to ensure text does not overflow.
  leaf
    .append("clipPath")
    // .attr("id", (d) => (d.clipUid = DOM.uid("clip")).id)
    .append("use")
    // .attr("xlink:href", (d) => d.leafUid.href);

  // Append multiline text. The last line shows the value and has a specific formatting.
  leaf
    .append("text")
    .attr("clip-path", (d) => d.clipUid)
    .selectAll("tspan")
    .data((d) =>
      d.data.name.split(/(?=[A-Z][a-z])|\s+/g).concat(format(d.value))
    )
    .join("tspan")
    .attr("x", 3)
    .attr(
      "y",
      (d, i, nodes) => `${(i === nodes.length - 1) * 0.3 + 1.1 + i * 0.9}em`
    )
    .attr("fill-opacity", (d, i, nodes) =>
      i === nodes.length - 1 ? 0.7 : null
    )
    .attr("fill", "white")
    .attr("font-size", "15px")
    .text((d) => d);
});
</script>

<style></style>
