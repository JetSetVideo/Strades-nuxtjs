<script setup>

const props = defineProps(['blocks']);

const getBlockDescription = (block) => {
  switch (block.type) {
    case 'asset':
      return `Asset: ${block.data}`;
    case 'condition':
      return `When ${block.data.condition} ${block.data.value}`;
    case 'action':
      return `${block.data.action} ${block.data.amount}`;
    default:
      return '';
  }
};
</script>

<template>
  <div class="strategy-visualizer">
    <h3>Strategy Overview</h3>
    <div class="strategy-flow">
      <div v-for="(block, index) in blocks" :key="block.id" class="block-item">
        {{ getBlockDescription(block) }}
        <span v-if="index < blocks.length - 1" class="arrow">→</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.strategy-visualizer {
  background-color: rgba(60, 60, 60, 0.6);
  padding: 15px;
  border-radius: 5px;
}

.strategy-flow {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.block-item {
  background-color: rgba(80, 80, 80, 0.6);
  padding: 5px 10px;
  border-radius: 3px;
}

.arrow {
  font-size: 1.2em;
  color: #4CAF50;
}
</style>