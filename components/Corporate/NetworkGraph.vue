<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, computed } from 'vue'
import * as d3 from 'd3'

export type NetworkRole = 'company' | 'facility' | 'supplier' | 'customer'

export interface NetworkNode extends d3.SimulationNodeDatum {
  id: string
  name: string
  role: NetworkRole
  status?: 'active' | 'reduced' | 'offline' | 'planned' | string
  share_pct?: number
  fluctuation_velocity?: number
}

export interface NetworkLink extends d3.SimulationLinkDatum<NetworkNode> {
  /** 0..1 — drives stroke width */
  health: number
  /** Optional label for tooltips / aria */
  label?: string
}

interface Facility {
  id: string
  name: string
  type?: string
  status?: string
  size?: 'small' | 'medium' | 'large' | string
  lat?: number
  lng?: number
}

interface SupplyChainParty {
  id: string
  name: string
  country?: string
  share_pct?: number
  status?: string
  lat?: number
  lng?: number
}

interface Shipment {
  id: string
  from_country: string
  to_country: string
  value_usd?: number
  product?: string
}

interface SupplyChain {
  headquarters?: { name?: string; lat?: number; lng?: number }
  facilities?: Facility[]
  suppliers?: SupplyChainParty[]
  customers?: SupplyChainParty[]
  shipments?: Shipment[]
}

const props = withDefaults(defineProps<{
  supplyChain: SupplyChain | null
  companyName?: string
  height?: number
  maxNodes?: number
}>(), { height: 380, maxNodes: 24, companyName: '' })

const containerRef = ref<HTMLElement | null>(null)
const svgGroup = ref<SVGGElement | null>(null)

const nodes = ref<NetworkNode[]>([])
const links = ref<NetworkLink[]>([])
let simulation: d3.Simulation<NetworkNode, NetworkLink> | null = null

const empty = computed(() => nodes.value.length === 0)

function buildGraph() {
  const sc = props.supplyChain
  if (!sc) { nodes.value = []; links.value = []; return }

  const ns: NetworkNode[] = []
  const ls: NetworkLink[] = []

  // 1. Anchor node — the company / HQ
  const anchorId = 'company'
  ns.push({
    id: anchorId,
    name: props.companyName || sc.headquarters?.name || 'Company',
    role: 'company',
    fluctuation_velocity: 0.6
  })

  // 2. Facilities branch off the anchor
  const fac = sc.facilities ?? []
  for (const f of fac.slice(0, Math.floor(props.maxNodes / 3))) {
    ns.push({
      id: `fac:${f.id}`,
      name: f.name,
      role: 'facility',
      status: f.status,
      fluctuation_velocity: f.size === 'large' ? 0.7 : 0.3
    })
    ls.push({ source: anchorId, target: `fac:${f.id}`, health: 0.85, label: f.type })
  }

  // 3. Top suppliers (by share_pct), connect to anchor or biggest facility
  const sup = (sc.suppliers ?? [])
    .slice()
    .sort((a, b) => (b.share_pct ?? 0) - (a.share_pct ?? 0))
    .slice(0, Math.floor(props.maxNodes / 3))
  const supTargetId = `fac:${fac[0]?.id}`
  for (const s of sup) {
    ns.push({
      id: `sup:${s.id}`,
      name: s.name,
      role: 'supplier',
      status: s.status,
      share_pct: s.share_pct,
      fluctuation_velocity: Math.min(1, (s.share_pct ?? 5) / 25)
    })
    const target = ns.find(n => n.id === supTargetId) ? supTargetId : anchorId
    ls.push({
      source: `sup:${s.id}`,
      target,
      health: Math.min(1, (s.share_pct ?? 5) / 25),
      label: s.country
    })
  }

  // 4. Top customers, connect to anchor
  const cus = (sc.customers ?? [])
    .slice()
    .sort((a, b) => (b.share_pct ?? 0) - (a.share_pct ?? 0))
    .slice(0, Math.floor(props.maxNodes / 3))
  for (const c of cus) {
    ns.push({
      id: `cus:${c.id}`,
      name: c.name,
      role: 'customer',
      share_pct: c.share_pct,
      fluctuation_velocity: Math.min(1, (c.share_pct ?? 5) / 25)
    })
    ls.push({
      source: anchorId,
      target: `cus:${c.id}`,
      health: Math.min(1, (c.share_pct ?? 5) / 25),
      label: c.country
    })
  }

  nodes.value = ns
  links.value = ls
}

function strokeWidth(health: number) {
  return Math.max(0.5, health * 4.5)
}

function nodeColor(node: NetworkNode) {
  if (node.role === 'company') return 'var(--primary-green, #00ff88)'
  if (node.role === 'facility') {
    if (node.status === 'offline')  return '#ff4d6a'
    if (node.status === 'reduced')  return '#ffaa00'
    if (node.status === 'planned')  return '#888888'
    return '#7ED321'
  }
  if (node.role === 'supplier') return '#F5A623'
  return 'var(--primary-blue, #00aaff)' // customer
}

function nodeRadius(node: NetworkNode) {
  if (node.role === 'company') return 14
  if (node.role === 'facility') return 9
  return Math.max(6, 6 + (node.share_pct ?? 0) * 0.25)
}

function pulseClass(velocity?: number) {
  const v = velocity ?? 0.3
  if (v > 0.8) return 'pulse-fast'
  if (v > 0.4) return 'pulse-medium'
  return 'pulse-slow'
}

function startSim() {
  stopSim()
  if (!containerRef.value || !svgGroup.value || nodes.value.length === 0) return
  const w = containerRef.value.clientWidth
  const h = props.height
  simulation = d3.forceSimulation<NetworkNode>(nodes.value)
    .force('link',  d3.forceLink<NetworkNode, NetworkLink>(links.value)
      .id(d => d.id)
      .distance(d => 50 + (1 - (d as NetworkLink).health) * 80))
    .force('charge', d3.forceManyBody().strength(-180))
    .force('center', d3.forceCenter(w / 2, h / 2))
    .force('collide', d3.forceCollide<NetworkNode>().radius(d => nodeRadius(d) + 4))
    .on('tick', tick)
}

function stopSim() {
  if (simulation) {
    simulation.stop()
    simulation = null
  }
}

function tick() {
  if (!svgGroup.value) return
  const svg = d3.select(svgGroup.value)
  svg.selectAll<SVGLineElement, NetworkLink>('.network-link')
    .data(links.value)
    .attr('x1', d => (d.source as NetworkNode).x ?? 0)
    .attr('y1', d => (d.source as NetworkNode).y ?? 0)
    .attr('x2', d => (d.target as NetworkNode).x ?? 0)
    .attr('y2', d => (d.target as NetworkNode).y ?? 0)
  svg.selectAll<SVGCircleElement, NetworkNode>('.network-node')
    .data(nodes.value)
    .attr('cx', d => d.x ?? 0)
    .attr('cy', d => d.y ?? 0)
  svg.selectAll<SVGTextElement, NetworkNode>('.network-label')
    .data(nodes.value)
    .attr('x', d => d.x ?? 0)
    .attr('y', d => (d.y ?? 0) + nodeRadius(d) + 10)
}

onMounted(() => {
  buildGraph()
  startSim()
})
onBeforeUnmount(stopSim)

watch(() => props.supplyChain, () => {
  buildGraph()
  startSim()
}, { deep: true })
</script>

<template>
  <div
    class="network-graph-container"
    ref="containerRef"
    :style="{ height: `${height}px` }"
    role="img"
    :aria-label="`Supply chain graph for ${companyName || 'company'}: ${nodes.length} nodes, ${links.length} connections.`"
  >
    <svg v-if="!empty" class="network-svg" :width="'100%'" :height="height">
      <g ref="svgGroup">
        <line
          v-for="(link, i) in links"
          :key="'l-' + i"
          class="network-link"
          :stroke-width="strokeWidth(link.health)"
        />
        <circle
          v-for="node in nodes"
          :key="node.id"
          class="network-node"
          :class="[`role-${node.role}`, pulseClass(node.fluctuation_velocity)]"
          :r="nodeRadius(node)"
          :fill="nodeColor(node)"
        />
        <text
          v-for="node in nodes"
          :key="`t-${node.id}`"
          class="network-label"
          :class="`role-${node.role}`"
          text-anchor="middle"
        >{{ node.name }}</text>
      </g>
    </svg>

    <div v-else class="empty">
      <span class="empty-icon">◯</span>
      <span class="empty-label">No supply chain data</span>
    </div>

    <ul class="legend" v-if="!empty" aria-label="Legend">
      <li><span class="dot role-company" /> Company</li>
      <li><span class="dot role-facility" /> Facility</li>
      <li><span class="dot role-supplier" /> Supplier</li>
      <li><span class="dot role-customer" /> Customer</li>
    </ul>
  </div>
</template>

<style scoped>
.network-graph-container {
  position: relative;
  width: 100%;
  background: linear-gradient(180deg, rgba(15,15,20,0.6), rgba(10,12,16,0.55));
  border-radius: var(--app-border-radius, 8px);
  border: 1px solid rgba(255,255,255,0.06);
  overflow: hidden;
}

.network-svg { display: block; }

.network-link {
  stroke: rgba(255, 255, 255, 0.22);
  transition: stroke-width 0.3s ease;
}

.network-node {
  stroke: rgba(15,15,18,0.9);
  stroke-width: 1.5px;
}
.network-node.role-company {
  stroke: var(--primary-green, #00ff88);
  stroke-width: 2px;
  filter: drop-shadow(0 0 6px rgba(0,255,136,0.4));
}

.network-label {
  fill: rgba(255,255,255,0.85);
  font-size: 9.5px;
  font-weight: 700;
  font-family: 'Poppins', sans-serif;
  pointer-events: none;
  letter-spacing: 0.02em;
  paint-order: stroke;
  stroke: rgba(10,12,16,0.85);
  stroke-width: 2.5px;
  stroke-linejoin: round;
}
.network-label.role-company { font-size: 11px; }

.pulse-fast   { animation: node-pulse 0.35s infinite alternate; }
.pulse-medium { animation: node-pulse 0.95s infinite alternate; }
.pulse-slow   { animation: node-pulse 2.2s  infinite alternate; }

@keyframes node-pulse {
  0%   { filter: drop-shadow(0 0 2px currentColor); transform: scale(1); }
  100% { filter: drop-shadow(0 0 9px currentColor); transform: scale(1.08); }
}

.empty {
  position: absolute; inset: 0;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: 0.35rem;
  color: rgba(255,255,255,0.45);
}
.empty-icon {
  font-size: 1.5rem;
  opacity: 0.6;
}
.empty-label {
  font-size: 0.7rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.legend {
  position: absolute;
  top: 0.5rem; right: 0.55rem;
  list-style: none;
  margin: 0;
  padding: 0.35rem 0.55rem;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  background: rgba(15,15,18,0.7);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 5px;
  backdrop-filter: blur(8px);
  font-size: 0.58rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.75);
  font-weight: 700;
}
.legend li { display: inline-flex; align-items: center; gap: 0.35rem; }
.dot {
  width: 7px; height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}
.dot.role-company  { background: var(--primary-green, #00ff88); }
.dot.role-facility { background: #7ED321; }
.dot.role-supplier { background: #F5A623; }
.dot.role-customer { background: var(--primary-blue, #00aaff); }

@media (max-width: 540px) {
  .network-label { font-size: 8px; }
  .legend { font-size: 0.5rem; padding: 0.25rem 0.4rem; }
}
</style>
