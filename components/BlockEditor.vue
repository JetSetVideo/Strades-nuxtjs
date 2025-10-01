<script setup>

const props = defineProps(['blocks']);
const emit = defineEmits(['update-block', 'remove-block']);

const updateBlock = (blockId, newData) => {
  emit('update-block', blockId, newData);
};

const removeBlock = (blockId) => {
  emit('remove-block', blockId);
};
</script>

<template>
  <div class="block-editor">
    <div v-for="block in blocks" :key="block.id" class="block">
      <slot :name="block.type" :block="block"></slot>
      <button @click="removeBlock(block.id)" class="remove-block">Remove</button>
    </div>
  </div>
</template>

<style scoped>
.block-editor {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.block {
  background-color: rgba(80, 80, 80, 0.6);
  padding: 10px;
  border-radius: 5px;
  position: relative;
}

.remove-block {
  position: absolute;
  top: 5px;
  right: 5px;
  background-color: #ff4444;
  color: white;
  border: none;
  border-radius: 3px;
  padding: 2px 5px;
  cursor: pointer;
}
</style>