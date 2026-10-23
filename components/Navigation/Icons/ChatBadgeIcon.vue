<script setup lang="ts">
/**
 * Chat tab — a speech bubble with a red dot holding the number of unread
 * messages (99+ past 99). Data: useNavPanels() chat (unreadFor over the user's
 * own conversations, the list /chat shows). Presentational only.
 */
import { computed } from 'vue'
import { badgeLabel } from '~/utils/navIcons'

const props = withDefaults(defineProps<{
  size?: number
  active?: boolean
  ready?: boolean
  unread?: number
  urgent?: boolean
}>(), { size: 40, active: false, ready: false, unread: 0, urgent: false })

const label = computed(() => (props.ready ? badgeLabel(props.unread) : ''))
// The dot widens into a pill for 2-3 characters; centred on the bubble's top-right corner.
const pill = computed(() => {
  const w = label.value.length <= 1 ? 9 : label.value.length === 2 ? 11.5 : 14
  return { x: 19.5 - w / 2, w, font: label.value.length >= 3 ? 5.4 : 6.6 }
})
</script>

<template>
  <span class="nav-icon chat-icon" :class="{ active, unread: !!label }" aria-hidden="true" :style="{ width: `${size}px`, height: `${size}px` }">
    <svg viewBox="0 0 24 24" :width="size" :height="size" fill="none">
      <g class="bubble">
        <path
          d="M4.2 6.2a3 3 0 0 1 3-3h9.6a3 3 0 0 1 3 3v7.1a3 3 0 0 1-3 3H11l-4.1 3.6v-3.6h0.3a3 3 0 0 1-3-3Z"
          class="body"
        />
        <circle cx="8.6" cy="9.8" r="1.05" class="dot d1" />
        <circle cx="12" cy="9.8" r="1.05" class="dot d2" />
        <circle cx="15.4" cy="9.8" r="1.05" class="dot d3" />
      </g>

      <g v-if="label" class="badge" :class="{ urgent }" data-nav-badge>
        <rect :x="pill.x - 1" y="-1" :width="pill.w + 2" height="11" rx="5.5" class="badge-cut" />
        <rect :x="pill.x" y="0" :width="pill.w" height="9" rx="4.5" class="badge-dot" />
        <text :x="19.5" y="6.7" text-anchor="middle" :font-size="pill.font" class="badge-num">{{ label }}</text>
      </g>
    </svg>
  </span>
</template>

<style scoped>
.nav-icon { display: inline-flex; align-items: center; justify-content: center; }
svg { display: block; overflow: visible; }

.body { fill: rgba(255,255,255,0.05); stroke: currentColor; stroke-width: 1.4; stroke-linejoin: round; }
.active .body { fill: rgba(var(--accent, 120,220,180), 0.16); }
.bubble { transform-origin: 12px 12px; transition: transform 0.3s cubic-bezier(0.34,1.56,0.64,1); }
.active .bubble { transform: scale(1.06); }
.dot { fill: currentColor; opacity: 0.45; }
/* Typing dots move only when something is waiting AND the tab is selected. */
.active.unread .dot { animation: blink 1.4s ease-in-out infinite; }
.d2 { animation-delay: 0.2s !important; }
.d3 { animation-delay: 0.4s !important; }
@keyframes blink { 0%, 60%, 100% { opacity: 0.3; } 30% { opacity: 1; } }

.badge-cut { fill: var(--secondary-darker, #0b0b0d); }
.badge-dot { fill: var(--app-color-down, #ff4444); }
.badge-num {
  fill: #fff;
  font-family: var(--font-market-data, 'IBM Plex Mono', monospace);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.badge { transform-box: fill-box; transform-origin: center; animation: pop 0.35s cubic-bezier(0.34,1.56,0.64,1); }
/* Urgent: a throb, but only on the selected tab (no endless repaint on every page). */
.active .badge.urgent { animation: pop 0.35s cubic-bezier(0.34,1.56,0.64,1), throb 1.2s ease-in-out 0.35s infinite; }
@keyframes pop { from { transform: scale(0.3); opacity: 0; } to { transform: scale(1); opacity: 1; } }
@keyframes throb { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.12); } }

@media (prefers-reduced-motion: reduce) {
  .active.unread .dot, .badge, .badge.urgent { animation: none; }
}
</style>
