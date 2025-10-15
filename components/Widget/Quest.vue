<script setup lang="ts">
import type { PropType } from 'vue';
import type { Quest } from '@/types';

const props = defineProps({
  quest: {
    type: Object as PropType<Quest>,
    required: true,
  },
  isCompleted: {
    type: Boolean,
    required: true,
  },
});
</script>

<template>
  <div :class="['quest-widget', { completed: isCompleted }]">
    <div class="difficulty">{{ quest.difficulty }} - {{ quest.points }}pts</div>
    <h3>{{ quest.name }}</h3>
    <progress :value="quest.progress" max="100"></progress>
    <button>Details</button>
  </div>
</template>

<style scoped>
.quest-widget {
  border: 1px solid #ccc;
  padding: 1rem;
  margin-bottom: 1rem;
  opacity: 0.5;
}
.quest-widget.completed {
  opacity: 1;
  border-color: gold;
  box-shadow: 0 0 10px gold;
}
</style>
