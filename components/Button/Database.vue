<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import Strategy from '@/components/Strategy/Card.vue'
import SharedData from '@/components/Card/SharedData.vue'
import { useStrategiesStore } from '@/stores/strategies'
import { useChatStore } from '@/stores/chat'
import { useUsersStore } from '@/stores/users'
import { useSharedDataStore } from '@/stores/sharedData'

// Store instances
const strategiesStore = useStrategiesStore()
const chatStore = useChatStore()
const usersStore = useUsersStore()
const sharedDataStore = useSharedDataStore()

// Data stores
const strategies = ref([])
const sharedData = ref([])
const conversations = ref([])
const users = ref([])

const route = useRoute()
const discussionId = route.params.id

// Panel state
const isOpen = ref(false)
const activeTab = ref('strategies') // 'strategies' or 'data'
const selectedUser = ref(null)

// Load data on mount
onMounted(async () => {
  try {
    // Initialize stores
    await Promise.all([
      strategiesStore.initializeStore(),
      chatStore.initializeStore(),
      usersStore.initializeStore(),
      sharedDataStore.initializeStore()
    ])

    // Get data from stores
    strategies.value = strategiesStore.strategies
    conversations.value = chatStore.conversations
    users.value = usersStore.users
    sharedData.value = sharedDataStore.sharedData

    // Filter data for this discussion
    const currentConversation = conversations.value.find(conv => conv.id === discussionId)

    if (currentConversation) {
      // Filter shared data by discussion ID
      sharedData.value = sharedDataStore.getSharedDataByDiscussion(discussionId)

      // Filter strategies by shared strategies in conversation metadata
      if (currentConversation.metadata?.shared_strategies) {
        const discussionStrategies = strategies.value.filter(strategy =>
          currentConversation.metadata.shared_strategies.includes(strategy.id)
        )
        strategies.value = discussionStrategies
      } else {
        // Fallback - show some strategies if no metadata
        strategies.value = strategies.value.slice(0, 3)
      }
    }
  } catch (error) {
    console.error('Failed to load data:', error)
  }
})

// Computed properties
const filteredStrategies = computed(() => {
  if (selectedUser.value) {
    return strategies.value.filter(strategy => strategy.creator_id === selectedUser.value)
  }
  return strategies.value
})

const filteredSharedData = computed(() => {
  if (selectedUser.value) {
    return sharedData.value.filter(item => item.sharedById === selectedUser.value)
  }
  return sharedData.value
})

const totalStrategies = computed(() => filteredStrategies.value.length)
const totalSharedData = computed(() => filteredSharedData.value.length)

// Methods
const openPanel = () => {
  isOpen.value = true
}

const closePanel = () => {
  isOpen.value = false
}

const handleOverlayClick = (event) => {
  // Only close if clicking the overlay itself, not its contents
  if (event.target === event.currentTarget) {
    closePanel()
  }
}

const handleEscapeKey = (event) => {
  if (event.key === 'Escape' && isOpen.value) {
    closePanel()
  }
}

// Add escape key listener
onMounted(() => {
  document.addEventListener('keydown', handleEscapeKey)
})

// Remove listener on unmount
import { onUnmounted } from 'vue'
onUnmounted(() => {
  document.removeEventListener('keydown', handleEscapeKey)
})
</script>

<template>
  <div>
    <!-- Database Button -->
    <button class="database-button" @click="openPanel" :title="'Shared Data & Strategies'">
      <div class="icon-wrapper">
        <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24">
          <path fill="currentColor" d="M12 11q3.75 0 6.375-1.175T21 7t-2.625-2.825T12 3T5.625 4.175T3 7t2.625 2.825T12 11m0 2.5q1.025 0 2.563-.213t2.962-.687t2.45-1.237T21 9.5V12q0 1.1-1.025 1.863t-2.45 1.237t-2.962.688T12 16t-2.562-.213t-2.963-.687t-2.45-1.237T3 12V9.5q0 1.1 1.025 1.863t2.45 1.237t2.963.688T12 13.5m0 5q1.025 0 2.563-.213t2.962-.687t2.45-1.237T21 14.5V17q0 1.1-1.025 1.863t-2.45 1.237t-2.962.688T12 21t-2.562-.213t-2.963-.687t-2.45-1.237T3 17v-2.5q0 1.1 1.025 1.863t2.45 1.237t2.963.688T12 18.5"/>
        </svg>
      </div>
    </button>

    <!-- Sliding Panel Overlay -->
    <div
      v-if="isOpen"
      class="panel-overlay"
      @click="handleOverlayClick"
    ></div>

    <!-- Sliding Panel -->
    <div class="sliding-panel" :class="{ 'open': isOpen }">
      <!-- Panel Header -->
      <div class="panel-header">
        <div class="header-content">
          <h2>📊 Shared Data & Strategies</h2>
          <button class="close-button" @click="closePanel" title="Close (ESC)">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
              <path fill="currentColor" d="M18.3 5.71a.996.996 0 0 0-1.41 0L12 10.59L7.11 5.7A.996.996 0 1 0 5.7 7.11L10.59 12L5.7 16.89a.996.996 0 1 0 1.41 1.41L12 13.41l4.89 4.89a.996.996 0 1 0 1.41-1.41L13.41 12l4.89-4.89c.38-.38.38-1.02 0-1.4z"/>
            </svg>
          </button>
        </div>

        <!-- User Filter -->
        <div class="user-filter">
          <label for="user-select">Filter by user:</label>
          <select id="user-select" v-model="selectedUser">
            <option :value="null">All Users</option>
            <option
              v-for="user in users"
              :key="user.id"
              :value="user.id"
            >
              {{ user.username }}
            </option>
          </select>
        </div>

        <!-- Tab Navigation -->
        <div class="tab-navigation">
          <button
            class="tab-button"
            :class="{ active: activeTab === 'strategies' }"
            @click="activeTab = 'strategies'"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z"/>
            </svg>
            Strategies ({{ totalStrategies }})
          </button>
          <button
            class="tab-button"
            :class="{ active: activeTab === 'data' }"
            @click="activeTab = 'data'"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
            </svg>
            Shared Data ({{ totalSharedData }})
          </button>
        </div>
      </div>

      <!-- Panel Content -->
      <div class="panel-content">
        <!-- Strategies Tab -->
        <div v-if="activeTab === 'strategies'" class="content-section">
          <div v-if="filteredStrategies.length === 0" class="empty-state">
            <div class="empty-icon">📈</div>
            <h3>No strategies shared</h3>
            <p>Investment strategies shared in this discussion will appear here.</p>
          </div>
          <div v-else class="strategies-grid">
            <Strategy
              v-for="strategy in filteredStrategies"
              :key="strategy.id"
              :strategy="strategy"
            />
          </div>
        </div>

        <!-- Shared Data Tab -->
        <div v-if="activeTab === 'data'" class="content-section">
          <div v-if="filteredSharedData.length === 0" class="empty-state">
            <div class="empty-icon">📄</div>
            <h3>No shared data</h3>
            <p>Articles, news, and analysis shared in this discussion will appear here.</p>
          </div>
          <div v-else class="shared-data-list">
            <SharedData
              v-for="item in filteredSharedData"
              :key="item.id"
              :shared-data="item"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Database Button */
.database-button {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: var(--primary-gradient);
  color: var(--secondary-darker);
  border: none;
  box-shadow: var(--shadow-primary);
  transition: var(--transition-normal);
  cursor: pointer;
  margin-left: var(--spacing-md);
}

.database-button:hover {
  transform: translateY(-2px) scale(1.05);
  box-shadow: var(--shadow-accent);
}

.database-button:active {
  transform: translateY(0) scale(0.98);
}

.icon-wrapper {
  font-size: 24px;
  transition: var(--transition-fast);
}

.database-button:hover .icon-wrapper {
  transform: rotate(15deg);
}

/* Panel Overlay */
.panel-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  z-index: 1000;
  opacity: 0;
  animation: fadeInOverlay 0.3s ease-out forwards;
  cursor: pointer;
}

@keyframes fadeInOverlay {
  from {
    opacity: 0;
    backdrop-filter: blur(0px);
  }
  to {
    opacity: 1;
    backdrop-filter: blur(4px);
  }
}

/* Sliding Panel */
.sliding-panel {
  position: fixed;
  top: 0;
  right: 0;
  width: 520px;
  height: 100vh;
  background: var(--bg-primary);
  border-left: 1px solid var(--border-primary);
  box-shadow: var(--shadow-primary);
  z-index: 1001;
  transform: translateX(100%);
  transition: transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.sliding-panel.open {
  transform: translateX(0);
}

/* Panel Header */
.panel-header {
  background: var(--card-bg);
  border-bottom: 1px solid var(--border-primary);
  padding: var(--spacing-lg);
  flex-shrink: 0;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-md);
}

.header-content h2 {
  color: var(--text-white);
  margin: 0;
  font-size: 1.4rem;
  font-family: var(--font-family-primary);
  font-weight: 600;
  background: linear-gradient(135deg, var(--primary-green), var(--primary-blue));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.close-button {
  background: none;
  border: none;
  color: var(--text-gray);
  cursor: pointer;
  padding: var(--spacing-sm);
  border-radius: var(--radius-md);
  transition: var(--transition-normal);
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-button:hover {
  background: var(--error-red);
  color: white;
  transform: rotate(90deg);
}

.user-filter {
  margin-bottom: var(--spacing-md);
}

.user-filter label {
  display: block;
  color: var(--text-gray);
  font-size: 0.9rem;
  margin-bottom: var(--spacing-xs);
  font-family: var(--font-family-secondary);
  font-weight: 500;
}

.user-filter select {
  width: 100%;
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  color: var(--text-white);
  font-family: var(--font-family-secondary);
  font-size: 0.9rem;
  transition: var(--transition-normal);
}

.user-filter select:focus {
  outline: none;
  border-color: var(--primary-green);
  box-shadow: 0 0 0 2px rgba(29, 190, 42, 0.2);
}

.user-filter select:hover {
  border-color: var(--border-accent);
}

/* Tab Navigation */
.tab-navigation {
  display: flex;
  gap: var(--spacing-sm);
  background: var(--bg-secondary);
  border-radius: var(--radius-lg);
  padding: var(--spacing-xs);
}

.tab-button {
  flex: 1;
  padding: var(--spacing-md);
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  color: var(--text-gray);
  cursor: pointer;
  font-family: var(--font-family-secondary);
  font-size: 0.9rem;
  font-weight: 500;
  transition: var(--transition-normal);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
}

.tab-button:hover {
  background: var(--bg-tertiary);
  color: var(--text-white);
}

.tab-button.active {
  background: var(--primary-gradient);
  color: var(--secondary-darker);
  border-color: var(--primary-green);
  box-shadow: var(--shadow-accent);
  transform: translateY(-1px);
}

.tab-button svg {
  transition: var(--transition-fast);
}

.tab-button.active svg {
  transform: scale(1.1);
}

/* Panel Content */
.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-lg);
  scrollbar-width: thin;
  scrollbar-color: var(--border-primary) transparent;
}

.panel-content::-webkit-scrollbar {
  width: 6px;
}

.panel-content::-webkit-scrollbar-track {
  background: transparent;
}

.panel-content::-webkit-scrollbar-thumb {
  background: var(--border-primary);
  border-radius: 3px;
}

.panel-content::-webkit-scrollbar-thumb:hover {
  background: var(--border-accent);
}

.content-section {
  height: 100%;
  animation: fadeInContent 0.3s ease-out;
}

@keyframes fadeInContent {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  text-align: center;
  color: var(--text-gray);
  padding: var(--spacing-xl);
}

.empty-icon {
  font-size: 5rem;
  margin-bottom: var(--spacing-lg);
  opacity: 0.6;
  animation: bounceIn 0.6s ease-out;
}

@keyframes bounceIn {
  0% {
    transform: scale(0.3);
    opacity: 0;
  }
  50% {
    transform: scale(1.05);
  }
  70% {
    transform: scale(0.9);
  }
  100% {
    transform: scale(1);
    opacity: 0.6;
  }
}

.empty-state h3 {
  color: var(--text-white);
  margin: 0 0 var(--spacing-sm) 0;
  font-family: var(--font-family-primary);
  font-size: 1.2rem;
}

.empty-state p {
  margin: 0;
  font-family: var(--font-family-secondary);
  max-width: 350px;
  line-height: 1.5;
}

.strategies-grid {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.shared-data-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

/* Responsive Design */
@media (max-width: 768px) {
  .sliding-panel {
    width: 100vw;
  }

  .panel-header {
    padding: var(--spacing-md);
  }

  .header-content h2 {
    font-size: 1.2rem;
  }

  .panel-content {
    padding: var(--spacing-md);
  }

  .tab-navigation {
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  .tab-button {
    padding: var(--spacing-sm);
    font-size: 0.85rem;
  }
}

@media (max-width: 480px) {
  .database-button {
    width: 50px;
    height: 50px;
    margin-left: var(--spacing-sm);
  }

  .icon-wrapper {
    font-size: 20px;
  }

  .sliding-panel {
    width: 100vw;
  }

  .panel-header {
    padding: var(--spacing-sm);
  }

  .header-content h2 {
    font-size: 1.1rem;
  }

  .panel-content {
    padding: var(--spacing-sm);
  }

  .tab-button {
    padding: var(--spacing-xs);
    font-size: 0.8rem;
  }

  .empty-icon {
    font-size: 4rem;
  }
}

/* Animation for panel entrance */
.sliding-panel.open .panel-content {
  animation: slideInContent 0.4s ease-out 0.1s both;
}

@keyframes slideInContent {
  from {
    opacity: 0;
    transform: translateX(20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
</style>