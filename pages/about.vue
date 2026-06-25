<script setup lang="ts">
import UIPageHeader from '@/components/UI/PageHeader.vue'
import UICard from '@/components/UI/Card.vue'
import UIPill from '@/components/UI/Pill.vue'

definePageMeta({ title: 'About', layout: 'default' })
</script>

<template>
  <div class="about-page">
    <UIPageHeader title="About Strades" subtitle="A living financial organism." badge="v0.2" />

    <UICard title="Vision">
      <p>
        Strades is built around <strong>perpetual financial fluctuations</strong>. Capital is never idle —
        your wallet is a 100% allocation pie constantly rebalancing across fiat, crypto, stocks, and commodities,
        driven by your strategies, agents, and the swarm.
      </p>
    </UICard>

    <UICard title="Pillars">
      <ul class="pillars">
        <li><UIPill tone="info">1</UIPill> <strong>Market &amp; Corporate intelligence</strong> — watch every asset and the web behind it.</li>
        <li><UIPill tone="info">2</UIPill> <strong>Social platform</strong> — opinions, sentiment, influencer signals.</li>
        <li><UIPill tone="info">3</UIPill> <strong>Wallet &amp; strategy creator</strong> — node trees, 100% allocation enforcer.</li>
        <li><UIPill tone="info">4</UIPill> <strong>Messaging</strong> — communicate, share live trades, form communities.</li>
      </ul>
    </UICard>

    <UICard title="Get in touch">
      <p>
        Reach the team via the <NuxtLink to="/contact">contact page</NuxtLink>, or report a bug at
        <a href="https://github.com" target="_blank" rel="noopener">github</a>.
      </p>
    </UICard>
  </div>
</template>

<style scoped>
.about-page { display: flex; flex-direction: column; gap: 0.75rem; max-width: 720px; margin: 0 auto; }
p { margin: 0; font-size: 0.88rem; color: rgba(255,255,255,0.8); line-height: 1.55; }
p a, .pillars a { color: var(--primary-green, #00ff88); }
.pillars { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.55rem; }
.pillars li {
  display: flex;
  gap: 0.6rem;
  align-items: baseline;
  font-size: 0.85rem;
  color: rgba(255,255,255,0.85);
}
</style>
