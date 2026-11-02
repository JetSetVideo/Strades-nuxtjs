<script setup lang="ts">
import UIPageHeader from '@/components/UI/PageHeader.vue'
import UICard from '@/components/UI/Card.vue'

definePageMeta({ title: 'Help', layout: 'default' })

// Each section ends with a link to the page where you do it (3-click rule: Help → page = 1 click).
// Strades is closed-beta PAPER trading: no real money, no live execution.
const sections = [
  { title: 'Prices, calls and paper trades', to: '/prices', body: 'Tap an asset to open it, paper-trade it, or click its chart to make a call (direction, horizon, confidence). Calls get scored when their horizon ends.' },
  { title: 'Wallet & 100% allocation', to: '/wallet', body: 'Your paper money across your wallets. Drag any slider: the others rebalance so the four asset classes always sum to 100%. Sample wallets are chipped Sample and never counted as yours.' },
  { title: 'Agents & your avatar', to: '/profile', body: 'Your personal avatar learns from what you do in the app (calls, reads, trades). Plug other agents from the Avatar Marketplace; their views combine into one advisory allocation you choose to apply.' },
  { title: 'Strategies & bots', to: '/creator', body: 'Build rules in the Strategy Creator, backtest them, then run one as a paper bot. Your strategies and bots live in the Lab.' },
  { title: 'Directions and risk budget', to: '/settings#primary', body: 'Starting capital, fees, max position, stop loss: the primary values every number is computed from, and the limits your agent works within.' },
  { title: 'News & sentiment', to: '/news', body: 'Stories with their sentiment. Read, react, comment and share an article with a friend in Chat.' },
]
</script>

<template>
  <div class="help-page">
    <UIPageHeader title="Help" subtitle="How each part of Strades works, with a link to where you do it." />
    <UICard v-for="s in sections" :key="s.title" :title="s.title">
      <p>{{ s.body }}</p>
      <NavigationNextLink :to="s.to" :label="`Open ${routeLabel(s.to.split('#')[0]!)}`" />
    </UICard>
    <UICard title="Need more?">
      <p>Open the <NuxtLink to="/contact">contact page</NuxtLink> or check <NuxtLink to="/about">About</NuxtLink>.</p>
    </UICard>
  </div>
</template>

<style scoped>
.help-page { display: flex; flex-direction: column; gap: 0.6rem; max-width: 720px; margin: 0 auto; }
p { margin: 0 0 0.35rem; font-size: 0.85rem; line-height: 1.5; color: rgba(255,255,255,0.8); }
p a { color: var(--primary-green, #00ff88); }
</style>
