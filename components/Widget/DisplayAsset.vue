<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'

const props = defineProps({
  assetName: String,
  tagName: String,
  nominalPrice: [String, Number],
  percentagePrice: [String, Number],
  profileIcon: String,
  dailyChart: String,
  assetId: String,
})

defineEmits(['click'])

const sparkValues = ref<number[]>([])
const tradeAmount = ref(0)
const tradePrice = ref(0)

onMounted(async () => {
  try {
    const wallets = await $fetch('/data/core/wallets.json')
    const w = Array.isArray(wallets) && wallets.length ? wallets[0] : null
    if (w && w.performance_history) {
      const order = ['1d', '7d', '30d', '90d', '1y']
      sparkValues.value = order
        .filter(k => w.performance_history[k])
        .map(k => Number(w.performance_history[k].change_percentage))
        .filter(v => Number.isFinite(v))
    }
  } catch (e) {
    sparkValues.value = []
  }
})

const sparkPoints = computed(() => {
  const width = 120
  const height = 40
  if (!sparkValues.value.length) return { points: '', width, height }
  const min = Math.min(...sparkValues.value)
  const max = Math.max(...sparkValues.value)
  const range = max - min || 1
  const stepX = width / (sparkValues.value.length - 1)
  const pts = sparkValues.value.map((v, i) => {
    const x = Math.round(i * stepX)
    const y = Math.round(height - ((v - min) / range) * height)
    return `${x},${y}`
  }).join(' ')
  return { points: pts, width, height }
})

const isPositive = computed(() => {
  const p = String(props.percentagePrice ?? '')
  const num = parseFloat(p)
  if (!Number.isNaN(num)) return num > 0
  return p.includes('+') && !p.includes('-')
})
</script>

<template>
  <div class="widget-asset" @click="$emit('click', assetId)">
    <div class="profil-icon">
      <img :src="profileIcon" :alt="`${assetName} icon`">
      <div class="icon-overlay">{{ tagName }}</div>
    </div>
    <div class="tags-names">
      <p class="full-name">{{ assetName }}</p>
      <div class="toolbar">
        <span class="price-display">{{ nominalPrice }}</span>
        <span :class="['change-display', { 'positive': isPositive, 'negative': !isPositive }]">
          {{ percentagePrice }}
        </span>
      </div>
    </div>
    <div class="display-prices">
      <div class="daily-price-chart">
        <svg :width="sparkPoints.width" :height="sparkPoints.height">
          <polyline
            :points="sparkPoints.points"
            fill="none"
            :stroke="isPositive ? 'var(--success-green)' : 'var(--error-red)'"
            stroke-width="2"
          />
        </svg>
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

/* tag-name removed to keep a single tag (overlay) */

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