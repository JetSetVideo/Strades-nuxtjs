<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Agent } from '~/types/agent'
import type { LabAxis } from '~/utils/labField'

const props = defineProps<{ agents: Agent[] }>()

const xAxis = ref<LabAxis>('patience')
const yAxis = ref<LabAxis>('risk')
const mode = ref<'map' | 'globe'>('map')
const spin = ref(24)
const focus = ref<string | null>(null)

const focused = computed(() => props.agents.find(agent => agent.id === focus.value) || null)

function toggle(id: string) {
  focus.value = focus.value === id ? null : id
}
</script>

<template>
  <section class="bench" aria-label="Laboratory bench">
    <header class="head">
      <div>
        <h2>Bench</h2>
        <LabStamp />
      </div>
      <NuxtLink v-if="focused" class="open" :to="`/agents/${focused.id}`">
        Open {{ focused.name }}
      </NuxtLink>
    </header>
    <div class="panes">
      <LabField
        :agents="agents"
        :x-axis="xAxis"
        :y-axis="yAxis"
        :mode="mode"
        :spin="spin"
        :focus="focus"
        @update:x-axis="xAxis = $event"
        @update:y-axis="yAxis = $event"
        @update:mode="mode = $event"
        @update:spin="spin = $event"
        @focus="toggle"
      />
      <LabOperators
        :agents="agents"
        :x-axis="xAxis"
        :y-axis="yAxis"
        :focus="focus"
        @focus="toggle"
      />
    </div>
  </section>
</template>

<style scoped>
.bench {
  margin: 0 0 12px;
  padding: 8px 10px 10px;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 10px;
  background: rgba(0,0,0,0.22);
}
.head {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  align-items: flex-start;
  margin-bottom: 8px;
}
.head h2 {
  margin: 0 0 2px;
  font-size: 0.78rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 700;
}
.open {
  font-size: 0.68rem;
  color: #fff;
  text-decoration: none;
  border-bottom: 1px solid rgba(255,255,255,0.35);
}
.panes {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
@media (max-width: 800px) {
  .panes { grid-template-columns: 1fr; }
}
</style>
