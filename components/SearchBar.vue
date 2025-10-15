<script setup lang="ts">
import { ref, computed } from 'vue';
import type { PropType } from 'vue';
import type { SearchHistory, SearchSuggestion } from '@/types';

const props = defineProps({
  searchHistory: {
    type: Array as PropType<SearchHistory[]>,
    default: () => [],
  },
  searchSuggestions: {
    type: Array as PropType<SearchSuggestion[]>,
    default: () => [],
  },
});

const q = ref("");
const isPanelOpen = ref(false);

const filteredSuggestions = computed(() => {
  if (!q.value) {
    return props.searchSuggestions;
  }
  return props.searchSuggestions.filter(suggestion =>
    suggestion.term.toLowerCase().includes(q.value.toLowerCase())
  );
});

const openPanel = () => {
  isPanelOpen.value = true;
};

const closePanel = () => {
  isPanelOpen.value = false;
};
</script>

<template>
  <div class="search-container">
    <UButton
      icon="i-heroicons-magnifying-glass-20-solid"
      @click="openPanel"
      :class="{ 'rotate-icon': isPanelOpen }"
    />
    <div v-if="isPanelOpen" class="search-panel">
      <UInput
        v-model="q"
        name="q"
        placeholder="Search..."
        icon="i-heroicons-magnifying-glass-20-solid"
        autocomplete="off"
        :ui="{ icon: { trailing: { pointer: '' } } }"
      >
        <template #trailing>
          <UButton
            v-show="q !== ''"
            color="gray"
            variant="link"
            icon="i-heroicons-x-mark-20-solid"
            :padded="false"
            @click="q = ''"
          />
        </template>
      </UInput>
      <div class="history">
        <h3>History</h3>
        <ul>
          <li v-for="item in searchHistory" :key="item.id">{{ item.term }}</li>
        </ul>
      </div>
      <div class="suggestions">
        <h3>Suggestions</h3>
        <ul>
          <li v-for="item in filteredSuggestions" :key="item.id">{{ item.term }}</li>
        </ul>
      </div>
      <button @click="closePanel">Close</button>
    </div>
  </div>
</template>

<style scoped>
.search-panel {
  position: fixed;
  left: 0;
  top: 0;
  width: 300px;
  height: 100%;
  background: white;
  z-index: 10;
  padding: 1rem;
  color: black;
  transition: transform 0.3s ease-in-out;
}

.search-container .rotate-icon {
  transform: rotate(90deg);
}
</style>
