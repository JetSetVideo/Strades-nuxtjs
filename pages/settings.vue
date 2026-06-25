<script setup lang="ts">
import { ref } from 'vue'
import UIPageHeader from '@/components/UI/PageHeader.vue'
import UICard from '@/components/UI/Card.vue'
import UIPill from '@/components/UI/Pill.vue'

definePageMeta({ title: 'Settings', description: 'Account, security, preferences.', layout: 'default' })

const apiKeys = ref([
  { exchange: 'Binance', key: '', secret: '' },
  { exchange: 'Kraken', key: '', secret: '' },
  { exchange: 'Uniswap', key: '', secret: '' }
])

const addApiKey = (exchange: string) => apiKeys.value.push({ exchange, key: '', secret: '' })
const removeApiKey = (i: number) => apiKeys.value.splice(i, 1)
const saveSettings = () => { /* persist later */ }
</script>

<template>
  <div class="settings-page">
    <UIPageHeader title="Settings" subtitle="Account, security, preferences." />

    <UICard title="API Keys">
      <template #action><UIPill tone="warning" show-dot>Local-only</UIPill></template>
      <div v-for="(api, i) in apiKeys" :key="i" class="api-row">
        <strong>{{ api.exchange }}</strong>
        <input v-model="api.key" placeholder="API Key" />
        <input v-model="api.secret" placeholder="API Secret" type="password" />
        <button class="ghost danger" @click="removeApiKey(i)">Remove</button>
      </div>
      <template #footer>
        <button class="ghost" @click="addApiKey('Custom')">+ Add custom</button>
        <button class="primary" @click="saveSettings">Save</button>
      </template>
    </UICard>

    <UICard title="Preferences" padding="tight">
      <p class="muted">Per-class trading defaults, theme density, hover-intent thresholds — coming soon.</p>
    </UICard>

    <UICard title="Security" padding="tight">
      <p class="muted">2FA, session keys, withdrawal whitelist — coming soon.</p>
    </UICard>

    <UICard title="About" padding="tight">
      <p class="muted">Strades · v0.2 · <NuxtLink to="/about">Read the vision →</NuxtLink></p>
    </UICard>
  </div>
</template>

<style scoped>
.settings-page { display: flex; flex-direction: column; gap: 0.75rem; max-width: 760px; margin: 0 auto; }

.api-row {
  display: grid;
  grid-template-columns: 100px 1fr 1fr auto;
  gap: 0.4rem;
  align-items: center;
  padding: 0.4rem 0;
  border-bottom: 1px solid rgba(255,255,255,0.04);
}
.api-row:last-of-type { border-bottom: none; }
.api-row strong { font-size: 0.85rem; }

input {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  color: #fff;
  padding: 0.4rem 0.55rem;
  border-radius: 5px;
  font-size: 0.8rem;
}
input:focus { outline: none; border-color: var(--primary-green, #00ff88); }

.muted { color: rgba(255,255,255,0.55); font-size: 0.8rem; margin: 0; }
.muted a { color: var(--primary-green, #00ff88); }

button { font-family: inherit; font-size: 0.72rem; letter-spacing: 0.06em; text-transform: uppercase; cursor: pointer; padding: 0.4rem 0.85rem; border-radius: 5px; }
.ghost { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); color: rgba(255,255,255,0.85); }
.ghost.danger:hover { color: var(--error-red, #ff4444); border-color: var(--error-red, #ff4444); }
.ghost:hover { color: #fff; }
.primary { background: var(--primary-gradient); color: #000; border: none; font-weight: 700; }
.primary:hover { transform: translateY(-1px); }
</style>
