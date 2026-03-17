<script setup>
import { computed } from 'vue';

const props = defineProps({
  totalValue: {
    type: Number,
    default: 0
  },
  currency: {
    type: String,
    default: 'USD'
  },
  returnPercentage: {
    type: Number,
    default: 0
  }
});

const emit = defineEmits(['switch-wallet']);

const formattedValue = computed(() => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: props.currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(props.totalValue);
});

const formattedReturn = computed(() => {
  return `${props.returnPercentage >= 0 ? '+' : ''}${props.returnPercentage.toFixed(2)}%`;
});

const returnColor = computed(() => {
  return props.returnPercentage >= 0 ? '#4CAF50' : '#f44336';
});
</script>

<template>
  <div class="capital-counter-box">
    <div class="capital-header">
      <h3>Total Portfolio Value</h3>
    </div>
    <div class="capital-main">
      <div class="capital-counter">{{ formattedValue }}</div>
      <div class="capital-return" :style="{ color: returnColor }">
        {{ formattedReturn }}
      </div>
    </div>
    <div class="capital-actions">
      <button @click="$emit('switch-wallet')" class="switch-wallet-btn">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M8 7H16M16 7V15M16 7L8 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Switch Wallet
      </button>
    </div>
  </div>
</template>
<style scoped>
.capital-counter-box {
  background: linear-gradient(135deg, rgba(15, 15, 15, 0.95) 0%, rgba(5, 5, 5, 0.95) 100%);
  backdrop-filter: blur(20px);
  border-radius: var(--app-border-radius, 20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.5),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
  padding: 1.5rem;
  width: 100%;
  max-width: 100%;
  position: relative;
  overflow: hidden;
  transition: all 0.3s ease;
}

.capital-counter-box::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, #31d0aa, #00aaff, #31d0aa);
  background-size: 200% 100%;
  animation: shimmer var(--app-animation-speed, 2s) ease-in-out infinite;
}

@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.capital-counter-box:hover {
  transform: translateY(-2px);
  box-shadow:
    0 12px 40px rgba(0, 0, 0, 0.6),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

.capital-header {
  text-align: center;
  margin-bottom: 1rem;
}

.capital-header h3 {
  font-family: "Poppins", sans-serif;
  font-size: 0.9rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.6);
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.capital-main {
  text-align: center;
  margin-bottom: 1.5rem;
}

.capital-counter {
  font-family: "Poppins", sans-serif;
  font-size: 2rem;
  font-weight: 700;
  color: white;
  margin-bottom: 0.25rem;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
  background: linear-gradient(135deg, #ffffff 0%, rgba(255, 255, 255, 0.8) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.capital-return {
  font-family: "Poppins", sans-serif;
  font-size: 1.1rem;
  font-weight: 600;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
}

.capital-actions {
  display: flex;
  justify-content: center;
}

.switch-wallet-btn {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: white;
  padding: 0.75rem 1.5rem;
  border-radius: var(--app-border-radius, 8px);
  cursor: pointer;
  font-family: "Poppins", sans-serif;
  font-size: 0.85rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.3s ease;
}

.switch-wallet-btn:hover {
  background: rgba(255, 255, 255, 0.15);
  transform: translateY(-1px);
}

.switch-wallet-btn svg {
  transition: transform 0.3s ease;
}

.switch-wallet-btn:hover svg {
  transform: rotate(45deg);
}

@media (min-width: 768px) {
  .capital-counter-box {
    padding: 2rem;
    max-width: 500px;
    margin: 0 auto;
  }
  .capital-counter {
    font-size: 2.5rem;
  }
  .capital-return {
    font-size: 1.3rem;
  }
  .capital-header h3 {
    font-size: 1rem;
  }
}
</style>