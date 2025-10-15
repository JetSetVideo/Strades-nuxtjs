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
</style>
