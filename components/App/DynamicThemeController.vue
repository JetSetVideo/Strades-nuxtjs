<template>
  <slot />
</template>

<script setup lang="ts">
import { watchEffect, onMounted } from 'vue'
import { useMacroStore } from '~/stores/macro'
import { useUserPreferencesStore } from '~/stores/userPreferences'

const macro = useMacroStore()
const prefs = useUserPreferencesStore()

const applyTheme = () => {
  if (typeof document === 'undefined') return
  const root = document.documentElement

  // Core: per Components.md DynamicThemeController spec
  root.style.setProperty('--app-animation-speed', `${macro.appAnimationSpeed}s`)
  root.style.setProperty('--app-lighting-hue', String(macro.appLightingHue))
  root.style.setProperty('--app-border-radius', macro.appBorderRadius)

  // Extended: glass blur narrows under high volatility (sharper, less depth)
  const blurAmount = Math.max(2, 20 - macro.global_volatility_index * 20)
  root.style.setProperty('--app-glass-blur', `${blurAmount}px`)

  // Density (Design.md: aggressive traders get compact UI)
  const density = Math.min(macro.appDensityScale, 1 - prefs.personality_matrix.risk * 0.15)
  root.style.setProperty('--app-density', density.toFixed(3))

  // Ambient background tint — geopolitical stress shifts hue, sentiment shifts lightness
  root.style.setProperty('--app-ambient', macro.ambientOklch)

  // Glow radius derived from liquidity index (Design.md: liquid assets glow more)
  root.style.setProperty('--app-glow-radius', `${macro.glowRadiusPx}px`)

  // News pulse — emits as a CSS animation duration for the news icon
  const pulseDuration = Math.max(0.3, 2.0 - macro.newsPulseHz * 1.5)
  root.style.setProperty('--app-news-pulse', `${pulseDuration}s`)

  // Lighting source angle (for shadows / radial gradients)
  root.style.setProperty('--app-light-angle', `${macro.lighting_source_angle}deg`)
}

onMounted(() => {
  // Plugin already hydrated macro, but fall back if it didn't
  if (!macro.hydrated) macro.fetchMacroState()
  if (!prefs.hydrated) prefs.fetchPreferences()
  watchEffect(applyTheme)
})
</script>
