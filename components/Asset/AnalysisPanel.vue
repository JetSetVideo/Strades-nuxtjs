<script setup lang="ts">
import { ref, computed } from 'vue'
import UICard from '@/components/UI/Card.vue'
import UIPill from '@/components/UI/Pill.vue'
import UIEmptyState from '@/components/UI/EmptyState.vue'

interface Tag { id: string; label: string }
interface Trigger {
  id: string
  kind: 'cross_above' | 'cross_below' | string
  target_price: number
  note?: string
  status: 'armed' | 'triggered' | 'cancelled' | string
}
interface Annotation {
  id: string
  kind: 'trendline' | 'level' | string
  price_a?: number
  price_b?: number
}

const props = defineProps<{
  tags: Tag[]
  triggers: Trigger[]
  annotations: Annotation[]
  suggestions?: string[]
}>()

const emit = defineEmits<{
  (e: 'addTag', label: string): void
  (e: 'removeTag', id: string): void
  (e: 'removeTrigger', id: string): void
  (e: 'removeAnnotation', id: string): void
}>()

const tagInput = ref('')
const armedCount = computed(() => props.triggers.filter(t => t.status === 'armed').length)
const firedCount = computed(() => props.triggers.filter(t => t.status === 'triggered').length)

function submitTag() {
  const lbl = tagInput.value.trim()
  if (!lbl) return
  emit('addTag', lbl)
  tagInput.value = ''
}
</script>

<template>
  <div class="grid-3">
    <UICard title="Tags">
      <template #action><UIPill ghost tone="neutral">{{ tags.length }}</UIPill></template>

      <div v-if="tags.length" class="tags-line">
        <span v-for="t in tags" :key="t.id" class="tag-chip">
          {{ t.label }}
          <button @click="emit('removeTag', t.id)" aria-label="Remove tag">✕</button>
        </span>
      </div>
      <UIEmptyState
        v-else size="sm" icon="◯"
        message="No tags yet. Tag this asset to remember your thesis."
      />

      <div class="tag-add-row">
        <input
          v-model="tagInput"
          @keyup.enter="submitTag"
          placeholder="Add a tag (Enter to save)"
        />
        <button class="add-btn" @click="submitTag">+ Add</button>
      </div>
      <div v-if="suggestions?.length" class="suggestion-row">
        <span class="sug-label">Quick:</span>
        <button
          v-for="s in suggestions" :key="s"
          class="sug"
          @click="emit('addTag', s)"
        >{{ s }}</button>
      </div>
    </UICard>

    <UICard title="Price Alerts">
      <template #action>
        <UIPill v-if="armedCount" tone="warning" show-dot>{{ armedCount }} ARMED</UIPill>
        <UIPill v-else-if="firedCount" tone="success" show-dot>{{ firedCount }} FIRED</UIPill>
        <UIPill v-else tone="neutral">NONE</UIPill>
      </template>
      <UIEmptyState
        v-if="triggers.length === 0"
        size="sm" icon="↑"
        message="Place ↑/↓ alerts on the chart to be notified when price crosses."
      />
      <ul v-else class="trigger-list">
        <li
          v-for="t in triggers" :key="t.id"
          :class="['trigger-row', t.status]"
        >
          <span class="kind">{{ t.kind === 'cross_above' ? '↑' : '↓' }}</span>
          <span class="target">{{ t.target_price.toFixed(2) }}</span>
          <span class="note">{{ t.note }}</span>
          <span class="status">{{ t.status }}</span>
          <button class="x" @click="emit('removeTrigger', t.id)" aria-label="Remove">✕</button>
        </li>
      </ul>
    </UICard>

    <UICard title="My Annotations">
      <template #action><UIPill ghost tone="neutral">{{ annotations.length }}</UIPill></template>
      <UIEmptyState
        v-if="annotations.length === 0"
        size="sm" icon="╱"
        message="Use the trendline / level tools on the chart to mark your analysis."
      />
      <ul v-else class="anno-list">
        <li v-for="a in annotations" :key="a.id" class="anno-row">
          <UIPill :tone="a.kind === 'trendline' ? 'success' : 'info'">{{ a.kind }}</UIPill>
          <span class="anno-info" v-if="a.kind === 'level'">@ {{ a.price_a?.toFixed(2) }}</span>
          <span class="anno-info" v-else-if="a.kind === 'trendline'">
            {{ a.price_a?.toFixed(2) }} → {{ a.price_b?.toFixed(2) }}
          </span>
          <button class="x" @click="emit('removeAnnotation', a.id)" aria-label="Remove">✕</button>
        </li>
      </ul>
    </UICard>
  </div>
</template>

<style scoped>
.grid-3 {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr));
  gap: 0.6rem;
  min-width: 0;
}
.grid-3 > * { min-width: 0; }

.tags-line {
  display: flex; gap: 0.3rem;
  flex-wrap: wrap;
  min-width: 0;
}
.tag-chip {
  display: inline-flex; align-items: center; gap: 0.3rem;
  background: rgba(0,255,136,0.1);
  border: 1px solid rgba(0,255,136,0.3);
  color: var(--primary-green, #00ff88);
  font-size: 0.7rem; letter-spacing: 0.04em;
  padding: 0.18rem 0.5rem;
  border-radius: 999px;
  max-width: 100%;
}
.tag-chip button {
  background: none; border: none;
  color: inherit; cursor: pointer;
  font-size: 0.6rem; opacity: 0.7; padding: 0;
}
.tag-chip button:hover { opacity: 1; }

.tag-add-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.35rem;
  margin-top: 0.3rem;
}
.tag-add-row input {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  color: #fff;
  padding: 0.4rem 0.6rem;
  border-radius: 5px;
  font-size: 0.8rem;
  font-family: inherit;
  min-width: 0;
}
.tag-add-row input:focus {
  outline: none;
  border-color: var(--primary-green, #00ff88);
}
.add-btn {
  background: var(--primary-gradient); color: #000; border: none;
  padding: 0.4rem 0.7rem; border-radius: 5px;
  font-size: 0.7rem; font-weight: 700;
  letter-spacing: 0.05em; text-transform: uppercase; cursor: pointer;
}

.suggestion-row {
  display: flex; align-items: center; gap: 0.3rem;
  flex-wrap: wrap;
  margin-top: 0.35rem;
}
.sug-label {
  font-size: 0.55rem; letter-spacing: 0.1em;
  text-transform: uppercase; color: rgba(255,255,255,0.4);
}
.sug {
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.06);
  color: rgba(255,255,255,0.7);
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  font-size: 0.65rem;
  cursor: pointer;
  font-family: inherit;
}
.sug:hover {
  background: rgba(0,255,136,0.05);
  border-color: rgba(0,255,136,0.25);
  color: var(--primary-green, #00ff88);
}

.trigger-list, .anno-list {
  list-style: none; margin: 0; padding: 0;
  display: flex; flex-direction: column; gap: 0.25rem;
}
.trigger-row, .anno-row {
  display: grid; align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.5rem;
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.04);
  border-radius: 5px;
  font-size: 0.75rem;
  min-width: 0;
}
.trigger-row { grid-template-columns: 18px auto minmax(0, 1fr) auto auto; }
.trigger-row .kind {
  color: #ffaa00;
  font-size: 0.95rem; font-weight: 800;
}
.trigger-row.triggered .kind { color: var(--primary-green, #00ff88); }
.trigger-row .target {
  font-variant-numeric: tabular-nums; font-weight: 700;
}
.trigger-row .note {
  font-size: 0.7rem; color: rgba(255,255,255,0.5);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0;
}
.trigger-row .status {
  font-size: 0.55rem; letter-spacing: 0.1em; text-transform: uppercase;
  padding: 1px 6px; border-radius: 999px;
  background: rgba(255,165,0,0.12); color: var(--warning-orange, #ffaa00);
  flex-shrink: 0;
}
.trigger-row.triggered .status {
  background: rgba(0,255,136,0.12); color: var(--primary-green, #00ff88);
}
.x {
  background: none; border: none;
  color: rgba(255,255,255,0.4); cursor: pointer;
  font-size: 0.7rem;
}
.x:hover { color: var(--error-red, #ff4d6a); }

.anno-row { grid-template-columns: auto minmax(0, 1fr) auto; }
.anno-info {
  font-size: 0.75rem;
  font-family: ui-monospace, Menlo, monospace;
  color: rgba(255,255,255,0.75);
}
</style>
