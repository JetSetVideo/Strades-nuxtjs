<script setup lang="ts">
import { ref } from 'vue'
import UIPageHeader from '@/components/UI/PageHeader.vue'
import UICard from '@/components/UI/Card.vue'
import UIPill from '@/components/UI/Pill.vue'
import {
  useAppearanceStore, TIMEZONE_LABELS,
  type FontScaleKey, type ChromeFontKey, type MarketDataFontKey, type ColorSchemeKey, type ChartStyleKey, type TimezoneKey
} from '~/stores/appearance'

definePageMeta({ title: 'Settings', description: 'Account, security, preferences.', layout: 'default' })

const appearance = useAppearanceStore()
appearance.hydrate()

const FONT_SCALE_OPTIONS: { key: FontScaleKey; label: string }[] = [
  { key: 'small', label: 'Small' }, { key: 'medium', label: 'Medium' }, { key: 'large', label: 'Large' }
]
const CHROME_FONT_OPTIONS: { key: ChromeFontKey; label: string }[] = [
  { key: 'poppins', label: 'Poppins' }, { key: 'sora', label: 'Sora' }
]
const MARKET_FONT_OPTIONS: { key: MarketDataFontKey; label: string }[] = [
  { key: 'plex-mono', label: 'IBM Plex Mono' }, { key: 'inter', label: 'Inter' }
]
const COLOR_SCHEME_OPTIONS: { key: ColorSchemeKey; label: string }[] = [
  { key: 'default', label: 'Green up / Red down' },
  { key: 'colorblind', label: 'Colorblind-safe' },
  { key: 'swapped', label: 'Red up / Green down' }
]
const CHART_STYLE_OPTIONS: { key: ChartStyleKey; label: string }[] = [
  { key: 'line', label: 'Line' },
  { key: 'candle', label: 'Candles' }
]
const TIMEZONE_OPTIONS = (Object.keys(TIMEZONE_LABELS) as TimezoneKey[]).map(key => ({ key, label: TIMEZONE_LABELS[key] }))

const apiKeys = ref([
  { exchange: 'Binance', key: '', secret: '' },
  { exchange: 'Kraken', key: '', secret: '' },
  { exchange: 'Uniswap', key: '', secret: '' }
])

const addApiKey = (exchange: string) => apiKeys.value.push({ exchange, key: '', secret: '' })
const removeApiKey = (i: number) => apiKeys.value.splice(i, 1)
const saveSettings = () => { /* persist later */ }
</script>

<template>
  <div class="settings-page">
    <UIPageHeader title="Settings" subtitle="Account, security, preferences." />

    <UICard title="API Keys">
      <template #action><UIPill tone="warning" show-dot>Local-only</UIPill></template>
      <div v-for="(api, i) in apiKeys" :key="i" class="api-row">
        <strong>{{ api.exchange }}</strong>
        <input v-model="api.key" placeholder="API Key" />
        <input v-model="api.secret" placeholder="API Secret" type="password" />
        <button class="ghost danger" @click="removeApiKey(i)">Remove</button>
      </div>
      <template #footer>
        <button class="ghost" @click="addApiKey('Custom')">+ Add custom</button>
        <button class="primary" @click="saveSettings">Save</button>
      </template>
    </UICard>

    <UICard title="Appearance">
      <template #action><UIPill tone="info" show-dot>Live</UIPill></template>

      <div class="appearance-grid">
        <div class="setting-row">
          <span class="setting-label">Text size</span>
          <div class="chip-row">
            <button
              v-for="opt in FONT_SCALE_OPTIONS" :key="opt.key"
              :class="['chip', { active: appearance.fontScaleKey === opt.key }]"
              @click="appearance.setFontScale(opt.key)"
            >{{ opt.label }}</button>
          </div>
        </div>

        <div class="setting-row">
          <span class="setting-label">Menu &amp; title font <em>(chrome)</em></span>
          <div class="chip-row">
            <button
              v-for="opt in CHROME_FONT_OPTIONS" :key="opt.key"
              :class="['chip', { active: appearance.chromeFontKey === opt.key }]"
              :style="{ fontFamily: opt.key === 'poppins' ? `'Poppins', sans-serif` : `'Sora', sans-serif` }"
              @click="appearance.setChromeFont(opt.key)"
            >{{ opt.label }}</button>
          </div>
        </div>

        <div class="setting-row">
          <span class="setting-label">Prices &amp; asset-name font <em>(market data)</em></span>
          <div class="chip-row">
            <button
              v-for="opt in MARKET_FONT_OPTIONS" :key="opt.key"
              :class="['chip', { active: appearance.marketDataFontKey === opt.key }]"
              :style="{ fontFamily: opt.key === 'plex-mono' ? `'IBM Plex Mono', monospace` : `'Inter', sans-serif` }"
              @click="appearance.setMarketDataFont(opt.key)"
            >{{ opt.label }}</button>
          </div>
        </div>

        <div class="setting-row">
          <span class="setting-label">Up / down colors</span>
          <div class="chip-row">
            <button
              v-for="opt in COLOR_SCHEME_OPTIONS" :key="opt.key"
              :class="['chip', { active: appearance.colorSchemeKey === opt.key }]"
              @click="appearance.setColorScheme(opt.key)"
            >
              <span class="swatch" :style="{ background: opt.key === 'default' ? '#00ff88' : opt.key === 'colorblind' ? '#00ff88' : '#ff4444' }" />
              <span class="swatch" :style="{ background: opt.key === 'default' ? '#ff4444' : opt.key === 'colorblind' ? '#3b82f6' : '#00ff88' }" />
              {{ opt.label }}
            </button>
          </div>
        </div>

        <div class="setting-row">
          <span class="setting-label">Price chart <em>(line or candles, with buy, sell, and prediction marks)</em></span>
          <div class="chip-row">
            <button
              v-for="opt in CHART_STYLE_OPTIONS" :key="opt.key"
              :class="['chip', { active: appearance.chartStyle === opt.key }]"
              @click="appearance.setChartStyle(opt.key)"
            >{{ opt.label }}</button>
          </div>
        </div>

        <div class="setting-row">
          <span class="setting-label">Clock timezone</span>
          <select
            class="tz-select"
            :value="appearance.timezone"
            @change="appearance.setTimezone(($event.target as HTMLSelectElement).value as TimezoneKey)"
          >
            <option v-for="opt in TIMEZONE_OPTIONS" :key="opt.key" :value="opt.key">{{ opt.label }}</option>
          </select>
        </div>
      </div>
    </UICard>

    <UICard title="Security" padding="tight">
      <p class="muted">2FA, session keys, withdrawal whitelist — coming soon.</p>
    </UICard>

    <UICard title="About" padding="tight">
      <p class="muted">Strades · v0.2 · <NuxtLink to="/about">Read the vision →</NuxtLink></p>
    </UICard>
  </div>
</template>

<style scoped>
.settings-page { display: flex; flex-direction: column; gap: 0.75rem; max-width: 760px; margin: 0 auto; }

.api-row {
  display: grid;
  grid-template-columns: 100px 1fr 1fr auto;
  gap: 0.4rem;
  align-items: center;
  padding: 0.4rem 0;
  border-bottom: 1px solid rgba(255,255,255,0.04);
}
.api-row:last-of-type { border-bottom: none; }
.api-row strong { font-size: 0.85rem; }

input {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  color: #fff;
  padding: 0.4rem 0.55rem;
  border-radius: 5px;
  font-size: 0.8rem;
}
input:focus { outline: none; border-color: var(--primary-green, #00ff88); }

.muted { color: rgba(255,255,255,0.55); font-size: 0.8rem; margin: 0; }
.muted a { color: var(--primary-green, #00ff88); }

.appearance-grid { display: flex; flex-direction: column; gap: 0.85rem; }
.setting-row { display: flex; flex-direction: column; gap: 0.35rem; }
.setting-label { font-size: 0.75rem; font-weight: 700; color: rgba(255,255,255,0.75); }
.setting-label em { font-style: normal; font-weight: 400; color: rgba(255,255,255,0.4); }

.chip-row { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.chip {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.75);
  padding: 0.35rem 0.7rem;
  border-radius: 999px;
  font-size: 0.75rem;
  cursor: pointer;
  font-family: inherit;
}
.chip:hover { border-color: rgba(255,255,255,0.25); color: #fff; }
.chip.active {
  background: rgba(0,255,136,0.12);
  border-color: var(--primary-green, #00ff88);
  color: var(--primary-green, #00ff88);
}
.swatch { width: 9px; height: 9px; border-radius: 50%; display: inline-block; }

.tz-select {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.1);
  color: #fff;
  padding: 0.4rem 0.6rem;
  border-radius: 6px;
  font-size: 0.78rem;
  font-family: inherit;
  max-width: 220px;
}
.tz-select:focus { outline: none; border-color: var(--primary-green, #00ff88); }

button { font-family: inherit; font-size: 0.72rem; letter-spacing: 0.06em; text-transform: uppercase; cursor: pointer; padding: 0.4rem 0.85rem; border-radius: 5px; }
.ghost { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); color: rgba(255,255,255,0.85); }
.ghost.danger:hover { color: var(--error-red, #ff4444); border-color: var(--error-red, #ff4444); }
.ghost:hover { color: #fff; }
.primary { background: var(--primary-gradient); color: #000; border: none; font-weight: 700; }
.primary:hover { transform: translateY(-1px); }
</style>
