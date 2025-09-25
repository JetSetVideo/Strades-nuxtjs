<!-- This Button can go anywhere and can become anything -->
<script setup>
const isOpen = ref(false);
</script>
<template>
<UButton label="Open" @click="isOpen = true" />

    <USlideover v-model="isOpen" prevent-close>
      <UCard
        class="flex flex-col flex-1"
        :ui="{
          background: 'bg-black',
          body: { base: 'flex-1' },
          ring: '',
          divide: 'divide-y divide-gray-100 dark:divide-gray-800',
        }"
      >
        <template #header>
          <div class="flex items-center justify-between">
            <h3
              class="text-base font-semibold leading-6 text-gray-900 dark:text-white"
            >
            </h3>
            <UButton
              color="gray"
              variant="ghost"
              icon="i-heroicons-x-mark-20-solid"
              class="-my-1"
              @click="isOpen = false"
            />
          </div>
        </template>

        <div class="menuLinks">
              <NuxtLink to="/pricing" class="nav-button">Product</NuxtLink>
              <NuxtLink to="/company" class="nav-button">Company</NuxtLink>
              <NuxtLink to="/community" class="nav-button">Community</NuxtLink>
        </div>
      </UCard>
    </USlideover>
</template>
<style scoped>
.menuLinks{
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  align-self: stretch;
  background-color: #1f1f1f;
  color: rgba(255, 255, 255, 1);
}
</style>