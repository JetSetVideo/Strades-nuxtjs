<!-- Page for displaying asset's informations: price, tags, name, and a chart of the price evolution. -->
<script setup>
const backgroundColor = ref('rgba(0, 30, 0, 0.8)');
const companyName = ref('Tesla');
</script>
<template>
    <div class="asset-page" :style="{backgroundColor: backgroundColor}">
        <img src="assets\DailyPriceChart.png" alt="display-price">
        <img src="assets\Logo_Color.png" alt="profil-icon">
        <img src="assets\Tesla-black-logo-bgtransparent-png.png" alt="company-logo">
        <h1>Asset Page</h1>
        <p>Asset Name: {{ companyName }}</p>
        <Chart />
        <p>Head Quarter: Palo Alto, California, USA</p>
        <p>Year of creation: 2003</p>
        
        <p>CEO: Elon Musk</p>
        <p>Foundators: Elon Musk / J. B. Straubel / Martin Eberhard / Marc Tarpenning / Ian Wright</p>
        <p>Website: www.tesla.com</p>
        <div class="container-tags">
            <p>Tags</p>
            <p>#ElectricCar #Car #Tesla</p>
        </div>
        <WidgetAccounting />
        <p>Price Widget</p>
        <p>ToolBar</p>
        <div class="display-map">MAP
            <img src="assets\modern-world-map-background_1035-7605.jpg.avif" alt="company-map">
        </div>
        <p>Hierachy: Vertical VS Horizontal</p>
        <p>Number of employees</p>
    </div>
</template>
<style>
.asset-page {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    background: rgba(0, 0, 0, 0.8);
    box-shadow: 0px 2px 10px 0px rgba(5, 255, 0, 0.25), 1px 2px 10px 0px rgba(255, 255, 255, 0.20) inset;
    padding: 10px;
    margin: 10px;
    border: 0.1px solid rgba(255, 255, 255, 0.25);
    border-radius: 8px;
}
.container-tags{
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem;
    margin: 0.5rem;
    border-radius: 0.5rem;
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.3);
}
</style>