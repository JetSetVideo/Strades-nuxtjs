<!-- components/Friend.vue -->
<script setup>
const props = defineProps({
  friend: {
    type: Object,
    required: true,
  },
});
</script>

<template>
  <NuxtLink :to="`/profile/${friend.id}`">
    <div class="friend-card">
      <div class="user-portrait">
        <UAvatar :src="friend.image" :alt="friend.name" />
      </div>
      <div class="user-info">
        <h2>{{ friend.name }}</h2>
        <h2>@ {{ friend.username }}</h2>
      </div>
    </div>
  </NuxtLink>
</template>

<style scoped>
.friend-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background-color: rgba(61, 61, 61, 0.5);
  border-radius: 0.5rem;
  cursor: pointer;
}

.user-portrait {
  display: flex;
  justify-content: center;
  align-items: center;
}

.user-info {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
</style>