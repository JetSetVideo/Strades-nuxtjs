<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { wealthBeads, type WealthCondition } from '~/utils/labField'

const props = defineProps<{
  condition: WealthCondition
  dense?: boolean
}>()

const MODES: WealthCondition[] = ['calm', 'shock', 'trend', 'chop']
const mode = ref<WealthCondition>(props.condition)
const phase = ref(0)
let frame = 0
let last = 0

watch(() => props.condition, value => { mode.value = value })

const beads = computed(() => wealthBeads(mode.value, phase.value))

const TONE = { up: '#3dd68c', down: '#ff5d73', neutral: '#9eb6d4' }

function tick(now: number) {
  if (!last) last = now
  phase.value = (phase.value + (now - last) / 4200) % 1
  last = now
  frame = requestAnimationFrame(tick)
}

onMounted(() => {
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  if (reduce) {
    phase.value = 0.35
    return
  }
  frame = requestAnimationFrame(tick)
})

onUnmounted(() => {
  if (frame) cancelAnimationFrame(frame)
})
</script>

<template>
  <div class="flow" :class="{ dense }">
    <svg viewBox="0 0 100 28" class="sheet" role="img" :aria-label="`Wealth transfer, ${mode}`">
      <path class="guide" d="M4 16 H96" />
      <circle
        v-for="(bead, i) in beads"
        :key="i"
        :cx="4 + bead.x * 92"
        :cy="2 + bead.y * 24"
        :r="bead.r"
        :fill="TONE[bead.tone]"
      />
    </svg>
    <div class="modes" role="group" aria-label="Wealth condition">
      <button
        v-for="item in MODES"
        :key="item"
        type="button"
        :class="{ on: mode === item }"
        @click.stop="mode = item"
      >{{ item }}</button>
    </div>
  </div>
</template>

<style scoped>
.flow { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.sheet { width: 100%; height: 36px; display: block; }
.guide { fill: none; stroke: rgba(255,255,255,0.12); stroke-width: 0.6; }
.modes { display: flex; gap: 4px; }
.modes button {
  background: transparent;
  border: 1px solid rgba(255,255,255,0.12);
  color: rgba(255,255,255,0.55);
  border-radius: 999px;
  font: inherit;
  font-size: 0.55rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  padding: 0.05rem 0.35rem;
  cursor: pointer;
}
.modes button.on { color: #fff; border-color: rgba(255,255,255,0.4); }
.dense .modes { display: none; }
.dense .sheet { height: 22px; }
</style>
