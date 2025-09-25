<script setup>
const props = defineProps({
  strategy: {
    type: Object,
    required: true,
  },
  startingDate: {
    type: String,
    required: true,
  },
  tradingPeriod: {
    type: String,
    required: true,
  },
  tradingFrequency: {
    type: String,
    required: true,
  },
  expectedInvestmentReturn: {
    type: String,
    required: true,
  },
  riskLevel: {
    type: String,
    required: true,
  },
  sharpRatio: {
    type: String,
    required: true,
  },
  tradingStyle: {
    type: String,
    required: true,
  },
  tradeType: {
    type: String,
    required: true,
  },
  balance: {
    type: String,
    required: true,
  },
  totalInvestment: {
    type: String,
    required: true,
  },
  netProfit: {
    type: String,
    required: true,
  },
  totalTrades: {
    type: String,
    required: true,
  },
  winRate: {
    type: String,
    required: true,
  },
  pnl: {
    type: String,
    required: true,
  },
  equity: {
    type: String,
    required: true,
  },
  maxDrawdown: {
    type: String,
    required: true,
  },
  margin: {
    type: String,
    required: true,
  },
});
</script>

<template>
<div class="strategy-general-info">
    <div class="strategy-name info-item">{{ strategy.name }}</div>
    <div class="info-time info-section"> 
        <div class="info-item">Starting Date: {{ startingDate }}</div>
        <div class="info-item">Trading Period: {{ tradingPeriod }}</div>
        <div class="info-item">Trading Frequency: {{ tradingFrequency }}</div>
    </div>
    <div class="info-return info-section">
        <div class="info-item">Expected Investment Return: {{ expectedInvestmentReturn }}</div>
        <div class="info-item">Risk Level: {{ riskLevel }}</div>
        <div class="info-item">Sharp Ratio: {{ sharpRatio }}</div>
    </div>
    <div class="info-style info-section">
        <div class="info-item">Trading Style: {{ tradingStyle }}</div>
        <div class="info-item">Trade Type: {{ tradeType }}</div>
    </div>

<div class="info-performance">
      <div class="info-item">Balance: {{ balance }}</div>
      <div class="info-item">Total Investment: {{ totalInvestment }}</div>
      <div class="info-item">Net Profit: {{ netProfit }}</div>
      <div class="info-item">Total Trades: {{ totalTrades }}</div>
      <div class="info-item">Win Rate: {{ winRate }}</div>
      <div class="info-item">P&L: {{ pnl }}</div>
      <div class="info-item">Equity: {{ equity }}</div>
      <div class="info-item">Max Drawdown: {{ maxDrawdown }}</div>
      <div class="info-item">Margin: {{ margin }}</div>
    </div>
  </div>
</template>

<style scoped>
.strategy-general-info {
  color: #cfd2d6;
  background-color: #1e2125;
  border: 1px solid #2a2e33;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.info-section {
  margin-bottom: 20px;
}

.info-item {
  background-color: #2a2e33;
  padding: 10px;
  margin: 5px 0;
  border-radius: 4px;
  border: 1px solid #343a40;
  box-shadow: inset 0 0 5px rgba(255, 255, 255, 0.1);
}

.info-item:not(:last-child) {
  margin-bottom: 10px;
}

.info-time, .info-return, .info-style, .info-performance {
  border-left: 4px solid #4b5162;
  padding-left: 15px;
}
</style>

