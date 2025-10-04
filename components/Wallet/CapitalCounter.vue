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
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%);
  backdrop-filter: blur(20px);
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.2),
    inset 0 -1px 0 rgba(255, 255, 255, 0.1);
  padding: 30px;
  min-width: 400px;
  max-width: 500px;
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
  height: 4px;
  background: linear-gradient(90deg, #00aaff, #00ccff, #00aaff);
  background-size: 200% 100%;
  animation: shimmer 3s ease-in-out infinite;
}

@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.capital-counter-box:hover {
  transform: translateY(-5px);
  box-shadow:
    0 15px 45px rgba(0, 0, 0, 0.15),
    inset 0 1px 0 rgba(255, 255, 255, 0.3),
    inset 0 -1px 0 rgba(255, 255, 255, 0.2);
}

.capital-header {
  text-align: center;
  margin-bottom: 20px;
}

.capital-header h3 {
  font-family: "Poppins", sans-serif;
  font-size: 1.2rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.8);
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.capital-main {
  text-align: center;
  margin-bottom: 25px;
}

.capital-counter {
  font-family: "Poppins", sans-serif;
  font-size: 2.5rem;
  font-weight: 700;
  color: white;
  margin-bottom: 10px;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  background: linear-gradient(135deg, #ffffff 0%, rgba(255, 255, 255, 0.9) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.capital-return {
  font-family: "Poppins", sans-serif;
  font-size: 1.4rem;
  font-weight: 600;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
  transition: all 0.3s ease;
}

.capital-actions {
  display: flex;
  justify-content: center;
}

.switch-wallet-btn {
  background: linear-gradient(135deg, rgba(0, 170, 255, 0.8) 0%, rgba(0, 204, 255, 0.8) 100%);
  border: 1px solid rgba(0, 170, 255, 0.3);
  color: white;
  padding: 12px 24px;
  border-radius: 12px;
  cursor: pointer;
  font-family: "Poppins", sans-serif;
  font-size: 0.9rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(0, 170, 255, 0.2);
}

.switch-wallet-btn:hover {
  background: linear-gradient(135deg, rgba(0, 170, 255, 1) 0%, rgba(0, 204, 255, 1) 100%);
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0, 170, 255, 0.3);
}

.switch-wallet-btn svg {
  transition: transform 0.3s ease;
}

.switch-wallet-btn:hover svg {
  transform: rotate(45deg);
}

/* Responsive design */
@media (max-width: 768px) {
  .capital-counter-box {
    min-width: 320px;
    padding: 25px;
  }

  .capital-counter {
    font-size: 2rem;
  }

  .capital-return {
    font-size: 1.2rem;
  }
}
</style>