<script setup>
defineProps({
  disabled: {
    type: Boolean,
    default: false
  }
});

defineEmits(['click']);
</script>

<template>
  <button 
    @click="$emit('click')" 
    :disabled="disabled"
    class="analyze-button"
  >
    <slot>Analyze Strategy</slot>
  </button>
</template>

<style scoped>
.analyze-button {
  background-color: #2c3e50;
  color: white;
  border: none;
  border-radius: 25px;
  padding: 12px 24px;
  font-size: 1.1em;
  font-weight: bold;
  margin: 10px;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  transition: all 0.3s ease;
  box-shadow: inset 0 0 10px rgba(255, 255, 255, 0.2), 0 0 15px rgba(0, 0, 0, 0.3);
}

.analyze-button::before {
  content: '';
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: linear-gradient(
    to bottom right,
    rgba(255, 255, 255, 0.3) 0%,
    rgba(255, 255, 255, 0.2) 40%,
    rgba(255, 255, 255, 0) 50%,
    rgba(255, 255, 255, 0.2) 60%,
    rgba(255, 255, 255, 0.3) 100%
  );
  transform: rotate(45deg);
  animation: glowing 2s linear infinite;
}

.analyze-button:hover:not(:disabled) {
  transform: scale(1.05);
  box-shadow: inset 0 0 15px rgba(255, 255, 255, 0.3), 0 0 20px rgba(0, 0, 0, 0.4);
}

.analyze-button:active:not(:disabled) {
  transform: scale(0.95);
}

.analyze-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  background-color: #4a5568;
}

@keyframes glowing {
  0% { left: -50%; }
  100% { left: 100%; }
}
</style>