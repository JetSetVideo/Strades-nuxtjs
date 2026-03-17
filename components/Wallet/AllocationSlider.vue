<template>
  <div class="allocation-slider-container">
    <h3 class="title">100% Allocation Enforcer</h3>
    <div class="sliders">
      <div v-for="(val, key) in walletStore.allocationPie" :key="key" class="slider-row">
        <label class="label">
          <span class="key-name">{{ key }}</span>
          <span class="percent">{{ val.toFixed(1) }}%</span>
        </label>
        <input 
          type="range" 
          :min="0" 
          :max="100" 
          :value="val" 
          @input="onInput(key as keyof typeof walletStore.allocationPie, Number(($event.target as HTMLInputElement).value))"
          class="range-slider"
          :class="`range-${key}`"
        />
      </div>
    </div>
    <div class="total-bar">
      <div 
        v-for="(val, key) in walletStore.allocationPie" 
        :key="key"
        class="total-segment"
        :class="`bg-${key}`"
        :style="{ width: `${val}%` }"
      ></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useWalletStore } from '~/stores/wallet'

const walletStore = useWalletStore()

const onInput = (category: keyof typeof walletStore.allocationPie, value: number) => {
  walletStore.updateAllocation(category, value)
}
</script>

<style scoped>
.allocation-slider-container {
  background: rgba(20, 20, 20, 0.8);
  backdrop-filter: blur(var(--app-glass-blur, 10px));
  border-radius: var(--app-border-radius, 12px);
  padding: 1.5rem;
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  transition: all var(--app-animation-speed, 0.5s) ease;
}

.title {
  margin-top: 0;
  font-family: 'Poppins', sans-serif;
  font-size: 1.2rem;
  margin-bottom: 1.5rem;
}

.slider-row {
  margin-bottom: 1.2rem;
}

.label {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.percent {
  font-weight: bold;
}

.range-slider {
  -webkit-appearance: none;
  width: 100%;
  height: 8px;
  border-radius: 4px;
  background: #333;
  outline: none;
  transition: opacity .2s;
}

.range-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #fff;
  cursor: pointer;
  box-shadow: 0 0 10px rgba(0,0,0,0.5);
}

.range-fiat::-webkit-slider-thumb { background: #4A90E2; }
.range-crypto::-webkit-slider-thumb { background: #F5A623; }
.range-stocks::-webkit-slider-thumb { background: #7ED321; }
.range-commodities::-webkit-slider-thumb { background: #F8E71C; }

.total-bar {
  display: flex;
  width: 100%;
  height: 12px;
  border-radius: 6px;
  overflow: hidden;
  margin-top: 2rem;
  background: #222;
}

.total-segment {
  height: 100%;
  transition: width 0.1s linear;
}

.bg-fiat { background: #4A90E2; }
.bg-crypto { background: #F5A623; }
.bg-stocks { background: #7ED321; }
.bg-commodities { background: #F8E71C; }

/* Responsive */
@media (min-width: 768px) {
  .allocation-slider-container {
    padding: 2rem;
  }
}
</style>
