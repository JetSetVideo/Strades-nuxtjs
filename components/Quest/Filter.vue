<script setup lang="ts">
import type { PropType } from 'vue';
import type { QuestCategory } from '@/types';

const props = defineProps({
  categories: {
    type: Array as PropType<QuestCategory[]>,
    required: true,
  },
  selectedCategory: {
    type: String,
    required: true,
  },
});

const emit = defineEmits(['update:selectedCategory']);

const onCategoryChange = (event: Event) => {
  emit('update:selectedCategory', (event.target as HTMLSelectElement).value);
};
</script>

<template>
  <div class="quest-filter">
    <select :value="selectedCategory" @change="onCategoryChange">
      <option value="all">All Categories</option>
      <option v-for="category in categories" :key="category.id" :value="category.id">
        {{ category.name }}
      </option>
    </select>
  </div>
</template>

<style scoped>
.quest-filter {
  margin-bottom: 1rem;
}
</style>
