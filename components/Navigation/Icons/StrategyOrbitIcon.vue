<template>
  <div class="strategy-orbit-icon" :style="{ width: `${size}px`, height: `${size}px` }">
    <svg :width="size" :height="size" viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <radialGradient id="hub-gradient" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="var(--primary-green, #00ff88)" />
          <stop offset="100%" stop-color="var(--primary-blue, #00aaff)" />
        </radialGradient>
      </defs>

      <!-- Outer orbit ring (slow) -->
      <ellipse
        cx="12" cy="12" rx="10" ry="3.5"
        fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="0.6"
        :style="{ transform: 'rotate(-25deg)', transformOrigin: '12px 12px' }"
      />
      <!-- Inner orbit ring (fast) -->
      <ellipse
        cx="12" cy="12" rx="9" ry="3"
        fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="0.5"
        :style="{ transform: 'rotate(35deg)', transformOrigin: '12px 12px' }"
      />

      <!-- Orbiting nodes (CSS animated) -->
      <g class="orbit-outer">
        <circle cx="22" cy="12" r="1.6" fill="var(--primary-green, #00ff88)" class="orbit-node" />
        <circle cx="2" cy="12" r="1.2" fill="var(--primary-blue, #00aaff)" class="orbit-node small" />
      </g>
      <g class="orbit-inner">
        <circle cx="21" cy="12" r="1.3" fill="#F5A623" class="orbit-node" />
        <circle cx="3" cy="12" r="1" fill="#7ED321" class="orbit-node small" />
      </g>

      <!-- Hub -->
      <circle cx="12" cy="12" r="3.5" fill="url(#hub-gradient)" />
      <circle cx="12" cy="12" r="3.5" fill="none" stroke="rgba(0,0,0,0.4)" stroke-width="0.5" />
      <text x="12" y="13.5" text-anchor="middle" font-size="4" font-weight="800" fill="#000" font-family="Poppins, sans-serif">A</text>
    </svg>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ size?: number }>(), { size: 24 })
</script>

<style scoped>
.strategy-orbit-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: inherit;
  transition: transform 0.3s ease;
}
.strategy-orbit-icon:hover { transform: scale(1.08); }

.orbit-outer {
  transform-origin: 12px 12px;
  animation: orbit-spin var(--app-animation-speed, 8s) linear infinite;
  animation-duration: calc(var(--app-animation-speed, 0.5s) * 18);
}
.orbit-inner {
  transform-origin: 12px 12px;
  animation: orbit-spin var(--app-animation-speed, 4s) linear infinite reverse;
  animation-duration: calc(var(--app-animation-speed, 0.5s) * 12);
}

@keyframes orbit-spin {
  to { transform: rotate(360deg); }
}

.orbit-node {
  filter: drop-shadow(0 0 2px currentColor);
}
.orbit-node.small { opacity: 0.65; }
</style>
