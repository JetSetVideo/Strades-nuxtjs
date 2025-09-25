<script setup>
import { ref, onMounted } from 'vue'
// const strategies = ref([])

// async function fetchStrategies() {
//     try {
//         const response = await fetch('/api/strategies')
//         const data = await response.json()
//         strategies.value = data
//     } catch (error) {
//         console.error("Failed to fetch strategies:", error)
//     }
// }

// onMounted(fetchStrategies)


const strategy = ref(
    {
        id: 1,
        user_id: 1,
        name: "Strategy 1",
        description: "Strategy 1 Description",
        date_start: "2021-01-01", // Corrected property name
        date_end: "2021-01-01", // Corrected property name
        status: "active",
        type: "strategy",
        created_at: "2021-01-01",
        updated_at: "2021-01-01",
        live_trading: true,
        run_at: "2021-01-01",
        run_type: "daily",
        run_time: "00:00",
        run_interval: "1",
        run_interval_type: "days",
        expected_profit: 100,
        expected_loss: 100,
        risk_level: "low",
        tags: ["tag1", "tag2"],
        exchanges: ["exchange1", "exchange2"],
        assets: ["asset1", "asset2"],
        indicators: ["indicator1", "indicator2"],
        signals: ["signal1", "signal2"],
        stop_loss: 100,
        take_profit: 100,
        profit_target: 100,
        loss_target: 100,
        experience: "beginner",
        expected_return: 100,
        expected_risk: 100,
        sharp_ratio: 100,
        max_drawdown: 100,
        max_consecutive_losses: 100,
        max_consecutive_wins: 100,
        total_trades: 100,
        winning_trades: 100,
        losing_trades: 100,
        net_profit: 100,
    }
)
</script>

<template>
    <div class="card-strategy">
        <h3>{{ strategy.name }}</h3>
        <p>{{ strategy.description }}</p>
        <!-- <p>Status: {{ strat.status }}</p>
        <p>Type: {{ strat.type }}</p>
        <p>Live Trading: {{ strat.live_trading ? 'Yes' : 'No' }}</p>
        <p>Run Type: {{ strat.run_type }}</p>
        <p>Expected Profit: {{ strat.expected_profit }}</p>
        <p>Expected Loss: {{ strat.expected_loss }}</p>
        <p>Risk Level: {{ strat.risk_level }}</p>
        <p>Experience Level: {{ strat.experience }}</p>
        <p>Net Profit: {{ strat.net_profit }}</p> -->
        <!-- Add more fields as needed -->
    </div>
    <div class="toolbar">
        <ul>
            <li class="button">Data</li>
            <li class="button">Run</li>
            <li class="button">Test</li>
            <li class="button">Share</li>
        </ul>
        <ul>
            <li class="button">Track Record</li>
            <li class="button">Risk</li>
            <li class="button">Complexity</li>
            <li class="button">Current number of Users</li>
        </ul>
      </div>
</template>

<style>
.card-strategy {
    width: 100%;
    height: auto; /* Adjusted for content */
    background-color: rgba(255, 255, 255, 0.1);
    border-radius: 1rem;
    padding: 1rem;
    margin: 1rem;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); /* Optional: added shadow for better visibility */
}

.button {
    display: inline-block;
    padding: 0.5em 1em;
    text-decoration: none;
    background: rgba(41, 41, 41, 0.1);
    color: #FFF;
    border-bottom: solid 4px #4a0641;
    border-radius: 3px;
}
.toolbar{
  display: flex;
  justify-content: space-between;
  background-color: rgba(32, 31, 31, 0.1);
  color: #FFF;
}
</style>

