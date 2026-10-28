<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useProfileFaceStore } from '@/stores/profileFace'
import { useTradingPrefsStore } from '~/stores/tradingPrefs'
import { TradingApiError, useTradingApi } from '~/composables/useTradingApi'
import UIPageHeader from '@/components/UI/PageHeader.vue'
import UICard from '@/components/UI/Card.vue'
import UIPill from '@/components/UI/Pill.vue'
import {
  useAppearanceStore, TIMEZONE_LABELS,
  type FontScaleKey, type ChromeFontKey, type MarketDataFontKey, type ColorSchemeKey, type ChartStyleKey, type TimezoneKey
} from '~/stores/appearance'
import { CURRENCY_CHOICES } from '~/utils/supplyDesk'

definePageMeta({ title: 'Settings', description: 'Account, security, preferences.', layout: 'default' })

const appearance = useAppearanceStore()
appearance.hydrate()

const auth = useAuth()
const face = useProfileFaceStore()
const paidDesk = computed(() => auth.user.value?.role === 'premium' || auth.user.value?.role === 'admin')
onMounted(() => face.hydrate())
function onPicture(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) face.setAvatar(file)
}
const signingOut = ref(false)
async function signOut() {
  signingOut.value = true
  try { await auth.logout() } finally { signingOut.value = false }
}

const claimEmail = ref('')
const claimPw = ref('')
const claiming = ref(false)
const claimError = ref('')
const claimed = ref(false)
async function claim() {
  claiming.value = true
  claimError.value = ''
  try {
    await $fetch('/api/auth/claim-demo/', {
      baseURL: useRuntimeConfig().public.apiBase as string, method: 'POST',
      headers: { Authorization: `Bearer ${auth.accessToken.value}` },
      body: { email: claimEmail.value.trim(), password: claimPw.value },
    })
    claimPw.value = ''
    claimed.value = true
    await auth.fetchUser()
  } catch (e: unknown) {
    const d = (e as { data?: Record<string, unknown> }).data ?? {}
    claimError.value = String(d.detail ?? Object.values(d).flat().join(' ') ?? '') || 'Could not save the account.'
  } finally {
    claiming.value = false
  }
}

const prefs = useTradingPrefsStore()
onMounted(() => prefs.hydrate())

const tradingApi = useTradingApi()
// Never for demo visitors: reset acts on EVERY user's bots in the shared session.
const showDevTools = computed(() => import.meta.dev || auth.user.value?.role === 'admin')
const devBusy = ref(false)
const devResult = ref('')
async function dev(fn: () => Promise<unknown>, label: string) {
  devBusy.value = true
  devResult.value = ''
  try {
    devResult.value = `${label}: ${JSON.stringify(await fn(), null, 2)}`
  } catch (e) {
    devResult.value = e instanceof TradingApiError ? `Refused (${e.status}): ${e.message}` : 'Request failed'
  } finally {
    devBusy.value = false
  }
}

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

    <!-- Account: who you are, and the only Sign out control in the app (crawl 2026-10-08 found none). -->
    <UICard title="Account">
      <div class="acct">
        <div>
          <div class="acct-email">{{ auth.user.value?.email ?? 'Signed in' }}</div>
          <div class="acct-meta">
            {{ auth.user.value?.is_demo ? 'Demo account: paper money, deleted 24 h after it was created' : 'Paper trading account' }}
          </div>
        </div>
        <button class="btn danger" :disabled="signingOut" @click="signOut">{{ signingOut ? 'Signing out…' : 'Sign out' }}</button>
      </div>
      <!-- Demo → real account: keeps wallets, bots and strategies (POST /api/auth/claim-demo/). -->
      <form v-if="auth.user.value?.is_demo && !claimed" class="claim" @submit.prevent="claim">
        <b>Keep this account</b>
        <span class="acct-meta">Add an email and password. Everything you built here (wallets, bots, strategies) stays, and the account is no longer deleted after 24 h.</span>
        <div class="claim-row">
          <input v-model="claimEmail" type="email" placeholder="Email" autocomplete="email" required />
          <input v-model="claimPw" type="password" placeholder="Password (min 8)" autocomplete="new-password" minlength="8" required />
          <button class="btn" :disabled="claiming">{{ claiming ? 'Saving…' : 'Keep account' }}</button>
        </div>
        <span v-if="claimError" class="claim-err">{{ claimError }}</span>
      </form>
      <p v-if="claimed" class="acct-meta">Done: this is now a permanent account. Sign in with {{ claimEmail }} from now on.</p>
    </UICard>

    <div id="identity">
      <UICard title="Profile">
        <div class="prefs">
          <label>Name on the desk
            <input
              type="text"
              :value="face.displayName"
              placeholder="Display name"
              @change="face.setDisplayName(($event.target as HTMLInputElement).value)"
            />
            <small>Opens from the portrait on your profile. Leave it empty to keep the current name.</small>
          </label>
          <label>@ name
            <input
              type="text"
              :value="face.handle"
              placeholder="handle"
              @change="face.setHandle(($event.target as HTMLInputElement).value)"
            />
          </label>
          <label>Picture
            <input type="file" accept="image/*" @change="onPicture" />
            <small>Stored in this browser. 1.5 MB maximum.</small>
          </label>
          <label class="row">
            <input
              type="checkbox"
              :checked="paidDesk && face.hideRealName"
              :disabled="!paidDesk"
              @change="paidDesk && face.setHideRealName(($event.target as HTMLInputElement).checked)"
            />
            Publish the @ name and hide the real name
          </label>
          <small v-if="!paidDesk">A paid desk can publish only the @ name.</small>
          <button v-if="face.avatarDataUrl" class="btn ghost" type="button" @click="face.clearAvatar()">Remove picture</button>
          <span v-if="face.note" class="claim-err">{{ face.note }}</span>
        </div>
      </UICard>
    </div>

    <!-- Trading: defaults the trade forms start from. -->
    <UICard title="Trading">
      <template #action><UIPill tone="info">Paper trading</UIPill></template>
      <div class="prefs">
        <label>Default bot capital (USD)
          <input type="number" min="10" step="any" inputmode="decimal" :value="prefs.defaultCapital"
            @change="prefs.update({ defaultCapital: Number(($event.target as HTMLInputElement).value) })" />
          <small>Pre-filled when you launch a bot or run a strategy on a wallet.</small>
        </label>
        <label>Default re-weight period
          <select :value="prefs.defaultPeriodS" @change="prefs.update({ defaultPeriodS: Number(($event.target as HTMLSelectElement).value) })">
            <option :value="900">15 min</option><option :value="3600">1 hour</option>
            <option :value="14400">4 hours</option><option :value="86400">1 day</option>
          </select>
          <small>How often a behaviour bot re-balances its mix from what made money.</small>
        </label>
        <label>Backtest length (bars)
          <input type="number" min="50" max="1000" step="1" :value="prefs.backtestBars"
            @change="prefs.update({ backtestBars: Number(($event.target as HTMLInputElement).value) })" />
          <small>History replayed by "Backtest on real prices" (50–1000 bars at the strategy's timeframe; the newest, still-open bar is never used).</small>
        </label>
        <label class="row">
          <input type="checkbox" :checked="prefs.hideSimulated" @change="prefs.update({ hideSimulated: ($event.target as HTMLInputElement).checked })" />
          Hide simulated assets on Prices (show only markets with a live quote)
        </label>
        <button class="btn ghost" @click="prefs.reset()">Restore defaults</button>
      </div>
    </UICard>

    <!-- Developer tools: the replay/roll/reset processes had API endpoints but no control (PROCESSES.md §A6). -->
    <UICard v-if="showDevTools" title="Developer tools">
      <template #action><UIPill tone="warning" show-dot>Developers and admins only</UIPill></template>
      <p class="dev-note">Drive the shared replay clock that paper bots trade on. The server refuses these outside DEBUG or for non-staff accounts.</p>
      <div class="dev-actions">
        <button class="btn" :disabled="devBusy" @click="dev(() => tradingApi.stepReplay(24), 'Replayed')">Replay +24 bars</button>
        <button class="btn" :disabled="devBusy" @click="dev(() => tradingApi.stepReplay(200), 'Replayed')">Replay +200 bars</button>
        <button class="btn" :disabled="devBusy" @click="dev(() => tradingApi.rollWindow(), 'Window rolled')">Roll window to latest candles</button>
        <button class="btn danger" :disabled="devBusy" @click="dev(() => tradingApi.resetBots(), 'Reset')">Reset ALL users' bots (returns their funds)</button>
      </div>
      <pre v-if="devResult" class="dev-result">{{ devResult }}</pre>
    </UICard>

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
          <span class="setting-label">Display currency <em>(supply-chain capitals)</em></span>
          <div class="chip-row">
            <button
              v-for="code in CURRENCY_CHOICES" :key="code"
              type="button"
              :class="['chip', { active: appearance.displayCurrency === code }]"
              @click="appearance.setDisplayCurrency(code)"
            >{{ code }}</button>
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
.acct { display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap; }
.acct-email { font-weight: 600; }
.claim { display: flex; flex-direction: column; gap: .35rem; margin-top: .9rem; padding-top: .8rem; border-top: 1px solid var(--border-primary); }
.claim-row { display: flex; gap: .5rem; flex-wrap: wrap; }
.claim-row input { padding: .5rem .6rem; border-radius: 6px; border: 1px solid var(--border-primary); background: var(--surface-sunken, transparent); color: var(--text-primary); font: inherit; }
.claim-err { color: var(--app-color-down, #ff4444); font-size: .8rem; }
.acct-meta { font-size: .8rem; color: var(--text-secondary); }
.prefs { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: .9rem; align-items: start; }
.prefs label { display: flex; flex-direction: column; gap: .3rem; font-size: .85rem; }
.prefs label.row { flex-direction: row; align-items: center; gap: .5rem; grid-column: 1 / -1; }
.prefs input[type=number], .prefs input[type=text], .prefs input[type=file], .prefs select { padding: .5rem .6rem; border-radius: 6px; border: 1px solid var(--border-primary); background: var(--surface-sunken, transparent); color: var(--text-primary); font: inherit; }
.prefs small { color: var(--text-secondary); font-size: .72rem; }
.btn { padding: .5rem .9rem; border-radius: 8px; border: 1px solid var(--border-primary); background: var(--surface-raised, transparent); color: var(--text-primary); cursor: pointer; font: inherit; }
.btn.ghost { background: transparent; justify-self: start; }
.btn.danger { border-color: var(--app-color-down, #ff4444); color: var(--app-color-down, #ff4444); background: transparent; }
.btn:disabled { opacity: .5; cursor: not-allowed; }
.dev-note { margin: 0 0 .6rem; font-size: .8rem; color: var(--text-secondary); }
.dev-actions { display: flex; gap: .5rem; flex-wrap: wrap; }
.dev-result { margin: .7rem 0 0; padding: .6rem; border-radius: 6px; background: var(--surface-sunken, rgba(0,0,0,.2)); font-size: .72rem; white-space: pre-wrap; max-height: 220px; overflow: auto; }
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
