<template>
  <div class="relation-container"></div>
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
const treeData = company.value.relation;

onMounted(() => {
  const margin = { top: 20, right: 90, bottom: 30, left: 90 },
    width = 1000 - margin.left - margin.right,
    height = 700 - margin.top - margin.bottom;
  const treemap = d3.tree().size([height, width]);
  let nodes = d3.hierarchy(treeData, (d) => d.children);

  // maps the node data to the tree layout
  nodes = treemap(nodes);
  const svg = d3
      .select(".relation-container")
      .append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom),
    g = svg
      .append("g")
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  // adds the links between the nodes
  const link = g
    .selectAll(".link")
    .data(nodes.descendants().slice(1))
    .enter()
    .append("path")
    .attr("class", "link")
    .style("stroke", (d) => d.data.level)
    .attr("d", (d) => {
      return (
        "M" +
        (d.y - 100) +
        "," +
        d.x +
        "C" +
        (d.y + d.parent.y) / 2 +
        "," +
        d.x +
        " " +
        (d.y + d.parent.y) / 2 +
        "," +
        d.parent.x +
        " " +
        (d.parent.y + 100) +
        "," +
        d.parent.x
      );
    });

  // adds each node as a group
  const node = g
    .selectAll(".node")
    .data(nodes.descendants())
    .enter()
    .append("g")
    .attr(
      "class",
      (d) => "node" + (d.children ? " node--internal" : " node--leaf")
    )
    .attr("transform", (d) => "translate(" + d.y + "," + d.x + ")");

  // adds the circle to the node
  node
    .append("rect")
    .attr("width", 200)
    .attr("height", 30)
    .attr("rx", 5)
    .attr("ry", 5)
    .attr("stroke", "rgba(255, 255, 255, 0.19)")
    .attr("transform", "translate(-100, -15)");

  // adds the text to the node
  node
    .append("text")
    .attr("dy", ".35em")
    // .attr("x", (d) => (d.children ? (d.data.value + 5) * -1 : d.data.value + 5))
    // .attr("y", (d) => (d.children && d.depth !== 0 ? -(d.data.value + 5) : d))
    .attr("fill", "white")
    .style("text-anchor", "middle")
    .attr("class", "text-[15px]")
    // .style("text-anchor", (d) => (d.children ? "end" : "start"))
    .text((d) => d.data.name);

  d3
    .selectAll(".node--leaf")
    .append("path")
    .attr("transform", "translate(-95, -15)")
    .attr("stroke", "currentColor")
    .attr("stroke-width", 1.5)
    .attr(
      "d",
      "M6 12c.263 0 .524-.06.767-.175a2 2 0 0 0 .65-.491c.186-.21.333-.46.433-.734.1-.274.15-.568.15-.864a2.4 2.4 0 0 0 .586 1.591c.375.422.884.659 1.414.659.53 0 1.04-.237 1.414-.659A2.4 2.4 0 0 0 12 9.736a2.4 2.4 0 0 0 .586 1.591c.375.422.884.659 1.414.659.53 0 1.04-.237 1.414-.659A2.4 2.4 0 0 0 16 9.736c0 .295.052.588.152.861s.248.521.434.73a2 2 0 0 0 .649.488 1.809 1.809 0 0 0 1.53 0 2.03 2.03 0 0 0 .65-.488c.185-.209.332-.457.433-.73.1-.273.152-.566.152-.861 0-.974-1.108-3.85-1.618-5.121A.983.983 0 0 0 17.466 4H6.456a.986.986 0 0 0-.93.645C5.045 5.962 4 8.905 4 9.736c.023.59.241 1.148.611 1.567.37.418.865.667 1.389.697Zm0 0c.328 0 .651-.091.94-.266A2.1 2.1 0 0 0 7.66 11h.681a2.1 2.1 0 0 0 .718.734c.29.175.613.266.942.266.328 0 .651-.091.94-.266.29-.174.537-.427.719-.734h.681a2.1 2.1 0 0 0 .719.734c.289.175.612.266.94.266.329 0 .652-.091.942-.266.29-.174.536-.427.718-.734h.681c.183.307.43.56.719.734.29.174.613.266.941.266a1.819 1.819 0 0 0 1.06-.351M6 12a1.766 1.766 0 0 1-1.163-.476M5 12v7a1 1 0 0 0 1 1h2v-5h3v5h7a1 1 0 0 0 1-1v-7m-5 3v2h2v-2h-2Z"
    );

    d3
    .selectAll(".node--internal")
    .append("path")
    .attr("transform", "translate(-95, -15)")
    .attr("stroke", "currentColor")
    .attr("stroke-width", 1.5)
    .attr(
      "d",
      "M13 7h6l2 4m-8-4v8m0-8V6a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v9h2m8 0H9m4 0h2m4 0h2v-4m0 0h-5m3.5 5.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Zm-10 0a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z"
    );

    d3.select(".node--internal>path").remove();

    d3
    .select(".node--internal")
    .append("path")
    .attr("transform", "translate(-95, -15)")
    .attr("stroke", "currentColor")
    .attr("stroke-width", 1.5)
    .attr(
      "d",
      "M11.083 5.104c.35-.8 1.485-.8 1.834 0l1.752 4.022a1 1 0 0 0 .84.597l4.463.342c.9.069 1.255 1.2.556 1.771l-3.33 2.723a1 1 0 0 0-.337 1.016l1.03 4.119c.214.858-.71 1.552-1.474 1.106l-3.913-2.281a1 1 0 0 0-1.008 0L7.583 20.8c-.764.446-1.688-.248-1.474-1.106l1.03-4.119A1 1 0 0 0 6.8 14.56l-3.33-2.723c-.698-.571-.342-1.702.557-1.771l4.462-.342a1 1 0 0 0 .84-.597l1.753-4.022Z"
    );

});
</script>

<style>
.link {
  fill: none;
  stroke: #ccc;
  stroke-width: 1px;
}
</style>
