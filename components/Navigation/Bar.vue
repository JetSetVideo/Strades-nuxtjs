<script setup lang="ts">
import WalletIcon from '~/components/Navigation/Icons/WalletIcon.vue'
import PricesIcon from '~/components/Navigation/Icons/PricesIcon.vue'
import NewsGlobeIcon from '~/components/Navigation/Icons/NewsGlobeIcon.vue'
import ChatBadgeIcon from '~/components/Navigation/Icons/ChatBadgeIcon.vue'
import StrategyOrbitIcon from '~/components/Navigation/Icons/StrategyOrbitIcon.vue'
</script>

<template>
  <nav class="NavigationBar" aria-label="Primary">
    <NuxtLink to="/prices" class="NavigationButton">
      <PricesIcon :size="24" />
      <p>Prices</p>
    </NuxtLink>
    <NuxtLink to="/news" class="NavigationButton">
      <NewsGlobeIcon :size="24" />
      <p>News</p>
    </NuxtLink>
    <NuxtLink to="/wallet" class="NavigationButton">
      <WalletIcon :size="24" />
      <p>Wallet</p>
    </NuxtLink>
    <NuxtLink to="/strategies" class="NavigationButton">
      <StrategyOrbitIcon :size="24" />
      <p>Lab</p>
    </NuxtLink>
    <NuxtLink to="/chat" class="NavigationButton">
      <ChatBadgeIcon :size="24" />
      <p>Chat</p>
    </NuxtLink>
  </nav>
</template>

<style scoped>
.NavigationBar {
  display: flex;
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  flex-direction: row;
  justify-content: space-around;
  align-items: stretch;
  width: 100%;
  height: 3.85rem;
  padding-bottom: env(safe-area-inset-bottom, 0);
  background: linear-gradient(180deg, rgba(17,17,17,0.85) 0%, rgba(17,17,17,0.97) 100%);
  backdrop-filter: blur(14px);
  border-top: 1px solid rgba(255,255,255,0.05);
  box-shadow: 0 -6px 18px rgba(0, 0, 0, 0.45);
  z-index: 50;
}

.NavigationButton {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 0.1rem;
  flex: 1;
  color: rgba(255, 255, 255, 0.5);
  text-decoration: none;
  transition: color var(--app-animation-speed, 0.3s) ease, transform 0.18s ease;
  position: relative;
  min-width: 0;
  padding: 0.25rem 0;
}

.NavigationButton::before {
  content: '';
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%) scaleX(0);
  width: 32px;
  height: 2.5px;
  border-radius: 0 0 3px 3px;
  background: var(--primary-green, #00ff88);
  box-shadow: 0 0 8px var(--primary-green, #00ff88);
  transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1);
}

.NavigationButton p {
  margin: 0;
  font-size: 0.6rem;
  font-family: 'Poppins', sans-serif;
  font-weight: 500;
  letter-spacing: 0.04em;
}

.NavigationButton:hover {
  color: #fff;
  transform: translateY(-1px);
}

.router-link-exact-active {
  color: var(--primary-green, #00ff88);
}
.router-link-exact-active::before { transform: translateX(-50%) scaleX(1); }

@media (min-width: 768px) {
  .NavigationBar {
    height: 4.2rem;
  }
  .NavigationButton p { font-size: 0.7rem; }
}
</style>
