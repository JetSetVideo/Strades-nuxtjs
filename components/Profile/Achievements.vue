<script setup>
defineProps({
  achievements: {
    type: Array,
    required: true,
  },
});
</script>

<template>
  <div class="achievements">
    <h2>Achievements</h2>
    <ul>
      <li v-for="ach in achievements" :key="ach.id">
        <img :src="ach.icon" />
        {{ ach.name }} - Unlocked on {{ ach.unlocked_date }}
      </li>
    </ul>
  </div>
</template>

<style scoped>
/* Styles for achievements */
</style>
