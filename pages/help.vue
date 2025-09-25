<script setup>
definePageMeta({
    title: "Custom Page",
    description: "Custom Page",
    layout: "custom",
});
import imageUrl from "../assets/icon_help-circle.png"

</script>

<template>
    <div class="Help Page">
        <img :src="imageUrl" alt="imageUrl"/>
        <p>Help Page</p>
    </div>
    <p>manual</p>
</template>

<style scoped>
.Help {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    background-color: #333333;
    color:#ffffff;
}
</style>
