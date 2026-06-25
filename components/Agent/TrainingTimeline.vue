<template>
  <div class="training-timeline">
    <header class="header">
      <h3>Training Stream</h3>
      <span class="meta">{{ training.totalEventsRecorded }} events · buffer {{ training.bufferSize }}</span>
    </header>

    <div class="summary" v-if="hasLearnedAnything">
      <span class="summary-label">Recent gradient</span>
      <div class="gradient-chips">
        <span
          v-for="(value, key) in training.learnedToday"
          :key="key"
          :class="['chip', value >= 0 ? 'up' : 'down']"
        >
          {{ key }} {{ value >= 0 ? '+' : '' }}{{ value.toFixed(3) }}
        </span>
      </div>
    </div>

    <div class="events">
      <div v-if="training.recentEvents.length === 0 && training.recentDeltas.length === 0" class="empty">
        No activity yet. Use the app — your Avatar learns from every interaction.
      </div>
      <div v-for="d in training.recentDeltas" :key="d.applied_at" class="row applied">
        <span class="dot live" />
        <div class="row-body">
          <div class="row-title">Epoch applied · {{ Object.keys(d.delta).length }} axis updated</div>
          <div class="row-meta">reward {{ d.reward?.toFixed(3) ?? '—' }} · {{ relTime(d.applied_at) }}</div>
        </div>
      </div>
      <div v-for="ev in training.recentEvents" :key="ev.id" class="row buffered">
        <span class="dot buf" />
        <div class="row-body">
          <div class="row-title">{{ formatEventType(ev.type) }}</div>
          <div class="row-meta">{{ relTime(ev.ts) }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useTrainingStore, type TrainingEventType } from '~/stores/training'

const training = useTrainingStore()

const hasLearnedAnything = computed(() => Object.keys(training.learnedToday).length > 0)

const formatEventType = (t: TrainingEventType) => t.replace(/_/g, ' ')

const relTime = (ts: number) => {
  const ms = Date.now() - ts
  if (ms < 60_000) return `${Math.round(ms / 1000)}s ago`
  if (ms < 3_600_000) return `${Math.round(ms / 60000)}m ago`
  return `${Math.round(ms / 3_600_000)}h ago`
}
</script>

<style scoped>
.training-timeline {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 0.75rem;
  background: linear-gradient(135deg, rgba(20,20,28,0.9), rgba(14,14,18,0.9));
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: var(--app-border-radius, 8px);
}
.header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.5rem;
}
.header h3 {
  margin: 0;
  font-size: 0.8rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.65);
}
.meta { font-size: 0.65rem; color: rgba(255,255,255,0.4); letter-spacing: 0.05em; }

.summary {
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.05);
  border-radius: 6px;
  padding: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}
.summary-label {
  font-size: 0.6rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.45);
}
.gradient-chips { display: flex; gap: 0.3rem; flex-wrap: wrap; }
.chip {
  font-size: 0.65rem;
  padding: 2px 6px;
  border-radius: 3px;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.04em;
}
.chip.up { background: rgba(0,255,136,0.12); color: var(--success-green, #00ff88); }
.chip.down { background: rgba(255,68,68,0.12); color: var(--error-red, #ff4444); }

.events { display: flex; flex-direction: column; gap: 0.3rem; max-height: 320px; overflow-y: auto; }
.empty { font-size: 0.75rem; color: rgba(255,255,255,0.4); padding: 0.5rem 0; }
.row { display: flex; gap: 0.5rem; align-items: flex-start; padding: 0.35rem 0.4rem; border-radius: 4px; }
.row.applied { background: rgba(0,255,136,0.04); }
.row.buffered { background: rgba(255,255,255,0.02); }
.dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; margin-top: 0.3rem; }
.dot.live { background: var(--success-green, #00ff88); box-shadow: 0 0 6px var(--success-green, #00ff88); }
.dot.buf { background: rgba(255,255,255,0.3); }
.row-body { display: flex; flex-direction: column; gap: 1px; flex: 1; min-width: 0; }
.row-title { font-size: 0.75rem; color: rgba(255,255,255,0.85); text-transform: capitalize; }
.row-meta { font-size: 0.6rem; color: rgba(255,255,255,0.4); letter-spacing: 0.05em; }
</style>
