<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
  strategies: {
    type: Array,
    required: true
  },
  selectedStrategies: {
    type: Array,
    required: true
  }
});

const emit = defineEmits(['update:selectedStrategies']);

const isOpen = ref(false);
const dropdownRef = ref(null);

const allSelected = computed({
  get: () => props.selectedStrategies.length === props.strategies.length,
  set: (value) => {
    if (value) {
      emit('update:selectedStrategies', props.strategies.map(s => s.name));
    } else {
      emit('update:selectedStrategies', []);
    }
  }
});

const selectedCount = computed(() => props.selectedStrategies.length);

const selectedText = computed(() => {
  if (selectedCount.value === 0) return 'No strategies selected';
  if (selectedCount.value === props.strategies.length) return 'All strategies';
  if (selectedCount.value === 1) return `${selectedCount.value} strategy selected`;
  return `${selectedCount.value} strategies selected`;
});

const toggleDropdown = () => {
  isOpen.value = !isOpen.value;
};

const toggleStrategy = (strategyName) => {
  const updatedSelection = props.selectedStrategies.includes(strategyName)
    ? props.selectedStrategies.filter(s => s !== strategyName)
    : [...props.selectedStrategies, strategyName];
  emit('update:selectedStrategies', updatedSelection);
};

// Close dropdown when clicking outside
const closeDropdown = () => {
  isOpen.value = false;
};
</script>

<template>
  <div class="select-strats" ref="dropdownRef">
    <div class="dropdown-trigger" @click="toggleDropdown">
      <span class="selected-text">{{ selectedText }}</span>
      <svg
        class="dropdown-arrow"
        :class="{ 'open': isOpen }"
        width="12"
        height="12"
        viewBox="0 0 12 12"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>

    <div class="dropdown-menu" :class="{ 'open': isOpen }">
      <div class="dropdown-item">
        <label class="checkbox-label">
          <input
            type="checkbox"
            v-model="allSelected"
            class="checkbox-input"
          />
          <span class="checkmark"></span>
          <span class="label-text">All Strategies</span>
        </label>
      </div>

      <div class="dropdown-divider"></div>

      <div
        v-for="strategy in strategies"
        :key="strategy.name"
        class="dropdown-item"
      >
        <label class="checkbox-label">
          <input
            type="checkbox"
            :checked="selectedStrategies.includes(strategy.name)"
            @change="toggleStrategy(strategy.name)"
            class="checkbox-input"
          />
          <span class="checkmark"></span>
          <span class="label-text">{{ strategy.name }}</span>
        </label>
      </div>
    </div>

    <!-- Overlay to close dropdown when clicking outside -->
    <div
      v-if="isOpen"
      class="dropdown-overlay"
      @click="closeDropdown"
    ></div>
  </div>
</template>

<style scoped>
.select-strats {
  position: relative;
  width: 100%;
  max-width: 280px;
  min-width: 200px;
}

.dropdown-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.05) 100%);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.dropdown-trigger:hover {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0.08) 100%);
  border-color: rgba(0, 170, 255, 0.3);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.selected-text {
  font-family: "Poppins", sans-serif;
  font-size: 0.9rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
  flex: 1;
}

.dropdown-arrow {
  color: rgba(255, 255, 255, 0.6);
  transition: transform 0.3s ease, color 0.3s ease;
  flex-shrink: 0;
}

.dropdown-arrow.open {
  transform: rotate(180deg);
  color: #00aaff;
}

.dropdown-menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: linear-gradient(135deg, rgba(20, 20, 20, 0.95) 0%, rgba(30, 30, 30, 0.95) 100%);
  backdrop-filter: blur(15px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
  opacity: 0;
  visibility: hidden;
  transform: translateY(-8px);
  transition: all 0.3s ease;
  z-index: 1000;
  max-height: 300px;
  overflow-y: auto;
}

.dropdown-menu.open {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
}

.dropdown-item {
  padding: 0;
}

.dropdown-item:first-child {
  border-radius: 8px 8px 0 0;
}

.dropdown-item:last-child {
  border-radius: 0 0 8px 8px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  cursor: pointer;
  transition: background-color 0.2s ease;
  width: 100%;
}

.checkbox-label:hover {
  background: rgba(255, 255, 255, 0.05);
}

.checkbox-input {
  position: absolute;
  opacity: 0;
  cursor: pointer;
  height: 0;
  width: 0;
}

.checkmark {
  position: relative;
  height: 18px;
  width: 18px;
  background-color: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 3px;
  margin-right: 12px;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.checkbox-input:checked ~ .checkmark {
  background-color: #00aaff;
  border-color: #00aaff;
}

.checkmark:after {
  content: "";
  position: absolute;
  display: none;
  left: 5px;
  top: 2px;
  width: 4px;
  height: 8px;
  border: solid white;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

.checkbox-input:checked ~ .checkmark:after {
  display: block;
}

.label-text {
  font-family: "Poppins", sans-serif;
  font-size: 0.9rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
  user-select: none;
}

.dropdown-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.1);
  margin: 4px 0;
}

.dropdown-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 999;
}

/* Custom scrollbar for dropdown */
.dropdown-menu::-webkit-scrollbar {
  width: 6px;
}

.dropdown-menu::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 3px;
}

.dropdown-menu::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
}

.dropdown-menu::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}

/* Mobile optimizations */
@media (max-width: 768px) {
  .select-strats {
    max-width: 100%;
    min-width: 160px;
  }

  .dropdown-trigger {
    padding: 14px 16px;
  }

  .selected-text {
    font-size: 0.85rem;
  }

  .checkbox-label {
    padding: 14px 16px;
  }

  .label-text {
    font-size: 0.85rem;
  }
}

/* Touch-friendly adjustments for mobile */
@media (pointer: coarse) {
  .dropdown-trigger {
    padding: 16px;
    min-height: 48px;
  }

  .checkbox-label {
    padding: 16px;
    min-height: 48px;
  }

  .checkmark {
    height: 20px;
    width: 20px;
    margin-right: 14px;
  }
}
</style>