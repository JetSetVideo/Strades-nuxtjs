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


const strategy = ref([
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
])
</script>

<template>
    <div v-for="strat in strategy" :key="strat.id" class="card-strategy">
        <h3>{{ strat.name }}</h3>
        <p>{{ strat.description }}</p>
        <p>Status: {{ strat.status }}</p>
        <p>Type: {{ strat.type }}</p>
        <p>Live Trading: {{ strat.live_trading ? 'Yes' : 'No' }}</p>
        <p>Run Type: {{ strat.run_type }}</p>
        <p>Expected Profit: {{ strat.expected_profit }}</p>
        <p>Expected Loss: {{ strat.expected_loss }}</p>
        <p>Risk Level: {{ strat.risk_level }}</p>
        <p>Experience Level: {{ strat.experience }}</p>
        <p>Net Profit: {{ strat.net_profit }}</p>
        <!-- Add more fields as needed -->
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
</style>