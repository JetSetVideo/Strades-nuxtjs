<script setup>
import { ref, computed } from 'vue'
import { useUsersStore } from '~/stores/users'

const usersStore = useUsersStore()
const currentUser = computed(() => usersStore.users?.[0] || usersStore.users)
const isOpen = ref(false)

// Use local avatar from data/avatars folder
const avatarSrc = computed(() => {
  // Try to use the first available avatar or fallback to user avatar_url
  return `/avatars/Ellipse5.png`
})
</script>

<template>
<div>
    <UButton label="Open" @click="isOpen = true" class="avatar-button">
        <div class="avatar-image-wrapper">
            <img :src="avatarSrc" :alt="`${currentUser.first_name} ${currentUser.last_name} Avatar`" />
        </div>
    </UButton>
    
    <USlideover v-model="isOpen" side="left">
        <div class="header">
            <div class="avatar-image-wrapper">
                <img :src="avatarSrc" :alt="`${currentUser.first_name} ${currentUser.last_name} Avatar`" />
            </div>
            <span class="tag-name">{{ currentUser.first_name }} {{ currentUser.last_name }}</span>
            <div class="user-info">
                <div class="info-item">
                    <span class="info-label">Username:</span>
                    <span class="info-value">{{ currentUser.username }}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Email:</span>
                    <span class="info-value">{{ currentUser.email }}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Date of Birth:</span>
                    <span class="info-value">{{ new Date(currentUser.date_of_birth).toLocaleDateString() }}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Country:</span>
                    <span class="info-value">{{ currentUser.country }}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Risk Tolerance:</span>
                    <span class="info-value">{{ currentUser.risk_tolerance }}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Trading Experience:</span>
                    <span class="info-value">{{ currentUser.trading_experience }}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Bio:</span>
                    <span class="info-value">{{ currentUser.bio }}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Total Portfolio:</span>
                    <span class="info-value">${{ currentUser.total_portfolio_value?.toLocaleString() }}</span>
                </div>
            </div>
            <ButtonSettings />
        </div>
    </USlideover>
</div>
</template>

<style scoped>
.avatar-button {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-decoration: none;
  background: rgba(255, 255, 255, 0.1);
  border-radius: var(--app-border-radius, 15px);
  padding: 0.5rem;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
  cursor: pointer;
}

.avatar-button:hover {
  background: rgba(255, 255, 255, 0.15);
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
}

.avatar-image-wrapper {
  border-radius: 50%;
  border: 2px solid #00aaff;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden;
  box-shadow: 0 4px 15px rgba(0, 170, 255, 0.3);
  transition: all 0.3s ease;
}

.avatar-image-wrapper:hover {
  border-color: #00ccff;
  box-shadow: 0 6px 20px rgba(0, 204, 255, 0.4);
}

.avatar-image-wrapper img {
  width: 3.5rem;
  height: 3.5rem;
  object-fit: cover;
  transition: transform 0.3s ease;
}

.avatar-image-wrapper:hover img {
  transform: scale(1.05);
}

.tag-name {
  font-family: "Poppins", sans-serif;
  font-size: 1rem;
  font-weight: 600;
  color: white;
  margin-top: 0.5rem;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.header {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: center;
  gap: 1rem;
  background: var(--bg-primary, #000);
  padding: 1.5rem;
  color: white;
  width: 100%;
  height: 100%;
  overflow-y: auto;
}

.header .avatar-image-wrapper {
  border-width: 3px;
  width: 5rem;
  height: 5rem;
}

.header .avatar-image-wrapper img {
  width: 4.8rem;
  height: 4.8rem;
}

.header .tag-name {
  font-size: 1.4rem;
  font-weight: 700;
  background: linear-gradient(45deg, #00aaff, #00ccff);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  text-shadow: none;
}

.user-info {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  padding: 1rem;
  width: 100%;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.info-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.25rem;
  padding: 0.5rem;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.04);
}

.info-label {
  font-family: "Poppins", sans-serif;
  font-size: 0.75rem;
  font-weight: 600;
  color: #00aaff;
  width: 100%;
  text-align: left;
}

.info-value {
  font-family: "Poppins", sans-serif;
  font-size: 0.9rem;
  font-weight: 500;
  color: white;
  width: 100%;
  text-align: left;
}

@media (min-width: 768px) {
  .info-item {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem;
  }
  .info-label {
    width: auto;
    flex: 1;
  }
  .info-value {
    width: auto;
    flex: 2;
    text-align: right;
  }
}
</style>

