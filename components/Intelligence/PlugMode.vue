<script setup lang="ts">
/**
 * Advisory / Auto switch for the plugged agents (PUT /api/v1/settings/plugs/ `mode`, debounced by
 * stores/opinions.ts). Self-contained: connects the plugs store itself (idempotent), so it can sit in the
 * profile Mirror "Your avatar" tab and on /agents. Paper only: auto reshapes paper allocations, never trades.
 */
import { computed, onMounted, watch } from 'vue'
import { useOpinionsStore, type PlugsApi } from '~/stores/opinions'

const opinions = useOpinionsStore()
const { isAuthenticated, user } = useAuth()
const nuxtApp = useNuxtApp()
function connectPlugs() {
  void opinions.connect({ signedIn: isAuthenticated.value, userId: user.value?.id, api: nuxtApp.$api as PlugsApi })
}
onMounted(connectPlugs)
watch(isAuthenticated, connectPlugs)

const plugged = computed(() => opinions.plugs.filter(p => p.enabled).length)
const note = computed(() => plugSyncNote(opinions.sync, opinions.syncError))
const busy = computed(() => opinions.sync === 'loading')
const MODES = [
  { key: 'advisory', label: 'Advisory', line: 'Shows what your plugged agents suggest next to your paper allocation.' },
  { key: 'auto', label: 'Auto', line: 'Your paper target allocation follows your plugged agents.' },
] as const
function pick(m: 'advisory' | 'auto') {
  if (m !== opinions.mode) opinions.setMode(m)
}
</script>

<template>
  <section class="pm" aria-labelledby="pm-title" data-testid="plug-mode">
    <div class="pm-head">
      <h3 id="pm-title" class="pm-t">Plugged agents · {{ plugged }}</h3>
      <div class="pm-seg" role="radiogroup" aria-label="How plugged agents act">
        <button
          v-for="m in MODES" :key="m.key" type="button" role="radio" class="pm-chip"
          :aria-checked="opinions.mode === m.key" :disabled="busy" @click="pick(m.key)"
        >{{ m.label }}</button>
      </div>
    </div>
    <p class="pm-line">Auto applies your plugged agents to paper allocations only; it never trades real money.</p>
    <p class="pm-sub">
      {{ MODES.find(m => m.key === opinions.mode)?.line }}
      <NuxtLink to="/agents">{{ plugged ? 'Change plugs →' : 'Plug an agent →' }}</NuxtLink>
    </p>
    <p v-if="note" class="pm-sub" :data-tone="opinions.sync === 'error' ? 'error' : undefined" role="status">{{ note }}</p>
  </section>
</template>

<style scoped>
.pm { display: flex; flex-direction: column; gap: 0.3rem; padding: 0.6rem 0.75rem; border-radius: var(--radius-md); border: 1px solid var(--edge-raised); background: var(--surface-raised); min-width: 0; }
.pm-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.4rem 1rem; }
.pm-t { margin: 0; font-size: 0.7rem; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-light-gray); }
.pm-seg { display: inline-flex; gap: 0.3rem; }
.pm-chip { all: unset; box-sizing: border-box; cursor: pointer; font-size: 0.74rem; padding: 0.3rem 0.75rem; border-radius: 999px; border: 1px solid var(--edge-raised); color: var(--text-light-gray); min-height: 24px; }
.pm-chip[aria-checked='true'] { background: var(--primary-blue); border-color: var(--primary-blue); color: var(--secondary-darker); font-weight: 600; }
.pm-chip:disabled { opacity: 0.6; cursor: progress; }
.pm-chip:focus-visible, .pm a:focus-visible { outline: 2px solid var(--text-white); outline-offset: 2px; }
.pm-line { margin: 0; font-size: 0.76rem; color: var(--text-white); }
.pm-sub { margin: 0; font-size: 0.7rem; color: var(--text-gray); }
.pm-sub[data-tone='error'] { color: var(--warning-orange); }
.pm a { color: var(--primary-blue); text-decoration: none; }
</style>
