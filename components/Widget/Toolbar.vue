<script setup>

</script>

<template>
    <div class="toolbar-container">
        <div class="toolbar-item">
            <p>Toolbar</p>
        </div>
        <div class="toolbar-item">
            <ButtonBookmark />
        </div>
        <div class="toolbar-item">
            <ButtonTransfer />
        </div>
    </div>
</template>

<style scoped>
.toolbar-container {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    min-height: fit-content;
    background-color: rgba(0, 0, 0, 0.8);
    box-shadow: inset 0 0 10px rgba(255, 255, 255, 0.3), 0 0 10px rgba(0, 0, 0, 0.5);
}
.toolbar-item {
    display: flex;
    justify-content: center;
    align-items: center;
}
</style>

