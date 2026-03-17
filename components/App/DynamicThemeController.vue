<template>
  <!-- Headless component, no visual output of its own -->
  <slot />
</template>

<script setup lang="ts">
import { watchEffect, onMounted, onUnmounted } from 'vue'
import { useMacroStore } from '~/stores/macro'

const macroStore = useMacroStore()

// Apply CSS variables to the document root
const applyDynamicTheme = () => {
  if (typeof document !== 'undefined') {
    const root = document.documentElement
    
    // Animation Speed (based on volatility)
    root.style.setProperty('--app-animation-speed', `${macroStore.appAnimationSpeed}s`)
    
    // Lighting Hue (based on geopolitical stress)
    // E.g., shifts the overall ambient tint
    root.style.setProperty('--app-lighting-hue', `${macroStore.appLightingHue}`)
    
    // Border Radius (based on dominant asset class)
    root.style.setProperty('--app-border-radius', macroStore.appBorderRadius)
    
    // Derived properties for glassmorphism and depth
    // The higher the volatility, the less blur (sharp, clear, fast UI)
    const blurAmount = Math.max(2, 20 - (macroStore.global_volatility_index * 20))
    root.style.setProperty('--app-glass-blur', `${blurAmount}px`)
  }
}

onMounted(() => {
  // Initially fetch data
  macroStore.fetchMacroState()
  
  // Watch for changes in macro state and apply
  watchEffect(() => {
    applyDynamicTheme()
  })
})

onUnmounted(() => {
  // Cleanup if necessary
})
</script>
