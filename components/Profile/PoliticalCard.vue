<script setup lang="ts">
import type { PoliticalProfile } from '@/stores/users'

const props = defineProps<{
  profile: PoliticalProfile
}>()

/** Map a -1…+1 dimension to a color (Data.md: political_leaning background tint) */
const polarColor = (val: number, leftHue = 240, rightHue = 10): string => {
  const norm = (val + 1) / 2 // 0-1
  const hue = leftHue + (rightHue - leftHue) * norm
  const sat = Math.min(0.3, Math.abs(val) * 0.35)
  return `oklch(65% ${sat} ${hue})`
}

const dims = computed(() => [
  { key: 'economic_ideology',    label: 'Economy',       val: props.profile.economic_ideology,    leftLbl: 'State', rightLbl: 'Market' },
  { key: 'fed_stance',           label: 'Fed Stance',    val: props.profile.fed_stance,           leftLbl: 'Dovish', rightLbl: 'Hawkish' },
  { key: 'regulatory_stance',    label: 'Regulation',    val: props.profile.regulatory_stance,    leftLbl: 'Less', rightLbl: 'More' },
  { key: 'esg_sensitivity',      label: 'ESG',           val: props.profile.esg_sensitivity,      leftLbl: 'Anti', rightLbl: 'Pro' },
  { key: 'crypto_libertarianism',label: 'Crypto',        val: (props.profile.crypto_libertarianism * 2) - 1, leftLbl: 'Skeptic', rightLbl: 'Maximalist' },
  { key: 'globalism_index',      label: 'Globalism',     val: props.profile.globalism_index,      leftLbl: 'Nationalist', rightLbl: 'Globalist' },
])

const pct = (val: number) => ((val + 1) / 2) * 100
</script>

<template>
  <div class="pol-card">
    <p class="description">{{ profile.description }}</p>

    <div class="dims">
      <div v-for="d in dims" :key="d.key" class="dim-row">
        <span class="dim-left">{{ d.leftLbl }}</span>
        <div class="spectrum-track">
          <div class="spectrum-fill" :style="{ width: `${pct(d.val)}%`, background: polarColor(d.val) }" />
          <div class="spectrum-dot" :style="{ left: `${pct(d.val)}%`, background: polarColor(d.val) }" />
        </div>
        <span class="dim-right">{{ d.rightLbl }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pol-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  padding: var(--spacing-md);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.description {
  font-size: 0.8rem;
  color: var(--text-light-gray);
  line-height: 1.5;
  margin: 0;
}

.dims {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.dim-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.dim-left, .dim-right {
  font-size: 0.65rem;
  color: var(--text-gray);
  min-width: 58px;
}

.dim-right { text-align: right; }

.spectrum-track {
  flex: 1;
  height: 5px;
  background: rgba(255,255,255,0.07);
  border-radius: 999px;
  position: relative;
}

.spectrum-fill {
  height: 100%;
  border-radius: 999px;
  transition: width 0.6s ease;
}

.spectrum-dot {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 2px solid var(--bg-secondary);
  transition: left 0.6s ease;
}
</style>
