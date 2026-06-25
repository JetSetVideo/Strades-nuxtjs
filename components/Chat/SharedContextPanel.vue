<script setup lang="ts">
import { computed } from 'vue'
import type { ShareContextItem } from '~/stores/shares'
import ChatSharePayload from '~/components/Chat/SharePayload.vue'

const props = defineProps<{
  items: ShareContextItem[]
  assetSymbols?: string[]
}>()

const uniqueAssets = computed(() => {
  const map = new Map<string, { symbol: string; name: string; price: number; asset_id?: string }>()
  for (const item of props.items) {
    for (const a of item.assets) {
      if (!map.has(a.symbol)) map.set(a.symbol, a)
    }
  }
  return [...map.values()].slice(0, 6)
})

const recentShares = computed(() => props.items.slice(0, 5))
</script>

<template>
  <aside v-if="items.length || uniqueAssets.length" class="context-panel">
    <header class="panel-head">
      <span class="panel-title">Shared context</span>
      <span class="panel-count">{{ items.length }}</span>
    </header>

    <section v-if="uniqueAssets.length" class="panel-block">
      <h3>Correlated assets</h3>
      <div class="asset-chips">
        <NuxtLink
          v-for="a in uniqueAssets"
          :key="a.symbol"
          :to="a.asset_id ? `/assets/${a.asset_id}` : '/prices'"
          class="asset-chip"
        >
          <span class="sym">{{ a.symbol }}</span>
          <span v-if="a.price" class="px">${{ a.price < 1 ? a.price.toFixed(4) : a.price.toFixed(2) }}</span>
        </NuxtLink>
      </div>
    </section>

    <section v-if="recentShares.length" class="panel-block">
      <h3>In this thread</h3>
      <div class="share-list">
        <ChatSharePayload
          v-for="item in recentShares"
          :key="item.share.id"
          :attachment="{
            type: 'share',
            share_kind: item.share.kind,
            title: item.share.title ?? item.share.asset_symbol,
            description: item.share.note,
            url: item.share.url,
            asset_id: item.share.asset_id,
            asset_symbol: item.share.asset_symbol,
            strategy_id: item.share.strategy_id,
            opinion_vector: item.share.opinion_vector
          }"
          compact
        />
      </div>
    </section>
  </aside>
</template>

<style scoped>
.context-panel {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.55rem;
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: var(--app-border-radius, 8px);
  min-width: 0;
  max-height: 100%;
  overflow-y: auto;
}
.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.4rem;
}
.panel-title {
  font-size: 0.65rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.55);
  font-weight: 700;
}
.panel-count {
  font-size: 0.6rem;
  font-weight: 800;
  padding: 1px 6px;
  border-radius: 999px;
  background: rgba(0,255,136,0.1);
  color: var(--primary-green, #00ff88);
}
.panel-block h3 {
  margin: 0 0 0.35rem;
  font-size: 0.58rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.4);
}
.asset-chips { display: flex; flex-wrap: wrap; gap: 0.3rem; }
.asset-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.25rem 0.5rem;
  border-radius: 999px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  text-decoration: none;
  color: inherit;
  font-size: 0.68rem;
}
.asset-chip:hover { border-color: var(--primary-green, #00ff88); }
.sym { font-weight: 800; letter-spacing: 0.04em; }
.px { color: rgba(255,255,255,0.55); font-variant-numeric: tabular-nums; }
.share-list { display: flex; flex-direction: column; gap: 0.35rem; }
</style>
