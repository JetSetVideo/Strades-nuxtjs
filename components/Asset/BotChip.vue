<script setup lang="ts">
/**
 * Bots the user runs on this asset. Same pill as the friends control:
 * a count, green when their recent result is up, red when it is down.
 * Opening it lists each bot without leaving the card.
 */
import { computed, onMounted, ref } from 'vue'
import { useBotsStore, type Bot } from '@/stores/bots'
import { useStrategiesStore } from '@/stores/strategies'

const props = defineProps<{ symbol: string; assetId?: string }>()

const bots = useBotsStore()
const strategies = useStrategiesStore()
const open = ref(false)

onMounted(() => {
  if (!bots.hydrated) bots.fetchBots()
  if (!strategies.strategies.length) strategies.fetchStrategies()
})

const ALIAS: Record<string, string[]> = {
  BTC: ['BITCOIN', 'BTCUSD'],
  ETH: ['ETHEREUM'],
  SOL: ['SOLANA'],
  XAU: ['GOLD'],
  GOLD: ['XAU'],
  NG: ['NATGAS', 'NATURALGAS'],
  SPX: ['SPY', 'SP500'],
  TSLA: ['TESLA'],
}

function keysOf(raw: string) {
  const k = raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (!k) return []
  return [k, ...(ALIAS[k] ?? [])]
}

const mine = computed(() => {
  const keys = new Set([...keysOf(props.symbol), ...keysOf(props.assetId ?? '')])
  if (!keys.size) return [] as Bot[]
  return bots.list.filter((b) => {
    const strategy = b.strategy_id ? strategies.getStrategyById(b.strategy_id) : undefined
    const targets = strategy?.target_assets ?? []
    if (targets.some(t => keysOf(t).some(k => keys.has(k)))) return true
    const name = b.name.toUpperCase()
    return [...keys].some(k => k.length >= 3 && name.includes(k))
  })
})

const pnl = computed(() => mine.value.reduce((s, b) => s + (b.pnl_30d_usd ?? 0), 0))
const up = computed(() => pnl.value >= 0)

function pct(b: Bot) {
  const n = b.pnl_30d_pct ?? 0
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`
}
</script>

<template>
  <span v-if="mine.length" class="bot-chip" :class="{ on: open, up, down: !up }" @click.stop>
    <button
      type="button"
      class="bot-btn"
      :aria-pressed="open"
      :title="open ? 'Hide bots on this asset' : `${mine.length} bot${mine.length > 1 ? 's' : ''} trading ${symbol}`"
      @click="open = !open"
    >
      <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
        <rect x="1.6" y="3.2" width="12.8" height="9" rx="2" fill="none" stroke="currentColor" stroke-width="1.4" />
        <circle cx="5.6" cy="7.2" r="1" fill="currentColor" />
        <circle cx="10.4" cy="7.2" r="1" fill="currentColor" />
        <path d="M5.4 10.2h5.2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
      </svg>
      <span class="bot-n">{{ mine.length }}</span>
    </button>
    <span v-if="open" class="bot-pop" role="list">
      <NuxtLink v-for="b in mine" :key="b.id" :to="`/bots/${b.id}`" class="bot-row" role="listitem">
        <i class="bot-dot" :class="b.status" />
        <span class="bot-name">{{ b.name }}</span>
        <span class="bot-pnl" :class="(b.pnl_30d_pct ?? 0) >= 0 ? 'up' : 'down'">{{ pct(b) }}</span>
      </NuxtLink>
    </span>
  </span>
</template>

<style scoped>
.bot-chip { position: relative; flex-shrink: 0; }
.bot-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 24px;
  padding: 1px 7px 1px 5px;
  border-radius: 999px;
  border: 1px solid var(--border-primary, rgba(255,255,255,.12));
  background: rgba(255,255,255,.03);
  color: var(--text-gray, #9aa0a6);
  cursor: pointer;
  font: 700 0.62rem/1 var(--font-market-data, inherit);
}
.bot-chip.up .bot-btn { color: var(--app-color-up, #00ff88); border-color: color-mix(in srgb, var(--app-color-up, #00ff88) 55%, transparent); }
.bot-chip.down .bot-btn { color: var(--app-color-down, #ff4444); border-color: color-mix(in srgb, var(--app-color-down, #ff4444) 55%, transparent); }
.bot-chip.on.up .bot-btn { background: color-mix(in srgb, var(--app-color-up, #00ff88) 14%, transparent); }
.bot-chip.on.down .bot-btn { background: color-mix(in srgb, var(--app-color-down, #ff4444) 14%, transparent); }
.bot-n { font-variant-numeric: tabular-nums; }
.bot-pop {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  z-index: 6;
  min-width: 220px;
  max-width: 280px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 4px;
  border-radius: 8px;
  border: 1px solid var(--border-primary, rgba(255,255,255,.14));
  background: #14161a;
  box-shadow: 0 8px 24px rgba(0,0,0,.45);
}
.bot-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 28px;
  padding: 2px 6px;
  border-radius: 6px;
  color: inherit;
  text-decoration: none;
  font-size: 0.68rem;
}
.bot-row:hover { background: rgba(255,255,255,.06); }
.bot-dot { width: 6px; height: 6px; border-radius: 50%; background: #888; flex-shrink: 0; }
.bot-dot.live { background: var(--app-color-up, #00ff88); }
.bot-dot.paused { background: #ffaa00; }
.bot-dot.error, .bot-dot.stopped { background: var(--app-color-down, #ff4444); }
.bot-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 650; }
.bot-pnl { font-weight: 800; font-variant-numeric: tabular-nums; font-family: var(--font-market-data, inherit); }
.bot-pnl.up { color: var(--app-color-up, #00ff88); }
.bot-pnl.down { color: var(--app-color-down, #ff4444); }
</style>
