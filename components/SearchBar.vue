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
      <button class="close-btn" @click="closePanel">Close</button>
    </div>
  </div>
</template>

<style scoped>
.search-panel {
  position: fixed;
  left: 0;
  top: 0;
  width: 100vw;
  max-width: 400px;
  height: 100%;
  background: var(--bg-primary, #111);
  backdrop-filter: blur(var(--app-glass-blur, 10px));
  z-index: 100;
  padding: 1.5rem;
  color: var(--text-white, #fff);
  border-right: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 4px 0 24px rgba(0, 0, 0, 0.5);
  transition: transform 0.3s ease-in-out;
}

.search-container .rotate-icon {
  transform: rotate(90deg);
}

.history, .suggestions {
  margin-top: 2rem;
}

.history h3, .suggestions h3 {
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.5);
  text-transform: uppercase;
  margin-bottom: 1rem;
}

ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

li {
  padding: 0.75rem 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  font-size: 1rem;
  cursor: pointer;
  transition: color 0.2s ease;
}

li:hover {
  color: var(--primary-green, #31d0aa);
}

.close-btn {
  position: absolute;
  bottom: 2rem;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(255, 255, 255, 0.1);
  border: none;
  color: #fff;
  padding: 0.75rem 2rem;
  border-radius: var(--app-border-radius, 8px);
  cursor: pointer;
  transition: background 0.2s ease;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}
</style>
