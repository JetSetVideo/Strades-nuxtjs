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

// Each destination carries its own accent so the active state
// communicates *where you are* through color, not just position.
const navItems = [
  { to: '/prices',     label: 'Prices',     icon: 'prices',     accent: '0,180,255'  },
  { to: '/news',       label: 'News',       icon: 'news',       accent: '0,170,255'  },
  { to: '/wallet',     label: 'Wallet',     icon: 'wallet',     accent: '245,166,35' },
  { to: '/strategies', label: 'Lab',        icon: 'strategies', accent: '0,255,136'  },
  { to: '/chat',       label: 'Chat',       icon: 'chat',       accent: '120,220,180' },
]
</script>

<template>
  <nav class="nav-bar" role="navigation" aria-label="Main navigation">
    <NuxtLink
      v-for="item in navItems"
      :key="item.to"
      :to="item.to"
      class="nav-btn"
      :style="{ '--accent': item.accent }"
      :aria-label="item.label"
      @mouseenter="playHover"
      @click="playClick"
    >
      <span class="aurora" aria-hidden="true" />
      <span class="icon-wrap">
        <PricesIcon        v-if="item.icon === 'prices'"     :size="30" />
        <NewsGlobeIcon     v-else-if="item.icon === 'news'"  :size="30" />
        <WalletIcon        v-else-if="item.icon === 'wallet'" :size="30" />
        <StrategyOrbitIcon v-else-if="item.icon === 'strategies'" :size="30" />
        <ChatBadgeIcon     v-else-if="item.icon === 'chat'"  :size="30" />
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
  --accent: 0,255,136;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.2rem;
  flex: 1;
  overflow: hidden;
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
  color: rgb(var(--accent));
  background: linear-gradient(180deg, rgba(var(--accent), 0.12) 0%, rgba(var(--accent), 0.03) 100%);
  animation: nav-arrive 0.3s cubic-bezier(0.34,1.56,0.64,1);
}

@keyframes nav-arrive {
  0%   { transform: translateY(0) scale(1); }
  40%  { transform: translateY(-4px) scale(1.05); }
  100% { transform: translateY(0) scale(1); }
}

/* Soft radial "aurora" that breathes behind the active icon */
.aurora {
  position: absolute;
  top: -30%;
  left: 50%;
  width: 3.6rem;
  height: 3.6rem;
  transform: translateX(-50%) scale(0);
  border-radius: 50%;
  background: radial-gradient(circle, rgba(var(--accent), 0.35) 0%, rgba(var(--accent), 0) 68%);
  pointer-events: none;
  transition: transform 0.35s cubic-bezier(0.22,1,0.36,1);
}
.router-link-active .aurora,
.router-link-exact-active .aurora {
  transform: translateX(-50%) scale(1);
  animation: aurora-breathe 3.4s ease-in-out infinite;
}
@keyframes aurora-breathe {
  0%, 100% { opacity: 0.65; }
  50%      { opacity: 1; }
}

.icon-wrap {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  flex-shrink: 0;
  transition: transform 0.25s cubic-bezier(0.34,1.56,0.64,1),
              filter   var(--transition-fast, 0.2s ease);
}
.nav-btn:hover .icon-wrap {
  transform: scale(1.14) translateY(-1px) rotate(-3deg);
  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.4));
}
.router-link-active .icon-wrap,
.router-link-exact-active .icon-wrap {
  transform: scale(1.08) translateY(-1px);
  filter: drop-shadow(0 0 5px rgba(var(--accent), 0.35));
}

.nav-btn:active {
  transform: scale(0.93) translateY(0);
  transition-duration: 0.08s;
}
.nav-btn:active .icon-wrap {
  transform: scale(0.9);
  transition-duration: 0.08s;
}

.nav-label {
  position: relative;
  z-index: 1;
  margin: 0;
  font-family: var(--font-family-primary, 'Poppins'), sans-serif;
  font-size: 0.6rem;
  font-weight: 500;
  letter-spacing: 0.04em;
  line-height: 1;
  transition: letter-spacing 0.25s ease, font-weight 0.25s ease;
}
.router-link-active .nav-label,
.router-link-exact-active .nav-label {
  font-weight: 700;
  letter-spacing: 0.1em;
}

.active-dot {
  position: absolute;
  bottom: 0.2rem;
  left: 50%;
  transform: translateX(-50%) scaleX(0);
  width: 1.4rem;
  height: 0.18rem;
  border-radius: 999px;
  background: linear-gradient(90deg, transparent, rgb(var(--accent)), transparent);
  box-shadow: 0 0 0.5rem rgba(var(--accent), 0.7);
  transition: transform 0.3s cubic-bezier(0.34,1.56,0.64,1);
}
.router-link-active .active-dot,
.router-link-exact-active .active-dot {
  transform: translateX(-50%) scaleX(1);
}

@media (min-width: 768px) {
  .nav-bar {
    height: var(--nav-bottom-height-md, 4.4rem);
    padding: 0 2rem;
    padding-bottom: env(safe-area-inset-bottom, 0);
  }
  .nav-label { font-size: 0.7rem; }
  .icon-wrap { width: 2.15rem; height: 2.15rem; }
}
</style>
