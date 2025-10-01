<script setup>
import { ref } from 'vue';

const props = defineProps(['modelValue']);
const emit = defineEmits(['update:modelValue']);

const assets = ref(['Bitcoin', 'Ethereum', 'USD', 'EUR']); // Example assets

const updateAsset = (asset) => {
  emit('update:modelValue', asset);
};
</script>

<template>
  <div class="asset-selector">
    <h3>Select Asset</h3>
    <select :value="modelValue" @change="updateAsset($event.target.value)">
      <option v-for="asset in assets" :key="asset" :value="asset">{{ asset }}</option>
    </select>
  </div>
</template>

<style scoped>
.asset-selector {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

select {
  padding: 5px;
  border-radius: 3px;
  background-color: rgba(60, 60, 60, 0.6);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.1);
}
</style>