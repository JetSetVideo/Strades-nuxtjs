<script setup lang="ts">
const props = defineProps({
  unreadCount: {
    type: Number,
    default: 0,
  },
});
</script>

<template>
  <NuxtLink to="/notifications" class="button">
    <UChip :text="unreadCount" v-if="unreadCount > 0" position="bottom-right" size="xl">
      <span class="btn-label">Notifications</span>
      <svg xmlns="http://www.w3.org/2000/svg" width="1.4em" height="1.4em" viewBox="0 0 24 24">
          <path fill="currentColor" d="M4 19v-2h2v-7q0-2.075 1.25-3.687T10.5 4.2v-.7q0-.625.438-1.062T12 2q.625 0 1.063.438T13.5 3.5v.7q2 .5 3.25 2.113T18 10v7h2v2zm8 3q-.825 0-1.412-.587T10 20h4q0 .825-.587 1.413T12 22" />
      </svg>
    </UChip>
    <div v-else class="icon-wrapper">
      <span class="btn-label">Notifications</span>
      <svg xmlns="http://www.w3.org/2000/svg" width="1.4em" height="1.4em" viewBox="0 0 24 24">
          <path fill="currentColor" d="M4 19v-2h2v-7q0-2.075 1.25-3.687T10.5 4.2v-.7q0-.625.438-1.062T12 2q.625 0 1.063.438T13.5 3.5v.7q2 .5 3.25 2.113T18 10v7h2v2zm8 3q-.825 0-1.412-.587T10 20h4q0 .825-.587 1.413T12 22" />
      </svg>
    </div>
  </NuxtLink>
</template>

<style scoped>
.button {
    color: #ffffff;
    background-color: rgba(255, 255, 255, 0.05);
    margin: 0;
    padding: 0.5rem 1rem;
    display: inline-flex;
    justify-content: center;
    align-items: center;
    border-radius: var(--app-border-radius, 0.5rem);
    border: 1px solid rgba(255,255,255,0.1);
    transition: background-color 0.3s;
    text-decoration: none;
    font-family: 'Poppins', sans-serif;
    font-size: 0.9rem;
}
.button:hover {
    background-color: rgba(255, 255, 255, 0.15);
}

.icon-wrapper {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.btn-label {
  display: none;
}

@media (min-width: 768px) {
  .btn-label {
    display: block;
    margin-right: 0.5rem;
  }
}
</style>

