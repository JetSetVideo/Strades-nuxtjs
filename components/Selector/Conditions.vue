<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
  modelValue: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(['update:modelValue']);

const conditions = ref(props.modelValue);

const conditionTypes = [
  { value: 'price', label: 'Price' },
  { value: 'volume', label: 'Volume' },
  { value: 'indicator', label: 'Indicator' },
  { value: 'time', label: 'Time' }
];

const comparators = [
  { value: 'greater', label: '>' },
  { value: 'less', label: '<' },
  { value: 'equal', label: '=' },
  { value: 'not_equal', label: '≠' }
];

function addCondition() {
  conditions.value.push({
    type: '',
    comparator: '',
    value: '',
    timeframe: ''
  });
  updateModelValue();
}

function removeCondition(index) {
  conditions.value.splice(index, 1);
  updateModelValue();
}

function updateModelValue() {
  emit('update:modelValue', conditions.value);
}

const isValid = computed(() => {
  return conditions.value.every(condition => 
    condition.type && condition.comparator && condition.value
  );
});
</script>

<template>
  <div class="conditions-selector">
    <h3>Conditions</h3>
    <div v-for="(condition, index) in conditions" :key="index" class="condition">
      <select v-model="condition.type" @change="updateModelValue">
        <option value="" disabled>Select type</option>
        <option v-for="type in conditionTypes" :key="type.value" :value="type.value">
          {{ type.label }}
        </option>
      </select>
      <select v-model="condition.comparator" @change="updateModelValue">
        <option value="" disabled>Select comparator</option>
        <option v-for="comp in comparators" :key="comp.value" :value="comp.value">
          {{ comp.label }}
        </option>
      </select>
      <input 
        v-model="condition.value" 
        type="text" 
        placeholder="Value"
        @input="updateModelValue"
      >
      <input 
        v-if="condition.type === 'time'" 
        v-model="condition.timeframe" 
        type="text" 
        placeholder="Timeframe"
        @input="updateModelValue"
      >
      <button @click="removeCondition(index)" class="remove-btn">Remove</button>
    </div>
    <button @click="addCondition" class="add-btn">Add Condition</button>
    <p v-if="!isValid" class="error-message">Please fill in all condition fields.</p>
  </div>
</template>

<style scoped>
.conditions-selector {
  background-color: #1e1e1e;
  border-radius: 8px;
  padding: 15px;
  margin-bottom: 20px;
}

h3 {
  color: #ffffff;
  margin-bottom: 10px;
}

.condition {
  display: flex;
  gap: 10px;
  margin-bottom: 10px;
}

select, input {
  background-color: #2c2c2c;
  color: #ffffff;
  border: 1px solid #3c3c3c;
  border-radius: 4px;
  padding: 5px;
}

.add-btn, .remove-btn {
  background-color: #3c3c3c;
  color: #ffffff;
  border: none;
  border-radius: 4px;
  padding: 5px 10px;
  cursor: pointer;
  transition: background-color 0.3s;
}

.add-btn:hover, .remove-btn:hover {
  background-color: #4c4c4c;
}

.error-message {
  color: #ff6b6b;
  margin-top: 10px;
}
</style>
