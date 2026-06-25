<script setup lang="ts">
import UIPageHeader from '@/components/UI/PageHeader.vue'
import UICard from '@/components/UI/Card.vue'

definePageMeta({ title: 'Help', layout: 'default' })

const sections = [
  { title: 'Wallet & 100% allocation', body: 'Drag any slider — the others auto-rebalance so the four asset classes always sum to 100%. The dominant class subtly drives the entire app theme (border-radius, colors).' },
  { title: 'Agents & swarm', body: 'Your personal Avatar trains on every interaction. Plug other users\' agents into your swarm; their opinion vectors aggregate into a single advisory allocation you can apply with one click.' },
  { title: 'Strategies & bots', body: 'Build a node tree in the Creator, backtest, deploy. A deployed strategy attached to a platform becomes a live Bot, tracked in the Trading Lab.' },
  { title: 'News & sentiment', body: 'The globe icon rotates toward the latest news geo-origin. Posts are tinted by political leaning and shake when controversy spikes.' }
]
</script>

<template>
  <div class="help-page">
    <UIPageHeader title="Help" subtitle="Quick reference for how Strades thinks." />
    <UICard v-for="s in sections" :key="s.title" :title="s.title">
      <p>{{ s.body }}</p>
    </UICard>
    <UICard title="Need more?">
      <p>Open the <NuxtLink to="/contact">contact page</NuxtLink> or check <NuxtLink to="/about">About</NuxtLink>.</p>
    </UICard>
  </div>
</template>

<style scoped>
.help-page { display: flex; flex-direction: column; gap: 0.6rem; max-width: 720px; margin: 0 auto; }
p { margin: 0; font-size: 0.85rem; line-height: 1.5; color: rgba(255,255,255,0.8); }
p a { color: var(--primary-green, #00ff88); }
</style>
