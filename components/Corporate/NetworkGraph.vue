<template>
  <div class="network-graph-container" ref="containerRef">
    <svg class="network-svg" width="100%" height="100%">
      <g ref="svgGroup">
        <!-- Links -->
        <line 
          v-for="(link, i) in links" 
          :key="'link-'+i"
          class="network-link"
          :stroke-width="getStrokeWidth(link.supply_chain_health)"
        />
        <!-- Nodes -->
        <circle 
          v-for="node in nodes" 
          :key="node.id"
          class="network-node"
          :r="10"
          :class="getPulseClass(node.fluctuation_velocity)"
          :fill="getNodeColor(node.status)"
        />
      </g>
    </svg>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import * as d3 from 'd3'

// Types
interface CorporateNode extends d3.SimulationNodeDatum {
  id: string
  name: string
  type: 'company' | 'factory' | 'supplier'
  status?: 'active' | 'reduced' | 'offline'
  fluctuation_velocity: number
}

interface CorporateLink extends d3.SimulationLinkDatum<CorporateNode> {
  supply_chain_health: number // 0.0 to 1.0
}

const props = defineProps({
  companyId: {
    type: String,
    required: true
  }
})

const containerRef = ref<HTMLElement | null>(null)
const svgGroup = ref<SVGGElement | null>(null)

const nodes = ref<CorporateNode[]>([])
const links = ref<CorporateLink[]>([])

let simulation: d3.Simulation<CorporateNode, CorporateLink> | null = null

const getStrokeWidth = (health: number) => {
  return Math.max(0.5, health * 5)
}

const getNodeColor = (status?: string) => {
  if (status === 'offline') return '#ff4444'
  if (status === 'reduced') return '#ffbb33'
  return '#00C851'
}

const getPulseClass = (velocity: number) => {
  if (velocity > 0.8) return 'pulse-fast'
  if (velocity > 0.4) return 'pulse-medium'
  return 'pulse-slow'
}

onMounted(() => {
  // Mock Data Initialization
  nodes.value = [
    { id: 'c1', name: 'Main Company', type: 'company', fluctuation_velocity: 0.9, status: 'active' },
    { id: 'f1', name: 'Factory Alpha', type: 'factory', fluctuation_velocity: 0.2, status: 'active' },
    { id: 'f2', name: 'Factory Beta', type: 'factory', fluctuation_velocity: 0.5, status: 'reduced' },
    { id: 's1', name: 'Supplier X', type: 'supplier', fluctuation_velocity: 0.1, status: 'active' },
  ]

  links.value = [
    { source: 'c1', target: 'f1', supply_chain_health: 0.9 },
    { source: 'c1', target: 'f2', supply_chain_health: 0.4 },
    { source: 'f1', target: 's1', supply_chain_health: 0.8 },
  ]

  if (containerRef.value && svgGroup.value) {
    const width = containerRef.value.clientWidth
    const height = containerRef.value.clientHeight

    simulation = d3.forceSimulation<CorporateNode>(nodes.value)
      .force('link', d3.forceLink<CorporateNode, CorporateLink>(links.value).id(d => d.id).distance(100))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .on('tick', () => {
        const svg = d3.select(svgGroup.value)
        svg.selectAll<SVGLineElement, CorporateLink>('.network-link')
          .data(links.value)
          .attr('x1', d => (d.source as CorporateNode).x || 0)
          .attr('y1', d => (d.source as CorporateNode).y || 0)
          .attr('x2', d => (d.target as CorporateNode).x || 0)
          .attr('y2', d => (d.target as CorporateNode).y || 0)

        svg.selectAll<SVGCircleElement, CorporateNode>('.network-node')
          .data(nodes.value)
          .attr('cx', d => d.x || 0)
          .attr('cy', d => d.y || 0)
      })
  }
})

onUnmounted(() => {
  if (simulation) simulation.stop()
})
</script>

<style scoped>
.network-graph-container {
  width: 100%;
  height: 400px;
  background: rgba(20, 20, 20, 0.5);
  border-radius: var(--app-border-radius, 12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  overflow: hidden;
}

.network-link {
  stroke: rgba(255, 255, 255, 0.3);
  transition: stroke-width 0.3s ease;
}

.network-node {
  stroke: #fff;
  stroke-width: 1.5px;
}

/* Phase 5.1 Fluctuation Velocity Animation */
.pulse-fast { animation: node-pulse 0.3s infinite alternate; }
.pulse-medium { animation: node-pulse 0.8s infinite alternate; }
.pulse-slow { animation: node-pulse 2s infinite alternate; }

@keyframes node-pulse {
  0% { filter: drop-shadow(0 0 2px currentColor); transform: scale(1); }
  100% { filter: drop-shadow(0 0 10px currentColor); transform: scale(1.2); }
}
</style>
