<script setup>
import { ref, onMounted, computed } from 'vue'
import { useUsersStore } from '@/stores/users'
import { useWalletsStore } from '@/stores/wallets'
import { useRoute } from 'vue-router'

const route = useRoute()
const usersStore = useUsersStore()
const walletsStore = useWalletsStore()

const userId = computed(() => route.params.id || usersStore.currentUser?.id)
const user = computed(() => usersStore.getUserById(userId.value))
const wallet = computed(() => walletsStore.getWalletByUserId(userId.value))
const statistics = ref(null)

onMounted(async () => {
  await Promise.all([
    usersStore.fetchUsers(),
    walletsStore.fetchWallets()
  ])
  try {
    const statsData = await $fetch('/data/user_statistics.json')
    statistics.value = statsData.find(s => s.user_id === userId.value) || {}
  } catch (e) {
    statistics.value = {}
  }
})

const evolution24h = computed(() => {
  return wallet.value?.performance_history?.['1d']?.change_percentage?.toFixed(1) + '%' || '0%'
})
</script>

<template>
  <div class="profile-page" v-if="user">
    <div class="header">
      <UAvatar :src="user.avatar_url" size="xl" />
      <h1>{{ user.username }}</h1>
      <p>{{ user.bio }}</p>
      <div class="evolution">{{ evolution24h }} (24h)</div>
    </div>

    <section class="achievements">
      <h2>Achievements</h2>
      <div v-for="ach in statistics.achievements" :key="ach.id">
        {{ ach.name }} - Unlocked: {{ ach.unlocked }}
      </div>
    </section>

    <section class="performance">
      <h2>Performance</h2>
      <p>Total Trades: {{ statistics.performance?.total_trades }}</p>
      <p>Win Rate: {{ statistics.performance?.win_rate }}%</p>
      <!-- Add more metrics -->
    </section>

    <section class="psychology">
      <h2>Psychology</h2>
      <p>Risk Tolerance: {{ statistics.psychology?.risk_tolerance }}</p>
      <!-- etc -->
    </section>

    <section class="historics">
      <h2>Historics</h2>
      <p>Success Periods: {{ statistics.historics?.success_periods?.join(', ') }}</p>
    </section>

    <section class="preferences">
      <h2>Preferences</h2>
      <p>Favorite Assets: {{ statistics.preferences?.favorite_assets?.join(', ') }}</p>
    </section>

    <section class="platforms">
      <h2>Trading Platforms</h2>
      <ul>
        <li v-for="plat in statistics.trading_platforms" :key="plat">{{ plat }}</li>
      </ul>
    </section>

    <section class="banks">
      <h2>Bank Accounts</h2>
      <div v-for="bank in statistics.bank_accounts" :key="bank.account_number">
        {{ bank.bank }} - {{ bank.account_number }}
      </div>
    </section>

    <!-- Add real-time update logic if needed, but since mock, reactivity is via computed -->
  </div>
  <div v-else>Loading profile...</div>
</template>

<style scoped>
/* Add appropriate styles for sections */
.profile-page {
  padding: var(--spacing-lg);
}

.header {
  text-align: center;
  margin-bottom: var(--spacing-lg);
}

section {
  margin-bottom: var(--spacing-xl);
  padding: var(--spacing-md);
  background: var(--card-bg);
  border-radius: var(--radius-lg);
}
</style>
