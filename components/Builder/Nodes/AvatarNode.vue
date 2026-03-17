<template>
  <div class="avatar-node" :style="dynamicStyles" :class="{ 'low-confidence': node.confidence_score < 0.7 }">
    <div class="node-header">
      <span class="icon">👤</span>
      <span class="title">Swarm AI</span>
    </div>
    <div class="node-body">
      <div class="stat">Risk: {{ (node.params.riskProfile * 100).toFixed(0) }}%</div>
      <div class="stat heartbeat">Freq: {{ node.execution_frequency }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { BuilderNode } from '~/stores/builder'

const props = defineProps<{
  node: BuilderNode
}>()

// Phase 4.2 Data-Driven Node Forms
const dynamicStyles = computed(() => {
  const risk = props.node.params.riskProfile || 0.5
  
  // High risk = sharp corners, Low risk = rounded corners
  const borderRadius = `${(1 - risk) * 20}px`
  
  // Execution frequency drives a CSS scale pulse (handled in CSS via class/keyframes)
  const animSpeed = `${1 / Math.max(0.1, props.node.execution_frequency)}s`

  return {
    borderRadius,
    '--heartbeat-speed': animSpeed,
    opacity: props.node.confidence_score // Phase 4.3 Node Confidence Opacity
  }
})
</script>

<style scoped>
.avatar-node {
  background: rgba(40, 40, 50, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(10px);
  padding: 10px;
  color: #fff;
  width: 140px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  transition: opacity 0.3s ease, border-radius 0.3s ease;
  font-family: 'Poppins', sans-serif;
  user-select: none;
}

.low-confidence {
  border-color: rgba(255, 100, 100, 0.5);
}

.node-header {
  display: flex;
  align-items: center;
  gap: 8px;
  border-bottom: 1px solid rgba(255,255,255,0.1);
  padding-bottom: 4px;
  margin-bottom: 4px;
}

.title {
  font-weight: bold;
  font-size: 0.9rem;
}

.stat {
  font-size: 0.8rem;
  color: #aaa;
}

/* Phase 4.4 Node Execution Heartbeat */
.heartbeat {
  animation: pulse var(--heartbeat-speed) infinite alternate;
}

@keyframes pulse {
  0% { transform: scale(1); color: #aaa; }
  100% { transform: scale(1.05); color: #fff; }
}
</style>
