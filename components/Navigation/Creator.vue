<script setup>
import { computed } from 'vue';

const props = defineProps({
  selectedStrategies: {
    type: Array,
    required: true,
  },
});

const buttonState = computed(() => {
  if (props.selectedStrategies.length > 2) return 'invalid';
  if (props.selectedStrategies.length === 2) return 'compare';
  if (props.selectedStrategies.length === 1) return 'modify';
  return 'create';
});

const buttonText = computed(() => {
  switch (buttonState.value) {
    case 'invalid': return 'Too many selected';
    case 'compare': return 'Compare';
    case 'modify': return 'Modify';
    default: return 'Create';
  }
});

function handleClick() {
  switch (buttonState.value) {
    case 'invalid':
      alert('Too many cards selected');
      break;
    case 'compare':
      // Logic for comparison will be handled in the parent component
      break;
    case 'modify':
      navigateTo(`/strategy/${props.selectedStrategies[0].name}`);
      break;
    case 'create':
      navigateTo('/creator');
      break;
  }
}
</script>

<template>
  <button 
    @click="handleClick" 
    :class="['creator-button', buttonState]"
    :disabled="buttonState === 'invalid'"
  >
    {{ buttonText }}
  </button>
</template>

<style scoped>
.creator-button {
  padding: 10px 20px;
  border: none;
  border-radius: 5px;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.creator-button.create {
  background-color: rgba(0, 255, 0, 0.8);
  color: rgba(0, 0, 0, 1);
}

.creator-button.modify {
  background-color: rgba(0, 0, 255, 0.8);
  color: rgba(255, 255, 255, 1);
}

.creator-button.compare {
  background-color: rgba(255, 165, 0, 0.8);
  color: rgba(0, 0, 0, 1);
}

.creator-button.invalid {
  background-color: rgba(128, 128, 128, 0.8);
  color: rgba(64, 64, 64, 1);
  cursor: not-allowed;
}

.creator-button:active:not(.invalid) {
  transform: scale(0.95);
}
</style>