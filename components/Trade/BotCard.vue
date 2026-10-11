<template>
  <article class="bot" :class="{ dead: !bot.alive }">
    <header>
      <div>
        <h4>{{ bot.strategy?.name ? bot.strategy.name : `Bot ${bot.bot_id.slice(0, 8)}` }}</h4>
        <NuxtLink v-if="bot.strategy?.id" class="strat-link" :to="`/strategy/${bot.strategy.id}`">strategy · {{ bot.strategy.symbol ?? '' }}</NuxtLink>
        <small>{{ bot.alive ? 'running' : 'stopped' }} · {{ bot.ticks }} bars · re-weights every {{ periodLabel }}</small>
      </div>
      <div class="pnl" :class="bot.pnl >= 0 ? 'up' : 'down'">
        {{ signed(bot.pnl) }} <small>({{ (bot.pnl_pct ?? 0).toFixed(2) }}%)</small>
      </div>
    </header>

    <div class="kpis">
      <div><span>Equity</span><b>{{ usd(bot.equity) }}</b></div>
      <div><span>Closed</span><b>{{ bot.stats?.closed ?? 0 }}</b></div>
      <div><span>Profitable</span><b>{{ bot.stats?.profitable ?? 0 }}</b></div>
      <div><span>Win rate</span><b>{{ Math.round((bot.stats?.win_rate ?? 0) * 100) }}%</b></div>
    </div>

    <p v-if="!bot.ticks" class="warm">
      Waiting for market data: no bars processed yet. A new bot also needs about a day of hourly bars to warm up before its first order.
    </p>
    <p v-else-if="bot.benchmark" class="bench" :class="beatsHold ? 'up' : 'down'">
      vs. just holding the same markets: {{ signed(bot.benchmark.buy_hold_pnl) }}
      ({{ (bot.benchmark.buy_hold_pct * 100).toFixed(2) }}%). The bot is
      <b>{{ beatsHold ? 'ahead' : 'behind' }} by {{ usd(Math.abs(bot.pnl - bot.benchmark.buy_hold_pnl)) }}</b>
    </p>

    <div v-if="bot.kind === 'prediction' && bot.market" class="pm">
      <div><span>Market</span><b>{{ bot.market.title }}<template v-if="bot.market.subtitle"> · {{ bot.market.subtitle }}</template></b></div>
      <div><span>Side</span><b :class="bot.market.side">{{ (bot.market.side ?? '').toUpperCase() }}</b></div>
      <div v-if="bot.position"><span>Position</span><b>{{ bot.position.contracts }} contracts @ {{ bot.position.avg_cents }}¢ · now {{ bot.position.mark_cents ?? '—' }}¢</b></div>
      <div v-else><span>Position</span><b>waiting for the ask to reach its limit</b></div>
    </div>

    <div v-if="!bot.strategy && bot.kind !== 'prediction'" class="weights">
      <div v-for="(v, k) in bot.weights" :key="k" class="w">
        <span>{{ WEIGHT_LABELS[k] ?? k }}</span>
        <div class="bar"><i :style="{ width: `${Math.round((v || 0) * 100)}%` }" /></div>
        <b>{{ Math.round((v || 0) * 100) }}%</b>
      </div>
    </div>

    <div v-if="bot.open_positions?.length" class="positions">
      <span v-for="p in bot.open_positions" :key="p.symbol" class="chip" :class="p.upnl >= 0 ? 'up' : 'down'">
        {{ p.symbol }} {{ signed(p.upnl) }}
      </span>
    </div>

    <table v-if="recent.length">
      <thead><tr><th>Market</th><th>Side</th><th>Entry → Exit</th><th>P&L (net)</th><th>Why</th></tr></thead>
      <tbody>
        <tr v-for="(t, i) in recent" :key="i">
          <td>{{ t.symbol }}</td>
          <td>{{ t.side }}</td>
          <td>{{ px(t.entry) }} → {{ px(t.exit) }}</td>
          <td :class="t.pnl >= 0 ? 'up' : 'down'">{{ signed(t.pnl) }}</td>
          <td>{{ t.behaviour }}</td>
        </tr>
      </tbody>
    </table>

    <div v-if="bot.alive" class="owner-actions">
      <button class="stop" :disabled="busy" @click="$emit('stop', bot.bot_id)">Stop and return funds</button>
      <button class="ghost" :disabled="busy" @click="$emit('pause', bot.bot_id, !bot.paused)">{{ bot.paused ? '▶ Resume' : '❚❚ Pause' }}</button>
      <button class="ghost" :disabled="busy" :title="bot.visibility === 'public' ? 'Visible on Community bots' : 'Only you can see it'"
        @click="$emit('visibility', bot.bot_id, bot.visibility === 'public' ? 'private' : 'public')">
        {{ bot.visibility === 'public' ? '◉ Public: make private' : '○ Private: share on Community' }}
      </button>
    </div>
  </article>
</template>

<script setup lang="ts">
import type { BotStatus } from '~/composables/useTradingApi'

const props = defineProps<{ bot: BotStatus; busy?: boolean }>()
defineEmits<{ stop: [botId: string]; pause: [botId: string, paused: boolean]; visibility: [botId: string, v: 'public' | 'private'] }>()

const WEIGHT_LABELS: Record<string, string> = {
  momentum: 'Momentum', mean_reversion: 'Mean reversion', breakout: 'Breakout',
  grid_dca: 'Grid / DCA', chain_propagation: 'BTC → alts lead-lag',
}
const beatsHold = computed(() => !!props.bot.benchmark && props.bot.pnl >= props.bot.benchmark.buy_hold_pnl)
const recent = computed(() => [...(props.bot.closed_trades || [])].slice(-8).reverse())
const periodLabel = computed(() => {
  const s = props.bot.period_s
  return s >= 86400 ? `${s / 86400}d` : s >= 3600 ? `${s / 3600}h` : `${Math.round(s / 60)}m`
})
const usd = (v: number) => (v ?? 0).toLocaleString(APP_LOCALE, { style: 'currency', currency: 'USD' })
const signed = (v: number) => `${v >= 0 ? '+' : '−'}${usd(Math.abs(v ?? 0))}`
const px = (v: number) => v >= 100 ? v.toFixed(2) : v.toPrecision(4)
</script>

<style scoped>
.bot { display: flex; flex-direction: column; gap: .7rem; padding: 1rem; border: 1px solid var(--border-primary);
  border-radius: var(--radius-lg, 12px); background: var(--surface-raised, var(--card-bg)); }
.bot.dead { opacity: .65; }
header { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; }

.strat-link { font-size: .72rem; color: var(--primary-blue, #3b82f6); }
h4 { margin: 0; font-family: var(--font-market-data, monospace); }
small { color: var(--text-secondary); font-size: .75rem; }
.pnl { font-weight: 700; font-size: 1.1rem; font-family: var(--font-market-data, monospace); text-align: right; }
.up { color: var(--app-color-up, #30a46c); }
.down { color: var(--app-color-down, #e5484d); }
.kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: .5rem; }
.kpis div { display: flex; flex-direction: column; font-size: .75rem; color: var(--text-secondary); }
.kpis b { font-size: .95rem; color: var(--text-primary); font-family: var(--font-market-data, monospace); }
.warm { margin: 0; font-size: .75rem; color: var(--text-secondary); padding: .4rem .6rem; border: 1px dashed var(--border-primary); border-radius: var(--radius-sm, 6px); }
.bench { margin: 0; font-size: .75rem; padding: .4rem .6rem; border-radius: var(--radius-sm, 6px); border: 1px dashed currentColor; }
.weights { display: flex; flex-direction: column; gap: .25rem; font-size: .75rem; }
.w { display: grid; grid-template-columns: 130px 1fr 40px; align-items: center; gap: .5rem; color: var(--text-secondary); }
.bar { height: 6px; border-radius: 3px; background: var(--surface-sunken, rgba(127,127,127,.2)); overflow: hidden; }
.bar i { display: block; height: 100%; background: var(--primary-blue, #3b82f6); transition: width .4s; }
.positions { display: flex; flex-wrap: wrap; gap: .35rem; }
.chip { font-size: .72rem; padding: .15rem .5rem; border-radius: 999px; border: 1px solid currentColor;
  font-family: var(--font-market-data, monospace); }
table { width: 100%; border-collapse: collapse; font-size: .75rem; font-family: var(--font-market-data, monospace); }
th { text-align: left; color: var(--text-secondary); font-weight: 500; padding: .25rem .3rem; }
td { padding: .25rem .3rem; border-top: 1px solid var(--border-primary); }
.pm { display: flex; flex-direction: column; gap: .25rem; font-size: .78rem; }
.pm div { display: flex; gap: .5rem; }
.pm span { color: var(--text-secondary); min-width: 64px; }
.pm .yes { color: var(--app-color-up, #30a46c); } .pm .no { color: var(--app-color-down, #e5484d); }
.owner-actions { display: flex; gap: .5rem; flex-wrap: wrap; }
.ghost { padding: .45rem .8rem; border-radius: var(--radius-sm, 6px); cursor: pointer; border: 1px solid var(--border-primary); background: transparent; color: var(--text-primary); font: inherit; font-size: .8rem; }
.stop { align-self: flex-start; padding: .45rem .8rem; border-radius: var(--radius-sm, 6px); cursor: pointer;
  border: 1px solid var(--app-color-down, #e5484d); background: transparent; color: var(--app-color-down, #e5484d); }
@media (max-width: 520px) { .kpis { grid-template-columns: repeat(2, 1fr); } .w { grid-template-columns: 100px 1fr 36px; } }
</style>
