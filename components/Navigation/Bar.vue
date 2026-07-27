<script setup lang="ts">
import { watch } from 'vue'
import { useRoute } from 'vue-router'
import PricesIcon from '~/components/Navigation/Icons/PricesIcon.vue'
import NewsGlobeIcon from '~/components/Navigation/Icons/NewsGlobeIcon.vue'
import WalletIcon from '~/components/Navigation/Icons/WalletIcon.vue'
import StrategyOrbitIcon from '~/components/Navigation/Icons/StrategyOrbitIcon.vue'
import ChatBadgeIcon from '~/components/Navigation/Icons/ChatBadgeIcon.vue'

const route = useRoute()
const { playHover, playClick, playActiveRoute } = useNavSound()

watch(() => route.path, () => playActiveRoute())

const navItems = [
  { to: '/prices',     label: 'Prices',     icon: 'prices'     },
  { to: '/news',       label: 'News',       icon: 'news'       },
  { to: '/wallet',     label: 'Wallet',     icon: 'wallet'     },
  { to: '/strategies', label: 'Lab',        icon: 'strategies' },
  { to: '/chat',       label: 'Chat',       icon: 'chat'       },
]
</script>

<template>
  <nav class="nav-bar" role="navigation" aria-label="Main navigation">
    <NuxtLink
      v-for="item in navItems"
      :key="item.to"
      :to="item.to"
      class="nav-btn"
      :aria-label="item.label"
      @mouseenter="playHover"
      @click="playClick"
    >
      <span class="icon-wrap">
        <PricesIcon        v-if="item.icon === 'prices'"     :size="26" />
        <NewsGlobeIcon     v-else-if="item.icon === 'news'"  :size="26" />
        <WalletIcon        v-else-if="item.icon === 'wallet'" :size="26" />
        <StrategyOrbitIcon v-else-if="item.icon === 'strategies'" :size="26" />
        <ChatBadgeIcon     v-else-if="item.icon === 'chat'"  :size="26" />
      </span>
      <span class="nav-label">{{ item.label }}</span>
      <span class="active-dot" aria-hidden="true" />
    </NuxtLink>
  </nav>
</template>

<style scoped>
.nav-bar {
  position: fixed;
  bottom: 0; left: 0; right: 0;
  z-index: var(--z-fixed, 1030);
  display: flex;
  align-items: stretch;
  height: var(--nav-bottom-height, 4rem);
  padding: 0 0.25rem;
  padding-bottom: env(safe-area-inset-bottom, 0);
  background: linear-gradient(180deg, rgba(17,17,17,0.85) 0%, rgba(17,17,17,0.97) 100%);
  backdrop-filter: blur(14px);
  border-top: 1px solid rgba(255,255,255,0.05);
  box-shadow: 0 -6px 18px rgba(0, 0, 0, 0.45);
  animation: bar-enter 0.4s cubic-bezier(0.22,1,0.36,1) 0.1s both;
}

@keyframes bar-enter {
  from { transform: translateY(100%); opacity: 0; }
  to   { transform: translateY(0);    opacity: 1; }
}

.nav-btn {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.2rem;
  flex: 1;
  text-decoration: none;
  color: rgba(255,255,255,0.45);
  border-radius: var(--radius-md, 0.5rem);
  margin: 0.3rem 0.1rem;
  transition:
    color var(--transition-fast, 0.2s ease),
    background var(--transition-fast, 0.2s ease),
    transform var(--transition-fast, 0.2s ease);
  -webkit-tap-highlight-color: transparent;
}

.nav-btn:hover {
  color: rgba(255,255,255,0.85);
  background: var(--nav-hover-bg, rgba(255,255,255,0.05));
  transform: translateY(-2px);
}

.router-link-active.nav-btn,
.router-link-exact-active.nav-btn {
  color: var(--nav-active-color, #00ff88);
  background: var(--nav-active-bg, rgba(0,255,136,0.08));
  animation: nav-arrive 0.25s cubic-bezier(0.34,1.56,0.64,1);
}

@keyframes nav-arrive {
  0%   { transform: translateY(0) scale(1); }
  40%  { transform: translateY(-4px) scale(1.04); }
  100% { transform: translateY(0) scale(1); }
}

.icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  flex-shrink: 0;
  transition: transform var(--transition-fast, 0.2s ease),
              filter   var(--transition-fast, 0.2s ease);
}
.nav-btn:hover .icon-wrap {
  transform: scale(1.12) translateY(-1px);
  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.4));
}
.router-link-active .icon-wrap,
.router-link-exact-active .icon-wrap {
  transform: scale(1.06);
  filter: drop-shadow(0 0 4px rgba(0,255,136,0.25));
}

.nav-btn:active {
  transform: scale(0.93) translateY(0);
  transition-duration: 0.08s;
}

.nav-label {
  margin: 0;
  font-family: var(--font-family-primary, 'Poppins'), sans-serif;
  font-size: 0.6rem;
  font-weight: 500;
  letter-spacing: 0.04em;
  line-height: 1;
}

.active-dot {
  position: absolute;
  bottom: 0.2rem;
  left: 50%;
  transform: translateX(-50%) scaleX(0);
  width: 1.2rem;
  height: 0.18rem;
  border-radius: 999px;
  background: var(--nav-active-color, #00ff88);
  box-shadow: 0 0 0.4rem rgba(0,255,136,0.6);
  transition: transform 0.25s cubic-bezier(0.34,1.56,0.64,1);
}
.router-link-active .active-dot,
.router-link-exact-active .active-dot {
  transform: translateX(-50%) scaleX(1);
}

@media (min-width: 768px) {
  .nav-bar {
    height: var(--nav-bottom-height-md, 4.5rem);
    padding: 0 2rem;
    padding-bottom: env(safe-area-inset-bottom, 0);
  }
  .nav-label { font-size: 0.7rem; }
}
</style>
