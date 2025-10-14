<script setup></script>

<template>
    <div class="section-transfer">
        <h1>Money Transfer Widget</h1>
        <h6>First Step</h6>
        <p>Selector for the amount of money (device symbol)</p>
        <p>Modality (ex: rate of sending: amount/time)</p>
        <ul>
            <li>Recharge</li>
            <li>Ask</li>
            <li>Send</li>
        </ul>
        <h6>Second step</h6>
        <div class="container-tranfer">
            <h3>Destination:</h3>
            <p>White List (registered users)</p>
            <input type="text" placeholder="Add Wallet address or search for a user" />
            <h3>sending method</h3>
            <h3>Reason for sending</h3>
        </div>
    </div>
</template>

<style>
.container-tranfer{
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    margin:0.1rem 0.2rem;
    padding: 1rem;
    background-color: rgba(39, 38, 41, 0.521);
    border: 0.1rem solid rgba(39, 38, 41, 0.521);
    border-radius: 8px;
}
.section-transfer{
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
}
</style>