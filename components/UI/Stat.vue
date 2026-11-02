<template>
  <div class="ui-stat" :class="[`size-${size}`, autoTone]">
    <span class="stat-label">{{ label }}</span>
    <span class="stat-value">
      <slot>{{ formatted.text }}</slot>
      <span v-if="shownSuffix" class="stat-suffix">{{ shownSuffix }}</span>
    </span>
    <span v-if="hint" class="stat-hint">{{ hint }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed, useSlots } from 'vue'
import { fmtStatValue } from '~/utils/format'

/**
 * Numbers go through utils/format.ts `fmtStatValue` (same rule as UIKpiStrip):
 *  suffix "USD" → "$1,234" / "+$13" (sign before $, U+2212 minus, suffix dropped);
 *  suffix "%"   → 1 dp, 2 dp under 1 %; plain → integers bare, else 2 dp, 0 dp from 1,000.
 *  `precision` overrides the default; tone="auto" marks a delta → "+" on gains.
 */
const props = withDefaults(defineProps<{
  label: string
  value?: string | number | null
  suffix?: string
  hint?: string
  size?: 'xs' | 'sm' | 'md' | 'lg'
  tone?: 'neutral' | 'positive' | 'negative' | 'auto'
  /** Fraction digits; omit for the documented default of the kind (see utils/format.ts). */
  precision?: number
}>(), {
  size: 'sm',
  tone: 'neutral',
  precision: undefined
})

const slots = useSlots()

const formatted = computed(() =>
  fmtStatValue(props.value, { suffix: props.suffix, precision: props.precision, signed: props.tone === 'auto' })
)
// A custom slot value keeps the caller's suffix untouched.
const shownSuffix = computed(() => (slots.default ? props.suffix : formatted.value.suffix))

const autoTone = computed(() => {
  if (props.tone !== 'auto') return props.tone
  // Same rounding as the text: a value printed as 0 is neutral.
  if (typeof props.value === 'number' && Number.isFinite(props.value) && !/^[$0.,%\s]*$/.test(formatted.value.text)) {
    if (props.value > 0) return 'positive'
    if (props.value < 0) return 'negative'
  }
  return 'neutral'
})

defineExpose({ autoTone })
</script>

<style scoped>
.ui-stat {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  background: rgba(255,255,255,0.03);
  padding: 0.4rem 0.55rem;
  border-radius: 6px;
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
  overflow: hidden;
}
.ui-stat.size-xs { padding: 0.25rem 0.4rem; gap: 0; }
.ui-stat.size-md { padding: 0.55rem 0.7rem; gap: 0.15rem; }
.ui-stat.size-lg { padding: 0.7rem 0.9rem; gap: 0.2rem; }

.stat-label {
  font-family: var(--font-chrome, inherit);
  font-size: 0.55rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.5);
  font-weight: 600;
}
.size-xs .stat-label { font-size: 0.5rem; letter-spacing: 0.08em; }
.size-md .stat-label { font-size: 0.6rem; }
.size-lg .stat-label { font-size: 0.65rem; }

.stat-value {
  font-family: var(--font-market-data, inherit);
  font-size: 0.85rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--text-white, #fff);
  display: inline-flex;
  align-items: baseline;
  gap: 0.15rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  min-width: 0;
  letter-spacing: -0.01em;
}
.size-xs .stat-value { font-size: 0.72rem; }
.size-md .stat-value { font-size: 1rem; }
.size-lg .stat-value { font-size: 1.35rem; font-weight: 800; }

@media (max-width: 640px) {
  .size-lg .stat-value { font-size: 1.15rem; }
  .size-md .stat-value { font-size: 0.92rem; }
}

.stat-suffix { font-size: 0.7em; font-weight: 500; color: rgba(255,255,255,0.55); }

.stat-hint {
  font-size: 0.6rem;
  color: rgba(255,255,255,0.4);
}

.positive .stat-value { color: var(--app-color-up, var(--success-green, #00ff88)); }
.negative .stat-value { color: var(--app-color-down, var(--error-red, #ff4444)); }
</style>
