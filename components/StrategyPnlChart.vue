<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import * as d3 from 'd3'

interface PnlData {
  date: string;
  pnl: number;
  equity: number;
  t?: Date;
}

const props = defineProps<{ history: Array<{ date: string; pnl: number; equity: number }> }>()
const el = ref<HTMLElement | null>(null)

function render() {
  if (!el.value) return
  const width = 600, height = 240, margin = { top: 10, right: 20, bottom: 30, left: 40 }
  const svgSel = d3.select(el.value).select('svg')
  if (svgSel.empty()) {
    d3.select(el.value).append('svg').attr('width', width).attr('height', height)
  }
  const svg = d3.select(el.value).select('svg')
  svg.selectAll('*').remove()
  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)
  const w = width - margin.left - margin.right
  const h = height - margin.top - margin.bottom
  const parse = d3.timeParse('%Y-%m-%d')
  const data: PnlData[] = props.history.map(d => ({ ...d, t: parse(d.date)! }))
  const x = d3.scaleTime().domain(d3.extent(data, (d: PnlData) => d.t) as [Date, Date]).range([0, w])
  const y = d3.scaleLinear().domain([d3.min(data, (d: PnlData) => Math.min(0, d.pnl)) || 0, d3.max(data, (d: PnlData) => d.pnl) || 0]).nice().range([h, 0])
  const line = d3.line<PnlData>().x((d: PnlData) => x(d.t!)).y((d: PnlData) => y(d.pnl)).curve(d3.curveMonotoneX)
  g.append('path').datum(data).attr('fill', 'none').attr('stroke', 'url(#grad)').attr('stroke-width', 2).attr('d', line)
  const defs = svg.append('defs')
  const grad = defs.append('linearGradient').attr('id', 'grad').attr('x1', '0%').attr('y1', '0%').attr('x2', '0%').attr('y2', '100%')
  grad.append('stop').attr('offset', '0%').attr('stop-color', '#00ff88')
  grad.append('stop').attr('offset', '100%').attr('stop-color', '#00aaff')
  g.append('g').attr('transform', `translate(0,${h})`).call(d3.axisBottom(x))
  g.append('g').call(d3.axisLeft(y))
}

onMounted(render)
watch(() => props.history, render, { deep: true })
</script>

<template>
  <div class="pnl-chart" ref="el" />
</template>

<style scoped>
.pnl-chart { background: var(--bg-secondary); border: 1px solid var(--border-primary); border-radius: var(--radius-md); padding: var(--spacing-md); }
svg text { fill: var(--text-light-gray); }
svg path, svg line { stroke: rgba(255,255,255,0.2); }
</style>


