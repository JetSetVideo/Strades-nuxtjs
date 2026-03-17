<script setup>
import { ref, computed, onMounted } from 'vue'
import { useUsersStore } from '~/stores/users'
import OverlaySlideover from '~/components/Overlay/Slideover.vue'

const usersStore = useUsersStore()
const currentUser = computed(() => usersStore.currentUser || usersStore.users?.[0] || null)
const isOpen = ref(false)

// Use local avatar from data/avatars folder
const avatarSrc = computed(() => {
  return currentUser.value?.avatar_url || `/avatars/Ellipse5.png`
})

onMounted(async () => {
  // ensure placeholder "DB" is loaded, like a remote fetch would do
  if (!usersStore.users.length && !usersStore.currentUser) {
    await usersStore.initializeStore()
  }
})
</script>

<template>
<div>
    <!-- Trigger (avatar icon) -->
    <div
      class="avatar-button"
      role="button"
      tabindex="0"
      :class="{ 'is-open': isOpen }"
      @click="isOpen = !isOpen"
    >
      <div class="avatar-image-wrapper">
        <img :src="avatarSrc" :alt="`${currentUser?.first_name} ${currentUser?.last_name} Avatar`" />
      </div>
    </div>

    <!-- Content (overlayed left drawer) -->
    <OverlaySlideover v-model="isOpen" side="left" :overlay="true" width="clamp(18rem, 50vw, 32rem)">
        <div class="profile-panel" @click.stop>
          <div class="profile-hero">
            <UButton
              icon="i-heroicons-x-mark-20-solid"
              color="gray"
              variant="ghost"
              size="sm"
              class="absolute top-2 right-2 z-10 close-btn"
              @click="isOpen = false"
            />
            <div class="profile-avatar">
              <img :src="avatarSrc" :alt="`${currentUser?.first_name} ${currentUser?.last_name} Avatar`" />
            </div>
            <div class="profile-title">
              <span class="tag-name">{{ currentUser?.first_name }} {{ currentUser?.last_name }}</span>
            </div>
          </div>

          <div class="user-info" v-if="currentUser">
            <div class="info-item">
              <span class="info-label">Email:</span>
              <span class="info-value">{{ currentUser.email || 'alice@example.com' }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Date of Birth:</span>
              <span class="info-value">{{ currentUser.date_of_birth ? new Date(currentUser.date_of_birth).toLocaleDateString() : 'Jan 1, 1990' }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Country:</span>
              <span class="info-value">{{ currentUser.country || 'USA' }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Risk Tolerance:</span>
              <span class="info-value">{{ currentUser.risk_tolerance || 'High' }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Trading Experience:</span>
              <span class="info-value">{{ currentUser.trading_experience || 'Expert' }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Bio:</span>
              <span class="info-value">{{ currentUser.bio || 'Active swing trader' }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Total Portfolio:</span>
              <span class="info-value">${{ currentUser.total_portfolio_value ? currentUser.total_portfolio_value.toLocaleString() : '100,000' }}</span>
            </div>
          </div>

          <ButtonSettings />
        </div>
    </OverlaySlideover>
</div>
</template>

<style scoped>
.avatar-button {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-decoration: none;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 50%;
  padding: 0.25rem;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  transition: all 0.3s ease;
  cursor: pointer;
  width: 2.5rem;
  height: 2.5rem;
}

.avatar-button:hover {
  background: rgba(255, 255, 255, 0.1);
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
}

.avatar-image-wrapper {
  border-radius: 50%;
  border: 2px solid var(--primary-blue, #00aaff);
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 170, 255, 0.2);
  transition: all 0.3s ease;
  width: 100%;
  height: 100%;
}

.avatar-image-wrapper:hover {
  border-color: #00ccff;
  box-shadow: 0 4px 12px rgba(0, 204, 255, 0.4);
}

.avatar-image-wrapper img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
}

.avatar-image-wrapper:hover img {
  transform: scale(1.05);
}

.tag-name {
  font-family: "Poppins", sans-serif;
  font-size: 0.9rem;
  font-weight: 600;
  color: white;
  margin-top: 0.25rem;
  display: none; /* Hide under normal circumstances, show only in slideover */
}

/* Slideover layout is handled by components/Overlay/Slideover.vue */

.avatar-button.is-open {
  background: rgba(255, 255, 255, 0.1);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
  border-color: rgba(255, 255, 255, 0.18);
}

.profile-panel {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: stretch;
  gap: 0.65rem;
  background: transparent;
  padding: 0.75rem;
  color: white;
  width: 100%;
  height: 100%;
  overflow-y: auto;
  position: relative;
}

.profile-hero {
  position: relative;
  min-height: 3.25rem;
  padding: 0.25rem 0.25rem 0.25rem 3.75rem; /* leave room for avatar */
  border-radius: calc(var(--app-border-radius, 12px) - 2px);
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.04);
}

.profile-avatar {
  position: absolute;
  top: 0.5rem;
  left: 0.5rem;
  width: 3rem;
  height: 3rem;
  border-radius: 9999px;
  overflow: hidden;
  border: 2px solid var(--primary-blue, #00aaff);
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.45);
  z-index: 30; /* stays above hero chrome */
  background: rgba(0, 0, 0, 0.35);
}

.profile-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.profile-title {
  display: flex;
  align-items: center;
  min-height: 3rem;
  padding-right: 2.25rem; /* keep away from close button */
}

.close-btn {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 50%;
}
.close-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

.tag-name {
  display: block;
  font-size: 1rem;
  font-weight: 700;
  background: linear-gradient(45deg, var(--primary-blue, #00aaff), #00ccff);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  text-shadow: none;
  margin-top: 0;
}

.user-info {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 0.6rem;
  width: 100%;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.info-item {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
  padding: 0.35rem 0.5rem;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.04);
}

.info-label {
  font-family: "Poppins", sans-serif;
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--primary-blue, #00aaff);
  width: auto;
  text-align: left;
}

.info-value {
  font-family: "Poppins", sans-serif;
  font-size: 0.78rem;
  font-weight: 500;
  color: var(--text-white, #fff);
  width: auto;
  text-align: right;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 60%;
}

@media (min-width: 768px) {
  :deep([data-slot="content"]) {
    width: 20rem !important;
  }

  .profile-panel {
    padding: 0.9rem;
    gap: 0.75rem;
  }

  .profile-avatar {
    width: 3.25rem;
    height: 3.25rem;
  }

  .profile-hero {
    padding-left: 4.1rem;
    min-height: 3.6rem;
  }

  .tag-name {
    font-size: 1.1rem;
  }

  .info-label {
    font-size: 0.75rem;
  }
  .info-value {
    font-size: 0.85rem;
  }
}
</style>

