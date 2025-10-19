<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useUsersStore } from '@/stores/users';
import { useAssetsStore } from '@/stores/assets'; // Assuming you have this
import UserProfileHeader from '@/components/Profile/Header.vue';
import UserStats from '@/components/Profile/UserStats.vue';
import UserAchievements from '@/components/Profile/Achievements.vue';
import UserPreferences from '@/components/Profile/Preferences.vue';
import PortfolioSnapshot from '@/components/Profile/PortfolioSnapshot.vue';

const route = useRoute();
const userId = computed(() => route.params.id);

const usersStore = useUsersStore();
const assetsStore = useAssetsStore();

// Fetch data in a real app, assuming it's already in stores for now
const user = computed(() => usersStore.getUserById(userId.value));
const userAssets = computed(() => usersStore.getUserAssets(userId.value));

const userPortfolio = computed(() => {
    if (!userAssets.value) return [];
    return userAssets.value.map(asset => {
        const assetDetails = assetsStore.getAssetById(asset.asset_id);
        return {
            ...asset,
            ...assetDetails,
        };
    });
});
</script>

<template>
  <div class="profile-container" v-if="user">
    <UserProfileHeader :user="user" />

    <!-- Header Tiles -->
    <div class="header-tiles">
      <div class="tile">
        <h4>Risk Tolerance</h4>
        <p>{{ user.risk_tolerance || 'Not set' }}</p>
      </div>
      <div class="tile">
        <h4>Win Rate</h4>
        <p>{{ user.win_rate ? (user.win_rate * 100).toFixed(1) + '%' : 'N/A' }}</p>
      </div>
      <div class="tile">
        <h4>Active Strategies</h4>
        <p>{{ user.active_strategies_count || 0 }}</p>
      </div>
      <div class="tile">
        <h4>24h Evolution</h4>
        <p>{{ user.portfolio_performance?.['24h'] ? (user.portfolio_performance['24h'] * 100).toFixed(1) + '%' : 'N/A' }}</p>
      </div>
    </div>

    <UserStats :user="user" />
    <UserAchievements :achievements="user.achievements" />
    <UserPreferences :preferences="user.notification_preferences" :privacy="user.privacy_settings" />
    <PortfolioSnapshot :portfolio="userPortfolio" />
  </div>
  <div v-else>
    User not found.
  </div>
</template>

<style scoped>
/* Add styles for the profile container and layout */
.profile-container {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.header-tiles {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.tile {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 1rem;
  text-align: center;
}

.tile h4 {
  margin: 0 0 0.5rem 0;
  color: #00aaff;
  font-size: 1rem;
}

.tile p {
  margin: 0;
  font-size: 1.2rem;
  font-weight: bold;
  color: white;
}
</style>
