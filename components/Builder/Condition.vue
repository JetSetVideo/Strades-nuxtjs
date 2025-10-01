<script setup>
import { ref } from 'vue';

const props = defineProps(['modelValue']);
const emit = defineEmits(['update:modelValue']);

const conditions = ref(['Price Above', 'Price Below', 'Volume Above', 'Volume Below']);

const updateCondition = (condition) => {
  emit('update:modelValue', { ...props.modelValue, condition });
};

const updateValue = (value) => {
  emit('update:modelValue', { ...props.modelValue, value });
};
</script>

<template>
  <div class="condition-builder">
    <h3>Build Condition</h3>
    <select :value="modelValue?.condition" @change="updateCondition($event.target.value)">
      <option v-for="cond in conditions" :key="cond" :value="cond">{{ cond }}</option>
    </select>
    <input 
      type="number" 
      :value="modelValue?.value" 
      @input="updateValue($event.target.value)" 
      placeholder="Value"
    />
  </div>
</template>

<style scoped>
.condition-builder {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

select, input {
  padding: 5px;
  border-radius: 3px;
  background-color: rgba(60, 60, 60, 0.6);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.1);
}
</style>