<template>
  <div class="wallet-icon-container" :style="{ width: `${size}px`, height: `${size}px` }">
    <svg ref="svgRef" :width="size" :height="size" viewBox="0 0 24 24" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import * as d3 from 'd3'
import { useWalletStore } from '~/stores/wallet'

const props = defineProps({
  size: {
    type: Number,
    default: 24
  }
})

const svgRef = ref<SVGSVGElement | null>(null)
const walletStore = useWalletStore()

// Mapping asset class to a default hue for the icon
const colorMap: Record<string, string> = {
  fiat: '#4A90E2',
  crypto: '#F5A623',
  stocks: '#7ED321',
  commodities: '#F8E71C'
}

let svgGroup: d3.Selection<SVGGElement, unknown, null, undefined>

const renderPie = () => {
  if (!svgRef.value) return

  const data = Object.entries(walletStore.allocationPie).map(([key, value]) => ({ key, value }))
  
  const pie = d3.pie<{key: string, value: number}>()
    .value(d => d.value)
    .sort(null)

  const arc = d3.arc<d3.PieArcDatum<{key: string, value: number}>>()
    .innerRadius(props.size / 4) // Donut shape
    .outerRadius(props.size / 2)

  // Initialization
  if (!svgGroup) {
    const svg = d3.select(svgRef.value)
    svgGroup = svg.append('g')
      .attr('transform', `translate(${props.size / 2}, ${props.size / 2})`)
  }

  const paths = svgGroup.selectAll('path')
    .data(pie(data))

  // Enter + Update
  paths.join('path')
    .attr('d', arc)
    .attr('fill', d => colorMap[d.data.key] || '#ccc')
    .attr('stroke', 'var(--bg-color, #1E1E24)')
    .attr('stroke-width', '1px')
    .transition()
    .duration(300)
    .attrTween('d', function(d) {
      // Very basic tweening for the demo
      const i = d3.interpolate(this._current || d, d)
      this._current = i(1)
      return (t) => arc(i(t)) as string
    })
}

onMounted(() => {
  renderPie()
})

watch(() => walletStore.allocationPie, () => {
  renderPie()
}, { deep: true })
</script>

<style scoped>
.wallet-icon-container {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s ease;
  width: 100%;
  height: 100%;
}
.wallet-icon-container:hover {
  transform: scale(1.1);
}
</style>
