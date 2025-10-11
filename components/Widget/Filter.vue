<script setup>
// Create a filter system for the financial news displayed in the dashboard where each option available has 3 exclusive postion state (off, neutral, on).
// Each state can be changed by clicking on the desired button (from neutral to on and then on to off, off to neutral). 
// The selected position state tells the filter system if it needs to include "on" the data selected,
// or exlude the data "off" or do nothing "neutral" depending of the selected state.
// All options naturally start on neutral.
// "off" state should add inner shadows, "neutral" keep the button without decoration and "on" adds shadows on the outter border.
import { reactive } from 'vue';

const filterOptions = reactive({
  'Crypto': 'neutral',
  'Stock': 'neutral',
  'Forex': 'neutral',
  'Commodities': 'neutral',
  'Energy': 'neutral',
  'Economy': 'neutral',
  'Politics': 'neutral',
  'Entertainment': 'neutral',
  
});

function toggleState(option) {
  const nextState = {
    'neutral': 'on',
    'on': 'off',
    'off': 'neutral',
  };
  filterOptions[option] = nextState[filterOptions[option]];
}
</script>

<template>
<div class="container-filter">
    <button 
        v-for="(state, option) in filterOptions" 
        :key="option"
        :class="`filter-option ${state}`" 
        @click="toggleState(option)">
        {{ option }}
    </button>
</div>

</template>

<style scoped>
.container-filter {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
  color: var(--text-white);
  padding: var(--spacing-md);
  background: var(--bg-secondary);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-primary);
  box-shadow: var(--shadow-primary);
}

.filter-option {
  transition: var(--transition-normal);
  border: 2px solid transparent;
  padding: var(--spacing-xs) var(--spacing-md);
  border-radius: var(--radius-md);
  cursor: pointer;
  background: var(--bg-tertiary);
  color: var(--text-white);
  font-family: var(--font-family-secondary);
  font-size: 0.85rem;
  font-weight: 500;
  min-width: 80px;
  text-align: center;
}

.filter-option:hover {
  background: var(--text-white);
  color: var(--secondary-darker);
  border-color: var(--text-white);
}

.on {
  background: var(--bg-accent);
  border-color: var(--success-green);
  color: var(--success-green);
  box-shadow: 0 0 8px rgba(0, 255, 0, 0.3);
}

.off {
  background: rgba(255, 68, 68, 0.1);
  border-color: var(--error-red);
  color: var(--error-red);
  box-shadow: inset 0 0 8px rgba(255, 0, 0, 0.3);
}

.neutral {
  border-color: var(--border-secondary);
  color: var(--text-gray);
}

/* Responsive adjustments */
@media (max-width: 480px) {
  .container-filter {
    padding: var(--spacing-sm);
  }

  .filter-option {
    flex: 1;
    min-width: 70px;
    padding: var(--spacing-xs);
    font-size: 0.8rem;
  }
}
</style>