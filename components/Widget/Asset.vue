<script setup>
import { ref } from 'vue';

defineProps({
    company: Object,
    crypto: Object
})

const sentiment = ref(null);

const selectSentiment = (direction) => {
  sentiment.value = sentiment.value === direction ? null : direction;
};
</script>

<template>
<div class="widget-asset">
    <div class="arrow-buttons">
      <ButtonUparrow @click="selectSentiment('up')" :class="{ 'selected': sentiment === 'up' }" />
      <ButtonDownarrow @click="selectSentiment('down')" :class="{ 'selected': sentiment === 'down' }" />
    </div>
    <NuxtLink :to="`/assets/${company ? company.id : (crypto ? crypto.id : '')}`" class="link-full-width">
        <div class="asset-content">
            <div class="asset-icon">
                <img :src="company ? company.profileIcon : (crypto ? crypto.icon : '')" alt="asset-icon">
            </div>
            <div class="asset-details">
                <p class="asset-name">{{ company ? company.name : (crypto ? crypto.name : 'Asset Name') }}</p>
                <p class="asset-symbol">{{ company ? company.symbol : (crypto ? crypto.symbol : '@Symbol') }}</p>
            </div>
            <div class="price-chart">
                <!-- Replace with actual chart component -->
                <img src="~/assets/backgrounds/DailyPriceChart.png" alt="price-chart">
            </div>
            <div class="price-info">
                <p class="current-price">{{ company ? company.stock_price_usd : (crypto ? crypto.price_usd : '0.00') }}</p>
                <p class="price-change" :class="{ 'price-up': (company ? company.change_percent : (crypto ? crypto.change_percent : 0)) > 0, 'price-down': (company ? company.change_percent : (crypto ? crypto.change_percent : 0)) < 0 }">
                    {{ company ? company.change_percent : (crypto ? crypto.change_percent : '0.00') }}%
                </p>
            </div>
        </div>
    </NuxtLink>
    <ButtonOptions class="options-button" />
</div>
</template>

<style scoped>
.widget-asset {
    display: flex;
    background-color: #1a1a1a;
    position: relative;
    margin: 0.3rem 0.1rem;
    border-radius: 8px;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
    overflow: hidden;
    padding: 10px;
}

.arrow-buttons {
    display: flex;
    flex-direction: column;
    position: absolute;
    left: -30px;
    top: 50%;
    transform: translateY(-50%);
}

.link-full-width {
    display: flex;
    width: 100%;
    text-decoration: none;
    color: inherit;
}

.asset-content {
    display: flex;
    align-items: center;
    width: 100%;
}

.asset-icon img {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    margin-right: 10px;
}

.asset-details {
    flex: 1;
}

.asset-name {
    font-size: 1.2rem;
    font-weight: bold;
    color: white;
    margin: 0;
}

.asset-symbol {
    font-size: 0.9rem;
    color: #ffa500;
    margin: 0;
}

.price-chart {
    width: 100px;
    height: 40px;
    margin: 0 10px;
}

.price-chart img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.price-info {
    text-align: right;
}

.current-price {
    font-size: 1.2rem;
    font-weight: bold;
    color: white;
    margin: 0;
}

.price-change {
    font-size: 0.9rem;
    margin: 0;
}

.price-up {
    color: #00ff00;
}

.price-down {
    color: #ff0000;
}

.options-button {
    position: absolute;
    right: 10px;
    top: 50%;
    transform: translateY(-50%);
}
</style>