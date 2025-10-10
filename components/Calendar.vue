<script setup>
import { ref, computed, onMounted } from 'vue';
import { useWalletsStore } from '@/stores/wallets';
import {
  eachDayOfInterval,
  endOfMonth,
  startOfMonth,
  startOfWeek,
  endOfWeek,
  format,
  addMonths,
  addWeeks,
  addDays,
  subDays,
  isSameMonth,
  isSameWeek,
  isSameDay,
  parseISO,
  startOfDay,
  endOfDay
} from 'date-fns';

const walletsStore = useWalletsStore();
const viewMode = ref('weekly'); // 'daily', 'weekly', 'monthly'
const currentDate = ref(new Date());
const walletData = ref(null);
const dailyPerformance = ref([]);

// Load wallet data on mount
onMounted(async () => {
  try {
    await walletsStore.initializeStore();
    walletData.value = walletsStore.wallets;
    generateDailyPerformance();
  } catch (error) {
    console.error('Failed to load wallet data:', error);
  }
});

// Generate synthetic daily performance data based on wallet transactions
const generateDailyPerformance = () => {
  if (!walletData.value || !Array.isArray(walletData.value)) return;

  const performance = [];
  const today = new Date();
  const startDate = subDays(today, 90); // Last 90 days

  // Generate daily data for each day in range
  for (let date = startDate; date <= today; date = addDays(date, 1)) {
    const dayTransactions = [];

    // Check each wallet's transactions for this day
    walletData.value.forEach(wallet => {
      if (wallet.transactions) {
        wallet.transactions.forEach(transaction => {
          const txnDate = parseISO(transaction.timestamp);
          if (isSameDay(txnDate, date)) {
            dayTransactions.push({
              ...transaction,
              walletId: wallet.id,
              walletName: wallet.name
            });
          }
        });
      }
    });

    // Calculate daily performance
    let totalValue = 0;
    let totalReturn = 0;
    let minPrice = Infinity;
    let maxPrice = -Infinity;
    let openPrice = null;
    let closePrice = null;

    dayTransactions.forEach(txn => {
      const value = txn.total_value;
      totalValue += value;

      // Simulate price movements for candlestick
      if (openPrice === null) openPrice = txn.price;
      closePrice = txn.price;
      minPrice = Math.min(minPrice, txn.price);
      maxPrice = Math.max(maxPrice, txn.price);

      // Calculate return (simplified)
      if (txn.type === 'sell') {
        totalReturn += (txn.price - txn.price * 0.05) * txn.amount; // Simulate profit/loss
      }
    });

    // Generate some variation even on days with no transactions
    const baseVariation = (Math.random() - 0.5) * 0.02; // ±1% base variation
    const transactionBonus = dayTransactions.length * 0.005; // Bonus for transaction volume

    const dailyReturn = totalValue > 0 ?
      (totalReturn / totalValue) * 100 + baseVariation :
      baseVariation;

    performance.push({
      date: format(date, 'yyyy-MM-dd'),
      return: Math.max(-5, Math.min(5, dailyReturn)), // Clamp between -5% and +5%
      volume: dayTransactions.length,
      transactions: dayTransactions,
      candlestick: {
        open: openPrice || (100 + Math.random() * 10),
        high: maxPrice !== -Infinity ? maxPrice : (105 + Math.random() * 10),
        low: minPrice !== Infinity ? minPrice : (95 + Math.random() * 10),
        close: closePrice || (102 + Math.random() * 10)
      }
    });
  }

  dailyPerformance.value = performance;
};

// Computed properties
const viewTitle = computed(() => {
  switch (viewMode.value) {
    case 'daily':
      return format(currentDate.value, 'EEEE, MMMM d, yyyy');
    case 'weekly':
      const weekStart = startOfWeek(currentDate.value);
      const weekEnd = endOfWeek(currentDate.value);
      return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`;
    case 'monthly':
      return format(currentDate.value, 'MMMM yyyy');
    default:
      return '';
  }
});

const daysInView = computed(() => {
  switch (viewMode.value) {
    case 'daily':
      // Show 24 hours as individual hours
      return Array.from({ length: 24 }, (_, i) => {
        const hour = new Date(currentDate.value);
        hour.setHours(i, 0, 0, 0);
        return hour;
      });
    case 'weekly':
      const weekStart = startOfWeek(currentDate.value);
      return eachDayOfInterval({
        start: weekStart,
        end: endOfWeek(currentDate.value)
      });
    case 'monthly':
      const monthStart = startOfMonth(currentDate.value);
      const monthEnd = endOfMonth(currentDate.value);
      return eachDayOfInterval({ start: monthStart, end: monthEnd });
    default:
      return [];
  }
});

const performanceRange = computed(() => {
  const returns = dailyPerformance.value.map(d => d.return).filter(r => r !== 0);
  if (returns.length === 0) return { min: 0, max: 0 };

  return {
    min: Math.min(...returns),
    max: Math.max(...returns)
  };
});

// Get performance data for a specific date
const getDayPerformance = (date) => {
  const dateStr = viewMode.value === 'daily' ?
    format(date, 'yyyy-MM-dd-HH') :
    format(date, 'yyyy-MM-dd');

  return dailyPerformance.value.find(d => d.date === dateStr) || {
    return: 0,
    volume: 0,
    transactions: [],
    candlestick: { open: 100, high: 105, low: 95, close: 102 }
  };
};

// Calculate color intensity based on performance
const getPerformanceColor = (returnValue) => {
  const { min, max } = performanceRange.value;
  const intensity = Math.abs(returnValue) / Math.max(Math.abs(min), Math.abs(max));

  if (returnValue > 0) {
    // Green gradient from light to dark
    const greenValue = Math.round(136 + (255 - 136) * intensity);
    return `rgb(${255 - greenValue}, ${greenValue}, ${255 - greenValue})`;
  } else if (returnValue < 0) {
    // Red gradient from light to dark
    const redValue = Math.round(68 + (255 - 68) * intensity);
    return `rgb(${redValue}, ${255 - redValue}, ${255 - redValue})`;
  }
  return 'var(--bg-secondary)'; // Grey for zero
};

// Check if date is in current view period
const isInCurrentPeriod = (date) => {
  switch (viewMode.value) {
    case 'daily':
      return isSameDay(date, currentDate.value);
    case 'weekly':
      return isSameWeek(date, currentDate.value);
    case 'monthly':
      return isSameMonth(date, currentDate.value);
    default:
      return false;
  }
};

// Navigation functions
const changeViewMode = (mode) => {
  viewMode.value = mode;
};

const goToPrevious = () => {
  switch (viewMode.value) {
    case 'daily':
      currentDate.value = subDays(currentDate.value, 1);
      break;
    case 'weekly':
      currentDate.value = addWeeks(currentDate.value, -1);
      break;
    case 'monthly':
      currentDate.value = addMonths(currentDate.value, -1);
      break;
  }
};

const goToNext = () => {
  switch (viewMode.value) {
    case 'daily':
      currentDate.value = addDays(currentDate.value, 1);
      break;
    case 'weekly':
      currentDate.value = addWeeks(currentDate.value, 1);
      break;
    case 'monthly':
      currentDate.value = addMonths(currentDate.value, 1);
      break;
  }
};

// Format display value with sign
const formatReturnValue = (value) => {
  if (value > 0) return `+${value.toFixed(2)}%`;
  if (value < 0) return `${value.toFixed(2)}%`;
  return '0.00%';
};

// Render Japanese candlestick
const renderCandlestick = (candlestick, size = 20) => {
  const { open, high, low, close } = candlestick;
  const isGreen = close >= open;
  const bodyHeight = Math.abs(close - open);
  const totalRange = high - low;

  if (totalRange === 0) return null;

  const wickTop = ((high - Math.max(open, close)) / totalRange) * size;
  const bodyTop = (wickTop / size) * 100;
  const bodyHeightPercent = (bodyHeight / totalRange) * 100;

  return {
    isGreen,
    wickTop: `${wickTop}px`,
    bodyTop: `${bodyTop}%`,
    bodyHeight: `${bodyHeightPercent}%`,
    color: isGreen ? 'var(--success-green)' : 'var(--error-red)'
  };
};
</script>

<template>
  <div class="calendar-container">
    <!-- Header -->
    <div class="calendar-header">
      <h2 class="calendar-title">Trading Performance Calendar</h2>
      <div class="calendar-subtitle">{{ viewTitle }}</div>
    </div>

    <!-- Controls -->
    <div class="calendar-controls">
      <!-- View Mode Selector -->
      <div class="view-mode-selector">
        <button
          v-for="mode in ['daily', 'weekly', 'monthly']"
          :key="mode"
          @click="changeViewMode(mode)"
          :class="['view-mode-btn', { active: viewMode === mode }]"
        >
          {{ mode.charAt(0).toUpperCase() + mode.slice(1) }}
        </button>
      </div>

      <!-- Navigation -->
      <div class="navigation-controls">
        <button @click="goToPrevious" class="nav-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15,18 9,12 15,6"></polyline>
          </svg>
        </button>
        <button @click="goToNext" class="nav-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9,18 15,12 9,6"></polyline>
          </svg>
        </button>
      </div>
    </div>

    <!-- Calendar Grid -->
    <div class="calendar-grid" :class="`view-${viewMode}`">
      <div
        v-for="date in daysInView"
        :key="date.toISOString()"
        class="calendar-cell"
        :class="{ 'current-period': isInCurrentPeriod(date) }"
        :style="{ backgroundColor: getPerformanceColor(getDayPerformance(date).return) }"
      >
        <!-- Date Label -->
        <div class="date-label">
          {{ viewMode === 'daily' ? format(date, 'HH:mm') : format(date, 'd') }}
        </div>

        <!-- Candlestick Chart -->
        <div class="candlestick-container" v-if="getDayPerformance(date).volume > 0">
          <div class="candlestick" :style="renderCandlestick(getDayPerformance(date).candlestick)">
            <div
              class="wick"
              :style="{
                height: renderCandlestick(getDayPerformance(date).candlestick)?.wickTop || '20px',
                backgroundColor: renderCandlestick(getDayPerformance(date).candlestick)?.color || 'var(--text-gray)'
              }"
            ></div>
            <div
              class="body"
              :class="{ 'bullish': renderCandlestick(getDayPerformance(date).candlestick)?.isGreen }"
              :style="{
                top: renderCandlestick(getDayPerformance(date).candlestick)?.bodyTop || '20%',
                height: renderCandlestick(getDayPerformance(date).candlestick)?.bodyHeight || '60%',
                backgroundColor: renderCandlestick(getDayPerformance(date).candlestick)?.color || 'var(--text-gray)'
              }"
            ></div>
          </div>
        </div>

        <!-- Performance Value -->
        <div
          class="performance-value"
          :class="{
            'positive': getDayPerformance(date).return > 0,
            'negative': getDayPerformance(date).return < 0,
            'zero': getDayPerformance(date).return === 0
          }"
        >
          {{ formatReturnValue(getDayPerformance(date).return) }}
        </div>

        <!-- Transaction Count -->
        <div class="transaction-count" v-if="getDayPerformance(date).volume > 0">
          {{ getDayPerformance(date).volume }} trades
        </div>

        <!-- Hover Details -->
        <div class="cell-details">
          <div class="detail-item">
            <span class="detail-label">Volume:</span>
            <span class="detail-value">{{ getDayPerformance(date).volume }}</span>
          </div>
          <div class="detail-item" v-if="getDayPerformance(date).volume > 0">
            <span class="detail-label">Range:</span>
            <span class="detail-value">
              {{ getDayPerformance(date).candlestick.low.toFixed(2) }} -
              {{ getDayPerformance(date).candlestick.high.toFixed(2) }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Legend -->
    <div class="calendar-legend">
      <div class="legend-item">
        <div class="legend-color" style="background: var(--success-green);"></div>
        <span>Positive Returns</span>
      </div>
      <div class="legend-item">
        <div class="legend-color" style="background: var(--error-red);"></div>
        <span>Negative Returns</span>
      </div>
      <div class="legend-item">
        <div class="legend-color" style="background: var(--bg-secondary);"></div>
        <span>No Activity</span>
      </div>
    </div>

    <!-- Performance Summary -->
    <div class="performance-summary" v-if="performanceRange.min !== 0 || performanceRange.max !== 0">
      <div class="summary-item">
        <span class="summary-label">Best Day:</span>
        <span class="summary-value positive">+{{ performanceRange.max.toFixed(2) }}%</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">Worst Day:</span>
        <span class="summary-value negative">{{ performanceRange.min.toFixed(2) }}%</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.calendar-container {
  background: var(--card-bg);
  border-radius: var(--radius-lg);
  padding: var(--spacing-xl);
  box-shadow: var(--shadow-primary);
  border: 1px solid var(--border-primary);
  color: var(--text-white);
  font-family: var(--font-family-primary);
}

.calendar-header {
  text-align: center;
  margin-bottom: var(--spacing-xl);
  padding-bottom: var(--spacing-lg);
  border-bottom: 1px solid var(--border-primary);
}

.calendar-title {
  font-size: 2rem;
  font-weight: bold;
  color: var(--text-white);
  margin: 0 0 var(--spacing-sm) 0;
  font-family: var(--font-family-primary);
}

.calendar-subtitle {
  font-size: 1.1rem;
  color: var(--text-gray);
  font-family: var(--font-family-secondary);
}

.calendar-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-xl);
  gap: var(--spacing-lg);
}

.view-mode-selector {
  display: flex;
  gap: var(--spacing-sm);
}

.view-mode-btn {
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--bg-secondary);
  border: 1px solid var(--border-secondary);
  border-radius: var(--radius-md);
  color: var(--text-white);
  cursor: pointer;
  transition: var(--transition-normal);
  font-family: var(--font-family-secondary);
  font-weight: 500;
  text-transform: capitalize;
}

.view-mode-btn:hover {
  border-color: var(--border-accent);
  background: var(--bg-tertiary);
}

.view-mode-btn.active {
  background: var(--primary-gradient);
  border-color: var(--primary-green);
  color: var(--secondary-darker);
}

.navigation-controls {
  display: flex;
  gap: var(--spacing-sm);
}

.nav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-secondary);
  border-radius: var(--radius-md);
  color: var(--text-white);
  cursor: pointer;
  transition: var(--transition-normal);
}

.nav-btn:hover {
  border-color: var(--border-accent);
  background: var(--bg-tertiary);
  transform: translateY(-1px);
}

.nav-btn svg {
  stroke: var(--text-white);
}

/* Calendar Grid */
.calendar-grid {
  display: grid;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-xl);
}

.calendar-grid.view-daily {
  grid-template-columns: repeat(6, 1fr);
  grid-template-rows: repeat(4, 1fr);
}

.calendar-grid.view-weekly {
  grid-template-columns: repeat(7, 1fr);
}

.calendar-grid.view-monthly {
  grid-template-columns: repeat(7, 1fr);
  grid-template-rows: repeat(5, 1fr);
}

.calendar-cell {
  aspect-ratio: 1;
  border-radius: var(--radius-md);
  padding: var(--spacing-sm);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  position: relative;
  transition: var(--transition-normal);
  cursor: pointer;
  border: 2px solid transparent;
  overflow: hidden;
}

.calendar-cell:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-accent);
  border-color: var(--border-accent);
}

.calendar-cell.current-period {
  border-color: var(--primary-green);
  box-shadow: 0 0 0 1px var(--primary-green);
}

.calendar-cell::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: inherit;
  opacity: 0.8;
  z-index: -1;
}

.date-label {
  font-size: 0.9rem;
  font-weight: bold;
  color: var(--text-white);
  font-family: var(--font-family-secondary);
  margin-bottom: var(--spacing-xs);
}

.candlestick-container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: var(--spacing-xs) 0;
}

.candlestick {
  position: relative;
  width: 12px;
  height: 100%;
  max-height: 40px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.wick {
  width: 1px;
  background: var(--text-gray);
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
}

.body {
  width: 100%;
  position: absolute;
  min-height: 2px;
  border-radius: 1px;
}

.body.bullish {
  background: var(--success-green);
}

.performance-value {
  font-size: 0.7rem;
  font-weight: bold;
  font-family: var(--font-family-secondary);
  margin-bottom: var(--spacing-xs);
  text-align: center;
}

.performance-value.positive {
  color: var(--success-green);
}

.performance-value.negative {
  color: var(--error-red);
}

.performance-value.zero {
  color: var(--text-gray);
}

.transaction-count {
  font-size: 0.6rem;
  color: var(--text-gray);
  font-family: var(--font-family-secondary);
  text-align: center;
  margin-top: auto;
}

.cell-details {
  position: absolute;
  bottom: -100%;
  left: 0;
  right: 0;
  background: rgba(0, 0, 0, 0.9);
  padding: var(--spacing-sm);
  border-radius: var(--radius-sm);
  transition: var(--transition-normal);
  opacity: 0;
  visibility: hidden;
  font-size: 0.7rem;
}

.calendar-cell:hover .cell-details {
  bottom: 0;
  opacity: 1;
  visibility: visible;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: var(--spacing-xs);
}

.detail-item:last-child {
  margin-bottom: 0;
}

.detail-label {
  color: var(--text-gray);
  font-family: var(--font-family-secondary);
}

.detail-value {
  color: var(--text-white);
  font-family: var(--font-family-primary);
  font-weight: 500;
}

/* Legend */
.calendar-legend {
  display: flex;
  justify-content: center;
  gap: var(--spacing-lg);
  margin-bottom: var(--spacing-xl);
  flex-wrap: wrap;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.legend-color {
  width: 16px;
  height: 16px;
  border-radius: var(--radius-sm);
}

.legend-item span {
  color: var(--text-white);
  font-size: 0.9rem;
  font-family: var(--font-family-secondary);
}

/* Performance Summary */
.performance-summary {
  display: flex;
  justify-content: center;
  gap: var(--spacing-xl);
  padding: var(--spacing-lg);
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-primary);
}

.summary-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-xs);
}

.summary-label {
  color: var(--text-gray);
  font-size: 0.8rem;
  font-family: var(--font-family-secondary);
}

.summary-value {
  font-size: 1rem;
  font-weight: bold;
  font-family: var(--font-family-secondary);
}

.summary-value.positive {
  color: var(--success-green);
}

.summary-value.negative {
  color: var(--error-red);
}

/* Responsive Design */
@media (max-width: 768px) {
  .calendar-container {
    padding: var(--spacing-lg);
  }

  .calendar-controls {
    flex-direction: column;
    gap: var(--spacing-md);
  }

  .view-mode-selector {
    justify-content: center;
  }

  .navigation-controls {
    order: -1;
  }

  .calendar-grid.view-daily {
    grid-template-columns: repeat(4, 1fr);
    grid-template-rows: repeat(6, 1fr);
  }

  .calendar-grid.view-weekly {
    grid-template-columns: repeat(4, 1fr);
    grid-template-rows: repeat(2, 1fr);
  }

  .calendar-grid.view-monthly {
    grid-template-columns: repeat(4, 1fr);
    grid-template-rows: repeat(8, 1fr);
  }

  .calendar-legend {
    gap: var(--spacing-md);
  }

  .performance-summary {
    flex-direction: column;
    gap: var(--spacing-md);
  }
}

@media (max-width: 480px) {
  .calendar-container {
    padding: var(--spacing-md);
  }

  .calendar-title {
    font-size: 1.5rem;
  }

  .calendar-subtitle {
    font-size: 1rem;
  }

  .view-mode-btn {
    padding: var(--spacing-xs) var(--spacing-sm);
    font-size: 0.8rem;
  }

  .calendar-grid.view-daily {
    grid-template-columns: repeat(3, 1fr);
    grid-template-rows: repeat(8, 1fr);
  }

  .calendar-grid.view-weekly {
    grid-template-columns: repeat(3, 1fr);
    grid-template-rows: repeat(3, 1fr);
  }

  .calendar-grid.view-monthly {
    grid-template-columns: repeat(3, 1fr);
    grid-template-rows: repeat(12, 1fr);
  }

  .calendar-legend {
    flex-direction: column;
    gap: var(--spacing-sm);
  }
}
</style>
