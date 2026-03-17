<template>
  <div class="chat-badge-icon" :style="{ width: `${size}px`, height: `${size}px` }">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
    </svg>
    <div v-if="unreadCount > 0" class="badge" :class="{ urgent: emotionalUrgency > 0.7 }">
      {{ unreadCount > 99 ? '99+' : unreadCount }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps({
  size: {
    type: Number,
    default: 24
  }
})

// Mocking the chat store data for now
const unreadCount = ref(3)
const emotionalUrgency = ref(0.8) // 0.0 to 1.0
</script>

<style scoped>
.chat-badge-icon {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: inherit;
}

svg {
  width: 100%;
  height: 100%;
}

.badge {
  position: absolute;
  top: -4px;
  right: -6px;
  background: var(--primary-green, #31d0aa);
  color: #000;
  font-size: 0.6rem;
  font-weight: bold;
  padding: 2px 4px;
  border-radius: 10px;
  min-width: 16px;
  text-align: center;
  line-height: 1;
  box-shadow: 0 2px 4px rgba(0,0,0,0.5);
  font-family: 'Poppins', sans-serif;
}

/* Phase 5: Map emotional urgency to a pulse animation */
.urgent {
  background: var(--error-red, #ed4b9e);
  color: #fff;
  animation: urgent-pulse 1s infinite;
}

@keyframes urgent-pulse {
  0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(237, 75, 158, 0.7); }
  70% { transform: scale(1.1); box-shadow: 0 0 0 6px rgba(237, 75, 158, 0); }
  100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(237, 75, 158, 0); }
}
</style>
