<script setup>
import { ref, computed } from 'vue'

const databaseItems = ref([
  {
    id: 1,
    title: 'Article 1',
    category: 'News',
    sharedBy: [1, 2],
    sharedAt: '2023-06-10T10:30:00Z',
    size: 1024
  },
  {
    id: 2,
    title: 'Article 2',
    category: 'Technology',
    sharedBy: [1, 3],
    sharedAt: '2023-06-09T15:45:00Z',
    size: 2048
  }
  // Add more fake items here...
])

const users = ref([
  { id: 1, name: 'John Doe' },
  { id: 2, name: 'Jane Smith' },
  { id: 3, name: 'Mike Johnson' }
])

const selectedUser = ref(null)
const isOpen = ref(false)

const filteredItems = computed(() => {
  if (selectedUser.value) {
    return databaseItems.value.filter(item => item.sharedBy.includes(selectedUser.value.id))
  }
  return databaseItems.value
})

const totalSize = computed(() => {
  return filteredItems.value.reduce((total, item) => total + item.size, 0)
})
</script>

<template>
<div>
  <UButton class="database-button" @click="isOpen = true">
    <div class="icon-wrapper">
      <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24">
        <path fill="currentColor" d="M12 11q3.75 0 6.375-1.175T21 7t-2.625-2.825T12 3T5.625 4.175T3 7t2.625 2.825T12 11m0 2.5q1.025 0 2.563-.213t2.962-.687t2.45-1.237T21 9.5V12q0 1.1-1.025 1.863t-2.45 1.237t-2.962.688T12 16t-2.562-.213t-2.963-.687t-2.45-1.237T3 12V9.5q0 1.1 1.025 1.863t2.45 1.237t2.963.688T12 13.5m0 5q1.025 0 2.563-.213t2.962-.687t2.45-1.237T21 14.5V17q0 1.1-1.025 1.863t-2.45 1.237t-2.962.688T12 21t-2.562-.213t-2.963-.687t-2.45-1.237T3 17v-2.5q0 1.1 1.025 1.863t2.45 1.237t2.963.688T12 18.5"/>
      </svg>
    </div>
  </UButton>

  <USlideover v-model="isOpen" side="right">
    <div class="panel-header">
      <h2>Shared Items</h2>
      <div class="user-filter">
        <label for="user-select">Filter by user:</label>
        <select id="user-select" v-model="selectedUser">
          <option :value="null">All Users</option>
          <option v-for="user in users" :key="user.id" :value="user">{{ user.name }}</option>
        </select>
      </div>
      <div class="item-count">Total Items: {{ filteredItems.length }}</div>
      <div class="total-size">Total Size: {{ totalSize }} bytes</div>
    </div>
    <div class="panel-content">
      <div v-for="item in filteredItems" :key="item.id" class="item-card">
        <h3>{{ item.title }}</h3>
        <p>Category: {{ item.category }}</p>
        <p>Shared By: {{ item.sharedBy.map(userId => users.find(user => user.id === userId).name).join(', ') }}</p>
        <p>Shared At: {{ new Date(item.sharedAt).toLocaleString() }}</p>
        <p>Size: {{ item.size }} bytes</p>
      </div>
    </div>
  </USlideover>
</div>
</template>


<style scoped>
.database-button {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background-color: rgba(0, 118, 255, 0.8);
  color: rgba(255, 255, 255, 0.9);
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.06), 
              inset 0 0 6px rgba(255, 255, 255, 0.3);
  transition: all 0.3s ease;
}

.database-button:hover {
  background-color: rgba(0, 118, 255, 0.9);
  box-shadow: 0 6px 8px rgba(0, 0, 0, 0.15), 0 3px 6px rgba(0, 0, 0, 0.1),
              inset 0 0 8px rgba(255, 255, 255, 0.4);
}

.icon-wrapper {
  font-size: 24px;
}

.panel-header {
  padding: 20px;
  background-color: rgba(0, 0, 0, 0.8);
  color: rgba(255, 255, 255, 0.9);
}

.user-filter {
  margin-top: 0.6rem;
}
.user-filter select {
  background-color: rgba(0, 0, 0, 0.6);
  color: rgba(255, 255, 255, 0.9);
  padding: 5px;
  border-radius: 4px;
}
.item-count,
.total-size {
  margin-top: 10px;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.7);
}

.panel-content {
  padding: 1.1rem;
  background-color: rgba(33, 33, 33, 0.6);
  height: calc(100% - 120px); /* Adjust the height based on the header height */
  overflow-y: auto;
}
.item-card {
  padding: 15px;
  margin-bottom: 20px;
  background-color: rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.item-card h3 {
  margin-bottom: 10px;
  color: rgba(255, 255, 255, 0.9);
}

.item-card p {
  margin-bottom: 0.3rem;
  color: rgba(255, 255, 255, 0.7);
}
</style>