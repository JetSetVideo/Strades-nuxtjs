<script setup>
const props = defineProps({
  name: {
    type: String,
    required: true
  },
  urlIcon: {
    type: String,
    required: true
  }
});
</script>

<template>
    <div class="asset-card">
        <img :src="urlIcon" alt="asset icon" class="asset-icon" />
        <div class="asset-name">{{ name }}</div>
    </div>
</template>
  
<style scoped>
.asset-card {
    display: flex;
    align-items: center;
    padding: 10px;
    border: 1px solid #ccc;
    border-radius: 8px;
    margin: 5px;
}
.asset-icon {
    width: 20px;
    height: 20px;
    margin-right: 10px;
}
.asset-name {
    font-size: 14px;
    font-weight: bold;
}
</style>