<script setup lang="ts">
import type { AssetClass } from '@/stores/macro'

interface Mover {
  id: string
  symbol: string
  name: string
  change: number
  icon_url?: string
  cls: AssetClass
}

defineProps<{
  gainers: Mover[]
  losers: Mover[]
}>()

defineEmits<{ (e: 'select', id: string): void }>()
</script>

<template>
  <section class="movers" aria-label="Top movers">
    <div class="movers-col gainers">
      <header><span class="dot up" /> Top gainers</header>
      <ul>
        <li v-for="m in gainers" :key="m.id" @click="$emit('select', m.id)">
          <img v-if="m.icon_url" :src="m.icon_url" alt="" />
          <div v-else class="ico-fallback">{{ m.symbol.slice(0,2) }}</div>
          <span class="sym">{{ m.symbol }}</span>
          <span class="chg up">+{{ m.change.toFixed(2) }}%</span>
        </li>
      </ul>
    </div>
    <div class="movers-col losers">
      <header><span class="dot down" /> Top losers</header>
      <ul>
        <li v-for="m in losers" :key="m.id" @click="$emit('select', m.id)">
          <img v-if="m.icon_url" :src="m.icon_url" alt="" />
          <div v-else class="ico-fallback">{{ m.symbol.slice(0,2) }}</div>
          <span class="sym">{{ m.symbol }}</span>
          <span class="chg down">{{ m.change.toFixed(2) }}%</span>
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.movers {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 0.55rem;
  min-width: 0;
}
.movers-col {
  background: linear-gradient(135deg, rgba(20,20,28,0.92), rgba(14,14,18,0.92));
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: var(--app-border-radius, 8px);
  padding: 0.4rem 0.5rem 0.5rem 0.5rem;
  min-width: 0;
  overflow: hidden;
}
.movers-col header {
  display: flex; align-items: center; gap: 0.35rem;
  font-size: 0.62rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.55);
  font-weight: 700;
  margin-bottom: 0.35rem;
}
.movers-col .dot {
  width: 6px; height: 6px; border-radius: 50%;
}
.movers-col .dot.up { background: var(--success-green, #00ff88); box-shadow: 0 0 4px var(--success-green, #00ff88); }
.movers-col .dot.down { background: #ff4d6a; box-shadow: 0 0 4px #ff4d6a; }
.movers-col ul {
  list-style: none; margin: 0; padding: 0;
  display: flex; flex-direction: column;
  gap: 0.18rem;
  min-width: 0;
}
.movers-col li {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr) auto;
  gap: 0.4rem;
  align-items: center;
  font-size: 0.78rem;
  padding: 0.18rem 0.25rem;
  border-radius: 4px;
  cursor: pointer;
  min-width: 0;
}
.movers-col li:hover { background: rgba(255,255,255,0.03); }
.movers-col li img { width: 18px; height: 18px; border-radius: 50%; object-fit: cover; }
.movers-col li .ico-fallback {
  width: 18px; height: 18px; border-radius: 50%;
  background: rgba(255,255,255,0.08);
  display: flex; align-items: center; justify-content: center;
  font-size: 0.55rem; font-weight: 700;
  color: rgba(255,255,255,0.6);
}
.movers-col .sym {
  font-weight: 700;
  letter-spacing: 0.04em;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  min-width: 0;
}
.movers-col .chg {
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  font-size: 0.78rem;
  white-space: nowrap;
}
.movers-col .chg.up { color: var(--success-green, #00ff88); }
.movers-col .chg.down { color: #ff4d6a; }

@media (max-width: 540px) {
  .movers { grid-template-columns: 1fr; }
}
</style>
