<script setup lang="ts">
</script>
<template>
    <div>Historic of trades</div>
    <div>
        <div>Filter</div>
        <div>Search</div>
    </div>
    <div class="selection">
        <div>Closed</div>
        <div>Open</div>
        <div>Upcoming</div>
    </div>
    <div>Review</div>
    <div>Analysis</div>
    <WalletPositionTracker />
</template>
<style scoped>
.selection {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    background-color: #333333;
    color:#ffffff;
}
.selection div {
    margin: 0.3rem 1rem;
}
.selection div:hover {
    background-color: #444444;
    box-shadow: 0 0 0.5rem #ffffff;
}
</style>
