<script setup>

</script>
<template>
  <div>
    <h1>Users</h1>
    <!-- <ConnectionTest /> -->
    <!-- <DataFetch /> -->
    <Asset />
    <AssetsCategoriesSelection />
    <BlockEditor />
    <Calendar />
    <CapitalDistribution />
    <Carousel />
    <Chart />
    <ChartAnalysis />
    <Company />
    <Comparator :strategies="[{name: 'Strat1', monthlyGain: 5, monthlyDrawdown: -2, totalProfit: 1000, winRate: 60}, {name: 'Strat2', monthlyGain: 3, monthlyDrawdown: -1, totalProfit: 800, winRate: 55}]" />
    <FinancialChart />
    <Filter />
    <Filters />
    <Heatmap />
  </div>
</template>
<style scoped>
</style>
