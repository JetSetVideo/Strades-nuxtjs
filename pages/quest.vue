<script setup lang="ts">
import { ref, computed } from 'vue'
import { useLocalJson } from '@/composables/useLocalJson'

import UIPageHeader from '@/components/UI/PageHeader.vue'
import UICard from '@/components/UI/Card.vue'
import UIStat from '@/components/UI/Stat.vue'
import UIPill from '@/components/UI/Pill.vue'
import UIMetricRow from '@/components/UI/MetricRow.vue'
import UISectionTabs, { type TabItem } from '@/components/UI/SectionTabs.vue'
import UIEmptyState from '@/components/UI/EmptyState.vue'
import AppSkeletonLoader from '@/components/App/SkeletonLoader.vue'

interface Quest {
  id: string
  title: string
  description: string
  category_id: string
  reward_credits: number
  completed: boolean
  progress: number
}

interface QuestCategory {
  id: string
  name: string
  description?: string
}

definePageMeta({ title: 'Quests', layout: 'default' })

const { data: quests, pending: questsPending } = await useAsyncData<Quest[]>(
  'quests',
  () => useLocalJson<Quest[]>('quests/quests.json'),
  { default: () => [] }
)
const { data: categories, pending: catsPending } = await useAsyncData<QuestCategory[]>(
  'quest-categories',
  () => useLocalJson<QuestCategory[]>('quests/categories.json'),
  { default: () => [] }
)

const selected = ref('all')

const tabs = computed<TabItem[]>(() => [
  { id: 'all', label: 'All', count: quests.value?.length ?? 0 },
  ...(categories.value ?? []).map(c => ({
    id: c.id,
    label: c.name,
    count: quests.value?.filter(q => q.category_id === c.id).length ?? 0
  }))
])

const filtered = computed(() => {
  if (!quests.value) return []
  if (selected.value === 'all') return quests.value
  return quests.value.filter(q => q.category_id === selected.value)
})

const totals = computed(() => {
  const q = quests.value ?? []
  return {
    done: q.filter(x => x.completed).length,
    total: q.length,
    credits: q.filter(x => x.completed).reduce((s, x) => s + x.reward_credits, 0),
    avg: q.length ? q.reduce((s, x) => s + x.progress, 0) / q.length : 0
  }
})
</script>

<template>
  <div class="quest-page">
    <UIPageHeader title="Quests" subtitle="Level up by exploring every corner of Strades.">
      <template #actions>
        <UIPill tone="accent">{{ totals.credits }} cr earned</UIPill>
      </template>
    </UIPageHeader>

    <UIMetricRow :cols="4">
      <UIStat label="Completed" :value="`${totals.done}/${totals.total}`" />
      <UIStat label="Avg progress" :value="(totals.avg * 100)" suffix="%" :precision="0" />
      <UIStat label="Credits won" :value="totals.credits" />
      <UIStat label="Open" :value="totals.total - totals.done" />
    </UIMetricRow>

    <UISectionTabs v-model="selected" :tabs="tabs" />

    <div v-if="questsPending || catsPending" class="loading">
      <AppSkeletonLoader height="80px" />
      <AppSkeletonLoader height="80px" />
    </div>

    <UIEmptyState v-else-if="filtered.length === 0" icon="◯" title="No quests" message="No quests in this category yet." />

    <div v-else class="quest-grid">
      <UICard
        v-for="q in filtered"
        :key="q.id"
        :title="q.title"
        :dominant="q.completed"
      >
        <template #action>
          <UIPill v-if="q.completed" tone="success" show-dot>DONE</UIPill>
          <UIPill v-else tone="info">{{ Math.round(q.progress * 100) }}%</UIPill>
        </template>
        <p class="desc">{{ q.description }}</p>
        <div class="progress-bar">
          <div class="fill" :style="{ width: `${q.progress * 100}%` }" />
        </div>
        <template #footer>
          <span class="reward">+{{ q.reward_credits }} credits</span>
          <UIPill ghost tone="neutral">{{ q.category_id }}</UIPill>
        </template>
      </UICard>
    </div>
  </div>
</template>

<style scoped>
.quest-page { display: flex; flex-direction: column; gap: 0.75rem; }
.loading { display: flex; flex-direction: column; gap: 0.5rem; }
.quest-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 0.6rem;
}
.desc { margin: 0; font-size: 0.78rem; color: rgba(255,255,255,0.65); line-height: 1.4; }
.progress-bar {
  width: 100%;
  height: 4px;
  background: rgba(255,255,255,0.06);
  border-radius: 2px;
  overflow: hidden;
}
.fill {
  height: 100%;
  background: linear-gradient(90deg, var(--primary-blue, #00aaff), var(--primary-green, #00ff88));
  transition: width 0.4s ease;
}
.reward {
  font-size: 0.7rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--primary-green, #00ff88);
  font-weight: 700;
}
</style>
