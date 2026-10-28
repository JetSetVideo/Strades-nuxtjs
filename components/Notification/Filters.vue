<script setup lang="ts">
/**
 * Feed filters: domain chips (All + each domain present, unopened counts), "Unopened only" switch,
 * search, and the removable day chip set by the calendar. Props in, v-model out — no store.
 * Counts are unopened (clicked), because appearing on the page already marks a row read.
 */
import { computed } from 'vue'
import type { NotificationDomain } from '~/types/notification'
import { NOTIFICATION_DOMAINS } from '~/types/notification'
import { DOMAIN_META } from '~/utils/notifications'

const props = defineProps<{
  counts: Record<NotificationDomain, { total: number; unread: number; unopened: number }>
  domains: NotificationDomain[]
  unopenedOnly: boolean
  q: string
  /** selected calendar day 'YYYY-MM-DD' or null */
  day: string | null
}>()
const emit = defineEmits<{
  (e: 'update:domains', v: NotificationDomain[]): void
  (e: 'update:unopenedOnly', v: boolean): void
  (e: 'update:q', v: string): void
  (e: 'update:day', v: string | null): void
}>()

const present = computed(() =>
  NOTIFICATION_DOMAINS.filter(d => (props.counts[d]?.total ?? 0) > 0 || props.domains.includes(d)),
)
const totalUnopened = computed(() => NOTIFICATION_DOMAINS.reduce((s, d) => s + (props.counts[d]?.unopened ?? 0), 0))

function toggle(d: NotificationDomain) {
  const has = props.domains.includes(d)
  emit('update:domains', has ? props.domains.filter(x => x !== d) : [...props.domains, d])
}

const dayText = computed(() => {
  if (!props.day) return ''
  const [y, m, d] = props.day.split('-').map(Number)
  return new Date(y!, m! - 1, d!).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
})
</script>

<template>
  <div class="nf" role="search" aria-label="Filter notifications">
    <div class="nf-chips" role="group" aria-label="Domain">
      <button
        type="button"
        class="chip"
        :class="{ on: !domains.length }"
        :aria-pressed="!domains.length"
        @click="emit('update:domains', [])"
      >
        <span class="chip-l">All</span>
        <span v-if="totalUnopened" class="chip-n">{{ totalUnopened }}<span class="sr-only"> unopened</span></span>
      </button>
      <button
        v-for="d in present"
        :key="d"
        type="button"
        class="chip"
        :class="{ on: domains.includes(d) }"
        :style="{ '--chip-c': DOMAIN_META[d].color }"
        :aria-pressed="domains.includes(d)"
        @click="toggle(d)"
      >
        <span class="chip-g" aria-hidden="true">{{ DOMAIN_META[d].glyph }}</span>
        <span class="chip-l">{{ DOMAIN_META[d].label }}</span>
        <span v-if="counts[d]?.unopened" class="chip-n">{{ counts[d].unopened }}<span class="sr-only"> unopened</span></span>
      </button>
    </div>

    <div class="nf-row">
      <button
        type="button"
        role="switch"
        class="sw"
        :aria-checked="unopenedOnly"
        @click="emit('update:unopenedOnly', !unopenedOnly)"
      >
        <span class="sw-track" aria-hidden="true"><span class="sw-knob" /></span>
        <span class="sw-l">Unopened only</span>
      </button>

      <label class="srch">
        <span class="sr-only">Search notifications</span>
        <span class="srch-ico" aria-hidden="true">⌕</span>
        <input
          type="search"
          :value="q"
          placeholder="Search title, asset, bot…"
          autocomplete="off"
          spellcheck="false"
          maxlength="80"
          @input="emit('update:q', ($event.target as HTMLInputElement).value)"
          @keydown.esc="emit('update:q', '')"
        >
      </label>

      <button
        v-if="day"
        type="button"
        class="day-chip"
        :aria-label="`Remove day filter: ${dayText}`"
        @click="emit('update:day', null)"
      >
        <span class="day-k">Day</span> {{ dayText }} <span aria-hidden="true" class="day-x">×</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.nf { display: flex; flex-direction: column; gap: 0.4rem; min-width: 0; }
.nf-chips { display: flex; flex-wrap: wrap; gap: 0.3rem; min-width: 0; }

.chip {
  --chip-c: var(--primary-blue, #00aaff);
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  min-height: 26px;
  padding: 0 0.55rem 0 0.5rem;
  background: rgba(255,255,255,0.03);
  border: 1px solid var(--edge-soft, rgba(255,255,255,0.05));
  border-left: 3px solid var(--chip-c);
  border-radius: var(--app-border-radius, 6px);
  color: rgba(255,255,255,0.65);
  font-family: var(--font-chrome, inherit);
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
  white-space: nowrap;
  transition: color 0.15s ease, border-color 0.15s ease, background-color 0.15s ease;
}
.chip:hover { color: var(--text-white, #ffffff); }
.chip.on {
  color: var(--text-white, #ffffff);
  background: rgba(255,255,255,0.08);
  border-color: var(--edge-lit, rgba(255,255,255,0.14));
  border-left-color: var(--chip-c);
  box-shadow: inset 0 -2px 0 var(--chip-c);
}
.chip:focus-visible, .sw:focus-visible, .day-chip:focus-visible { outline: 2px solid var(--primary-blue, #00aaff); outline-offset: 1px; }
.chip-g { font-size: 0.75rem; color: var(--chip-c); letter-spacing: 0; }
.chip-n {
  font-family: var(--font-market-data, monospace);
  font-variant-numeric: tabular-nums;
  font-size: 0.58rem;
  padding: 0 5px;
  border-radius: 999px;
  background: rgba(255,255,255,0.1);
  color: var(--text-white, #ffffff);
  letter-spacing: 0;
}

.nf-row { display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem; min-width: 0; }

.sw {
  display: inline-flex; align-items: center; gap: 0.4rem;
  min-height: 28px;
  padding: 0 0.5rem;
  background: rgba(255,255,255,0.03);
  border: 1px solid var(--edge-soft, rgba(255,255,255,0.05));
  border-radius: var(--app-border-radius, 6px);
  color: rgba(255,255,255,0.7);
  font-size: 0.62rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;
  cursor: pointer;
}
.sw-track {
  position: relative;
  width: 24px; height: 13px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,0.3);
  background: rgba(255,255,255,0.05);
  transition: background-color 0.15s ease;
}
.sw-knob {
  position: absolute; top: 1px; left: 1px;
  width: 9px; height: 9px; border-radius: 50%;
  background: rgba(255,255,255,0.6);
  transition: transform 0.15s ease;
}
.sw[aria-checked='true'] { color: var(--text-white, #ffffff); border-color: var(--edge-lit, rgba(255,255,255,0.14)); }
.sw[aria-checked='true'] .sw-track { background: var(--primary-blue, #00aaff); border-color: var(--primary-blue, #00aaff); }
.sw[aria-checked='true'] .sw-knob { transform: translateX(11px); background: var(--text-white, #ffffff); }

.srch {
  flex: 1 1 10rem;
  min-width: 0;
  display: flex; align-items: center; gap: 0.3rem;
  min-height: 28px;
  padding: 0 0.5rem;
  background: rgba(255,255,255,0.03);
  border: 1px solid var(--edge-soft, rgba(255,255,255,0.05));
  border-radius: var(--app-border-radius, 6px);
}
.srch:focus-within { border-color: var(--primary-blue, #00aaff); outline: 1px solid var(--primary-blue, #00aaff); }
.srch-ico { color: rgba(255,255,255,0.4); font-size: 0.85rem; }
.srch input {
  flex: 1; min-width: 0;
  background: transparent; border: 0; outline: none;
  color: var(--text-white, #ffffff);
  font: inherit;
  font-size: 0.75rem;
  padding: 0.3rem 0;
}
.srch input::placeholder { color: rgba(255,255,255,0.35); }

.day-chip {
  display: inline-flex; align-items: center; gap: 0.3rem;
  min-height: 28px;
  padding: 0 0.55rem;
  background: rgba(0,170,255,0.1);
  border: 1px solid var(--primary-blue, #00aaff);
  border-radius: 999px;
  color: var(--text-white, #ffffff);
  font-size: 0.68rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}
.day-k { font-size: 0.52rem; letter-spacing: 0.12em; text-transform: uppercase; font-weight: 800; color: var(--primary-blue, #00aaff); }
.day-x { font-size: 0.85rem; line-height: 1; }

.sr-only {
  position: absolute !important;
  width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
}

@media (prefers-reduced-motion: reduce) {
  .chip, .sw-track, .sw-knob { transition: none; }
}
</style>
