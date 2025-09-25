<script setup lang="ts">
import { useBitcoinStore } from "@/stores/BitcoinStore.ts";
const bitcoin = useBitcoinStore()
</script>

<template>
    <!-- <div>
        <h1>{{ bitcoin.bitcoinPrices }}</h1>
    </div> -->
    <ChartCandleChart />
</template>

<style scoped>

</style>

