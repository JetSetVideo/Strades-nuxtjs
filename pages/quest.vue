<script setup lang="ts">
import { ref, computed } from 'vue';
import type { Quest, QuestCategory } from '@/types';
import { useLocalJson } from '@/composables/useLocalJson';
import QuestFilter from '@/components/Quest/Filter.vue';
import QuestWidget from '@/components/Widget/Quest.vue';

const { data: quests, pending: questsPending } = await useLocalJson<Quest[]>('quests/quests.json');
const { data: categories, pending: categoriesPending } = await useLocalJson<QuestCategory[]>('quests/categories.json');

const selectedCategory = ref('all');

const filteredQuests = computed(() => {
  if (!quests.value) return [];
  if (selectedCategory.value === 'all') {
    return quests.value;
  }
  return quests.value.filter((quest) => quest.category === selectedCategory.value);
});
</script>

<template>
  <div>
    <h1>Quests</h1>
    <div v-if="!categoriesPending && categories">
      <QuestFilter
        :categories="categories"
        :selected-category="selectedCategory"
        @update:selected-category="selectedCategory = $event"
      />
    </div>
    <div v-if="!questsPending && filteredQuests">
      <QuestWidget
        v-for="quest in filteredQuests"
        :key="quest.id"
        :quest="quest"
        :is-completed="quest.progress === 100"
      />
    </div>
    <div v-else>
      <p>Loading quests...</p>
    </div>
  </div>
</template>
