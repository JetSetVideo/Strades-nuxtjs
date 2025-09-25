<script setup>
</script>
<template>
<div class="quest-page">
    <WidgetExperience />
    <h1>Quest</h1>
    <div class="card-quest">
        <h1>Daily</h1>
    </div>
    <div class="card-quest">
        <h1>Challenges</h1>
    </div>
    <div class="card-quest">
        <h1>Season Pass</h1>
    </div>
    <div class="card-quest">
        <h1>Success</h1>
    </div>
    <div class="card-quest">
        <h1>Streaks</h1>
    </div>
    <div class="card-quest">
        <h1>Tournament</h1>
    </div>
</div>
</template>
<style>
.card-quest{
    display: inline-flex;
    padding: 8px 14px;
    justify-content: center;
    align-items: center;
    gap: 18px;
    border-radius: 0px 8px;
    background: linear-gradient(180deg, rgba(148, 115, 31, 0.50) 0%, rgba(203, 172, 92, 0.75) 51.04%, rgba(142, 112, 35, 0.50) 100%);
    box-shadow: 0px 2px 10px 0px rgba(0, 0, 0, 0.20), 0px 3px 10px 0px rgba(255, 255, 255, 0.25) inset;
}
.quest-page{
    display: flex;
    flex-direction: column;
    gap: 10px;
}
</style>
