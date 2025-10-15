<script setup>
defineProps({
  user: {
    type: Object,
    required: true,
  },
});
</script>

<template>
  <div class="profile-header">
    <UAvatar :src="user.avatar_url || '/avatars/default.png'" size="2xl" />
    <div>
      <h1>{{ user.username }}</h1>
      <p>{{ user.bio }}</p>
      <button>Follow +</button>
    </div>
  </div>
</template>

<style scoped>
/* Styles for header */
</style>
