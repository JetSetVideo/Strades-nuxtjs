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
  border-radius: 15px;
  padding: 10px;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
  cursor: pointer;
}

.avatar-button:hover {
  background: rgba(255, 255, 255, 0.15);
  transform: translateY(-2px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
}

.avatar-image-wrapper {
  border-radius: 50%;
  border: 3px solid #00aaff;
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
  width: 80px;
  height: 80px;
  object-fit: cover;
  transition: transform 0.3s ease;
}

.avatar-image-wrapper:hover img {
  transform: scale(1.05);
}

.tag-name {
  font-family: "Poppins", sans-serif;
  font-size: 1.2rem;
  font-weight: 600;
  color: white;
  margin-top: 8px;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.header {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: center;
  gap: 20px;
  background: linear-gradient(135deg, rgba(20, 20, 20, 0.95) 0%, rgba(30, 30, 30, 0.95) 100%);
  backdrop-filter: blur(20px);
  padding: 30px;
  color: white;
  width: 100%;
  height: 100%;
  border-radius: 20px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

.header .avatar-image-wrapper {
  border-width: 4px;
  width: 120px;
  height: 120px;
}

.header .avatar-image-wrapper img {
  width: 116px;
  height: 116px;
}

.header .tag-name {
  font-size: 1.8rem;
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
  gap: 15px;
  padding: 20px;
  width: 100%;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 15px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 15px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  transition: all 0.3s ease;
}

.info-item:hover {
  background: rgba(255, 255, 255, 0.08);
  transform: translateX(5px);
}

.info-label {
  font-family: "Poppins", sans-serif;
  font-size: 1rem;
  font-weight: 600;
  color: #00aaff;
  background: rgba(0, 170, 255, 0.1);
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid rgba(0, 170, 255, 0.2);
  flex: 1;
  text-align: center;
}

.info-value {
  font-family: "Poppins", sans-serif;
  font-size: 1rem;
  font-weight: 500;
  color: white;
  background: rgba(255, 255, 255, 0.1);
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  flex: 1.5;
  text-align: center;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.1);
}
</style>

