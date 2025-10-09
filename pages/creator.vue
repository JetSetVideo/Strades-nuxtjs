<script setup>
import { ref, computed } from 'vue';
import { useStrategies } from '@/composables/useStrategies';
import SelectorDatasources from '@/components/Selector/Datasources.vue';
import SelectorUsers from '@/components/Selector/Users.vue';
import DateRangePicker from '@/components/DateRangePicker.vue';
import NavigationAnalyse from '@/components/Navigation/Analyse.vue';
import BlockEditor from '@/components/BlockEditor.vue';
import SelectorAsset from '@/components/Selector/Asset.vue';
import BuilderCondition from '@/components/Builder/Condition.vue';
import BuilderAction from '@/components/Builder/Action.vue';
import StrategyVisualizer from '@/components/StrategyVisualizer.vue';
import StrategyCodeView from '@/components/StrategyCodeView.vue';
import StrategyRating from '@/components/StrategyRating.vue';
import CountdownModal from '@/components/CountdownModal.vue';

definePageMeta({
  title: "Strategy Creator",
  description: "Create your custom investment strategy",
  layout: "default",
});

const { createStrategy, backtestStrategy } = useStrategies();

const strategy = ref({
  name: '',
  description: '',
  dataSources: [],
  blocks: [],
  users: [],
  period: { start: null, end: null },
  riskRating: 0,
  complexityRating: '0/10',
});

const credit = ref(1000);
const neededCredit = computed(() => {
  return strategy.value.blocks.length * 100;
});

const hasEnoughCredit = computed(() => credit.value >= neededCredit.value);
const isStrategyValid = computed(() => 
  strategy.value.dataSources.length > 0 && 
  strategy.value.blocks.length > 0 &&
  strategy.value.name.trim() !== '' &&
  strategy.value.description.trim() !== ''
);

const CreditPriceCost = computed(() => {
  return credit.value * 0.000000001;
});

const addBlock = (blockType) => {
  strategy.value.blocks.push({
    type: blockType,
    id: Date.now(),
    data: {}
  });
};

const updateBlock = (blockId, newData) => {
  const blockIndex = strategy.value.blocks.findIndex(block => block.id === blockId);
  if (blockIndex !== -1) {
    strategy.value.blocks[blockIndex].data = newData;
  }
};

const removeBlock = (blockId) => {
  strategy.value.blocks = strategy.value.blocks.filter(block => block.id !== blockId);
};

async function analyseStrategy() {
  if (hasEnoughCredit.value && isStrategyValid.value) {
    try {
      const code = {
        assets: { entry: (strategy.value.blocks.find(b => b.type === 'asset')?.data || 'BTC-USD'), exit: 'USD' },
        period: { start: strategy.value.period.start || new Date().toISOString().slice(0,10), end: strategy.value.period.end || new Date().toISOString().slice(0,10) },
        frequency: '1D',
        conditions: strategy.value.blocks.filter(b => b.type === 'condition').map(b => b.data),
        profiles: strategy.value.users || [],
        parameters: {},
        rights: { owners: ['current_user'], editors: [], viewers: [], is_public: false }
      }
      const newStrategy = await createStrategy({
        name: strategy.value.name,
        description: strategy.value.description,
        category: 'technical',
        targetAssets: [code.assets.entry],
        code
      });
      showCountdown.value = true;
      pendingId.value = newStrategy.id;
    } catch (error) {
      console.error('Failed to create strategy:', error);
      alert('Failed to create strategy. Please try again.');
    }
  } else if (!isStrategyValid.value) {
    alert('Please fill in all required fields and select at least one data source and one asset');
  } else {
    alert('Not enough credits to analyse strategy');
  }
}

const showCountdown = ref(false);
const pendingId = ref<string | null>(null);
async function onCountdownFinish() {
  if (pendingId.value) {
    await backtestStrategy(pendingId.value);
    navigateTo(`/strategy/${pendingId.value}`);
  }
}
</script>

<template>
  <div class="strategy-creator">
    <h1>Create Your Strategy</h1>
    <div class="strategy-form">
      <input v-model="strategy.name" placeholder="Strategy Name" required />
      <textarea v-model="strategy.description" placeholder="Strategy Description" required></textarea>
      <SelectorDatasources v-model="strategy.dataSources" />
      
      <div class="block-editor-container">
        <h2>Strategy Blocks</h2>
        <div class="block-actions">
          <button @click="addBlock('asset')">Add Asset</button>
          <button @click="addBlock('condition')">Add Condition</button>
          <button @click="addBlock('action')">Add Action</button>
        </div>
        <BlockEditor 
          :blocks="strategy.blocks"
          @update-block="updateBlock"
          @remove-block="removeBlock"
        >
          <template #asset="{ block }">
            <SelectorAsset 
              v-model="block.data"
              @update:modelValue="updateBlock(block.id, $event)"
            />
          </template>
          <template #condition="{ block }">
            <BuilderCondition
              v-model="block.data"
              @update:modelValue="updateBlock(block.id, $event)"
            />
          </template>
          <template #action="{ block }">
            <BuilderAction
              v-model="block.data"
              @update:modelValue="updateBlock(block.id, $event)"
            />
          </template>
        </BlockEditor>
      </div>
      
      <StrategyVisualizer :blocks="strategy.blocks" />

      <div class="preview-section">
        <h2>Source Code</h2>
        <StrategyCodeView :code="{
          name: strategy.name,
          description: strategy.description,
          period: strategy.period,
          blocks: strategy.blocks,
          profiles: strategy.users
        }" />
      </div>

      <StrategyRating :risk="Math.min(10, Math.max(0, strategy.blocks.length + (strategy.users?.length||0)))" :complexity="complexityRating" :computationalCost="neededCredit" />
      
      <SelectorUsers v-model="strategy.users" />
      <DateRangePicker v-model="strategy.period" />
      <div class="credit-info">
        <p>Available Credits: {{ credit }}</p>
        <p>Needed Credits: {{ neededCredit }}</p>
        <p>Credit Cost: ${{ CreditPriceCost.toFixed(8) }}</p>
      </div>
      <NavigationAnalyse 
        :disabled="!hasEnoughCredit || !isStrategyValid"
        @click="analyseStrategy"
      >
        Analyse Strategy
      </NavigationAnalyse>
    </div>
    <CountdownModal :open="showCountdown" @finish="onCountdownFinish" @close="showCountdown = false" />
  </div>
</template>

<style scoped>
.strategy-creator {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
  background-color: rgba(30, 30, 30, 0.8);
  border-radius: 10px;
  color: white;
}

.strategy-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

input, textarea {
  padding: 12px;
  border-radius: 5px;
  background-color: rgba(60, 60, 60, 0.6);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.1);
  font-size: 1em;
}

input:focus, textarea:focus {
  outline: none;
  border-color: rgba(255, 255, 255, 0.3);
}

.credit-info {
  background-color: rgba(60, 60, 60, 0.6);
  padding: 15px;
  border-radius: 5px;
  font-size: 0.9em;
}

.block-editor-container {
  background-color: rgba(60, 60, 60, 0.6);
  padding: 15px;
  border-radius: 5px;
  margin-top: 20px;
}

.preview-section { background: var(--bg-secondary); border: 1px solid var(--border-primary); border-radius: var(--radius-md); padding: var(--spacing-md); }

.block-actions {
  display: flex;
  gap: 10px;
  margin-bottom: 15px;
}

.block-actions button {
  padding: 8px 12px;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.block-actions button:hover {
  background-color: #45a049;
}
</style>