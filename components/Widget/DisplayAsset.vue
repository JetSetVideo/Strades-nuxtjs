<script setup>
defineProps({
  assetName: String,
  tagName: String,
  nominalPrice: String,
  percentagePrice: String,
  profileIcon: String,
  dailyChart: String,
});
</script>

<template>
  <NuxtLink to="/assets">
    <div class="widget-asset">
      <div class="profil-icon">
        <img :src="profileIcon" alt="profil-icon">
        <div class="icon-overlay">TEST</div>
      </div>
      <div class="tags-names">
        <p class="full-name">{{ assetName }}</p>
        <p class="tag-name">{{ tagName }}</p>
        <div class="toolbar">Tool Bar</div>
      </div>
      <div class="display-prices">
        <div class="price-evolution">
          <div class="nominal-price">
            {{ nominalPrice }}
          </div>
          <div class="pourcentage-price">
            {{ percentagePrice }}
          </div>
        </div>
        <div class="daily-price-chart">
          <img :src="dailyChart" alt="daily-price-chart">
        </div>
      </div>
    </div>
  </NuxtLink>
</template>

<style>
.tag-name {
  font-size: 0.8rem;
  color: #ffffff;
  background-color: rgba(0, 0, 0, 0.5);
  padding: 0.2rem;
  border-radius: 8px;
}
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  background-color: rgba(0, 0, 0, 0.5);
  border-radius: 8px;
  color: #ffffff;
}
</style>