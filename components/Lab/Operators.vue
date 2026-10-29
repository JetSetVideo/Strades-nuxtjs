<script setup lang="ts">
import { computed } from 'vue'
import type { Agent } from '~/types/agent'
import {
  allRelations, operatorCounts, pickRelations, projectAgents,
  type LabAxis, type Operator,
} from '~/utils/labField'

const props = defineProps<{
  agents: Agent[]
  xAxis: LabAxis
  yAxis: LabAxis
  focus: string | null
}>()

const emit = defineEmits<{ focus: [string] }>()

const relations = computed(() => allRelations(props.agents))
const counts = computed(() => operatorCounts(relations.value))
const drawn = computed(() => pickRelations(relations.value, props.agents.length > 16 ? 28 : 40))
const placed = computed(() => {
  const points = projectAgents(props.agents, props.xAxis, props.yAxis)
  return new Map(points.map(point => [point.id, point]))
})

function at(id: string) {
  const point = placed.value.get(id)
  return {
    x: 8 + (point?.x ?? 0.5) * 84,
    y: 8 + (1 - (point?.y ?? 0.5)) * 50,
    name: point?.name ?? id,
  }
}

const TONE: Record<Operator, string> = {
  together: '#3dd68c',
  against: '#ff5d73',
  junction: '#ffb020',
  apart: 'rgba(255,255,255,0.28)',
}

function visible(op: Operator, a: string, b: string) {
  if (!props.focus) return true
  return a === props.focus || b === props.focus
}
</script>

<template>
  <section class="ops" aria-label="How the agents relate">
    <p class="counts">
      <span class="together">{{ counts.together }} together</span>
      <span class="against">{{ counts.against }} against</span>
      <span class="junction">{{ counts.junction }} junction</span>
      <span class="apart">{{ counts.apart }} apart</span>
    </p>
    <svg viewBox="0 0 100 66" class="plot" role="img" aria-label="Performance links between the agents in view">
      <line
        v-for="link in drawn"
        :key="`${link.a}-${link.b}`"
        :x1="at(link.a).x"
        :y1="at(link.a).y"
        :x2="at(link.b).x"
        :y2="at(link.b).y"
        :stroke="TONE[link.op]"
        :stroke-width="link.op === 'apart' ? 0.28 : 0.4"
        :stroke-dasharray="link.op === 'apart' ? '1.2 0.8' : link.op === 'junction' ? '0.4 0.9' : undefined"
        :opacity="visible(link.op, link.a, link.b) ? 0.9 : 0.08"
      >
        <title>{{ at(link.a).name }} {{ link.op }} {{ at(link.b).name }} · money {{ link.financial.toFixed(2) }} · compute {{ link.compute.toFixed(2) }}</title>
      </line>
      <g v-for="agent in agents" :key="agent.id" @click="emit('focus', agent.id)">
        <circle
          class="node"
          :class="{ on: focus === agent.id }"
          :cx="at(agent.id).x"
          :cy="at(agent.id).y"
          r="1.5"
        >
          <title>{{ agent.name }}</title>
        </circle>
      </g>
    </svg>
    <p class="legend">
      Solid green moves together. Red moves against. Amber meets at the method. A dashed line sits apart.
      The counts are every pair in view. The drawing keeps the strongest links.
    </p>
  </section>
</template>

<style scoped>
.ops {
  min-width: 0;
  padding: 4px 6px 2px;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 8px;
}
.counts {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 10px;
  margin: 0 0 4px;
  font-size: 0.62rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.together { color: #3dd68c; }
.against { color: #ff5d73; }
.junction { color: #ffb020; }
.apart { color: rgba(255,255,255,0.45); }
.plot { width: 100%; height: auto; display: block; }
.node { fill: #d7e4ff; cursor: pointer; }
.node.on { fill: #fff; }
.legend {
  margin: 4px 0 0;
  font-size: 0.62rem;
  line-height: 1.35;
  color: rgba(255,255,255,0.48);
}
</style>
