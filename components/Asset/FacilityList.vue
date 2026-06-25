<script setup lang="ts">
import UIEmptyState from '@/components/UI/EmptyState.vue'

interface Facility {
  id: string
  type?: string
  name: string
  city?: string
  country?: string
  size?: 'small' | 'medium' | 'large' | string
  status: 'active' | 'planned' | 'inactive' | string
  lat?: number
  lng?: number
}

withDefaults(defineProps<{
  facilities?: Facility[]
}>(), { facilities: () => [] })
</script>

<template>
  <ul v-if="facilities.length" class="facility-list">
    <li
      v-for="f in facilities" :key="f.id"
      :class="['facility-row', `status-${f.status}`]"
    >
      <span class="fac-tag">{{ f.type }}</span>
      <div class="fac-info">
        <strong>{{ f.name }}</strong>
        <small>{{ f.city }}, {{ f.country }}</small>
      </div>
      <span class="fac-size">{{ f.size }}</span>
      <span :class="['fac-status', f.status]">{{ f.status }}</span>
    </li>
  </ul>
  <UIEmptyState
    v-else size="sm" icon="◯"
    message="No facility data."
  />
</template>

<style scoped>
.facility-list {
  list-style: none; margin: 0; padding: 0;
  display: flex; flex-direction: column; gap: 0.3rem;
  min-width: 0;
}
.facility-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto auto;
  gap: 0.5rem;
  align-items: center;
  padding: 0.45rem 0.55rem;
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.04);
  border-radius: 5px;
  min-width: 0;
}
.facility-row.status-planned { opacity: 0.6; }

.fac-tag {
  font-size: 0.55rem; letter-spacing: 0.1em;
  text-transform: uppercase;
  background: rgba(0,170,255,0.15);
  color: var(--primary-blue, #00aaff);
  padding: 1px 6px;
  border-radius: 999px;
  font-weight: 700;
  white-space: nowrap;
}

.fac-info {
  display: flex; flex-direction: column; gap: 0.05rem;
  min-width: 0; overflow: hidden;
}
.fac-info strong {
  font-size: 0.82rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.fac-info small { font-size: 0.65rem; color: rgba(255,255,255,0.5); }

.fac-size {
  font-size: 0.6rem; letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.5);
  font-weight: 700;
  white-space: nowrap;
}
.fac-status {
  font-size: 0.55rem; letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 1px 6px;
  border-radius: 999px;
  font-weight: 700;
  white-space: nowrap;
}
.fac-status.active   { background: rgba(0,255,136,0.12); color: var(--primary-green, #00ff88); }
.fac-status.planned  { background: rgba(255,170,0,0.12); color: #ffaa00; }
.fac-status.inactive { background: rgba(255,77,106,0.12); color: #ff4d6a; }

@media (max-width: 640px) {
  .facility-row { grid-template-columns: auto minmax(0, 1fr) auto; }
  .fac-size { display: none; }
}
</style>
