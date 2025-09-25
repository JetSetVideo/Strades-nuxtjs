<script setup></script>
<template>
  <div class="container-shop">
    <h1>Shop</h1>
    <div><ul>
        <li class="button">Databases</li>
        <li class="button">Strategies</li>
        <li class="button">Buy</li>
        <li class="button">Rent</li>
    </ul></div>
    <div><ul>
        <li class="button">Subscribe</li>
        <li class="button">Buy</li>
        <li class="button">Rent</li>
        <li class="button">Share</li>
    </ul></div>
    <div class="section">
        <h1>Market</h1>
        <ul>
            <li>Strategies</li>
            <li>Assets</li>
            <li>Databases</li>
        </ul>
        <p>Subscribe to Strades Premium</p>
        <p>Buy extensions</p>
        <p>Buy eCu</p>
    </div>
  </div>
</template>
<style scoped>
.button {
    display: inline-block;
    padding: 0.5em 1em;
    text-decoration: none;
    background: #a17eaf;
    color: #FFF;
    border-bottom: solid 3px #4d3d26;
    border-radius: 3px;
}
.container-shop{
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 1rem;
    padding: 0.1rem 0.2rem;
    margin: 1rem;
    background-color: rgba(66, 55, 65, 0.5);
    border: 3px solid rgba(124, 124, 124, 0.3);
    border-radius: 8px;
    color:#ffffff;
}
</style>