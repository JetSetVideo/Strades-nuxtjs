<script setup>
import { ref } from 'vue'
import { useUsersStore } from '~/stores/UsersStore'

const usersStore = useUsersStore()
const user = usersStore.users

const isOpen = ref(false)
</script>

<template>
<div>
    <UButton label="Open" @click="isOpen = true">
        <div class="avatar-image-wrapper">
            <img :src="user.avatar" alt="User Avatar" />
        </div>
        <span class="tag-name">{{ user.name }}</span>
    </UButton>
    
    <USlideover v-model="isOpen" side="left">
        <div class="header">
            <div class="avatar-image-wrapper">
                <img :src="user.avatar" alt="User Avatar" />
            </div>
            <span class="tag-name">{{ user.name }}</span>
            <div class="user-info">
                <div class="info-item">
                    <span class="info-label">Username:</span>
                    <span class="info-value">{{ user.username }}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Email:</span>
                    <span class="info-value">{{ user.email }}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Birthday:</span>
                    <span class="info-value">{{ user.birthday }}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Psychology Type:</span>
                    <span class="info-value">{{ user.psychologyType }}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Role:</span>
                    <span class="info-value">{{ user.role }}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Sentiment:</span>
                    <span class="info-value">{{ user.sentiment }}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Bio:</span>
                    <span class="info-value">{{ user.bio }}</span>
                </div>
                </div>
            <ButtonSettings />
        </div>
    </USlideover>
</div>
</template>

<style>
.avatar-button {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-decoration: none;
}

.avatar-image-wrapper {
  border-radius: 50%;
  border: 0.3rem solid rgb(0, 110, 255);
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden;
}

.avatar-image-wrapper img {
  width: 100px; /* Adjust size as needed */
  height: 100px; /* Adjust size as needed */
}
.header {
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    align-items: center;
    gap: 10px;
    background-color: rgba(0, 0, 0, 0.808);
    padding: 10px;
    color: white;
    width: 100%;
    height: 100%;
}
.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}

.info-label {
  background-color: rgba(128, 128, 128, 0.5);
  padding: 5px;
  border-radius: 5px;
  box-shadow: inset 0 0 5px rgba(0, 0, 0, 0.5);
  flex: 1;
}

.info-value {
  background-color: rgba(255, 255, 255, 0.8);
  padding: 5px;
  border-radius: 5px;
  box-shadow: inset 0 0 5px rgba(255, 255, 255, 0.5);
  flex: 2;
}
.tag-name {
    font-size: 1.5rem;
    font-weight: 600;
    color: #0076ff;
    background-color: rgba(0, 0, 0, 0.1);
    padding: 5px;
    border-radius: 5px;
    width: 100%;
    text-align: center;
    text-shadow: 0 0 5px rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(0, 0, 0, 0.1);
}
.user-info {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px;
  width: 100%;
}
</style>

