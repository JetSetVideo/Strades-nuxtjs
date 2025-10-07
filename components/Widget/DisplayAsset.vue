<script setup>
defineProps({
  assetName: String,
  tagName: String,
  nominalPrice: String,
  percentagePrice: String,
  profileIcon: String,
  dailyChart: String,
  assetId: String,
});

defineEmits(['click']);
</script>

<template>
  <div class="widget-asset" @click="$emit('click', assetId)">
    <div class="profil-icon">
      <img :src="profileIcon" :alt="`${assetName} icon`">
      <div class="icon-overlay">{{ tagName }}</div>
    </div>
    <div class="tags-names">
      <p class="full-name">{{ assetName }}</p>
      <p class="tag-name">{{ tagName }}</p>
      <div class="toolbar">
        <span class="price-display">{{ nominalPrice }}</span>
        <span :class="['change-display', { 'positive': percentagePrice.includes('+') || (!percentagePrice.includes('-') && parseFloat(percentagePrice) > 0), 'negative': percentagePrice.includes('-') || parseFloat(percentagePrice) < 0 }]">
          {{ percentagePrice }}
        </span>
      </div>
    </div>
    <div class="display-prices">
      <div class="daily-price-chart">
        <img :src="dailyChart" :alt="`${assetName} price chart`">
      </div>
    </div>
  </div>
</template>

<style scoped>
.widget-asset {
  width: 100%;
  background: var(--card-bg);
  border-radius: var(--radius-lg);
  padding: var(--spacing-md);
  cursor: pointer;
  transition: var(--transition-normal);
  box-shadow: var(--shadow-primary);
  border: 1px solid var(--border-primary);
  margin-bottom: var(--spacing-md);
}

.widget-asset:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-accent);
  border-color: var(--primary-green);
}

.profil-icon {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: var(--spacing-sm);
}

.profil-icon img {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid var(--border-secondary);
}

.icon-overlay {
  position: absolute;
  top: -8px;
  right: -8px;
  background: var(--primary-gradient);
  color: var(--secondary-darker);
  font-size: 0.7rem;
  font-weight: bold;
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-xl);
  border: 2px solid var(--secondary-dark);
  font-family: var(--font-family-secondary);
}

.tags-names {
  margin-bottom: var(--spacing-sm);
}

.full-name {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text-white);
  margin: 0 0 var(--spacing-xs) 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: var(--font-family-primary);
}

.tag-name {
  font-size: 0.8rem;
  color: var(--primary-green);
  background: var(--bg-accent);
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  display: inline-block;
  margin-bottom: var(--spacing-sm);
  border: 1px solid var(--primary-green);
  font-family: var(--font-family-secondary);
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  background: rgba(0, 0, 0, 0.3);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-secondary);
}

.price-display {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-white);
  font-family: var(--font-family-primary);
}

.change-display {
  font-size: 0.9rem;
  font-weight: 500;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  transition: var(--transition-normal);
  font-family: var(--font-family-secondary);
}

.change-display.positive {
  color: var(--success-green);
  background: rgba(0, 255, 136, 0.1);
  border: 1px solid var(--success-green);
}

.change-display.negative {
  color: var(--error-red);
  background: rgba(255, 68, 68, 0.1);
  border: 1px solid var(--error-red);
}

.display-prices {
  display: flex;
  justify-content: center;
}

.daily-price-chart {
  width: 100%;
  height: 60px;
  overflow: hidden;
  border-radius: var(--radius-md);
}

.daily-price-chart img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-secondary);
}

/* Responsive adjustments */
@media (max-width: 480px) {
  .widget-asset {
    padding: var(--spacing-sm);
  }

  .profil-icon img {
    width: 40px;
    height: 40px;
  }

  .full-name {
    font-size: 1rem;
  }

  .toolbar {
    padding: var(--spacing-xs) var(--spacing-sm);
  }

  .price-display {
    font-size: 0.9rem;
  }

  .change-display {
    font-size: 0.8rem;
  }
}
</style>