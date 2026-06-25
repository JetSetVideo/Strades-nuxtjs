<script setup lang="ts">
interface MatrixAxisKey {
  key: string
  label: string
  hint: string
}

interface Matrix { [key: string]: number }

defineProps<{
  matrix: Matrix
  axes?: MatrixAxisKey[]
}>()

const DEFAULT_AXES: MatrixAxisKey[] = [
  { key: 'risk',           label: 'Risk',       hint: 'Conservative ↔ Aggressive' },
  { key: 'aggression',     label: 'Aggression', hint: 'Patient ↔ Bold' },
  { key: 'reaction_speed', label: 'Reaction',   hint: 'Slow ↔ Fast' },
  { key: 'patience',       label: 'Patience',   hint: 'Restless ↔ Patient' },
  { key: 'contrarian',     label: 'Contrarian', hint: 'Follow ↔ Fade' }
]
</script>

<template>
  <div class="axes">
    <div
      v-for="a in (axes || DEFAULT_AXES)"
      :key="a.key"
      class="axis"
    >
      <div class="axis-head">
        <span class="axis-label">{{ a.label }}</span>
        <span class="axis-value">{{ Math.round((matrix[a.key] ?? 0) * 100) }}</span>
      </div>
      <span class="axis-bar">
        <span
          class="axis-fill"
          :style="{ width: ((matrix[a.key] ?? 0) * 100) + '%' }"
        />
      </span>
      <span class="axis-hint">{{ a.hint }}</span>
    </div>
  </div>
</template>

<style scoped>
.axes {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}
.axis {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}
.axis-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}
.axis-label {
  font-size: 0.55rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-weight: 700;
  color: rgba(255,255,255,0.55);
}
.axis-value {
  font-size: 0.78rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  color: rgba(255,255,255,0.95);
}
.axis-bar {
  display: block;
  width: 100%;
  height: 4px;
  background: rgba(255,255,255,0.06);
  border-radius: 2px;
  overflow: hidden;
}
.axis-fill {
  display: block;
  height: 100%;
  background: var(--primary-gradient);
  transition: width 0.4s ease;
}
.axis-hint {
  font-size: 0.55rem;
  color: rgba(255,255,255,0.4);
  letter-spacing: 0.04em;
}
</style>
