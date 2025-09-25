<script setup lang="ts">
const strategy1 = ref({
  name: 'Strategy 1',
  trades: 100,
  profit: 1000,
  assets: ['Asset 1', 'Asset 2'],
  allocations: [60, 40],
  riskManagement: 'Low',
  performance: 'High',
  description: 'This is strategy 1',
  valueAtRisk: 0.05,
  maxDrawdown: 0.1,
  sharpeRatio: 1.5,
  sortinoRatio: 2.0,
});

const strategy2 = ref({
  name: 'Strategy 2',
  trades: 80,
  profit: 800,
  assets: ['Asset 3', 'Asset 4'],
  allocations: [50, 50],
  riskManagement: 'Medium',
  performance: 'Moderate',
  description: 'This is strategy 2',
  valueAtRisk: 0.08,
  maxDrawdown: 0.15,
  sharpeRatio: 1.2,
  sortinoRatio: 1.8,
});
</script>

<template>
    <div class="comparaison-widget">
      <div class="strategy-container">
        <div class="strategy">
          <div class="strategy-name-box">
            <span class="strategy-name">{{ strategy1.name }}</span>
          </div>
          <div class="strategy-trades glass">Number of trades: {{ strategy1.trades }}</div>
          <div class="strategy-profit glass">Profit: {{ strategy1.profit }}</div>
          <div class="assets glass">Assets: {{ strategy1.assets.join(', ') }}</div>
          <div class="allocations glass">Allocations: {{ strategy1.allocations.join('%, ') }}%</div>
          <div class="risk-management glass">Risk Management: {{ strategy1.riskManagement }}</div>
          <div class="performance glass">Performance: {{ strategy1.performance }}</div>
          <div class="strategy-description glass">{{ strategy1.description }}</div>
          <div class="value-at-risk glass">Value at Risk: {{ strategy1.valueAtRisk }}</div>
          <div class="max-drawdown glass">Max Drawdown: {{ strategy1.maxDrawdown }}</div>
          <div class="sharpe-ratio glass">Sharpe Ratio: {{ strategy1.sharpeRatio }}</div>
          <div class="sortino-ratio glass">Sortino Ratio: {{ strategy1.sortinoRatio }}</div>
        </div>
        <div class="vs-line">VS</div>
        <div class="strategy">
          <div class="strategy-name-box">
            <span class="strategy-name">{{ strategy2.name }}</span>
          </div>
        <div class="strategy-trades glass">Number of trades: {{ strategy2.trades }}
            <div class="diff-trades" :class="{ positive: strategy1.trades - strategy2.trades > 0, negative: strategy1.trades - strategy2.trades < 0 }">
                Trades: {{ strategy1.trades - strategy2.trades }}
            </div>
        </div>
        <div class="strategy-profit glass">Profit: {{ strategy2.profit }}
            <div class="diff-profit" :class="{ positive: strategy1.profit - strategy2.profit > 0, negative: strategy1.profit - strategy2.profit < 0 }">
                Profit: {{ strategy1.profit - strategy2.profit }}
            </div>
        </div>
          <div class="assets glass">Assets: {{ strategy2.assets.join(', ') }}</div>
          <div class="allocations glass">Allocations: {{ strategy2.allocations.join('%, ') }}%</div>
          <div class="risk-management glass">Risk Management: {{ strategy2.riskManagement }}</div>
          <div class="performance glass">Performance: {{ strategy2.performance }}</div>
          <div class="strategy-description glass">{{ strategy2.description }}</div>
        <div class="value-at-risk glass">Value at Risk: {{ strategy2.valueAtRisk }}
            <div class="diff-value-at-risk" :class="{ positive: strategy1.valueAtRisk - strategy2.valueAtRisk < 0, negative: strategy1.valueAtRisk - strategy2.valueAtRisk > 0 }">
                Value at Risk: {{ (strategy1.valueAtRisk - strategy2.valueAtRisk).toFixed(2) }}
            </div>
        </div>
        <div class="max-drawdown glass">Max Drawdown: {{ strategy2.maxDrawdown }}
            <div class="diff-max-drawdown" :class="{ positive: strategy1.maxDrawdown - strategy2.maxDrawdown < 0, negative: strategy1.maxDrawdown - strategy2.maxDrawdown > 0 }">
                Max Drawdown: {{ (strategy1.maxDrawdown - strategy2.maxDrawdown).toFixed(2) }}
            </div>
        </div>
        <div class="sharpe-ratio glass">Sharpe Ratio: {{ strategy2.sharpeRatio }}
            <div class="diff-sharpe-ratio" :class="{ positive: strategy1.sharpeRatio - strategy2.sharpeRatio > 0, negative: strategy1.sharpeRatio - strategy2.sharpeRatio < 0 }">
                Sharpe Ratio: {{ (strategy1.sharpeRatio - strategy2.sharpeRatio).toFixed(2) }}
            </div>
        </div>
        <div class="sortino-ratio glass">Sortino Ratio: {{ strategy2.sortinoRatio }}
            <div class="diff-sortino-ratio" :class="{ positive: strategy1.sortinoRatio - strategy2.sortinoRatio > 0, negative: strategy1.sortinoRatio - strategy2.sortinoRatio < 0 }">
                Sortino Ratio: {{ (strategy1.sortinoRatio - strategy2.sortinoRatio).toFixed(2) }}
            </div>
        </div>
        <div class="difference">
          
          
          
          
          
          
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.comparaison-widget {
  display: flex;
  justify-content: center;
  padding: 1rem;
  background-color: rgba(255, 255, 255, 0.3);
}

.strategy-container {
  display: flex;
  gap: 2rem;
  align-items: flex-start;
}

.strategy {
  background-color: rgba(255, 255, 255, 0.3);
  padding: 1rem;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.strategy-name-box {
  background-color: #333;
  padding: 0.5rem;
  border-radius: 4px;
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2);
  border: 1px solid #fff;
  text-align: center;
}

.strategy-name {
  font-size: 1.2rem;
  font-weight: bold;
  color: #fff;
}

.glass {
  background-color: rgba(255, 255, 255, 0.6);
  padding: 0.5rem;
  border-radius: 4px;
  font-size: 1.1rem;
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.1);
}
.vs-line {
  font-size: 1.5rem;
  font-weight: bold;
  color: #fff;
  text-align: center;
  margin-top: 2rem;
}
.difference {
  margin-top: 1rem;
}

.difference > div {
  margin-bottom: 0.5rem;
  padding: 0.5rem;
  border-radius: 4px;
  font-size: 1.1rem;
}

.positive {
  background-color: rgba(0, 255, 0, 0.2);
  color: green;
}

.negative {
  background-color: rgba(255, 0, 0, 0.2);
  color: red;
}
</style>
