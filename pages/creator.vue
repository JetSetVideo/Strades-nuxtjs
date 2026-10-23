<script setup lang="ts">
import { ref, computed, onMounted, watch, reactive } from 'vue'
import { allowsValue, cycleKey, type FilterTriState } from '~/utils/priceFilters'
import { useStrategies } from '@/composables/useStrategies'
import SelectorDatasources from '@/components/Selector/Datasources.vue'
import SelectorAsset from '@/components/Selector/Asset.vue'
import BuilderCondition from '@/components/Builder/Condition.vue'
import BuilderAction from '@/components/Builder/Action.vue'
import StrategyVisualizer from '@/components/Creator/StrategyFlow.vue'
import StrategyCodeView from '@/components/Strategy/CodeView.vue'
import StrategyRating from '@/components/Strategy/Rating.vue'
import FrequencySelector from '@/components/Creator/FrequencySelector.vue'
import AllocationWheel from '@/components/Creator/AllocationWheel.vue'
import StrategyBlueprint from '@/components/Creator/Blueprint.vue'
import BuilderFormula from '@/components/Builder/Formula.vue'
import {
  SECTION_TONE, sourceBasis, strategyParameters, suggestFromProfile, wheelModel, patchFromParameters,
  CLASS_META, assetClass, type PoolMember, type BlockType,
} from '~/utils/strategyDraft'
import { useAllocationStore } from '~/stores/allocation'
import CountdownModal from '@/components/Overlay/CountdownModal.vue'
import AvatarCard from '@/components/Card/Avatar.vue'
import StrategySwarmPlugs from '@/components/Strategy/SwarmPlugs.vue'
import { useOpinionsStore } from '@/stores/opinions'
import { useCreditsStore } from '@/stores/credits'
import { useBacktest } from '@/composables/useBacktest'
import { TradingApiError, useTradingApi, type RealBacktest } from '@/composables/useTradingApi'
import { toServerStrategy, type CreatorCondition } from '@/utils/strategyServer'
import { useTradingPrefsStore } from '~/stores/tradingPrefs'

definePageMeta({
  title: 'Strategy Creator',
  description: 'Build multi-asset capital allocation strategies powered by AI avatars & real data.',
  layout: 'creator',
})

// ── Layout shared state ──────────────────────────────────────────────────────
const layoutTitle   = useState<string>('creator:title',  () => '')
const layoutStatus  = useState<string>('creator:status', () => 'draft')
const layoutSaving  = useState<'idle' | 'saving' | 'saved' | 'error'>('creator:saving', () => 'idle')

// ── Composables ───────────────────────────────────────────────────────────────
const { createStrategy, backtestStrategy, deployStrategy, backtestAndDeploy } = useStrategies()

// ── Strategy model ────────────────────────────────────────────────────────────
const strategy = ref({
  name: '',
  description: '',
  category: 'multi-asset',
  dataSources: [] as string[],
  assetFrom: '',
  assetTo: '',
  allocation: 50,          // % of portfolio to shift
  pool: [] as PoolMember[],
  frequency: '1D',
  variables: [] as { key: string; value: string }[],
  blocks: [] as { type: BlockType; id: number; data: Record<string, unknown> }[],
  selectedProfiles: [] as string[],
  period: { start: null as string | null, end: null as string | null },
})

const profiles = ref<{ id: string; name: string; avatar_url?: string }[]>([])

const opinionsStore = useOpinionsStore()
const backtestEngine = useBacktest()
function onSwarmChange() {
  // Swarm plugs changed — opinionsStore already recomputed
}

onMounted(async () => {
  creditsStore.hydrate()
  try { profiles.value = await $fetch('/data/strategies/profiles.json') } catch { /* ok */ }
})

// Sync strategy name with layout header
watch(() => strategy.value.name, n => { layoutTitle.value = n })

// ── Section-level inline searches ─────────────────────────────────────────
const dsSearch      = ref('')
const profileSearch = ref('')
const logicSearch   = ref('')
const blockStates = reactive<Record<string, FilterTriState>>({})
const BLOCK_OPTIONS = [
  { id: 'condition', label: 'IF' },
  { id: 'formula', label: 'Math' },
  { id: 'action', label: 'Exchange' },
]

// ── Date range presets ─────────────────────────────────────────────────────
const DATE_PRESETS = [
  { label: '7 days',  days: 7 },
  { label: '30 days', days: 30 },
  { label: '3 months', days: 90 },
  { label: '6 months', days: 180 },
  { label: '1 year',  days: 365 },
  { label: '2 years', days: 730 },
]

function applyPreset(days: number) {
  const end   = new Date()
  const start = new Date(end.getTime() - days * 86400000)
  strategy.value.period.end   = end.toISOString().slice(0, 10)
  strategy.value.period.start = start.toISOString().slice(0, 10)
}

function isActivePreset(days: number): boolean {
  if (!strategy.value.period.start || !strategy.value.period.end) return false
  const diff = Math.round(
    (new Date(strategy.value.period.end).getTime() - new Date(strategy.value.period.start).getTime()) / 86400000
  )
  return Math.abs(diff - days) <= 1
}

// ── Asset catalogue (mirrored from Selector/Asset for mini-card display) ──
const ASSET_INFO: Record<string, { label: string; symbol: string; cat: string; color: string }> = {
  BTC:     { label: 'Bitcoin',     symbol: 'BTC',      cat: 'crypto',      color: '#f7931a' },
  ETH:     { label: 'Ethereum',    symbol: 'ETH',      cat: 'crypto',      color: '#627eea' },
  SOL:     { label: 'Solana',      symbol: 'SOL',      cat: 'crypto',      color: '#9945ff' },
  BNB:     { label: 'BNB',         symbol: 'BNB',      cat: 'crypto',      color: '#f3ba2f' },
  ADA:     { label: 'Cardano',     symbol: 'ADA',      cat: 'crypto',      color: '#0033ad' },
  DOGE:    { label: 'Dogecoin',    symbol: 'DOGE',     cat: 'crypto',      color: '#c2a633' },
  AAPL:    { label: 'Apple',       symbol: 'AAPL',     cat: 'stocks',      color: '#555' },
  TSLA:    { label: 'Tesla',       symbol: 'TSLA',     cat: 'stocks',      color: '#cc0000' },
  NVDA:    { label: 'NVIDIA',      symbol: 'NVDA',     cat: 'stocks',      color: '#76b900' },
  MSFT:    { label: 'Microsoft',   symbol: 'MSFT',     cat: 'stocks',      color: '#00a4ef' },
  AMZN:    { label: 'Amazon',      symbol: 'AMZN',     cat: 'stocks',      color: '#ff9900' },
  GOOGL:   { label: 'Alphabet',    symbol: 'GOOGL',    cat: 'stocks',      color: '#4285f4' },
  SPY:     { label: 'S&P 500 ETF', symbol: 'SPY',      cat: 'stocks',      color: '#1565c0' },
  'EUR/USD':{ label: 'Euro/USD',   symbol: 'EUR/USD',  cat: 'forex',       color: '#0052b4' },
  'GBP/USD':{ label: 'GBP/USD',   symbol: 'GBP/USD',  cat: 'forex',       color: '#00247d' },
  'USD/JPY':{ label: 'USD/JPY',   symbol: 'USD/JPY',  cat: 'forex',       color: '#bc002d' },
  XAU:     { label: 'Gold',        symbol: 'XAU/USD',  cat: 'commodities', color: '#ffd700' },
  XAG:     { label: 'Silver',      symbol: 'XAG/USD',  cat: 'commodities', color: '#c0c0c0' },
  WTI:     { label: 'Crude Oil',   symbol: 'WTI',      cat: 'commodities', color: '#704214' },
  USD:     { label: 'US Dollar',   symbol: 'USD',      cat: 'fiat',        color: '#4caf50' },
  EUR:     { label: 'Euro',        symbol: 'EUR',      cat: 'fiat',        color: '#0052b4' },
  USDT:    { label: 'Tether',      symbol: 'USDT',     cat: 'fiat',        color: '#26a17b' },
}

function assetInfo(id: string) { return ASSET_INFO[id] }

const filteredBlocks = computed(() => {
  let list = strategy.value.blocks
  list = list.filter(b => allowsValue(b.type, blockStates))
  if (logicSearch.value.trim()) {
    const q = logicSearch.value.toLowerCase()
    list = list.filter(b => {
      const data = b.data as Record<string, unknown>
      return Object.values(data).some(v => String(v).toLowerCase().includes(q))
    })
  }
  return list
})

const filteredProfiles = computed(() => {
  if (!profileSearch.value.trim()) return profiles.value
  const q = profileSearch.value.toLowerCase()
  return profiles.value.filter(p => p.name?.toLowerCase().includes(q) || p.id.toLowerCase().includes(q))
})

// ── Credits & validation ──────────────────────────────────────────────────────
// Same house-credit bankroll as the Arena / Quests / Leaderboard (was a hard-coded 1000).
const creditsStore = useCreditsStore()
const credit = computed(() => creditsStore.balance)

const neededCredit = computed(() => {
  const blocksCost   = strategy.value.blocks.length * 100
  const profilesCost = strategy.value.selectedProfiles.length * 50
  const sourcesCost  = strategy.value.dataSources.length * 20
  return blocksCost + profilesCost + sourcesCost
})

const hasEnoughCredit = computed(() => credit.value >= neededCredit.value)
const includedAssets = computed(() => strategy.value.pool.filter(p => p.op === 'include'))
const isValid = computed(() =>
  strategy.value.name.trim() !== '' &&
  (strategy.value.assetFrom !== '' || includedAssets.value.length > 0) &&
  strategy.value.dataSources.length > 0
)

// ── Computed risk score (0-10) ────────────────────────────────────────────────
const riskScore = computed(() => {
  const freqRisk: Record<string, number> = {
    '1m': 9, '5m': 8, '15m': 7, '1h': 6, '4h': 5, '1D': 4, '1W': 2, '1M': 1,
  }
  const baseFreq = freqRisk[strategy.value.frequency] ?? 4
  const blockRisk = Math.min(3, strategy.value.blocks.length * 0.3)
  const allocRisk = (strategy.value.allocation / 100) * 2
  return Math.min(10, Math.round(baseFreq + blockRisk + allocRisk))
})

const complexityRating = computed(() => {
  const c = strategy.value.dataSources.length + strategy.value.blocks.length + strategy.value.selectedProfiles.length
  return `${Math.min(10, c)}/10`
})

// ── Blocks ────────────────────────────────────────────────────────────────────
function addBlock(type: BlockType) {
  const data = type === 'formula' ? { op: 'if', left: '', right: '', into: '' } : {}
  strategy.value.blocks.push({ type, id: Date.now(), data })
}

function cyclePool(id: string) {
  const pool = strategy.value.pool
  const idx = pool.findIndex(p => p.id === id)
  if (idx < 0) pool.push({ id, op: 'include' })
  else if (pool[idx].op === 'include') pool[idx].op = 'exclude'
  else pool.splice(idx, 1)
  const member = strategy.value.pool.find(p => p.id === id)
  if (member?.op === 'include') {
    if (!strategy.value.assetFrom) strategy.value.assetFrom = id
    else if (!strategy.value.assetTo && id !== strategy.value.assetFrom) strategy.value.assetTo = id
  }
  if (!member || member.op === 'exclude') {
    if (strategy.value.assetFrom === id) strategy.value.assetFrom = includedAssets.value.find(p => p.id !== id)?.id ?? ''
    if (strategy.value.assetTo === id) strategy.value.assetTo = ''
  }
}

function poolState(id: string) {
  return strategy.value.pool.find(p => p.id === id)?.op ?? 'off'
}

function updateBlock(id: number, data: Record<string, unknown>) {
  const b = strategy.value.blocks.find(x => x.id === id)
  if (b) b.data = data
}

function removeBlock(id: number) {
  strategy.value.blocks = strategy.value.blocks.filter(x => x.id !== id)
}

// ── Variables ─────────────────────────────────────────────────────────────────
const addVariable    = () => strategy.value.variables.push({ key: '', value: '' })
const removeVariable = (i: number) => strategy.value.variables.splice(i, 1)

// ── Profiles ──────────────────────────────────────────────────────────────────
function toggleProfile(id: string) {
  const idx = strategy.value.selectedProfiles.indexOf(id)
  if (idx > -1) strategy.value.selectedProfiles.splice(idx, 1)
  else strategy.value.selectedProfiles.push(id)
}

// ── Sections UI ──────────────────────────────────────────────────────────────
const activeSection = ref<string | null>(null)
const sections = [
  { id: 'identity',   label: 'Identity',     icon: '✎', tone: SECTION_TONE.identity },
  { id: 'assets',     label: 'Asset Flow',   icon: '↔', tone: SECTION_TONE.assets },
  { id: 'sources',    label: 'Sources',      icon: '◎', tone: SECTION_TONE.sources },
  { id: 'logic',      label: 'Logic',        icon: 'ƒ', tone: SECTION_TONE.logic },
  { id: 'avatars',    label: 'Avatars',      icon: '◈', tone: SECTION_TONE.avatars },
  { id: 'swarm',      label: 'Swarm',        icon: '✶', tone: SECTION_TONE.swarm },
  { id: 'variables',  label: 'Variables',    icon: '𝑥', tone: SECTION_TONE.variables },
  { id: 'preview',    label: 'Preview',      icon: '▤', tone: SECTION_TONE.preview },
]

const viewMode = ref<'card' | 'blueprint' | 'json'>('card')
const allocationStore = useAllocationStore()
const sourceBases = computed(() => strategy.value.dataSources.map(id => sourceBasis({ id })))
const parameters = computed(() => strategyParameters({ ...strategy.value }, sourceBases.value))
const wheel = computed(() => wheelModel({
  pool: strategy.value.pool,
  assetFrom: strategy.value.assetFrom,
  assetTo: strategy.value.assetTo,
  allocation: strategy.value.allocation,
  wallet: strategy.value.pool.some(p => p.op === 'include') ? null : allocationStore.allocationPie,
  blocks: strategy.value.blocks,
  sourceBases: sourceBases.value,
  frequency: strategy.value.frequency,
}))
const namedSources = computed(() => strategy.value.dataSources.map(id => ({ id, basis: sourceBasis({ id }) })))
const jsonFocused = ref(false)
const jsonDraft = ref('')
const jsonError = ref('')
watch(parameters, (value) => {
  if (jsonFocused.value) return
  jsonDraft.value = JSON.stringify(value, null, 2)
}, { immediate: true })

function onJsonInput(text: string) {
  jsonDraft.value = text
  let parsed: unknown
  try { parsed = JSON.parse(text) }
  catch { jsonError.value = 'JSON is not valid yet.'; return }
  const patch = patchFromParameters(parsed)
  if (!patch) { jsonError.value = 'Expected an object of strategy parameters.'; return }
  jsonError.value = ''
  Object.assign(strategy.value, patch)
}

function showCard(section?: string) {
  viewMode.value = 'card'
  if (section) activeSection.value = section
}

function fillFromProfile() {
  const draft = suggestFromProfile({
    pie: allocationStore.allocationPie,
    swarm: opinionsStore.swarmVector,
    periodS: tradingPrefs.defaultPeriodS,
    bars: tradingPrefs.backtestBars,
  })
  Object.assign(strategy.value, draft)
  viewMode.value = 'card'
  activeSection.value = 'assets'
}

const toggleSection = (id: string) =>
  (activeSection.value = activeSection.value === id ? null : id)

// ── Code payload ──────────────────────────────────────────────────────────────
function buildCodePayload() {
  const vars = strategy.value.variables.reduce(
    (acc, v) => ({ ...acc, [v.key]: v.value }), {} as Record<string, string>
  )
  return {
    assets:     { from: strategy.value.assetFrom, to: strategy.value.assetTo, allocation: strategy.value.allocation },
    period:     { start: strategy.value.period.start ?? new Date().toISOString().slice(0, 10), end: strategy.value.period.end ?? new Date().toISOString().slice(0, 10) },
    frequency:  strategy.value.frequency,
    dataSources: strategy.value.dataSources,
    conditions: strategy.value.blocks.filter(b => b.type === 'condition').map(b => b.data),
    actions:    strategy.value.blocks.filter(b => b.type === 'action').map(b => b.data),
    formulas:   strategy.value.blocks.filter(b => b.type === 'formula').map(b => b.data),
    pool:       strategy.value.pool,
    mix:        parameters.value.mix,
    variables:  vars,
    profiles:   strategy.value.selectedProfiles,
    rights:     { owners: ['current_user'], editors: [], viewers: [], is_public: false },
  }
}

// ── Action handlers ───────────────────────────────────────────────────────────
const showCountdown = ref(false)
const pendingId     = ref<string | null>(null)
const pendingAction = ref<'backtest' | 'both'>('backtest')
const actionError   = ref<string | null>(null)
const pendingServerId = ref<string | null>(null)
const serverNotes   = ref<string[]>([])
const tradingApi    = useTradingApi()
const tradingPrefs  = useTradingPrefsStore()
tradingPrefs.hydrate()
// Real-history backtests, keyed by strategy id (shown on /strategy/<id>).
const realBacktests = useState<Record<string, RealBacktest>>('backtest:real', () => ({}))
const saveSuccess   = ref(false)

function guard() {
  if (!isValid.value) {
    actionError.value = 'Name the strategy, include at least one asset, and pick a data source.'
    return false
  }
  if (!hasEnoughCredit.value) {
    actionError.value = 'Not enough credits. Reduce blocks or data sources.'
    return false
  }
  actionError.value = null
  return true
}

/** Save to the backend rules engine so the backtest runs on REAL prices; null if signed out. */
async function saveToServer(): Promise<string | null> {
  const mapped = toServerStrategy({
    name: strategy.value.name,
    description: strategy.value.description,
    category: strategy.value.category,
    assetFrom: strategy.value.assetFrom,
    assetTo: strategy.value.assetTo,
    frequency: strategy.value.frequency,
    allocation: strategy.value.allocation,
    variables: strategy.value.variables,
    conditions: strategy.value.blocks.filter(b => b.type === 'condition').map(b => b.data as unknown as CreatorCondition),
  })
  if (!mapped.ok) throw new Error(mapped.errors.join(' '))
  serverNotes.value = mapped.notes
  try {
    const saved = await tradingApi.saveStrategy(mapped.payload)
    return saved.id
  } catch (e) {
    if (e instanceof TradingApiError && e.status === 401) return null // signed out → simulated backtest only
    throw e
  }
}

async function handleBacktest() {
  if (!guard()) return
  try {
    const serverId = await saveToServer()
    pendingServerId.value = serverId
    const s = await createStrategy({
      ...(serverId ? { id: serverId } : {}),
      name: strategy.value.name,
      description: strategy.value.description,
      category: strategy.value.category,
      targetAssets: [strategy.value.assetFrom],
      code: buildCodePayload(),
    })
    pendingId.value = s.id
    pendingAction.value = 'backtest'
    showCountdown.value = true
  } catch (e) {
    actionError.value = e instanceof Error && e.message ? e.message : 'Failed to create strategy.'
  }
}

async function handleDeploy() {
  if (!guard()) return
  try {
    const s = await createStrategy({
      name: strategy.value.name,
      description: strategy.value.description,
      category: strategy.value.category,
      targetAssets: [strategy.value.assetFrom],
      code: buildCodePayload(),
    })
    await deployStrategy(s.id)
    navigateTo(`/strategy/${s.id}`)
  } catch (e) { actionError.value = 'Failed to deploy strategy.' }
}

async function handleBacktestAndDeploy() {
  if (!guard()) return
  try {
    const s = await createStrategy({
      name: strategy.value.name,
      description: strategy.value.description,
      category: strategy.value.category,
      targetAssets: [strategy.value.assetFrom],
      code: buildCodePayload(),
    })
    pendingId.value = s.id
    pendingAction.value = 'both'
    showCountdown.value = true
  } catch (e) { actionError.value = 'Failed to create strategy.' }
}

async function handleSaveDraft() {
  if (!strategy.value.name.trim()) {
    actionError.value = 'Give your strategy a name before saving.'
    return
  }
  actionError.value = null
  layoutSaving.value = 'saving'
  try {
    const s = await createStrategy({
      name: strategy.value.name,
      description: strategy.value.description,
      category: strategy.value.category,
      targetAssets: [strategy.value.assetFrom].filter(Boolean),
      code: buildCodePayload(),
    })
    layoutStatus.value = 'saved'
    layoutSaving.value = 'saved'
    saveSuccess.value = true
    setTimeout(() => {
      layoutSaving.value = 'idle'
      saveSuccess.value = false
    }, 2500)
  } catch (e) {
    layoutSaving.value = 'error'
    actionError.value = 'Failed to save strategy.'
    setTimeout(() => { layoutSaving.value = 'idle' }, 3000)
  }
}

async function onCountdownFinish() {
  if (!pendingId.value) return
  if (pendingAction.value === 'backtest') {
    // 1) Real prices: the backend rules engine replays pinned Binance candles.
    if (pendingServerId.value) {
      try {
        const real = await tradingApi.backtestReal(pendingServerId.value, { capital_usd: 10000, bars: tradingPrefs.backtestBars })
        realBacktests.value = { ...realBacktests.value, [pendingId.value]: real }
      } catch (e) {
        actionError.value = e instanceof Error ? `Real-price backtest failed: ${e.message}` : 'Real-price backtest failed.'
      }
    }
    // 2) Simulated paths (Monte Carlo on synthetic prices), kept as a separate, labelled view.
    const config = {
      id: pendingId.value,
      name: strategy.value.name || 'Untitled',
      conditions: strategy.value.blocks.filter(b => b.type === 'condition').map(b => ({
        datasource: 'price',
        asset: strategy.value.assetFrom || 'BTC',
        operator: (b.data as any)?.operator || '>',
        value: (b.data as any)?.value || 50000,
        timeframe: strategy.value.frequency || '1D',
      })),
      variables: {
        stop_loss_percent: Number((strategy.value.variables.find(v => v.key === 'stop_loss')?.value) || 5),
        take_profit_percent: Number((strategy.value.variables.find(v => v.key === 'take_profit')?.value) || 15),
        position_size: strategy.value.allocation || 10,
      },
      targetAssets: [strategy.value.assetFrom].filter(Boolean),
      initialCapital: 10000,
      frequency: strategy.value.frequency || '1D',
      period: {
        start: strategy.value.period.start || new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10),
        end: strategy.value.period.end || new Date().toISOString().slice(0, 10),
      },
      swarmVector: opinionsStore.swarmVector,
    }
    await backtestEngine.runBacktest(config, 250)
  } else {
    // backtestAndDeploy — run MC then deploy
    const config = {
      id: pendingId.value,
      name: strategy.value.name || 'Untitled',
      conditions: strategy.value.blocks.filter(b => b.type === 'condition').map(b => ({
        datasource: 'price',
        asset: strategy.value.assetFrom || 'BTC',
        operator: (b.data as any)?.operator || '>',
        value: (b.data as any)?.value || 50000,
        timeframe: strategy.value.frequency || '1D',
      })),
      variables: {
        stop_loss_percent: Number((strategy.value.variables.find(v => v.key === 'stop_loss')?.value) || 5),
        take_profit_percent: Number((strategy.value.variables.find(v => v.key === 'take_profit')?.value) || 15),
        position_size: strategy.value.allocation || 10,
      },
      targetAssets: [strategy.value.assetFrom].filter(Boolean),
      initialCapital: 10000,
      frequency: strategy.value.frequency || '1D',
      period: {
        start: strategy.value.period.start || new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10),
        end: strategy.value.period.end || new Date().toISOString().slice(0, 10),
      },
      swarmVector: opinionsStore.swarmVector,
    }
    await backtestEngine.runBacktest(config, 250)
    await deployStrategy(pendingId.value)
  }
  navigateTo({ path: `/strategy/${pendingId.value}`, query: { tab: 'backtest' } })
}
</script>

<template>
  <div class="creator-page">

    <!-- ── Page hero ──────────────────────────────────────────────────────── -->
    <div class="page-hero">
      <div class="hero-text">
        <h1 class="hero-title">Strategy Creator</h1>
        <p class="hero-sub">Design capital reallocation flows between any financial assets, driven by live data and AI avatars.</p>
        <button type="button" class="ai-fill" title="Fill every parameter from your profile" @click="fillFromProfile">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
            <path d="M12 3.2 13.4 8l4.6 1.2L13.4 10.4 12 15.2 10.6 10.4 6 9.2 10.6 8Z" />
            <path d="M18 14.5 18.7 16.8 19.9 17.5 18.7 18.2 18 20.5 17.3 18.2 16.1 17.5 17.3 16.8Z" />
          </svg>
          Fill from profile
        </button>
      </div>
      <!-- Credit widget -->
      <div class="credit-widget">
        <span class="credit-label">Credits</span>
        <span class="credit-val">{{ credit.toLocaleString(APP_LOCALE) }}</span>
        <div class="credit-bar">
          <div
            class="credit-fill"
            :style="{
              width: Math.min(100, (neededCredit / Math.max(1, credit)) * 100) + '%',
              background: hasEnoughCredit ? 'var(--success-green)' : 'var(--error-red)',
            }"
          />
        </div>
        <span class="credit-need" :class="{ over: !hasEnoughCredit }">–{{ neededCredit }} needed</span>
      </div>
    </div>

    <!-- ── Flow visualizer (sticky top) ─────────────────────────────────── -->
    <div class="visualizer-wrap">
      <StrategyVisualizer
        :blocks="strategy.blocks"
        :asset-from="strategy.assetFrom"
        :asset-to="strategy.assetTo"
        :frequency="strategy.frequency"
      />
    </div>

    <!-- ── Sections nav ───────────────────────────────────────────────────── -->
    <div class="view-switch" role="tablist" aria-label="Strategy representation">
      <button type="button" role="tab" :aria-selected="viewMode === 'card'" :class="{ on: viewMode === 'card' }" @click="viewMode = 'card'">Card</button>
      <button type="button" role="tab" :aria-selected="viewMode === 'blueprint'" :class="{ on: viewMode === 'blueprint' }" @click="viewMode = 'blueprint'">Blueprint</button>
      <button type="button" role="tab" :aria-selected="viewMode === 'json'" :class="{ on: viewMode === 'json' }" @click="viewMode = 'json'">JSON</button>
    </div>

    <StrategyBlueprint
      v-if="viewMode === 'blueprint'"
      :pool="strategy.pool"
      :asset-from="strategy.assetFrom"
      :asset-to="strategy.assetTo"
      :allocation="strategy.allocation"
      :blocks="strategy.blocks"
      :sources="namedSources"
      :frequency="strategy.frequency"
      @focus="showCard"
    />
    <div v-else-if="viewMode === 'json'" class="json-view">
      <p class="json-note">These are the same parameters the card and the blueprint use. Edit the JSON and the other views follow.</p>
      <textarea
        class="json-editor"
        :value="jsonDraft"
        spellcheck="false"
        @focus="jsonFocused = true"
        @blur="jsonFocused = false"
        @input="onJsonInput(($event.target as HTMLTextAreaElement).value)"
      />
      <p v-if="jsonError" class="json-error">{{ jsonError }}</p>
    </div>

    <div v-show="viewMode === 'card'" class="sections-nav">
      <button
        v-for="s in sections"
        :key="s.id"
        class="sec-nav-btn"
        :class="{ active: activeSection === s.id }"
        :style="{ '--tone': s.tone }"
        @click="toggleSection(s.id)"
      >
        <span class="sec-glyph">{{ s.icon }}</span>
        <span>{{ s.label }}</span>
      </button>
    </div>

    <!-- ── Form body ──────────────────────────────────────────────────────── -->
    <div v-show="viewMode === 'card'" class="form-body">

      <!-- IDENTITY -->
      <section class="form-section" :class="{ collapsed: activeSection !== null && activeSection !== 'identity' }" :style="{ '--tone': SECTION_TONE.identity }">
        <button class="section-toggle" @click="toggleSection('identity')">
          <span class="sec-icon">✎</span>
          <span class="sec-title">Identity</span>
          <span class="sec-status">{{ strategy.name || 'Unnamed strategy' }}</span>
          <span class="sec-chevron" :class="{ open: activeSection === 'identity' }">▾</span>
        </button>
        <div v-show="activeSection === 'identity' || activeSection === null" class="section-body">
          <div class="field-group">
            <label class="field-label">Strategy Name *</label>
            <input
              v-model="strategy.name"
              class="strat-input"
              placeholder="e.g. BTC → ETH RSI Rebalancer"
              maxlength="60"
            />
          </div>
          <div class="field-group">
            <label class="field-label">Description</label>
            <textarea
              v-model="strategy.description"
              class="strat-input strat-textarea"
              placeholder="Describe the logic and goal of this strategy…"
              rows="3"
            />
          </div>
          <div class="field-group">
            <label class="field-label">Category</label>
            <div class="chip-row">
              <button
                v-for="cat in ['crypto', 'stocks', 'forex', 'commodities', 'multi-asset']"
                :key="cat"
                type="button"
                class="chip"
                :class="{ active: strategy.category === cat }"
                @click="strategy.category = cat"
              >{{ cat }}</button>
            </div>
          </div>
        </div>
      </section>

      <!-- ASSETS + FREQUENCY + ALLOCATION -->
      <section class="form-section" :class="{ collapsed: activeSection !== null && activeSection !== 'assets' }" :style="{ '--tone': SECTION_TONE.assets }">
        <button class="section-toggle" @click="toggleSection('assets')">
          <span class="sec-icon">↔</span>
          <span class="sec-title">Asset Flow</span>
          <span class="sec-status">
            {{ strategy.assetFrom || '?' }} → {{ strategy.assetTo || '?' }}
            <span v-if="strategy.assetFrom && strategy.assetTo"> · {{ strategy.allocation }}%</span>
          </span>
          <span class="sec-chevron" :class="{ open: activeSection === 'assets' }">▾</span>
        </button>
        <div v-show="activeSection === 'assets' || activeSection === null" class="section-body">

          <!-- FROM / TO with mini-asset cards -->
          <div class="asset-flow-row">
            <!-- FROM slot -->
            <div class="asset-slot">
              <label class="field-label">Source (FROM)</label>
              <SelectorAsset v-model="strategy.assetFrom" label="Select source…" />
              <!-- Mini asset card when selected -->
              <div v-if="strategy.assetFrom && assetInfo(strategy.assetFrom)" class="asset-mini-card"
                :style="{ borderColor: assetInfo(strategy.assetFrom)!.color, background: assetInfo(strategy.assetFrom)!.color + '12' }">
                <span class="amc-dot" :style="{ background: assetInfo(strategy.assetFrom)!.color }" />
                <div class="amc-info">
                  <span class="amc-symbol" :style="{ color: assetInfo(strategy.assetFrom)!.color }">{{ assetInfo(strategy.assetFrom)!.symbol }}</span>
                  <span class="amc-label">{{ assetInfo(strategy.assetFrom)!.label }}</span>
                </div>
                <span class="amc-cat">{{ assetInfo(strategy.assetFrom)!.cat }}</span>
              </div>
            </div>

            <div class="flow-mid-col">
              <AllocationWheel
                :start="wheel.start"
                :end="wheel.end"
                :marks="wheel.marks"
                :allocation="strategy.allocation"
                :frequency="strategy.frequency"
              />
            </div>

            <!-- TO slot -->
            <div class="asset-slot">
              <label class="field-label">Target (TO)</label>
              <SelectorAsset v-model="strategy.assetTo" label="Select target…" />
              <div v-if="strategy.assetTo && assetInfo(strategy.assetTo)" class="asset-mini-card"
                :style="{ borderColor: assetInfo(strategy.assetTo)!.color, background: assetInfo(strategy.assetTo)!.color + '12' }">
                <span class="amc-dot" :style="{ background: assetInfo(strategy.assetTo)!.color }" />
                <div class="amc-info">
                  <span class="amc-symbol" :style="{ color: assetInfo(strategy.assetTo)!.color }">{{ assetInfo(strategy.assetTo)!.symbol }}</span>
                  <span class="amc-label">{{ assetInfo(strategy.assetTo)!.label }}</span>
                </div>
                <span class="amc-cat">{{ assetInfo(strategy.assetTo)!.cat }}</span>
              </div>
            </div>
          </div>

          <div class="field-group">
            <label class="field-label">Universe · click to include, again to exclude</label>
            <div class="pool-grid">
              <button
                v-for="(info, id) in ASSET_INFO"
                :key="id"
                type="button"
                class="pool-asset"
                :class="poolState(String(id))"
                :style="{ '--asset': info.color }"
                @click="cyclePool(String(id))"
              >
                <span class="pool-op">{{ poolState(String(id)) === 'include' ? '+' : poolState(String(id)) === 'exclude' ? '−' : '' }}</span>
                <span class="pool-sym">{{ info.symbol }}</span>
                <span class="pool-cat">{{ CLASS_META[assetClass(String(id))].label }}</span>
              </button>
            </div>
          </div>

          <!-- Allocation slider -->
          <div class="field-group">
            <label class="field-label">Capital to reallocate</label>
            <div class="alloc-row">
              <span class="alloc-anchor">1%</span>
              <input
                type="range"
                v-model.number="strategy.allocation"
                min="1" max="100" step="1"
                class="alloc-slider"
                :style="{
                  background: `linear-gradient(to right, var(--primary-green) ${strategy.allocation}%, rgba(255,255,255,0.1) ${strategy.allocation}%)`
                }"
              />
              <span class="alloc-anchor">100%</span>
              <span class="alloc-badge">{{ strategy.allocation }}%</span>
            </div>
          </div>

          <!-- Date range with presets -->
          <div class="field-group">
            <label class="field-label">Backtest period</label>

            <!-- Quick presets -->
            <div class="date-presets">
              <button
                v-for="p in DATE_PRESETS"
                :key="p.days"
                type="button"
                class="date-preset-chip"
                :class="{ active: isActivePreset(p.days) }"
                @click="applyPreset(p.days)"
              >{{ p.label }}</button>
            </div>

            <!-- Date inputs row -->
            <div class="date-row">
              <div class="date-input-wrap">
                <span class="date-input-label">START</span>
                <input
                  type="date"
                  v-model="strategy.period.start"
                  class="date-input-real"
                />
              </div>
              <div class="date-range-arrow">→</div>
              <div class="date-input-wrap">
                <span class="date-input-label">END</span>
                <input
                  type="date"
                  v-model="strategy.period.end"
                  class="date-input-real"
                />
              </div>
            </div>

            <!-- Period summary -->
            <div v-if="strategy.period.start && strategy.period.end && periodDays > 1" class="period-summary">
              <span class="period-days">{{ periodDays }} days</span>
              <span class="period-months">≈ {{ (periodDays / 30).toFixed(1) }} months of data</span>
            </div>
          </div>

          <!-- Frequency selector -->
          <div class="field-group">
            <FrequencySelector v-model="strategy.frequency" />
          </div>
        </div>
      </section>

      <!-- DATA SOURCES -->
      <section class="form-section" :class="{ collapsed: activeSection !== null && activeSection !== 'sources' }" :style="{ '--tone': SECTION_TONE.sources }">
        <!-- Fused header: toggle + count + inline search -->
        <div class="section-toggle-bar">
          <button class="toggle-trigger" @click="toggleSection('sources')">
            <span class="sec-icon">◎</span>
            <span class="sec-title">Data Sources *</span>
            <span class="sec-count-badge" :class="{ zero: !strategy.dataSources.length }">{{ strategy.dataSources.length }}</span>
            <span class="sec-chevron" :class="{ open: activeSection === 'sources' }">▾</span>
          </button>
          <!-- Inline search appears when section is open -->
          <div
            v-show="activeSection === 'sources'"
            class="toggle-inline-search"
            @click.stop
          >
            <span class="tis-icon">🔍</span>
            <input
              v-model="dsSearch"
              class="tis-input"
              placeholder="Search sources…"
              @click.stop
            />
            <button v-if="dsSearch" class="tis-clear" @click.stop="dsSearch = ''">✕</button>
          </div>
        </div>
        <div v-show="activeSection === 'sources' || activeSection === null" class="section-body no-top-pad">
          <SelectorDatasources v-model="strategy.dataSources" :search-query="dsSearch" />
        </div>
      </section>

      <!-- LOGIC (CONDITIONS + ACTIONS) -->
      <section class="form-section" :class="{ collapsed: activeSection !== null && activeSection !== 'logic' }" :style="{ '--tone': SECTION_TONE.logic }">
        <button class="section-toggle" @click="toggleSection('logic')">
          <span class="sec-icon">ƒ</span>
          <span class="sec-title">Logic</span>
          <span class="sec-status">{{ strategy.blocks.filter(b=>b.type==='condition').length }} if · {{ strategy.blocks.filter(b=>b.type==='formula').length }} math · {{ strategy.blocks.filter(b=>b.type==='action').length }} exchange</span>
          <span class="sec-chevron" :class="{ open: activeSection === 'logic' }">▾</span>
        </button>
        <div v-show="activeSection === 'logic' || activeSection === null" class="section-body">

          <!-- Add buttons -->
          <div class="add-block-row">
            <button class="add-block-btn cond-btn" @click="addBlock('condition')">
              + Condition
            </button>
            <button class="add-block-btn formula-btn" @click="addBlock('formula')">
              + Formula
            </button>
            <button class="add-block-btn action-btn" @click="addBlock('action')">
              + Exchange
            </button>
          </div>

          <!-- Search + filter (only when blocks exist) -->
          <div v-if="strategy.blocks.length > 1" class="logic-toolbar">
            <div class="logic-search-wrap">
              <span>🔍</span>
              <input v-model="logicSearch" class="logic-search-input" placeholder="Search blocks…" />
              <button v-if="logicSearch" @click="logicSearch = ''" class="logic-search-clear">✕</button>
            </div>
            <UIOpChips
              label="Block type"
              :options="BLOCK_OPTIONS"
              :states="blockStates"
              @cycle="id => cycleKey(blockStates, id)"
            />
          </div>

          <!-- Blocks list -->
          <div v-if="filteredBlocks.length" class="blocks-list">
            <div
              v-for="block in filteredBlocks"
              :key="block.id"
              class="block-card"
              :class="block.type"
            >
              <div class="block-head">
                <span class="block-type-badge" :class="block.type">
                  {{ block.type === 'condition' ? 'IF' : block.type === 'formula' ? 'MATH' : 'EXCHANGE' }}
                </span>
                <button class="remove-block" @click="removeBlock(block.id)">✕</button>
              </div>
              <BuilderCondition
                v-if="block.type === 'condition'"
                :model-value="(block.data as any)"
                @update:model-value="updateBlock(block.id, $event)"
              />
              <BuilderFormula
                v-else-if="block.type === 'formula'"
                :model-value="(block.data as any)"
                @update:model-value="updateBlock(block.id, $event)"
              />
              <BuilderAction
                v-else
                :model-value="(block.data as any)"
                @update:model-value="updateBlock(block.id, $event)"
              />
            </div>
          </div>

          <div v-else-if="strategy.blocks.length && logicSearch" class="blocks-empty">
            <p>No blocks match "{{ logicSearch }}". <button class="clear-link" @click="logicSearch = ''">Clear search</button></p>
          </div>
          <div v-else class="blocks-empty">
            <p>No logic yet. Add an if, a formula, or an exchange.</p>
          </div>
        </div>
      </section>

      <!-- AI AVATARS -->
      <section class="form-section" :class="{ collapsed: activeSection !== null && activeSection !== 'avatars' }" :style="{ '--tone': SECTION_TONE.avatars }">
        <div class="section-toggle-bar">
          <button class="toggle-trigger" @click="toggleSection('avatars')">
            <span class="sec-icon">◈</span>
            <span class="sec-title">AI Avatars</span>
            <span class="sec-count-badge" :class="{ zero: !strategy.selectedProfiles.length }">{{ strategy.selectedProfiles.length }}</span>
            <span class="sec-chevron" :class="{ open: activeSection === 'avatars' }">▾</span>
          </button>
          <div
            v-show="activeSection === 'avatars' && profiles.length"
            class="toggle-inline-search"
            @click.stop
          >
            <span class="tis-icon">🔍</span>
            <input
              v-model="profileSearch"
              class="tis-input"
              placeholder="Search avatars…"
              @click.stop
            />
            <button v-if="profileSearch" class="tis-clear" @click.stop="profileSearch = ''">✕</button>
          </div>
        </div>
        <div v-show="activeSection === 'avatars' || activeSection === null" class="section-body">
          <p class="section-hint">Select AI avatars trained on traders' behaviour to influence capital allocation decisions.</p>
          <div v-if="filteredProfiles.length" class="profiles-grid">
            <div
              v-for="profile in filteredProfiles"
              :key="profile.id"
              class="profile-chip"
              :class="{ selected: strategy.selectedProfiles.includes(profile.id) }"
              @click="toggleProfile(profile.id)"
            >
              <AvatarCard :profile="profile" />
              <div v-if="strategy.selectedProfiles.includes(profile.id)" class="chip-selected-overlay">✓</div>
            </div>
          </div>
          <div v-else class="no-avatars">
            <span class="no-avatars-icon">🤖</span>
            <p>No AI avatars available. Deploy strategies with avatars first.</p>
          </div>
        </div>
      </section>

      <!-- SWARM -->
      <section class="form-section" :class="{ collapsed: activeSection !== null && activeSection !== 'swarm' }" :style="{ '--tone': SECTION_TONE.swarm }">
        <button class="section-toggle" @click="toggleSection('swarm')">
          <span class="sec-icon">✶</span>
          <span class="sec-title">Swarm Intelligence</span>
          <span class="sec-status">{{ opinionsStore?.plugs?.length ?? 0 }} plugged</span>
          <span class="sec-chevron" :class="{ open: activeSection === 'swarm' }">▾</span>
        </button>
        <div v-show="activeSection === 'swarm' || activeSection === null" class="section-body">
          <p class="section-hint">Plug community members or AI avatars to feed their weighted opinions into your strategy allocation engine.</p>
          <StrategySwarmPlugs @change="onSwarmChange" />
        </div>
      </section>

      <!-- VARIABLES -->
      <section class="form-section" :class="{ collapsed: activeSection !== null && activeSection !== 'variables' }" :style="{ '--tone': SECTION_TONE.variables }">
        <button class="section-toggle" @click="toggleSection('variables')">
          <span class="sec-icon">𝑥</span>
          <span class="sec-title">Variables</span>
          <span class="sec-status">{{ strategy.variables.length }} defined</span>
          <span class="sec-chevron" :class="{ open: activeSection === 'variables' }">▾</span>
        </button>
        <div v-show="activeSection === 'variables' || activeSection === null" class="section-body">
          <p class="section-hint">Define reusable variables referenced in conditions (e.g. RSI_THRESHOLD = 70).</p>
          <div v-for="(v, idx) in strategy.variables" :key="idx" class="var-row">
            <input v-model="v.key"   class="strat-input var-input" placeholder="KEY" />
            <span class="var-eq">=</span>
            <input v-model="v.value" class="strat-input var-input" placeholder="value" />
            <button class="remove-var" @click="removeVariable(idx)">✕</button>
          </div>
          <button class="add-var-btn" @click="addVariable">+ Add Variable</button>
        </div>
      </section>

      <!-- PREVIEW -->
      <section class="form-section" :class="{ collapsed: activeSection !== null && activeSection !== 'preview' }" :style="{ '--tone': SECTION_TONE.preview }">
        <button class="section-toggle" @click="toggleSection('preview')">
          <span class="sec-icon">▤</span>
          <span class="sec-title">Preview</span>
          <span class="sec-status">Code view</span>
          <span class="sec-chevron" :class="{ open: activeSection === 'preview' }">▾</span>
        </button>
        <div v-show="activeSection === 'preview' || activeSection === null" class="section-body">
          <StrategyCodeView :code="{
            name: strategy.name,
            description: strategy.description,
            assetFrom: strategy.assetFrom,
            assetTo: strategy.assetTo,
            allocation: strategy.allocation,
            frequency: strategy.frequency,
            period: strategy.period,
            variables: strategy.variables,
            conditions: strategy.blocks.filter(b => b.type === 'condition'),
            actions: strategy.blocks.filter(b => b.type === 'action'),
            dataSources: strategy.dataSources,
            profiles: strategy.selectedProfiles,
          }" />
        </div>
      </section>

    </div><!-- /form-body -->

    <!-- ── Strategy rating ────────────────────────────────────────────────── -->
    <div class="rating-wrap">
      <StrategyRating
        :risk="riskScore"
        :complexity="complexityRating"
        :computational-cost="neededCredit"
        :selected-sources="strategy.dataSources.length"
        :frequency="strategy.frequency"
      />
    </div>

    <!-- ── Error banner ───────────────────────────────────────────────────── -->
    <div v-if="actionError" class="error-banner">
      ⚠ {{ actionError }}
    </div>

    <!-- ── Save success toast ─────────────────────────────────────────────── -->
    <Transition name="toast">
      <div v-if="saveSuccess" class="save-toast">
        ✓ Strategy saved to your list
      </div>
    </Transition>

    <!-- ── CTA buttons ────────────────────────────────────────────────────── -->
    <div class="cta-bar">
      <div class="cta-credits">
        <div class="credit-mini">
          <span class="credit-mini-val" :class="{ over: !hasEnoughCredit }">💳 {{ neededCredit }}</span>
          <span class="credit-mini-total"> / {{ credit }}</span>
        </div>
      </div>
      <div class="cta-buttons">
        <button
          class="cta-btn save-draft"
          @click="handleSaveDraft"
        >
          <span class="cta-icon">💾</span> Save
        </button>
        <button
          class="cta-btn backtest"
          :disabled="!hasEnoughCredit || !isValid"
          @click="handleBacktest"
        >
          <span class="cta-icon">⏪</span> Backtest
        </button>
        <button
          class="cta-btn deploy"
          :disabled="!hasEnoughCredit || !isValid"
          @click="handleDeploy"
        >
          <span class="cta-icon">🚀</span> Deploy
        </button>
        <button
          class="cta-btn both"
          :disabled="!hasEnoughCredit || !isValid"
          @click="handleBacktestAndDeploy"
        >
          <span class="cta-icon">⚡</span> Both
        </button>
      </div>
    </div>

    <!-- ── Countdown modal ────────────────────────────────────────────────── -->
    <CountdownModal :open="showCountdown" @finish="onCountdownFinish" @close="showCountdown = false" />

  </div>
</template>

<style scoped>
/* ── Page root ── */
.creator-page {
  max-width: 720px;
  margin: 0 auto;
  padding: var(--spacing-md) var(--spacing-sm) 120px;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  color: var(--text-white);
}

/* ── Hero ── */
.page-hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--spacing-md);
  flex-wrap: wrap;
}

.hero-title {
  font-size: 1.6rem;
  font-weight: 800;
  line-height: 1.1;
  background: var(--primary-gradient);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin: 0;
}

.hero-sub {
  font-size: 0.75rem;
  color: var(--text-gray);
  margin: 4px 0 0;
  max-width: 420px;
  line-height: 1.4;
}

.ai-fill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 10px;
  padding: 7px 12px;
  border-radius: var(--radius-md);
  border: 1px solid rgba(255,176,32,0.45);
  background: rgba(255,176,32,0.1);
  color: #ffb020;
  font: inherit;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  cursor: pointer;
}
.ai-fill:hover { background: rgba(255,176,32,0.18); }
.ai-fill svg { flex-shrink: 0; }

/* Credit widget */
.credit-widget {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  flex-shrink: 0;
}

.credit-label {
  font-size: 0.55rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-gray);
}

.credit-val {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-white);
}

.credit-bar {
  width: 80px;
  height: 4px;
  background: rgba(255,255,255,0.08);
  border-radius: 999px;
  overflow: hidden;
}

.credit-fill {
  height: 100%;
  border-radius: 999px;
  transition: width 0.3s ease, background 0.3s ease;
}

.credit-need {
  font-size: 0.6rem;
  color: var(--text-gray);
}

.credit-need.over { color: var(--error-red); font-weight: 700; }

/* ── Visualizer ── */
.visualizer-wrap {
  position: sticky;
  top: 56px;
  z-index: 10;
  background: var(--bg-primary);
  padding: var(--spacing-xs) 0;
}

/* ── Section nav strip ── */
.view-switch {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}
.view-switch button {
  padding: 8px 10px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-secondary);
  background: transparent;
  color: var(--text-gray);
  font: inherit;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  cursor: pointer;
}
.view-switch button.on {
  color: var(--text-white);
  border-color: rgba(61,214,140,0.5);
  background: rgba(61,214,140,0.1);
}
.json-view { display: flex; flex-direction: column; gap: 6px; }
.json-note, .json-error { margin: 0; font-size: 0.72rem; color: var(--text-gray); }
.json-error { color: var(--error-red); }
.json-editor {
  width: 100%;
  min-height: 360px;
  box-sizing: border-box;
  padding: 12px 14px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-secondary);
  background: rgba(0,0,0,0.35);
  color: #d6d3d1;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.72rem;
  line-height: 1.45;
  resize: vertical;
}

.sections-nav {
  display: flex;
  overflow-x: auto;
  scrollbar-width: none;
  gap: 6px;
}
@media (min-width: 900px) {
  .sections-nav { display: grid; grid-template-columns: repeat(8, minmax(0, 1fr)); }
}

.sections-nav::-webkit-scrollbar { display: none; }

.sec-nav-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  white-space: nowrap;
  font-size: 0.65rem;
  padding: 6px 8px;
  border-radius: 999px;
  border: 1px solid var(--border-secondary);
  background: transparent;
  color: var(--text-gray);
  cursor: pointer;
  min-width: 0;
  transition: all 0.15s ease;
}
.sec-glyph { color: var(--tone); font-weight: 700; width: 0.9rem; text-align: center; }

.sec-nav-btn:hover { background: rgba(255,255,255,0.06); color: var(--text-white); }
.sec-nav-btn.active {
  background: color-mix(in srgb, var(--tone) 14%, transparent);
  border-color: var(--tone);
  color: var(--text-white);
}

/* ── Form sections ── */
.form-body {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.form-section {
  background: rgba(0,0,0,0.2);
  border: 1px solid var(--border-primary);
  border-left: 2px solid var(--tone, var(--border-primary));
  border-radius: var(--radius-md);
  overflow: hidden;
  transition: opacity 0.2s ease;
}

.form-section.collapsed { opacity: 0.6; }

/* ── Section toggle bar (fused header for sections with inline search) ── */
.section-toggle-bar {
  display: flex;
  align-items: center;
  min-height: 44px;
  padding: 0 var(--spacing-md);
  gap: 8px;
  border-bottom: 1px solid transparent;
  transition: border-color 0.15s ease;
}

.section-toggle-bar:has(.tis-input:focus-within) {
  border-color: var(--border-accent);
}

.toggle-trigger {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 8px;
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--text-white);
  padding: var(--spacing-sm) 0;
  text-align: left;
}

/* Inline search inside toggle bar */
.toggle-inline-search {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 5px;
  background: rgba(0,0,0,0.25);
  border: 1px solid var(--border-secondary);
  border-radius: var(--radius-sm);
  padding: 5px 10px;
  min-width: 0;
  transition: border-color 0.15s ease;
}

.toggle-inline-search:focus-within { border-color: var(--border-accent); }

.tis-icon { font-size: 0.7rem; opacity: 0.5; flex-shrink: 0; }

.tis-input {
  flex: 1;
  background: transparent;
  border: none;
  color: var(--text-white);
  font-size: 0.75rem;
  outline: none;
  font-family: inherit;
  min-width: 0;
}

.tis-input::placeholder { color: var(--text-gray); }

.tis-clear {
  background: transparent;
  border: none;
  color: var(--text-gray);
  cursor: pointer;
  font-size: 0.6rem;
  flex-shrink: 0;
  transition: color 0.12s ease;
}
.tis-clear:hover { color: var(--text-white); }

/* Count badge in toggle (replaces plain sec-status for sections with search) */
.sec-count-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: rgba(0,255,136,0.15);
  color: var(--primary-green);
  font-size: 0.62rem;
  font-weight: 700;
  flex-shrink: 0;
}

.sec-count-badge.zero { background: rgba(255,255,255,0.06); color: var(--text-gray); }

/* Old-style simple section toggle (for sections without inline search) */
.section-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: var(--spacing-sm) var(--spacing-md);
  background: transparent;
  border: none;
  cursor: pointer;
  text-align: left;
  color: var(--text-white);
  min-height: 44px;
}

.sec-icon { font-size: 0.85rem; flex-shrink: 0; width: 1.1rem; text-align: center; color: var(--tone, var(--text-gray)); }

.sec-title {
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--text-white);
  flex: 1;
}

.sec-status {
  font-size: 0.65rem;
  color: var(--text-gray);
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sec-chevron {
  font-size: 0.65rem;
  color: var(--text-gray);
  transition: transform 0.2s ease;
  flex-shrink: 0;
}

.sec-chevron.open { transform: rotate(180deg); }

.section-body {
  padding: var(--spacing-md);
  border-top: 1px solid var(--border-primary);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.section-body.no-top-pad { padding-top: var(--spacing-sm); }

.section-hint {
  font-size: 0.72rem;
  color: var(--text-gray);
  margin: 0;
  line-height: 1.4;
}

/* ── Fields ── */
.field-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-label {
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-gray);
}

.strat-input {
  padding: 10px 14px;
  background: rgba(0,0,0,0.3);
  border: 1px solid var(--border-secondary);
  border-radius: var(--radius-md);
  color: var(--text-white);
  font-size: 0.82rem;
  transition: border-color 0.15s ease;
  width: 100%;
  box-sizing: border-box;
  font-family: inherit;
}

.strat-input:focus {
  outline: none;
  border-color: var(--border-accent);
}

.strat-textarea { resize: vertical; min-height: 70px; }

/* Category chips */
.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.chip {
  font-size: 0.65rem;
  padding: 4px 12px;
  border-radius: 999px;
  border: 1px solid var(--border-secondary);
  background: transparent;
  color: var(--text-gray);
  cursor: pointer;
  text-transform: capitalize;
  transition: all 0.12s ease;
}

.chip:hover { background: rgba(255,255,255,0.06); color: var(--text-white); }
.chip.active {
  border-color: var(--primary-green);
  background: rgba(0,255,136,0.1);
  color: var(--primary-green);
}

/* ── Asset flow ── */
.asset-flow-row {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-md);
  width: 100%;
}

.asset-slot { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px; }

.flow-mid-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 0 1 220px;
  width: min(220px, 34%);
  min-width: 160px;
}

@media (max-width: 720px) {
  .asset-flow-row { flex-direction: column; }
  .flow-mid-col { width: 100%; flex-basis: auto; }
}

.pool-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(76px, 1fr));
  gap: 6px;
  width: 100%;
}
.pool-asset {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1px;
  min-width: 0;
  padding: 7px 8px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-secondary);
  background: transparent;
  color: var(--text-gray);
  cursor: pointer;
  text-align: left;
}
.pool-asset.include {
  border-color: var(--asset);
  background: color-mix(in srgb, var(--asset) 16%, transparent);
  color: var(--text-white);
}
.pool-asset.exclude {
  border-color: rgba(255,90,106,0.7);
  color: #ff8b96;
  text-decoration: line-through;
}
.pool-op { font-size: 0.62rem; font-weight: 800; min-height: 0.7rem; color: var(--asset); }
.pool-asset.exclude .pool-op { color: #ff8b96; }
.pool-sym { font-size: 0.75rem; font-weight: 800; color: var(--asset); }
.pool-cat { font-size: 0.52rem; letter-spacing: 0.04em; text-transform: uppercase; }

.flow-line-v { width: 1px; height: 14px; background: var(--border-secondary); }

.alloc-bubble-v {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  background: rgba(0,255,136,0.1);
  border: 1px solid rgba(0,255,136,0.3);
  border-radius: 999px;
  padding: 4px 8px;
}

.abv-pct  { font-size: 0.78rem; font-weight: 800; color: var(--primary-green); line-height: 1; }
.abv-sub  { font-size: 0.45rem; color: var(--primary-green); opacity: 0.7; }
.flow-arrow-v { font-size: 0.8rem; color: var(--primary-green); }

/* Asset mini-card (shown below selector when asset is selected) */
.asset-mini-card {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border: 1px solid;
  border-radius: var(--radius-sm);
  transition: all 0.2s ease;
}

.amc-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.amc-info {
  display: flex;
  flex-direction: column;
  gap: 1px;
  flex: 1;
  min-width: 0;
}

.amc-symbol {
  font-size: 0.8rem;
  font-weight: 800;
  line-height: 1;
}

.amc-label {
  font-size: 0.6rem;
  color: var(--text-gray);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.amc-cat {
  font-size: 0.55rem;
  color: var(--text-gray);
  text-transform: capitalize;
  background: rgba(255,255,255,0.06);
  padding: 2px 6px;
  border-radius: 999px;
  flex-shrink: 0;
}

/* Allocation slider */
.alloc-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.alloc-anchor {
  font-size: 0.6rem;
  color: var(--text-gray);
  flex-shrink: 0;
  min-width: 28px;
}

.alloc-slider {
  flex: 1;
  -webkit-appearance: none;
  height: 5px;
  border-radius: 999px;
  outline: none;
  cursor: pointer;
  transition: background 0.1s ease;
}

.alloc-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--primary-green);
  cursor: pointer;
  box-shadow: 0 0 10px rgba(0,255,136,0.5);
  border: 2px solid rgba(0,0,0,0.3);
  transition: transform 0.1s ease;
}

.alloc-slider:active::-webkit-slider-thumb { transform: scale(1.15); }

.alloc-slider::-moz-range-thumb {
  width: 18px; height: 18px; border-radius: 50%;
  background: var(--primary-green); cursor: pointer; border: 2px solid rgba(0,0,0,0.3);
}

.alloc-badge {
  font-size: 0.88rem;
  font-weight: 800;
  color: var(--primary-green);
  min-width: 42px;
  text-align: right;
  flex-shrink: 0;
}

/* ── Date range ── */
.date-presets {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.date-preset-chip {
  font-size: 0.62rem;
  padding: 3px 10px;
  border-radius: 999px;
  border: 1px solid var(--border-secondary);
  background: transparent;
  color: var(--text-gray);
  cursor: pointer;
  transition: all 0.12s ease;
}

.date-preset-chip:hover { background: rgba(255,255,255,0.06); color: var(--text-white); }
.date-preset-chip.active {
  border-color: var(--primary-green);
  background: rgba(0,255,136,0.1);
  color: var(--primary-green);
}

.date-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.date-input-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.date-input-label {
  font-size: 0.52rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-gray);
  padding-left: 2px;
}

.date-input-real {
  width: 100%;
  box-sizing: border-box;
  padding: 8px 12px;
  background: rgba(0,0,0,0.35);
  border: 1px solid var(--border-secondary);
  border-radius: var(--radius-md);
  color: var(--text-white);
  font-size: 0.8rem;
  font-family: inherit;
  cursor: pointer;
  transition: border-color 0.15s ease;
  color-scheme: dark;
}

.date-input-real:focus { outline: none; border-color: var(--border-accent); }
.date-input-real::-webkit-calendar-picker-indicator { filter: invert(1); opacity: 0.5; cursor: pointer; }
.date-input-real:hover { border-color: var(--border-primary); }

.date-range-arrow { font-size: 1rem; color: var(--text-gray); flex-shrink: 0; }

.period-summary {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
}

.period-days {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--primary-green);
}

.period-months {
  font-size: 0.65rem;
  color: var(--text-gray);
}

/* ── Logic blocks ── */
.add-block-row {
  display: flex;
  gap: var(--spacing-sm);
}

.add-block-btn {
  flex: 1;
  padding: 8px;
  border-radius: var(--radius-md);
  border: 1px dashed;
  background: transparent;
  cursor: pointer;
  font-size: 0.72rem;
  font-weight: 700;
  transition: all 0.15s ease;
}

.cond-btn {
  color: var(--primary-blue);
  border-color: var(--primary-blue);
}
.cond-btn:hover {
  background: rgba(33,150,243,0.1);
}

.action-btn {
  color: var(--warning-orange);
  border-color: var(--warning-orange);
}
.action-btn:hover {
  background: rgba(255,160,0,0.1);
}
.formula-btn {
  color: #c084fc;
  border-color: #c084fc;
}
.formula-btn:hover { background: rgba(192,132,252,0.12); }

.blocks-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.block-card {
  background: rgba(0,0,0,0.3);
  border: 1px solid var(--border-secondary);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.block-card.condition { border-left: 3px solid #5b9cff; }
.block-card.formula   { border-left: 3px solid #c084fc; }
.block-card.action    { border-left: 3px solid #ffb020; }

.block-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  background: rgba(255,255,255,0.02);
  border-bottom: 1px solid var(--border-secondary);
}

.block-type-badge {
  font-size: 0.65rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 999px;
}

.block-type-badge.condition {
  color: var(--primary-blue);
  background: rgba(33,150,243,0.12);
}

.block-type-badge.formula {
  color: #c084fc;
  background: rgba(192,132,252,0.12);
}
.block-type-badge.action {
  color: #ffb020;
  background: rgba(255,176,32,0.12);
}

.remove-block {
  font-size: 0.7rem;
  color: var(--text-gray);
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  transition: all 0.12s ease;
}
.remove-block:hover { color: var(--error-red); background: rgba(244,67,54,0.12); }

.block-card :deep(.cond-builder),
.block-card :deep(.action-builder) {
  padding: var(--spacing-sm) var(--spacing-md) var(--spacing-md);
}

.blocks-empty {
  padding: var(--spacing-md);
  text-align: center;
}
.blocks-empty p { font-size: 0.72rem; color: var(--text-gray); margin: 0; }

/* ── Avatar profiles ── */
.profiles-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: var(--spacing-sm);
}

.profile-chip {
  position: relative;
  cursor: pointer;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-secondary);
  overflow: hidden;
  transition: all 0.15s ease;
}

.profile-chip:hover { transform: translateY(-2px); border-color: var(--border-primary); }
.profile-chip.selected { border-color: var(--primary-green); box-shadow: 0 0 10px rgba(0,255,136,0.2); }

.chip-selected-overlay {
  position: absolute;
  top: 6px;
  right: 6px;
  background: var(--primary-green);
  color: #000;
  font-size: 0.65rem;
  font-weight: 800;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.no-avatars {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
}
.no-avatars-icon { font-size: 2rem; opacity: 0.3; }
.no-avatars p { font-size: 0.72rem; color: var(--text-gray); text-align: center; margin: 0; }

/* ── Variables ── */
.var-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.var-input {
  flex: 1;
  min-width: 0;
  padding: 8px 10px;
  font-size: 0.78rem;
}

.var-eq { color: var(--text-gray); font-weight: 700; flex-shrink: 0; }

.remove-var {
  font-size: 0.7rem;
  color: var(--text-gray);
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 4px 6px;
  flex-shrink: 0;
  transition: color 0.12s ease;
}
.remove-var:hover { color: var(--error-red); }

.add-var-btn {
  align-self: flex-start;
  font-size: 0.72rem;
  padding: 5px 12px;
  border-radius: 999px;
  border: 1px dashed var(--border-secondary);
  background: transparent;
  color: var(--text-gray);
  cursor: pointer;
  transition: all 0.12s ease;
}
.add-var-btn:hover { border-color: var(--primary-green); color: var(--primary-green); }

/* ── Rating + error ── */
.rating-wrap { margin-top: var(--spacing-sm); }

.error-banner {
  background: rgba(244,67,54,0.1);
  border: 1px solid var(--error-red);
  border-radius: var(--radius-md);
  padding: 10px 14px;
  font-size: 0.78rem;
  color: var(--error-red);
}

/* ── CTA bar ── */
.cta-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--bg-primary);
  border-top: 1px solid var(--border-primary);
  padding: var(--spacing-sm) var(--spacing-md);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-sm);
  z-index: 50;
}

.cta-credits { flex-shrink: 0; }
.cta-credit-info {
  font-size: 0.65rem;
  color: var(--text-gray);
}

.cta-buttons {
  display: flex;
  gap: var(--spacing-sm);
  flex: 1;
  justify-content: flex-end;
}

.cta-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 9px 16px;
  border: none;
  border-radius: var(--radius-md);
  font-size: 0.72rem;
  font-weight: 700;
  cursor: pointer;
  transition: all var(--transition-normal);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  white-space: nowrap;
}

.cta-icon { font-size: 0.9rem; }

.cta-btn.save-draft { background: rgba(255,255,255,0.08); color: var(--text-white); border: 1px solid var(--border-secondary); }
.cta-btn.save-draft:hover { background: rgba(255,255,255,0.12); border-color: var(--border-primary); }
.cta-btn.backtest { background: var(--primary-blue); color: #fff; }
.cta-btn.deploy   { background: var(--warning-orange); color: #000; }
.cta-btn.both     { background: var(--button-primary); color: #000; }

.cta-btn:hover:not(:disabled) { transform: translateY(-1px); opacity: 0.9; }
.cta-btn:disabled { opacity: 0.35; cursor: not-allowed; transform: none; }

/* Credit mini */
.credit-mini { display: flex; align-items: baseline; gap: 2px; }
.credit-mini-val { font-size: 0.72rem; font-weight: 700; color: var(--primary-green); }
.credit-mini-val.over { color: var(--error-red); }
.credit-mini-total { font-size: 0.6rem; color: var(--text-gray); }

/* Logic toolbar */
.logic-toolbar {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.logic-search-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(0,0,0,0.25);
  border: 1px solid var(--border-secondary);
  border-radius: var(--radius-md);
  padding: 7px 12px;
  transition: border-color 0.15s ease;
  font-size: 0.75rem;
}

.logic-search-wrap:focus-within { border-color: var(--border-accent); }

.logic-search-input {
  flex: 1;
  background: transparent;
  border: none;
  color: var(--text-white);
  font-size: 0.78rem;
  outline: none;
  font-family: inherit;
}

.logic-search-input::placeholder { color: var(--text-gray); }

.logic-search-clear {
  background: transparent;
  border: none;
  color: var(--text-gray);
  cursor: pointer;
  font-size: 0.65rem;
  transition: color 0.12s ease;
}
.logic-search-clear:hover { color: var(--text-white); }

.logic-type-filter { display: flex; gap: 4px; }

.filter-chip {
  font-size: 0.62rem;
  padding: 3px 10px;
  border-radius: 999px;
  border: 1px solid var(--border-secondary);
  background: transparent;
  color: var(--text-gray);
  cursor: pointer;
  transition: all 0.12s ease;
}

.filter-chip:hover { background: rgba(255,255,255,0.06); color: var(--text-white); }
.filter-chip.active {
  background: rgba(0,255,136,0.1);
  border-color: rgba(0,255,136,0.4);
  color: var(--primary-green);
}

.clear-link {
  background: transparent;
  border: none;
  color: var(--primary-green);
  cursor: pointer;
  font-size: 0.72rem;
  text-decoration: underline;
}

/* Save toast */
.save-toast {
  position: fixed;
  bottom: 70px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--success-green);
  color: #000;
  font-weight: 700;
  font-size: 0.75rem;
  padding: 8px 20px;
  border-radius: 999px;
  z-index: 200;
  pointer-events: none;
  box-shadow: 0 4px 16px rgba(0,0,0,0.4);
}

.toast-enter-active, .toast-leave-active { transition: all 0.3s ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateX(-50%) translateY(10px); }
</style>
