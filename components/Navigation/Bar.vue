<script setup>
import { useMacroStore } from '~/stores/macro'
import WalletIcon from '~/components/Navigation/Icons/WalletIcon.vue'
import PricesIcon from '~/components/Navigation/Icons/PricesIcon.vue'
import NewsGlobeIcon from '~/components/Navigation/Icons/NewsGlobeIcon.vue'
import ChatBadgeIcon from '~/components/Navigation/Icons/ChatBadgeIcon.vue'
import StrategyOrbitIcon from '~/components/Navigation/Icons/StrategyOrbitIcon.vue'
</script>

<template>
    <div class="">
        <div class="NavigationBar">
            <NuxtLink to="/prices" class="NavigationButton">
                <PricesIcon :size="28" />
                <p>Prices</p>
            </NuxtLink>
            <NuxtLink to="/news" class="NavigationButton">
                <NewsGlobeIcon :size="28" />
                <p>News</p>
            </NuxtLink>
            <NuxtLink to="/wallet" class="NavigationButton">
                <WalletIcon :size="28" />
                <p>Wallet</p>
            </NuxtLink>
            <NuxtLink to="/strategies" class="NavigationButton">
                <StrategyOrbitIcon :size="28" />
                <p>Strategies</p>
            </NuxtLink>
            <NuxtLink to="/chat" class="NavigationButton">
                <ChatBadgeIcon :size="28" />
                <p>Chat</p>
            </NuxtLink>
        </div>
    </div>
</template>

<style scoped>
.NavigationBar {
    display: flex;
    position: fixed;
    bottom: 0;
    left: 0;
    flex-direction: row;
    justify-content: space-around; /* Distribute evenly on mobile */
    align-items: center;
    width: 100%;
    height: 4.5rem; /* rem sizing */
    padding: 0.5rem; /* smaller padding for mobile */
    background: linear-gradient(270deg, #111 -0.15%, rgba(40, 40, 40, 0.90) 50%, #111 99.96%);
    backdrop-filter: blur(10px);
    box-shadow: 0px -4px 12px rgba(0, 0, 0, 0.3);
    z-index: 50; /* Add z-index */
}

.NavigationButton {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 0.2rem;
    flex: 1; /* allow spreading */
    color: rgba(255, 255, 255, 0.6);
    text-decoration: none;
    transition: all 0.3s ease;
    border-radius: var(--app-border-radius, 8px);
    padding: 0.4rem 0;
}

.NavigationButton p {
    margin: 0;
    font-size: 0.65rem;
    font-family: 'Poppins', sans-serif;
    font-weight: 500;
}

/* Hover and Active states - No more stark white background */
.NavigationButton:hover {
    color: #fff;
    background-color: rgba(255, 255, 255, 0.05);
    transform: translateY(-2px);
}

.router-link-exact-active {
    color: var(--primary-green, #31d0aa);
    background-color: rgba(49, 208, 170, 0.1);
}

/* Tablet/Desktop overrides */
@media (min-width: 768px) {
    .NavigationBar {
        padding: 0 4rem;
        height: 5rem;
    }
    .NavigationButton p {
        font-size: 0.8rem;
    }
}
</style>
