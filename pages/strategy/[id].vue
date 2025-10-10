<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useStrategies, type StrategySummary } from '@/composables/useStrategies'
import StrategyVisualizer from '@/components/StrategyVisualizer.vue'
import StrategyCodeView from '@/components/StrategyCodeView.vue'
import StrategyRating from '@/components/StrategyRating.vue'
import StrategyPnlChart from '@/components/StrategyPnlChart.vue'
import AvatarCard from '@/components/Card/Avatar.vue'

// Get the strategy ID from the route
const route = useRoute()
const strategyId = route.params.id as string

const { strategies, updateStrategy, fetchStrategies, fetchStrategyDetail, backtestStrategy, generateComplementary, generateOpposite } = useStrategies()
const isEditing = ref(false)
const editedStrategy = ref<StrategySummary | null>(null)
const details = ref<{ code: any; rating: any; history: any[]; trades: any[] } | null>(null)
const profileObjects = ref<Array<{ id: string; name: string; avatar_url?: string; pnl?: number; traits?: string[] }>>([])

async function loadProfiles(profileIds: string[]) {
  if (!profileIds || profileIds.length === 0) return
  try {
    const allProfiles = await $fetch<Array<{ id: string; name: string; avatar_url?: string; pnl?: number; traits?: string[] }>>('/data/strategies/profiles.json')
    profileObjects.value = allProfiles.filter(p => profileIds.includes(p.id))
  } catch {
    profileObjects.value = profileIds.map(id => ({ id, name: id }))
  }
}

// Find the current strategy
const currentStrategy = computed(() => {
  return strategies.value.find(s => s.id === strategyId) || null
})

// Asset icon mapping for display
function getAssetIcon(asset: string) {
  const assetMap: Record<string, string> = {
    'BTC': 'btc.svg',
    'ETH': 'eth.png',
    'bitcoin': 'btc.svg',
    'ethereum': 'eth.png',
    'AAPL': 'apple.png',
    'GOOGL': 'google.png',
    'MSFT': 'msft.png',
    'XRP': 'xrp.png',
    'USD': 'average.png',
  };

  const iconFile = assetMap[asset] || assetMap[asset.toUpperCase()] || 'average.png';
  return `/logos/${iconFile}`;
}

// Status management
function toggleStrategyStatus() {
  if (currentStrategy.value) {
    const newStatus = currentStrategy.value.status === 'active' ? 'paused' : 'active'
    updateStrategy(currentStrategy.value.id!, {
      status: newStatus,
      isRunning: newStatus === 'active'
    })
  }
}

// Editing functions
function startEditing() {
  if (currentStrategy.value) {
    editedStrategy.value = { ...currentStrategy.value }
    isEditing.value = true
  }
}

function cancelEditing() {
  editedStrategy.value = null
  isEditing.value = false
}

function saveChanges() {
  if (editedStrategy.value && currentStrategy.value) {
    updateStrategy(currentStrategy.value.id!, editedStrategy.value)
    isEditing.value = false
    editedStrategy.value = null
  }
}

function addTrade() {
  if (editedStrategy.value) {
    const newTrade = {
      asset: 'BTC',
      entryPrice: 0,
      exitPrice: 0,
      duration: 1,
      date: new Date().toISOString().split('T')[0]
    }
    editedStrategy.value.trades = [...(editedStrategy.value.trades || []), newTrade]
  }
}

function removeTrade(index: number) {
  if (editedStrategy.value?.trades) {
    editedStrategy.value.trades.splice(index, 1)
  }
}

function addBlock(type: string) {
  if (editedStrategy.value) {
    const newBlock = {
      type,
      id: Date.now(),
      data: {}
    }
    editedStrategy.value.blocks = [...(editedStrategy.value.blocks || []), newBlock]
  }
}

function removeBlock(index: number) {
  if (editedStrategy.value?.blocks) {
    editedStrategy.value.blocks.splice(index, 1)
  }
}

function handleImageError(event: Event) {
  const img = event.target as HTMLImageElement;
  if (img) {
    img.style.display = 'none';
    const placeholder = img.nextElementSibling as HTMLElement;
    if (placeholder) {
      placeholder.style.display = 'block';
    }
  }
}

onMounted(async () => {
  await fetchStrategies()
  try {
    details.value = await fetchStrategyDetail(strategyId)
    if (details.value?.code?.profiles) {
      await loadProfiles(details.value.code.profiles)
    }
  } catch {}
})
</script>
<template>
  <div class="strategy-detail-page">
    <!-- Header -->
    <div class="strategy-header">
      <div class="header-content">
        <h1 class="strategy-title" v-if="!isEditing">{{ currentStrategy?.name }}</h1>
        <input
          v-else
          v-model="editedStrategy!.name"
          class="strategy-title-input"
          placeholder="Strategy Name"
        >

        <div class="strategy-meta">
          <div class="meta-item">
            <span class="label">Creator:</span>
            <span class="value" v-if="!isEditing">{{ currentStrategy?.creator }}</span>
            <input
              v-else
              v-model="editedStrategy!.creator"
              class="meta-input"
              placeholder="Creator"
            >
          </div>

          <div class="meta-item">
            <span class="label">Created:</span>
            <span class="value">{{ currentStrategy?.creationDate }}</span>
          </div>

          <div class="meta-item">
            <span class="label">Last Modified:</span>
            <span class="value">{{ currentStrategy?.lastModifiedDate }}</span>
          </div>

          <div class="meta-item">
            <span class="label">Status:</span>
            <div class="status-indicator" :class="currentStrategy?.status">
              {{ currentStrategy?.status }}
            </div>
          </div>
        </div>

        <div class="strategy-description">
          <label class="description-label" v-if="isEditing">Description:</label>
          <p v-if="!isEditing">{{ currentStrategy?.description }}</p>
          <textarea
            v-else
            v-model="editedStrategy!.description"
            class="description-input"
            placeholder="Strategy Description"
          ></textarea>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="action-buttons">
        <button
          v-if="!isEditing"
          @click="startEditing"
          class="action-btn edit-btn"
        >
          Edit Strategy
        </button>

        <button
          v-if="!isEditing"
          @click="toggleStrategyStatus"
          :class="['action-btn', 'status-btn', currentStrategy?.status]"
        >
          {{ currentStrategy?.status === 'active' ? 'Pause' : 'Start' }}
        </button>

        <button
          v-if="isEditing"
          @click="saveChanges"
          class="action-btn save-btn"
        >
          Save Changes
        </button>

        <button
          v-if="isEditing"
          @click="cancelEditing"
          class="action-btn cancel-btn"
        >
          Cancel
        </button>
      </div>
    </div>

    <!-- Main Content -->
    <div class="strategy-content">
      <!-- Performance Metrics -->
      <div class="section performance-section">
        <h2 class="section-title">Performance Metrics</h2>
        <div class="metrics-grid">
          <div class="metric-card">
            <div class="metric-label">Monthly Gain</div>
            <div
              class="metric-value"
              :class="{ positive: (currentStrategy?.monthlyGain || 0) > 0, negative: (currentStrategy?.monthlyGain || 0) < 0 }"
            >
              {{ currentStrategy?.monthlyGain }}%
            </div>
          </div>

          <div class="metric-card">
            <div class="metric-label">Monthly Drawdown</div>
            <div
              class="metric-value"
              :class="{ positive: (currentStrategy?.monthlyDrawdown || 0) < 0, negative: (currentStrategy?.monthlyDrawdown || 0) > 0 }"
            >
              {{ currentStrategy?.monthlyDrawdown }}%
            </div>
          </div>

          <div class="metric-card">
            <div class="metric-label">Total Profit</div>
            <div class="metric-value positive">
              ${{ currentStrategy?.totalProfit }}
            </div>
          </div>

          <div class="metric-card">
            <div class="metric-label">Win Rate</div>
            <div class="metric-value positive">
              {{ currentStrategy?.winRate }}%
            </div>
          </div>

          <div class="metric-card">
            <div class="metric-label">Number of Trades</div>
            <div class="metric-value">
              {{ currentStrategy?.numberOfTrades }}
            </div>
          </div>

          <div class="metric-card">
            <div class="metric-label">Avg Trade Duration</div>
            <div class="metric-value">
              {{ currentStrategy?.averageTradeDuration }} days
            </div>
          </div>
        </div>
      </div>

      <!-- Strategy Configuration -->
      <div class="section config-section">
        <h2 class="section-title">Strategy Configuration</h2>

        <div class="config-grid">
          <div class="config-item">
            <label class="config-label">Risk Rating:</label>
            <div v-if="!isEditing" class="config-value">{{ currentStrategy?.riskRating }}/10</div>
            <input
              v-else
              v-model.number="editedStrategy!.riskRating"
              type="range"
              min="1"
              max="10"
              class="config-slider"
            >
            <span v-if="isEditing" class="slider-value">{{ editedStrategy?.riskRating }}/10</span>
          </div>

          <div class="config-item">
            <label class="config-label">Complexity:</label>
            <div v-if="!isEditing" class="config-value">{{ currentStrategy?.complexityRating }}</div>
            <input
              v-else
              v-model="editedStrategy!.complexityRating"
              class="config-input"
              placeholder="e.g., 3/10"
            >
          </div>

          <div class="config-item">
            <label class="config-label">Data Sources:</label>
            <div v-if="!isEditing" class="config-value">
              <span v-for="source in currentStrategy?.dataSources" :key="source" class="source-tag">
                {{ source }}
              </span>
            </div>
            <input
              v-else
              v-model="editedStrategy!.dataSources"
              class="config-input"
              placeholder="Comma-separated data sources"
            >
          </div>
        </div>
      </div>

      <!-- Trading History -->
      <div class="section trades-section">
        <div class="section-header">
          <h2 class="section-title">Trading History</h2>
          <button
            v-if="isEditing"
            @click="addTrade"
            class="add-btn"
          >
            Add Trade
          </button>
        </div>

        <div class="trades-grid">
          <div
            v-for="(trade, index) in (isEditing ? editedStrategy?.trades : currentStrategy?.trades)"
            :key="index"
            class="trade-card"
          >
            <div class="trade-header">
              <div class="trade-asset">
                <img
                  :src="getAssetIcon(trade.asset)"
                  :alt="trade.asset"
                  class="asset-icon"
                  @error="handleImageError"
                >
                <div class="asset-placeholder" style="display: none;"></div>
                <span class="asset-name">{{ trade.asset }}</span>
              </div>

              <button
                v-if="isEditing"
                @click="removeTrade(index)"
                class="remove-btn"
              >
                ×
              </button>
            </div>

            <div class="trade-details">
              <div class="trade-metric">
                <span class="label">Entry Price:</span>
                <span v-if="!isEditing" class="value">${{ trade.entryPrice }}</span>
                <input
                  v-else
                  v-model.number="trade.entryPrice"
                  type="number"
                  step="0.01"
                  class="trade-input"
                >
              </div>

              <div class="trade-metric">
                <span class="label">Exit Price:</span>
                <span v-if="!isEditing" class="value">${{ trade.exitPrice }}</span>
                <input
                  v-else
                  v-model.number="trade.exitPrice"
                  type="number"
                  step="0.01"
                  class="trade-input"
                >
              </div>

              <div class="trade-metric">
                <span class="label">Duration:</span>
                <span v-if="!isEditing" class="value">{{ trade.duration }} days</span>
                <input
                  v-else
                  v-model.number="trade.duration"
                  type="number"
                  class="trade-input"
                >
              </div>

              <div class="trade-metric">
                <span class="label">Date:</span>
                <span v-if="!isEditing" class="value">{{ trade.date }}</span>
                <input
                  v-else
                  v-model="trade.date"
                  type="date"
                  class="trade-input"
                >
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Strategy Blocks (if editing) -->
      <div v-if="isEditing" class="section blocks-section">
        <div class="section-header">
          <h2 class="section-title">Strategy Blocks</h2>
          <div class="add-block-buttons">
            <button @click="addBlock('asset')" class="add-block-btn">Add Asset</button>
            <button @click="addBlock('condition')" class="add-block-btn">Add Condition</button>
            <button @click="addBlock('action')" class="add-block-btn">Add Action</button>
          </div>
        </div>

        <div class="blocks-list">
          <div
            v-for="(block, index) in editedStrategy?.blocks"
            :key="block.id"
            class="block-item"
          >
            <div class="block-header">
              <span class="block-type">{{ block.type }}</span>
              <button @click="removeBlock(index)" class="remove-btn">×</button>
            </div>
            <div class="block-content">
              <pre>{{ JSON.stringify(block.data, null, 2) }}</pre>
            </div>
          </div>
        </div>
      </div>

      <!-- Asset Flow -->
      <div v-if="details?.code" class="section asset-flow-section">
        <h2 class="section-title">Asset Flow</h2>
        <div class="asset-flow">
          <div class="flow-item">
            <span class="flow-label">From</span>
            <span class="flow-asset">{{ details!.code.assets?.entry || 'N/A' }}</span>
          </div>
          <div class="flow-arrow">→</div>
          <div class="flow-item">
            <span class="flow-label">To</span>
            <span class="flow-asset">{{ details!.code.assets?.exit || 'N/A' }}</span>
          </div>
        </div>
      </div>

      <!-- Users Involved (Avatars) -->
      <div v-if="profileObjects.length" class="section avatars-section">
        <h2 class="section-title">Users Involved</h2>
        <div class="avatars-grid">
          <AvatarCard v-for="profile in profileObjects" :key="profile.id" :profile="profile" />
        </div>
      </div>

      <!-- Strategy Code -->
      <div v-if="!isEditing && details?.code" class="section visualization-section">
        <h2 class="section-title">Strategy Code</h2>
        <StrategyCodeView :code="details!.code" />
      </div>

      <!-- Ratings -->
      <div v-if="details" class="section">
        <h2 class="section-title">Ratings</h2>
        <StrategyRating :risk="details!.rating.risk" :complexity="details!.rating.complexity" :computationalCost="details!.rating.computationalCost" />
      </div>

      <!-- P&L Chart -->
      <div v-if="details?.history?.length" class="section">
        <h2 class="section-title">P&L History</h2>
        <StrategyPnlChart :history="details!.history" />
      </div>

      <!-- Derived Strategies -->
      <div class="section">
        <div class="section-header">
          <h2 class="section-title">Derived Strategies</h2>
          <div class="add-block-buttons">
            <button @click="() => generateComplementary(strategyId).then(s => navigateTo(`/strategy/${s.id}`))" class="add-block-btn">Create complementary strategy</button>
            <button @click="() => generateOpposite(strategyId).then(s => navigateTo(`/strategy/${s.id}`))" class="add-block-btn">Create opposite strategy</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Loading/Error States -->
    <div v-if="!currentStrategy" class="loading-state">
      <div class="loading-spinner"></div>
      <p>Loading strategy...</p>
    </div>
  </div>
</template>

<style scoped>
.strategy-detail-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%);
  color: white;
  padding: 20px;
}

.strategy-header {
  background: rgba(30, 30, 30, 0.9);
  border-radius: 15px;
  padding: 30px;
  margin-bottom: 30px;
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

.header-content {
  max-width: 1200px;
  margin: 0 auto;
}

.strategy-title {
  font-size: 3rem;
  font-weight: bold;
  margin-bottom: 20px;
  text-shadow:
    0 2px 4px rgba(255, 255, 255, 0.9),
    inset 0 1px 2px rgba(255, 255, 255, 0.4);
}

.strategy-title-input {
  font-size: 3rem;
  font-weight: bold;
  width: 100%;
  background: rgba(60, 60, 60, 0.8);
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  padding: 15px;
  color: white;
  margin-bottom: 20px;
}

.strategy-title-input:focus {
  outline: none;
  border-color: rgba(0, 123, 255, 0.8);
  box-shadow: 0 0 10px rgba(0, 123, 255, 0.3);
}

.strategy-meta {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin-bottom: 25px;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 10px;
}

.meta-item .label {
  font-weight: bold;
  color: rgba(200, 200, 200, 1);
  text-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.8);
}

.meta-item .value {
  color: rgba(255, 255, 255, 0.9);
  text-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.8);
}

.meta-input {
  background: rgba(60, 60, 60, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  padding: 5px 8px;
  color: white;
  flex: 1;
}

.meta-input:focus {
  outline: none;
  border-color: rgba(0, 123, 255, 0.8);
}

.status-indicator {
  padding: 4px 12px;
  border-radius: 15px;
  font-size: 12px;
  font-weight: bold;
  text-transform: uppercase;
  text-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.8);
}

.status-indicator.active {
  background: rgba(0, 255, 0, 0.8);
  color: black;
}

.status-indicator.paused {
  background: rgba(255, 165, 0, 0.8);
  color: black;
}

.status-indicator.stopped {
  background: rgba(128, 128, 128, 0.8);
  color: white;
}

.strategy-description {
  margin-bottom: 20px;
}

.description-label {
  display: block;
  font-weight: bold;
  margin-bottom: 8px;
  color: rgba(200, 200, 200, 1);
  text-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.8);
}

.strategy-description p {
  font-size: 1.1rem;
  line-height: 1.6;
  text-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.8);
}

.description-input {
  width: 100%;
  min-height: 80px;
  background: rgba(60, 60, 60, 0.8);
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  padding: 15px;
  color: white;
  font-size: 1.1rem;
  resize: vertical;
}

.description-input:focus {
  outline: none;
  border-color: rgba(0, 123, 255, 0.8);
  box-shadow: 0 0 10px rgba(0, 123, 255, 0.3);
}

.action-buttons {
  display: flex;
  gap: 15px;
  justify-content: center;
  margin-top: 30px;
  flex-wrap: wrap;
}

.action-btn {
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s ease;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.edit-btn {
  background: rgba(0, 0, 255, 0.8);
  color: white;
}

.edit-btn:hover {
  background: rgba(0, 0, 150, 0.8);
  transform: translateY(-2px);
}

.status-btn.active {
  background: rgba(255, 165, 0, 0.8);
  color: black;
}

.status-btn:not(.active) {
  background: rgba(0, 255, 0, 0.8);
  color: black;
}

.status-btn:hover {
  transform: translateY(-2px);
}

.save-btn {
  background: rgba(0, 255, 0, 0.8);
  color: black;
}

.save-btn:hover {
  background: rgba(0, 200, 0, 0.8);
  transform: translateY(-2px);
}

.cancel-btn {
  background: rgba(255, 0, 0, 0.8);
  color: white;
}

.cancel-btn:hover {
  background: rgba(200, 0, 0, 0.8);
  transform: translateY(-2px);
}

.strategy-content {
  max-width: 1200px;
  margin: 0 auto;
  display: grid;
  gap: 30px;
}

.section {
  background: rgba(30, 30, 30, 0.9);
  border-radius: 15px;
  padding: 25px;
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

.section-title {
  font-size: 2rem;
  font-weight: bold;
  margin-bottom: 20px;
  text-shadow:
    0 2px 4px rgba(255, 255, 255, 0.9),
    inset 0 1px 2px rgba(255, 255, 255, 0.4);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.add-btn, .add-block-btn {
  background: rgba(0, 255, 0, 0.8);
  color: black;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: bold;
  transition: all 0.3s ease;
}

.add-btn:hover, .add-block-btn:hover {
  background: rgba(0, 200, 0, 0.8);
  transform: translateY(-2px);
}

.add-block-buttons {
  display: flex;
  gap: 10px;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
}

.metric-card {
  background: rgba(50, 50, 50, 0.8);
  border-radius: 10px;
  padding: 20px;
  text-align: center;
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.5);
}

.metric-label {
  font-size: 0.9rem;
  color: rgba(200, 200, 200, 1);
  margin-bottom: 8px;
  text-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.6);
}

.metric-value {
  font-size: 2rem;
  font-weight: bold;
  text-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.6);
}

.metric-value.positive {
  color: rgba(0, 255, 0, 0.9);
}

.metric-value.negative {
  color: rgba(255, 0, 0, 0.9);
}

.config-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
}

.config-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.config-label {
  font-weight: bold;
  color: rgba(200, 200, 200, 1);
  text-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.8);
}

.config-value {
  color: rgba(255, 255, 255, 0.9);
  text-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.8);
}

.config-slider {
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: rgba(100, 100, 100, 0.5);
  outline: none;
}

.slider-value {
  font-size: 0.9rem;
  color: rgba(200, 200, 200, 1);
  text-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.6);
}

.config-input {
  background: rgba(60, 60, 60, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  padding: 8px 12px;
  color: white;
}

.config-input:focus {
  outline: none;
  border-color: rgba(0, 123, 255, 0.8);
  box-shadow: 0 0 8px rgba(0, 123, 255, 0.3);
}

.source-tag {
  display: inline-block;
  background: rgba(0, 123, 255, 0.2);
  border: 1px solid rgba(0, 123, 255, 0.4);
  border-radius: 12px;
  padding: 4px 8px;
  margin: 2px;
  font-size: 0.8rem;
  text-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.6);
}

.trades-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: 20px;
}

.trade-card {
  background: rgba(50, 50, 50, 0.8);
  border-radius: 10px;
  padding: 20px;
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.5);
}

.trade-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.trade-asset {
  display: flex;
  align-items: center;
  gap: 10px;
}

.asset-icon, .asset-placeholder {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(128, 128, 128, 0.8), rgba(160, 160, 160, 0.8));
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.5);
}

.asset-name {
  font-weight: bold;
  font-size: 1.1rem;
  text-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.6);
}

.remove-btn {
  background: rgba(255, 0, 0, 0.8);
  color: white;
  border: none;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  cursor: pointer;
  font-size: 16px;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
}

.remove-btn:hover {
  background: rgba(200, 0, 0, 0.8);
  transform: scale(1.1);
}

.trade-details {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.trade-metric {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.trade-metric .label {
  font-size: 0.8rem;
  color: rgba(200, 200, 200, 1);
  text-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.6);
}

.trade-metric .value {
  font-weight: bold;
  color: rgba(255, 255, 255, 0.9);
  text-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.6);
}

.trade-input {
  background: rgba(60, 60, 60, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  padding: 6px 8px;
  color: white;
  font-size: 0.9rem;
}

.trade-input:focus {
  outline: none;
  border-color: rgba(0, 123, 255, 0.8);
  box-shadow: 0 0 6px rgba(0, 123, 255, 0.3);
}

.blocks-list {
  display: grid;
  gap: 15px;
}

.block-item {
  background: rgba(60, 60, 60, 0.8);
  border-radius: 8px;
  padding: 15px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.block-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.block-type {
  font-weight: bold;
  color: rgba(0, 123, 255, 0.9);
  text-transform: capitalize;
  text-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.6);
}

.block-content {
  background: rgba(40, 40, 40, 0.8);
  border-radius: 4px;
  padding: 10px;
  font-family: monospace;
  font-size: 0.8rem;
  overflow-x: auto;
  text-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.6);
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 50vh;
  gap: 20px;
}

.loading-spinner {
  width: 50px;
  height: 50px;
  border: 4px solid rgba(255, 255, 255, 0.1);
  border-left: 4px solid rgba(0, 123, 255, 0.8);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.loading-state p {
  font-size: 1.2rem;
  color: rgba(200, 200, 200, 1);
  text-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.8);
}

/* Responsive Design */
@media (max-width: 768px) {
  .strategy-title {
    font-size: 2rem;
  }

  .strategy-title-input {
    font-size: 2rem;
  }

  .strategy-meta {
    grid-template-columns: 1fr;
  }

  .action-buttons {
    flex-direction: column;
    align-items: stretch;
  }

  .action-btn {
    width: 100%;
  }

  .metrics-grid {
    grid-template-columns: 1fr;
  }

  .config-grid {
    grid-template-columns: 1fr;
  }

  .trades-grid {
    grid-template-columns: 1fr;
  }

  .trade-details {
    grid-template-columns: 1fr;
  }

  .add-block-buttons {
    flex-direction: column;
  }
}

@media (max-width: 480px) {
  .strategy-header {
    padding: 20px;
  }

  .section {
    padding: 15px;
  }

  .trade-card {
    padding: 15px;
  }
}

.asset-flow {
  display: flex;
  align-items: center;
  gap: var(--spacing-lg);
  padding: var(--spacing-md);
  background: rgba(0, 0, 0, 0.2);
  border-radius: var(--radius-md);
}

.flow-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.flow-label {
  font-size: 12px;
  color: var(--text-light-gray);
  text-transform: uppercase;
}

.flow-asset {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-white);
}

.flow-arrow {
  font-size: 32px;
  color: var(--primary-green);
}

.avatars-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: var(--spacing-md);
}
</style>
