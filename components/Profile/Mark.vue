<script setup lang="ts">
import { computed } from 'vue'
import { profileMask } from '~/utils/profileMask'

const props = withDefaults(defineProps<{
  seed: string
  tradeStyle?: string
  risk?: number
  discipline?: number
  patience?: number
  aggression?: number
  muted?: boolean
}>(), { muted: false })

const face = computed(() => profileMask(props.seed, {
  style: props.tradeStyle,
  risk: props.risk,
  discipline: props.discipline,
  patience: props.patience,
  aggression: props.aggression,
  muted: props.muted,
}))
const gid = computed(() => `mark-${props.seed.replace(/[^a-zA-Z0-9_-]/g, '')}${props.muted ? '-mute' : ''}`)
</script>

<template>
  <svg class="mark" viewBox="0 0 80 80" aria-hidden="true">
    <defs>
      <linearGradient :id="gid" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" :stop-color="face.from" />
        <stop offset="0.55" :stop-color="face.cheek" />
        <stop offset="1" :stop-color="face.to" />
      </linearGradient>
    </defs>
    <rect width="80" height="80" :fill="face.plate" />
    <path :d="face.body" :fill="face.to" :opacity="face.opacity" />
    <path :d="face.head" :fill="`url(#${gid})`" :opacity="face.opacity" :stroke="face.edge" stroke-width="1.4" />
    <path :d="face.eyes" :fill="face.plate" />
  </svg>
</template>

<style scoped>
.mark {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: 14px 0 14px 0;
  box-shadow:
    inset 1px 1px 0 rgba(255,255,255,0.34),
    inset -2px -2px 5px rgba(0,0,0,0.45),
    0 1px 0 rgba(255,255,255,0.16),
    0 6px 14px rgba(0,0,0,0.38);
}
</style>
