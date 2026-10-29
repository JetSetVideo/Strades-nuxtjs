<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ category?: string }>()

const kind = computed(() => {
  const value = (props.category || '').toLowerCase()
  if (value.includes('crypto')) return 'crypto'
  if (value.includes('stock') || value.includes('equit')) return 'stocks'
  if (value.includes('commod') || value.includes('metal') || value.includes('energy')) return 'commodities'
  if (value.includes('forex') || value.includes('fx')) return 'forex'
  return 'system'
})
</script>

<template>
  <svg class="mark" viewBox="0 0 16 16" aria-hidden="true">
    <g v-if="kind === 'crypto'" fill="none" stroke="currentColor" stroke-width="1.3">
      <circle cx="8" cy="8" r="2.1" />
      <circle cx="3.2" cy="4" r="1.15" />
      <circle cx="12.8" cy="4.5" r="1.15" />
      <circle cx="12.3" cy="12.1" r="1.15" />
      <path d="M4.2 4.8 6.3 6.6M11.7 5.3 9.7 6.7M11.3 11.2 9.5 9.3" />
    </g>
    <g v-else-if="kind === 'stocks'" fill="currentColor">
      <rect x="2" y="9" width="2.4" height="5" rx="0.4" />
      <rect x="6.8" y="5" width="2.4" height="9" rx="0.4" />
      <rect x="11.6" y="2" width="2.4" height="12" rx="0.4" />
    </g>
    <g v-else-if="kind === 'commodities'" fill="none" stroke="currentColor" stroke-width="1.3">
      <path d="M8 1.6 14 8 8 14.4 2 8Z" />
    </g>
    <g v-else-if="kind === 'forex'" fill="none" stroke="currentColor" stroke-width="1.3">
      <path d="M2.5 5.5h7.2M7.2 3.2 9.8 5.5 7.2 7.8" />
      <path d="M13.5 10.5H6.3M8.8 8.2 6.2 10.5 8.8 12.8" />
    </g>
    <g v-else fill="none" stroke="currentColor" stroke-width="1.3">
      <path d="M8 1.8 13.2 4.8v6.4L8 14.2 2.8 11.2V4.8Z" />
    </g>
  </svg>
</template>

<style scoped>
.mark {
  width: 16px;
  height: 16px;
  flex: 0 0 16px;
  color: var(--text-white, #fff);
}
</style>
