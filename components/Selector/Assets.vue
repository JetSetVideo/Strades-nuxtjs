<script setup>
import { computed } from 'vue';
import { useAssetsStore } from '@/stores/assets';

const props = defineProps({
  assets: {
    type: Array,
    default: () => []
  },
  selectedType: {
    type: String,
    default: 'all'
  }
});

const assetsStore = useAssetsStore();

defineEmits(['asset-selected']);

// Get filtered assets based on selected type
const filteredAssets = computed(() => {
  if (!props.assets || props.assets.length === 0) {
    return assetsStore.assets.filter(asset =>
      props.selectedType === 'all' || asset.type === props.selectedType
    ).slice(0, 8); // Show first 8 assets
  }

  return props.assets.filter(asset =>
    props.selectedType === 'all' || asset.type === props.selectedType
  ).slice(0, 8);
});

// Get asset types for filtering
const assetTypes = computed(() => {
  const types = new Set(assetsStore.assets.map(asset => asset.type));
  return ['all', ...Array.from(types)];
});
</script>

<template>
  <div class="asset-selector">
    <div class="asset-grid">
      <div
        v-for="asset in filteredAssets"
        :key="asset.id"
        class="asset-card"
        @click="$emit('asset-selected', asset)"
      >
        <div class="asset-icon">
          <img :src="asset.icon_url" :alt="`${asset.name} icon`" />
        </div>
        <div class="asset-info">
          <div class="asset-name">{{ asset.name }}</div>
          <div class="asset-symbol">{{ asset.symbol }}</div>
          <div class="asset-price">
            ${{ asset.current_price.toFixed(asset.current_price < 1 ? 4 : 2) }}
          </div>
        </div>
        <div class="asset-type-badge" :class="`type-${asset.type}`">
          {{ asset.type.replace('_', ' ').toUpperCase() }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.asset-selector {
  width: 100%;
}

.asset-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
}

.asset-card {
  background: linear-gradient(135deg, #1e1e1e 0%, #2e2e2e 100%);
  border-radius: 12px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.3s ease;
  border: 1px solid #444;
  position: relative;
  overflow: hidden;
}

.asset-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 255, 136, 0.2);
  border-color: #00ff88;
}

.asset-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
}

.asset-icon img {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid #555;
}

.asset-info {
  text-align: center;
  margin-bottom: 12px;
}

.asset-name {
  font-size: 1rem;
  font-weight: 600;
  color: white;
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.asset-symbol {
  font-size: 0.8rem;
  color: #00ff88;
  background: rgba(0, 255, 136, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
  display: inline-block;
  margin-bottom: 8px;
  border: 1px solid #00ff88;
}

.asset-price {
  font-size: 1rem;
  font-weight: 600;
  color: #fff;
}

.asset-type-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  font-size: 0.6rem;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 8px;
  color: white;
}

.type-cryptocurrency {
  background: linear-gradient(45deg, #f7931a, #ff6b35);
}

.type-stock {
  background: linear-gradient(45deg, #00ff88, #00aaff);
}

.type-fiat_currency {
  background: linear-gradient(45deg, #ff6b6b, #ffa500);
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .asset-grid {
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 12px;
  }

  .asset-card {
    padding: 12px;
  }

  .asset-icon img {
    width: 40px;
    height: 40px;
  }

  .asset-name {
    font-size: 0.9rem;
  }

  .asset-price {
    font-size: 0.9rem;
  }
}

@media (max-width: 480px) {
  .asset-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>