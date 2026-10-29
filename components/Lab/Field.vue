<script setup lang="ts">
import { computed } from 'vue'
import type { Agent } from '~/types/agent'
import { LAB_AXES, projectAgents, type LabAxis } from '~/utils/labField'
import { agentSphere, orthographic } from '~/utils/navIcons'

const props = defineProps<{
  agents: Agent[]
  xAxis: LabAxis
  yAxis: LabAxis
  mode: 'map' | 'globe'
  spin: number
  focus: string | null
}>()

const emit = defineEmits<{
  'update:xAxis': [LabAxis]
  'update:yAxis': [LabAxis]
  'update:mode': ['map' | 'globe']
  'update:spin': [number]
  focus: [string]
}>()

const points = computed(() => {
  if (props.mode === 'globe') {
    const sphere = agentSphere(props.agents.map(agent => ({
      id: agent.id,
      name: agent.name,
      status: agent.training_state.status,
      risk: agent.personality_matrix.risk,
      patience: agent.personality_matrix.patience,
      contrarian: agent.personality_matrix.contrarian,
      trades: agent.performance.trades_total,
    })))
    const byId = new Map(props.agents.map(agent => [agent.id, agent]))
    return sphere.map(point => {
      const placed = orthographic(point.lon, point.lat, props.spin, 18)
      const agent = byId.get(point.id)
      return {
        id: point.id,
        name: point.name,
        role: agent?.role || 'catalog',
        x: (placed.x + 1) / 2,
        y: (1 - placed.y) / 2,
        depth: placed.depth,
        state: point.state,
      }
    })
  }
  return projectAgents(props.agents, props.xAxis, props.yAxis).map(point => ({
    ...point,
    depth: 1,
    state: 'running' as const,
  }))
})

function px(n: number, pad: number, span: number) {
  return pad + n * span
}

function place(point: { x: number; y: number }) {
  if (props.mode === 'globe') {
    return {
      x: 50 + (point.x * 2 - 1) * 28,
      y: 34 - (point.y * 2 - 1) * 28,
    }
  }
  return {
    x: px(point.x, 10, 80),
    y: px(1 - point.y, 8, 50),
  }
}

const label = (id: LabAxis) => LAB_AXES.find(axis => axis.id === id)?.label || id

const drawn = computed(() => {
  const raw = points.value
  const showAll = props.mode === 'map' && raw.length <= 14 && !props.focus
  const used: { x: number; y: number }[] = []
  return raw.map(point => {
    const at = place(point)
    let ly = at.y - 2.6
    const showLabel = showAll || props.focus === point.id
    if (showLabel) {
      let guard = 0
      while (used.some(row => Math.abs(row.x - at.x) < 15 && Math.abs(row.y - ly) < 3) && guard < 8) {
        ly -= 3.1
        guard++
      }
      if (ly < 4) ly = at.y + 3.2
      used.push({ x: at.x, y: ly })
    }
    return { ...point, cx: at.x, cy: at.y, lx: at.x + 2.2, ly, showLabel }
  })
})
</script>

<template>
  <section class="field" aria-label="Agent map">
    <div class="controls">
      <div class="modes" role="group" aria-label="Map mode">
        <button type="button" :class="{ on: mode === 'map' }" @click="emit('update:mode', 'map')">Map</button>
        <button type="button" :class="{ on: mode === 'globe' }" @click="emit('update:mode', 'globe')">Globe</button>
      </div>
      <template v-if="mode === 'map'">
        <label>X
          <select :value="xAxis" @change="emit('update:xAxis', ($event.target as HTMLSelectElement).value as LabAxis)">
            <option v-for="axis in LAB_AXES" :key="axis.id" :value="axis.id">{{ axis.label }}</option>
          </select>
        </label>
        <label>Y
          <select :value="yAxis" @change="emit('update:yAxis', ($event.target as HTMLSelectElement).value as LabAxis)">
            <option v-for="axis in LAB_AXES" :key="axis.id" :value="axis.id">{{ axis.label }}</option>
          </select>
        </label>
      </template>
      <label v-else class="spin">Turn
        <input
          type="range"
          min="-180"
          max="180"
          :value="spin"
          aria-label="Globe rotation"
          @input="emit('update:spin', Number(($event.target as HTMLInputElement).value))"
        />
      </label>
    </div>

    <svg viewBox="0 0 100 68" class="plot" role="img" :aria-label="mode === 'globe' ? 'Agents on the lab globe' : `${label(xAxis)} across, ${label(yAxis)} up`">
      <template v-if="mode === 'globe'">
        <ellipse class="disc" cx="50" cy="34" rx="30" ry="30" />
      </template>
      <template v-else>
        <line class="axis" x1="8" y1="60" x2="94" y2="60" />
        <line class="axis" x1="8" y1="60" x2="8" y2="6" />
        <text class="axis-name" x="94" y="66" text-anchor="end">{{ label(xAxis) }}</text>
        <text class="axis-name" x="10" y="5">{{ label(yAxis) }}</text>
      </template>
      <g v-for="point in drawn" :key="point.id">
        <circle
          class="dot"
          :class="[point.state, { on: focus === point.id, back: point.depth < 0.05 }]"
          :cx="point.cx"
          :cy="point.cy"
          :r="focus === point.id ? 2.4 : 1.7"
          @click="emit('focus', point.id)"
        >
          <title>{{ point.name }} · {{ point.role }}</title>
        </circle>
        <text
          v-if="point.showLabel"
          class="name"
          :text-anchor="point.cx > 72 ? 'end' : 'start'"
          :x="point.cx > 72 ? point.cx - 2.2 : point.lx"
          :y="point.ly"
        >{{ point.name }}</text>
      </g>
    </svg>
  </section>
</template>

<style scoped>
.field {
  min-width: 0;
  padding: 4px 6px 2px;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 8px;
}
.controls {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  align-items: center;
  margin-bottom: 4px;
}
.modes { display: inline-flex; gap: 4px; }
.modes button, select {
  background: transparent;
  color: rgba(255,255,255,0.78);
  border: 1px solid rgba(255,255,255,0.14);
  border-radius: 999px;
  font: inherit;
  font-size: 0.62rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  padding: 0.15rem 0.45rem;
}
.modes button.on { color: #fff; border-color: rgba(255,255,255,0.45); }
label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.62rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.5);
}
.spin input { width: 88px; }
.plot { width: 100%; height: auto; display: block; }
.disc { fill: rgba(255,255,255,0.03); stroke: rgba(255,255,255,0.16); }
.axis { stroke: rgba(255,255,255,0.18); }
.axis-name { fill: rgba(255,255,255,0.45); font-size: 3.2px; letter-spacing: 0.04em; }
.dot { fill: #8eb6ff; cursor: pointer; }
.dot.waiting { fill: #ffb020; }
.dot.error { fill: #ff5d73; }
.dot.back { opacity: 0.35; }
.dot.on { fill: #fff; }
.name { fill: rgba(255,255,255,0.82); font-size: 2.7px; pointer-events: none; }
</style>
