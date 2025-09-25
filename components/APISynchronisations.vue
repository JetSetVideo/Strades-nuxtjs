<script setup>
</script>

<template>
    <div class="section">
        <div class="card-promotion">
            Get Premium membership for unlimited accesses!
        </div>
        <p>Synchronisation of the APIs</p>
        <div class="all-connections">
            <p>All connections:</p>
            <div class="card-connection">
                <p>Connection 1: Binance</p>
                <p>Main Wallet</p>
                <p>Centralized Exchange</p>
                <p>Last synchronisation: 3 minutes ago</p>
            </div>
        </div>
        <div class="options"><p>Options</p>
            <p>Add a new connection</p>
            <p>Synchronisation periods</p>
        </div>
        <p>Help</p>
        <div class="button-synchronisation">
            <p>Synchronise now (image)</p>
        </div>
    </div>
</template>

<style>
.all-connections {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    padding: 1rem;
    margin: 1rem;
    background-color: #1b1b1b;
    color: #ffffff;
    border-radius: 0.5rem;
} 
.button-synchronisation{
    display: flex;
    flex-direction: row;
    justify-content: center;
    align-items: center;
    padding: 0.3rem 0.8rem;
    gap: 0.5rem;
    align-self: auto;
    background-color:#111111
}
.card-connection {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    padding: 1rem;
    margin: 1rem;
    background-color: #1b1b1b;
    color: #ffffff;
    border-radius: 0.5rem;
}
.card-promotion {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    padding: 1rem;
    margin: 1rem;
    background-color: #1b1b1b;
    color: #ffffff;
    border-radius: 0.5rem;
}

.options {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    padding: 1rem;
    margin: 1rem;
    background-color: #1b1b1b;
    color: #ffffff;
    border-radius: 0.5rem;
}

.section {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100vh;
    margin: 1rem;
    padding: 1rem;
    background-color: rgba(20, 20, 20, 0.1);
    border-radius: 0.5rem;
}
</style>