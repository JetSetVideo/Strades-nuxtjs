<template>
  <div class="node-canvas-container" ref="containerRef">
    <!-- SVG layer for edges -->
    <svg class="edges-layer" width="100%" height="100%">
      <g ref="edgesGroup">
        <path 
          v-for="(edge, index) in builderStore.edges" 
          :key="index"
          class="edge-path"
          :d="getEdgePath(edge)"
          :stroke-width="getEdgeWidth(edge.capital_flow)"
        />
      </g>
    </svg>

    <!-- HTML layer for Nodes -->
    <div class="nodes-layer">
      <div 
        v-for="node in builderStore.nodes" 
        :key="node.id"
        class="node-wrapper"
        :style="{ transform: `translate(${node.x}px, ${node.y}px)` }"
        @mousedown="startDrag($event, node)"
      >
        <AvatarNode v-if="node.type === 'avatar'" :node="node" />
        <div v-else class="generic-node" :style="{ opacity: node.confidence_score }">
          {{ node.type }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useBuilderStore, type BuilderNode, type BuilderEdge } from '~/stores/builder'
import AvatarNode from './Nodes/AvatarNode.vue'

const builderStore = useBuilderStore()
const containerRef = ref<HTMLElement | null>(null)

// Dragging logic
let draggingNode: BuilderNode | null = null
let dragOffset = { x: 0, y: 0 }

const startDrag = (event: MouseEvent, node: BuilderNode) => {
  draggingNode = node
  dragOffset.x = event.clientX - node.x
  dragOffset.y = event.clientY - node.y
  window.addEventListener('mousemove', onDrag)
  window.addEventListener('mouseup', stopDrag)
}

const onDrag = (event: MouseEvent) => {
  if (draggingNode) {
    const newX = event.clientX - dragOffset.x
    const newY = event.clientY - dragOffset.y
    builderStore.updateNodePosition(draggingNode.id, newX, newY)
  }
}

const stopDrag = () => {
  draggingNode = null
  window.removeEventListener('mousemove', onDrag)
  window.removeEventListener('mouseup', stopDrag)
}

// Edge rendering
const getEdgePath = (edge: BuilderEdge) => {
  const sourceNode = builderStore.nodes.find(n => n.id === edge.source)
  const targetNode = builderStore.nodes.find(n => n.id === edge.target)
  
  if (!sourceNode || !targetNode) return ''
  
  // Connect from right of source to left of target roughly (assuming 140px width nodes)
  const sx = sourceNode.x + 140
  const sy = sourceNode.y + 40
  const tx = targetNode.x
  const ty = targetNode.y + 40
  
  // Bezier curve
  return `M ${sx} ${sy} C ${sx + 100} ${sy}, ${tx - 100} ${ty}, ${tx} ${ty}`
}

const getEdgeWidth = (flow: number) => {
  return Math.max(1, flow / 10)
}
</script>

<style scoped>
.node-canvas-container {
  position: relative;
  width: 100%;
  height: 80vh;
  min-height: 600px;
  background: #111;
  overflow: hidden;
  border-radius: var(--app-border-radius, 12px);
  border: 1px solid rgba(255,255,255,0.1);
  box-shadow: inset 0 0 50px rgba(0,0,0,0.5);
}

.edges-layer {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
}

.edge-path {
  fill: none;
  stroke: rgba(255, 255, 255, 0.2);
  transition: stroke-width 0.3s;
}

.nodes-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.node-wrapper {
  position: absolute;
  top: 0;
  left: 0;
  cursor: grab;
  /* Hardware acceleration for smooth drag */
  will-change: transform;
}

.node-wrapper:active {
  cursor: grabbing;
}

.generic-node {
  background: #333;
  padding: 10px 20px;
  border-radius: 8px;
  color: white;
  border: 1px solid #555;
  user-select: none;
}
</style>
