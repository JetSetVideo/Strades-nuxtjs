<script setup>
import iconNews from "../assets/icon_News.png"
import iconChat from "../assets/icon_Chat.png"
import iconPrice from "../assets/icon_Prices.png"
import iconStrategies from "../assets/icon_Strategies.png"
import iconWallet from "../assets/Wallet.png"
</script>

<template>
    <div class="">
        <div class="NavigationBar">
            <NuxtLink to="/prices" class="NavigationButton">
                <img :src="iconPrice" alt="iconPrice" />
                <p>Prices</p>
            </NuxtLink>
            <NuxtLink to="/news" class="NavigationButton">
                <img :src="iconNews" alt="iconNews" />
                <p>News</p>
            </NuxtLink>
            <NuxtLink to="/wallet" class="NavigationButton">
                <img :src="iconWallet" alt="iconWallet" />
                <p>Wallet</p>
            </NuxtLink>
            <NuxtLink to="/strategies" class="NavigationButton">
                <img :src="iconStrategies" alt="iconStrategies"/>
                <p>Strategies</p>
            </NuxtLink>
            <NuxtLink to="/chat" class="NavigationButton">
                <img :src="iconChat" alt="iconChat"/>
                <p>Chat</p>
            </NuxtLink>
        </div>
    </div>
</template>

<style>
.NavigationBar {
    display: flex;
    position: fixed; /* Fix the navbar to the bottom of the viewport */
    bottom: 0; /* Position the navbar at the bottom of the viewport */
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    width: 100%; /* Make the navbar full-width */
    height: 4rem;
    padding: 3.5rem 7rem;
    background: linear-gradient(270deg, #111 -0.15%, rgba(68, 68, 68, 0.50) 50.06%, #111 99.96%);
    box-shadow: 1rem 0px 8.089px 0px rgba(0, 0, 0, 0.25);
}
.NavigationButton {
    display: flex;
    padding: -1rem 0;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 0rem;
    align-self: stretch;
    color:#111111
}
.NavigationButton:hover {
    background-color: #ffffff;
    box-shadow: 1rem 1rem 1rem #ffffff;
}
img{
    margin: 0.3rem;
    width:5rem;
    height:5rem;
    filter: drop-shadow(0px 1.429px 3.571px rgba(0, 0, 0, 0.65)) drop-shadow(-1.429px -1.429px 4.643px rgba(0, 0, 0, 0.50));
}
</style>
