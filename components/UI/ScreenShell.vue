<template>
  <div class="screen-shell">
    <UIPageHeader :title="title" :subtitle="subtitle">
      <template v-if="$slots.actions" #actions>
        <slot name="actions" />
      </template>
    </UIPageHeader>

    <UIKpiStrip v-if="kpis?.length" :items="kpis" />

    <UISectionTabs
      v-if="tabs?.length && tab !== undefined"
      :model-value="tab"
      :tabs="tabs"
      @update:model-value="emit('update:tab', $event)"
    />

    <slot />
  </div>
</template>

<script setup lang="ts">
import UIPageHeader from '~/components/UI/PageHeader.vue'
import UIKpiStrip, { type KpiItem } from '~/components/UI/KpiStrip.vue'
import UISectionTabs, { type TabItem } from '~/components/UI/SectionTabs.vue'

defineProps<{
  title: string
  subtitle?: string
  kpis?: KpiItem[]
  tabs?: TabItem[]
  tab?: string
}>()

const emit = defineEmits<{ (e: 'update:tab', v: string): void }>()
</script>

<style scoped>
.screen-shell {
  display: flex;
  flex-direction: column;
  gap: var(--page-gap, 0.6rem);
  min-width: 0;
}
</style>
