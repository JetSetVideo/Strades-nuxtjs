<script setup lang="ts">
import { defineComponent } from 'vue';

defineComponent({
  name: 'MaterialSymbolsNotifications',
});
</script>
<template>
  <NuxtLink to="/notifications" class="button">
    <UChip text="3" position="bottom-right" size="2xl">
      <h1>Notifications</h1>
      <svg xmlns="http://www.w3.org/2000/svg" width="1.6em" height="1.6em" viewBox="0 0 24 24">
          <path fill="currentColor" d="M4 19v-2h2v-7q0-2.075 1.25-3.687T10.5 4.2v-.7q0-.625.438-1.062T12 2q.625 0 1.063.438T13.5 3.5v.7q2 .5 3.25 2.113T18 10v7h2v2zm8 3q-.825 0-1.412-.587T10 20h4q0 .825-.587 1.413T12 22" />
      </svg>
    </UChip>
  </NuxtLink>
</template>
<style scoped>
.button {
    width: auto;
    height: auto;
    color: #ffffff;
    background-color: rgba(24, 24, 24, 0.5);
    margin: 0.5rem;
    padding: 0.2rem;
    display: flex;
    justify-content: center;
    align-items: center;
    border-radius: 0.5rem;
    transition: background-color 0.3s;

}
.button:hover {
    background-color: rgba(17, 17, 17, 0.7);
}
</style>

