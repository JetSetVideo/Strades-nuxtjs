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

<style>
.container-filter{
    color: rgba(255, 255, 255,1);
    min-width: none;
    min-height: auto;
    background-color: rgba(11,11,11,05);
}

.filter-option {
  transition: all 0.3s ease;
  border: 2px solid transparent;
  padding: 8px 16px;
  margin: 4px;
  cursor: pointer;
}

.on {
  box-shadow: 0 0 8px 0 rgba(0, 255, 0, 0.5);
}

.off {
  box-shadow: inset 0 0 8px 0 rgba(255, 0, 0, 0.5);
}

.neutral {
  /* No additional styling needed */
}
</style>