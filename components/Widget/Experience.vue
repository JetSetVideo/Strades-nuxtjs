<script setup>
import { ref, computed } from 'vue';

const experience = ref(450); // Current experience points
const totalNeeded = ref(1000); // Total points needed for next level
const level = ref(5); // Current user level

const percentage = computed(() => (experience.value / totalNeeded.value) * 100);
</script>

<template>
  <div class="experience-container">
    <div class="experience-header">
      <h3>Level {{ level }}</h3>
      <p>{{ experience }} / {{ totalNeeded }} XP</p>
    </div>
    <div class="experience-bar">
      <div class="experience-fill" :style="{ width: `${percentage}%` }"></div>
    </div>
  </div>
</template>

<style scoped>
.experience-container {
  width: 100%;
  max-width: 600px;
  margin: 0 auto;
  padding: 20px;
  background-color: #1a1a1a;
  border-radius: 10px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  color: #fff;
  text-align: center;
}

.experience-header {
  margin-bottom: 10px;
}

.experience-bar {
  position: relative;
  width: 100%;
  height: 30px;
  background-color: #333;
  border-radius: 15px;
  overflow: hidden;
  box-shadow: inset 0 0 10px rgba(0, 0, 0, 0.5);
}

.experience-fill {
  height: 100%;
  background: linear-gradient(90deg, rgba(0, 255, 0, 0.7), rgba(0, 128, 0, 0.7));
  box-shadow: 0 0 10px rgba(0, 255, 0, 0.7), 0 0 20px rgba(0, 255, 0, 0.7), 0 0 30px rgba(0, 255, 0, 0.7);
  transition: width 0.5s ease-in-out;
  animation: glowing 2s infinite;
}

@keyframes glowing {
  0% { box-shadow: 0 0 5px rgba(0, 255, 0, 0.7); }
  50% { box-shadow: 0 0 20px rgba(0, 255, 0, 0.7); }
  100% { box-shadow: 0 0 5px rgba(0, 255, 0, 0.7); }
}
</style>