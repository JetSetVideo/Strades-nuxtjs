<script setup>
import { ref, defineProps, defineEmits } from 'vue';

const props = defineProps(['modelValue']);
const emit = defineEmits(['update:modelValue']);

const actions = ref(['Buy', 'Sell', 'Hold']);

const updateAction = (action) => {
  emit('update:modelValue', { ...props.modelValue, action });
};

const updateAmount = (amount) => {
  emit('update:modelValue', { ...props.modelValue, amount });
};
</script>

<template>
  <div class="action-builder">
    <h3>Build Action</h3>
    <select :value="modelValue?.action" @change="updateAction($event.target.value)">
      <option v-for="act in actions" :key="act" :value="act">{{ act }}</option>
    </select>
    <input 
      type="number" 
      :value="modelValue?.amount" 
      @input="updateAmount($event.target.value)" 
      placeholder="Amount"
    />
  </div>
</template>

<style scoped>
.action-builder {
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