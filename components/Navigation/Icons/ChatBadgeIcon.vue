<script setup lang="ts">
import { computed } from 'vue'
import { useChatStore } from '~/stores/chat'
import { useCurrentUser } from '~/composables/useCurrentUser'

withDefaults(defineProps<{ size?: number }>(), { size: 24 })

const chat = useChatStore()
const { userId } = useCurrentUser()

const unreadCount = computed(() => chat.getUnreadCount(userId))
const emotionalUrgency = computed(() => chat.getEmotionalUrgency(userId))
</script>

<template>
  <div class="chat-icon" :style="{ width: `${size}px`, height: `${size}px` }">
    <svg :width="size" :height="size" viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <linearGradient id="chat-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="rgba(0,255,136,0.85)" />
          <stop offset="100%" stop-color="rgba(0,170,255,0.85)" />
        </linearGradient>
      </defs>

      <path
        d="M 4 5 Q 4 3 6 3 L 18 3 Q 20 3 20 5 L 20 13 Q 20 15 18 15 L 11 15 L 7 19 L 7 15 L 6 15 Q 4 15 4 13 Z"
        fill="rgba(255,255,255,0.05)"
        stroke="currentColor"
        stroke-width="1.4"
        stroke-linejoin="round"
      />

      <!-- Typing dots animate only when something is actually waiting -->
      <g class="dots" :class="{ live: unreadCount > 0 }">
        <circle cx="9" cy="9" r="1" fill="currentColor" class="dot dot-1" />
        <circle cx="12" cy="9" r="1" fill="currentColor" class="dot dot-2" />
        <circle cx="15" cy="9" r="1" fill="currentColor" class="dot dot-3" />
      </g>

      <!-- Unread counter — sized to be readable at nav-bar scale -->
      <g v-if="unreadCount > 0" class="badge" :class="{ urgent: emotionalUrgency > 0.7 }">
        <circle cx="19" cy="4.5" r="4.6" fill="var(--bg-primary, #0e0e0f)" opacity="0.9" />
        <circle cx="19" cy="4.5" r="4" :fill="emotionalUrgency > 0.7 ? 'var(--error-red, #ff4444)' : 'url(#chat-gradient)'" />
        <text x="19" y="6" text-anchor="middle" font-size="4.6" font-weight="800" :fill="emotionalUrgency > 0.7 ? '#fff' : '#001a0d'" font-family="Poppins, sans-serif">
          {{ unreadCount > 9 ? '9+' : unreadCount }}
        </text>
      </g>
    </svg>
  </div>
</template>

<style scoped>
.chat-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: inherit;
}
svg { overflow: visible; }

.dots .dot { opacity: 0.55; }
.dots.live .dot {
  animation: dot-blink 1.4s infinite ease-in-out;
}
.dot-1 { animation-delay: 0s; }
.dot-2 { animation-delay: 0.2s; }
.dot-3 { animation-delay: 0.4s; }

@keyframes dot-blink {
  0%, 60%, 100% { opacity: 0.3; }
  30% { opacity: 1; }
}

.badge.urgent {
  animation: badge-pulse 1.1s infinite ease-out;
  transform-origin: 19px 4.5px;
}
@keyframes badge-pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.15); }
  100% { transform: scale(1); }
}
</style>
