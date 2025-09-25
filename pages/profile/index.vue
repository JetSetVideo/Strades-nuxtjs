<script setup>
import { ref } from 'vue'
import { useUsersStore } from '@/stores/UsersStore.ts';

const user = useUsersStore()
const walletEvolution24h = ref("5.6%")
</script>

<template>
<div class="section">
        <h1>User's profil {{ user.users.username }}</h1>
    <div class="container-header">
        <UAvatar chip-color="green" chip-text="" chip-position="top-right" size="lg" src="{{user.users.avatar}}" alt="Avatar"/>
        <p>Profil Picture</p>
        <div class="price-evolution">
            {{walletEvolution24h}}/d
        </div>
    </div>
        <p>Pseudonyme {{ user.users.pseudonyme }}</p>
        <div class="trust-level">
            <!-- the sercurity level that proves that it is a honest human -->
            <p>Trust Level: </p>
        </div>
        <div>
            <p>Avatars</p>
        </div>
        <p>Performances</p>
        <Chart />
        <p>Achievements</p>
        <p>Psychology</p>
        <p>Historics / Logs</p>
        <p>Preferences</p>
        <p>My Trading Platforms / Bank Accounts</p>
    </div>
</template>

<style>
.container-header{
    display: flex;
    flex-direction: row;
    justify-content: center;
    align-items: center;
    gap: 1rem;
    padding: 0.1rem 0.5rem;
    margin: 0.5rem;
    background-color: rgba(51, 51, 51, 0.5);
    border: 3px solid rgba(34, 48, 68, 0.5);
    border-radius: 5px;
    color:#ffffff;
}
.price-evolution{
    display: flex;
    flex-direction: row;
    justify-content: center;
    align-items: center;
    gap: 1rem;
    padding: 0.1rem 0.5rem;
    margin: 0.5rem;
    background-color: rgba(29, 190, 42, 0.5);
    border: 3px solid rgba(18, 65, 32, 0.5);
    border-radius: 5px;
    color:#ffffff;
}
.section {
    flex-direction: column;
    margin: 20px;
    padding: 20px;
    border: 1px solid #333;
}
</style>
