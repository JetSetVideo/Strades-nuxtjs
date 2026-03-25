<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ modelValue: string }>()
const emit  = defineEmits<{ 'update:modelValue': [v: string] }>()

const FREQUENCIES = [
  { id: '1m',  label: '1 Min',   desc: 'Scalping',        riskMult: 2.0,  icon: '⚡', heartbeatMs: 400  },
  { id: '5m',  label: '5 Min',   desc: 'Scalping+',       riskMult: 1.8,  icon: '⚡', heartbeatMs: 600  },
  { id: '15m', label: '15 Min',  desc: 'Short-term',      riskMult: 1.5,  icon: '🔥', heartbeatMs: 900  },
  { id: '1h',  label: '1 Hour',  desc: 'Intraday',        riskMult: 1.2,  icon: '📈', heartbeatMs: 1400 },
  { id: '4h',  label: '4 Hours', desc: 'Swing',           riskMult: 1.0,  icon: '🌊', heartbeatMs: 2000 },
  { id: '1D',  label: '1 Day',   desc: 'Daily',           riskMult: 0.8,  icon: '☀',  heartbeatMs: 3000 },
  { id: '1W',  label: '1 Week',  desc: 'Weekly',          riskMult: 0.6,  icon: '📅', heartbeatMs: 5000 },
  { id: '1M',  label: '1 Month', desc: 'Macro / HODL',    riskMult: 0.4,  icon: '🌕', heartbeatMs: 9000 },
]

const selected = computed(() => FREQUENCIES.find(f => f.id === props.modelValue) ?? FREQUENCIES[5])

// Border-radius morphs: higher freq = more angular, lower = round
const borderRadius = computed(() => {
  const idx = FREQUENCIES.findIndex(f => f.id === props.modelValue)
  // 0 (fastest) → 4px sharp, 7 (slowest) → 20px round
  const r = 4 + (idx / 7) * 16
  return `${r}px`
})

// Heartbeat glow colour
const glowColor = computed(() => {
  const rm = selected.value.riskMult
  if (rm >= 1.8) return '#f44336'
  if (rm >= 1.2) return '#ff9800'
  if (rm >= 0.8) return '#4caf50'
  return '#2196f3'
})
</script>

<template>
  <div class="freq-selector">
    <div class="freq-header">
      <span class="freq-label">Execution Frequency</span>
      <span class="freq-current" :style="{ color: glowColor }">
        {{ selected.icon }} {{ selected.label }} · {{ selected.desc }}
      </span>
    </div>

    <!-- Visual frequency track -->
    <div class="freq-track">
      <button
        v-for="(f, i) in FREQUENCIES"
        :key="f.id"
        type="button"
        class="freq-node"
        :class="{ active: modelValue === f.id }"
        :style="{
          '--node-color': glowColor,
          '--beat-ms': f.heartbeatMs + 'ms',
          borderRadius: borderRadius,
        }"
        @click="emit('update:modelValue', f.id)"
        :title="`${f.label} — ${f.desc}`"
      >
        <span class="node-icon">{{ f.icon }}</span>
        <span class="node-tf">{{ f.id }}</span>
        <!-- Heartbeat rings (shown on active) -->
        <template v-if="modelValue === f.id">
          <span class="ring ring-1" />
          <span class="ring ring-2" />
        </template>
      </button>
    </div>

    <!-- Speed description -->
    <div class="freq-desc-row">
      <span class="slow-label">← Macro / Passive</span>
      <div class="speed-bar">
        <div
          class="speed-fill"
          :style="{
            width: ((FREQUENCIES.length - 1 - FREQUENCIES.findIndex(f => f.id === modelValue)) / (FREQUENCIES.length - 1) * 100) + '%',
            background: glowColor,
          }"
        />
      </div>
      <span class="fast-label">Active / Scalping →</span>
    </div>
  </div>
</template>

<style scoped>
.freq-selector {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.freq-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.freq-label {
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-gray);
}

.freq-current {
  font-size: 0.72rem;
  font-weight: 700;
  transition: color 0.3s ease;
}

/* ── Track ── */
.freq-track {
  display: flex;
  gap: 4px;
  align-items: center;
}

.freq-node {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 8px 2px;
  border: 1px solid var(--border-secondary);
  background: rgba(0,0,0,0.2);
  cursor: pointer;
  transition: all 0.2s ease;
  overflow: visible;
}

.freq-node:hover {
  background: rgba(255,255,255,0.06);
  border-color: var(--border-primary);
}

.freq-node.active {
  border-color: var(--node-color);
  background: color-mix(in srgb, var(--node-color) 15%, transparent);
  box-shadow: 0 0 10px color-mix(in srgb, var(--node-color) 40%, transparent);
}

.node-icon { font-size: 0.9rem; }
.node-tf   { font-size: 0.52rem; font-weight: 700; color: var(--text-gray); }
.freq-node.active .node-tf { color: var(--node-color); }

/* Heartbeat rings */
.ring {
  position: absolute;
  inset: -4px;
  border-radius: inherit;
  border: 1px solid var(--node-color);
  animation: ring-beat var(--beat-ms) ease-out infinite;
  pointer-events: none;
}

.ring-2 { animation-delay: calc(var(--beat-ms) * 0.5); }

@keyframes ring-beat {
  0%   { transform: scale(1);    opacity: 0.8; }
  70%  { transform: scale(1.35); opacity: 0; }
  100% { transform: scale(1.35); opacity: 0; }
}

/* ── Speed bar ── */
.freq-desc-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.slow-label, .fast-label {
  font-size: 0.55rem;
  color: var(--text-gray);
  white-space: nowrap;
  flex-shrink: 0;
}

.speed-bar {
  flex: 1;
  height: 3px;
  background: rgba(255,255,255,0.08);
  border-radius: 999px;
  overflow: hidden;
}

.speed-fill {
  height: 100%;
  border-radius: 999px;
  transition: width 0.3s ease, background 0.3s ease;
}
</style>
