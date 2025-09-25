<script setup>
import { ref, onMounted } from 'vue';
import { useFriendsStore } from '@/stores/FriendsStore';

const route = useRoute();
const friendId = ref(route.params.id);
const friendsStore = useFriendsStore();
const friend = computed(() => {
  return friendsStore.friends.find(friend => friend.id === parseInt(friendId.value));
});

const priceEvolutionColors = {
  positive: 'rgba(29, 190, 42, 0.5)',
  negative: 'rgba(190, 29, 42, 0.5)',
  border: 'rgba(18, 65, 32, 0.5)',
};
</script>

<template>
  <div class="profile-container">
    <div class="profile-header">
      <div class="avatar-container">
        <UAvatar
          :chip-color="friend.online ? 'green' : 'red'"
          chip-text=""
          chip-position="top-right"
          size="xl"
          :src="friend.image"
          alt="Avatar"
          class="avatar"
        />
      </div>
      <div class="user-info">
        <h1 class="user-name"><strong>{{ friend.name }}</strong>'s Profile</h1>
        <p class="user-username"><i>Pseudonym:</i> <strong>{{ friend.username }}</strong></p>
      </div>
    </div>
    <div class="price-evolution" :style="{ backgroundColor: friend['value-evolution-percent'] >= 0 ? priceEvolutionColors.positive : priceEvolutionColors.negative }">
      <strong>+ {{ friend['value-evolution-percent'] }}%/d</strong>
    </div>
    <div class="profile-details">
      <p><i>Performances:</i> <strong>{{ friend.performances }}</strong></p>
      <Chart />
      <p><i>Achievements</i></p>
      <p><i>Psychology</i></p>
      <p><i>Historics / Logs / Transactions</i></p>
      <p><i>Preferences</i></p>
      <p><i>My Trading Platforms / Bank Accounts</i></p>
    </div>
  </div>
</template>

<style scoped>
.profile-container {
  margin: 2rem auto;
  padding: 2rem;
  background-color: rgba(33, 33, 33, 0.8);
  border: 1px solid rgba(44, 44, 44, 0.5);
  border-radius: 10px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.08);
  max-width: 800px;
}

.profile-header {
  display: flex;
  align-items: center;
  gap: 2rem;
  margin-bottom: 2rem;
}

.avatar-container {
  position: relative;
}

.avatar {
  width: 150px;
  height: 150px;
  border-radius: 50%;
  object-fit: cover;
}

.user-info {
  color: #ffffff;
}

.user-name {
  font-size: 2rem;
  margin-bottom: 0.5rem;
}

.user-username {
  font-size: 1.2rem;
}

.price-evolution {
  display: inline-block;
  padding: 0.5rem 1rem;
  border-radius: 5px;
  color: #ffffff;
  border: 3px solid v-bind('priceEvolutionColors.border');
  margin-bottom: 2rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.08)
}
.profile-details {
  color: #ffffff;
}

.profile-details p {
  margin-bottom: 1rem;
}

.profile-details strong {
  font-weight: bold;
}

.profile-details i {
  font-style: italic;
}
</style>
