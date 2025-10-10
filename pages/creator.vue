<script setup>
import { ref, computed, onMounted } from 'vue';
import { useStrategies } from '@/composables/useStrategies';
import SelectorDatasources from '@/components/Selector/Datasources.vue';
import DateRangePicker from '@/components/DateRangePicker.vue';
import SelectorAsset from '@/components/Selector/Asset.vue';
import BuilderCondition from '@/components/Builder/Condition.vue';
import BuilderAction from '@/components/Builder/Action.vue';
import BlockEditor from '@/components/BlockEditor.vue';
import StrategyVisualizer from '@/components/StrategyVisualizer.vue';
import StrategyCodeView from '@/components/StrategyCodeView.vue';
import StrategyRating from '@/components/StrategyRating.vue';
import CountdownModal from '@/components/CountdownModal.vue';
import AvatarCard from '@/components/Card/Avatar.vue';

definePageMeta({
  title: "Strategy Creator",
  description: "Create your custom investment strategy",
  layout: "default",
});

const { createStrategy, backtestStrategy, deployStrategy, backtestAndDeploy } = useStrategies();

const strategy = ref({
  name: '',
  description: '',
  dataSources: [],
  assetFrom: '',
  assetTo: '',
  variables: [],
  blocks: [],
  statements: [],
  selectedProfiles: [],
  period: { start: null, end: null },
  riskRating: 0,
  complexityRating: '0/10',
});

const profiles = ref([]);

onMounted(async () => {
  try {
    profiles.value = await $fetch('/data/strategies/profiles.json')
  } catch {
    profiles.value = []
  }
});

const credit = ref(1000);

const periodDays = computed(() => {
  if (!strategy.value.period.start || !strategy.value.period.end) return 1
  const start = new Date(strategy.value.period.start).getTime()
  const end = new Date(strategy.value.period.end).getTime()
  return Math.max(1, Math.floor((end - start) / (86400 * 1000)))
})

const neededCredit = computed(() => {
  const blocksCost = strategy.value.blocks.length * 100
  const profilesCost = strategy.value.selectedProfiles.length * 50
  const periodCost = Math.floor(periodDays.value / 30) * 20
  return blocksCost + profilesCost + periodCost
});

const hasEnoughCredit = computed(() => credit.value >= neededCredit.value);
const isStrategyValid = computed(() => 
  strategy.value.dataSources.length > 0 && 
  strategy.value.assetFrom.trim() !== '' &&
  strategy.value.assetTo.trim() !== '' &&
  strategy.value.name.trim() !== '' &&
  strategy.value.description.trim() !== ''
);

const CreditPriceCost = computed(() => {
  return credit.value * 0.000000001;
});

const selectedProfileObjects = computed(() => {
  return profiles.value.filter(p => strategy.value.selectedProfiles.includes(p.id))
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

const addVariable = () => {
  strategy.value.variables.push({ key: '', value: '' })
}

  const removeVariable = (index) => {
    strategy.value.variables.splice(index, 1)
  }

const addStatement = () => {
  strategy.value.statements.push('')
}

const removeStatement = (index) => {
  strategy.value.statements.splice(index, 1)
}

const toggleProfile = (profileId) => {
  const idx = strategy.value.selectedProfiles.indexOf(profileId)
  if (idx > -1) {
    strategy.value.selectedProfiles.splice(idx, 1)
  } else {
    strategy.value.selectedProfiles.push(profileId)
  }
}

const showCountdown = ref(false);
const pendingId = ref(null);
const pendingAction = ref('backtest');

function buildCodePayload() {
  const varsObj = strategy.value.variables.reduce((acc, v) => ({ ...acc, [v.key]: v.value }), {})
  return {
    assets: { entry: strategy.value.assetFrom, exit: strategy.value.assetTo },
    period: { start: strategy.value.period.start || new Date().toISOString().slice(0,10), end: strategy.value.period.end || new Date().toISOString().slice(0,10) },
    frequency: '1D',
    conditions: strategy.value.blocks.filter(b => b.type === 'condition').map(b => b.data),
    variables: varsObj,
    statements: strategy.value.statements.filter(s => s.trim()),
    profiles: strategy.value.selectedProfiles,
    parameters: {},
    rights: { owners: ['current_user'], editors: [], viewers: [], is_public: false }
  }
}

async function handleBacktest() {
  if (!hasEnoughCredit.value || !isStrategyValid.value) {
    alert('Please fill in all required fields or add more credits')
    return
  }
  try {
    const code = buildCodePayload()
    const newStrategy = await createStrategy({
      name: strategy.value.name,
      description: strategy.value.description,
      category: 'technical',
      targetAssets: [code.assets.entry],
      code
    });
    pendingId.value = newStrategy.id
    pendingAction.value = 'backtest'
    showCountdown.value = true
  } catch (error) {
    console.error('Failed to create strategy:', error);
    alert('Failed to create strategy. Please try again.');
  }
}

async function handleDeploy() {
  if (!hasEnoughCredit.value || !isStrategyValid.value) {
    alert('Please fill in all required fields or add more credits')
    return
  }
  try {
    const code = buildCodePayload()
    const newStrategy = await createStrategy({
      name: strategy.value.name,
      description: strategy.value.description,
      category: 'technical',
      targetAssets: [code.assets.entry],
      code
    });
    await deployStrategy(newStrategy.id)
    navigateTo(`/strategy/${newStrategy.id}`)
  } catch (error) {
    console.error('Failed:', error);
    alert('Failed to deploy strategy.');
  }
}

async function handleBacktestAndDeploy() {
  if (!hasEnoughCredit.value || !isStrategyValid.value) {
    alert('Please fill in all required fields or add more credits')
    return
  }
  try {
    const code = buildCodePayload()
    const newStrategy = await createStrategy({
      name: strategy.value.name,
      description: strategy.value.description,
      category: 'technical',
      targetAssets: [code.assets.entry],
      code
    });
    pendingId.value = newStrategy.id
    pendingAction.value = 'both'
    showCountdown.value = true
  } catch (error) {
    console.error('Failed:', error);
    alert('Failed to create strategy.');
  }
}

async function onCountdownFinish() {
  if (!pendingId.value) return
  if (pendingAction.value === 'backtest') {
    await backtestStrategy(pendingId.value)
  } else if (pendingAction.value === 'both') {
    await backtestAndDeploy(pendingId.value)
  }
  navigateTo(`/strategy/${pendingId.value}`)
}
</script>

<template>
  <div class="strategy-creator">
    <h1>Create Your Strategy</h1>
    <div class="strategy-form">
      <input v-model="strategy.name" placeholder="Strategy Name" required />
      <textarea v-model="strategy.description" placeholder="Strategy Description" required></textarea>
      
      <SelectorDatasources v-model="strategy.dataSources" />

      <div class="assets-section">
        <h3>Assets</h3>
        <div class="asset-selectors">
          <div class="selector-wrap">
            <label>From</label>
            <SelectorAsset v-model="strategy.assetFrom" />
          </div>
          <div class="arrow">→</div>
          <div class="selector-wrap">
            <label>To</label>
            <SelectorAsset v-model="strategy.assetTo" />
          </div>
        </div>
      </div>

      <div class="variables-section">
        <div class="section-header">
          <h3>Variables</h3>
          <button @click="addVariable" class="add-btn-small">+ Add</button>
        </div>
        <div v-for="(variable, idx) in strategy.variables" :key="idx" class="variable-row">
          <input v-model="variable.key" placeholder="Key" class="var-key" />
          <input v-model="variable.value" placeholder="Value" class="var-value" />
          <button @click="removeVariable(idx)" class="remove-btn-small">×</button>
        </div>
      </div>
      
      <div class="block-editor-container">
        <h2>Conditions</h2>
        <div class="block-actions">
          <button @click="addBlock('condition')">Add Condition</button>
          <button @click="addBlock('action')">Add Action</button>
        </div>
        <BlockEditor 
          :blocks="strategy.blocks"
          @update-block="updateBlock"
          @remove-block="removeBlock"
        >
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

      <div class="statements-section">
        <div class="section-header">
          <h3>Statements</h3>
          <button @click="addStatement" class="add-btn-small">+ Add</button>
        </div>
        <div v-for="(stmt, idx) in strategy.statements" :key="idx" class="statement-row">
          <textarea v-model="strategy.statements[idx]" placeholder="Enter statement..." class="statement-input"></textarea>
          <button @click="removeStatement(idx)" class="remove-btn-small">×</button>
        </div>
      </div>

      <div class="profiles-section">
        <h3>Avatars (User Profiles)</h3>
        <div class="profiles-grid">
          <div v-for="profile in profiles" :key="profile.id" @click="toggleProfile(profile.id)" 
               :class="['profile-chip', { selected: strategy.selectedProfiles.includes(profile.id) }]">
            <AvatarCard :profile="profile" />
          </div>
        </div>
      </div>

      <DateRangePicker v-model="strategy.period" />
      
      <StrategyVisualizer :blocks="strategy.blocks" />

      <div class="preview-section">
        <h2>Source Code</h2>
        <StrategyCodeView :code="{
          name: strategy.name,
          description: strategy.description,
          assetFrom: strategy.assetFrom,
          assetTo: strategy.assetTo,
          period: strategy.period,
          variables: strategy.variables,
          conditions: strategy.blocks.filter(b => b.type === 'condition'),
          statements: strategy.statements,
          profiles: strategy.selectedProfiles
        }" />
      </div>

      <StrategyRating :risk="Math.min(10, Math.max(0, strategy.blocks.length + strategy.selectedProfiles.length))" :complexity="strategy.complexityRating" :computationalCost="neededCredit" />
      
      <div class="credit-info">
        <p>Available Credits: {{ credit }}</p>
        <p>Needed Credits: {{ neededCredit }}</p>
        <p>Cost: ${{ CreditPriceCost.toFixed(8) }}</p>
      </div>

      <div class="action-buttons-grid">
        <button class="cta-backtest" @click="handleBacktest" :disabled="!hasEnoughCredit || !isStrategyValid">
          Backtest Only
        </button>
        <button class="cta-deploy" @click="handleDeploy" :disabled="!hasEnoughCredit || !isStrategyValid">
          Deploy Only
        </button>
        <button class="cta-both" @click="handleBacktestAndDeploy" :disabled="!hasEnoughCredit || !isStrategyValid">
          Backtest & Deploy
        </button>
      </div>
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

.assets-section { background: var(--bg-secondary); border: 1px solid var(--border-primary); border-radius: var(--radius-md); padding: var(--spacing-md); }
.asset-selectors { display: flex; align-items: center; gap: var(--spacing-md); }
.selector-wrap { flex: 1; }
.selector-wrap label { display: block; margin-bottom: 6px; font-weight: 600; color: var(--text-light-gray); }
.arrow { font-size: 24px; color: var(--primary-green); }

.variables-section, .statements-section, .profiles-section {
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  padding: var(--spacing-md);
}

.section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--spacing-sm); }
.add-btn-small { background: var(--primary-green); color: #000; border: none; padding: 4px 10px; border-radius: var(--radius-sm); cursor: pointer; font-weight: 600; }
.add-btn-small:hover { opacity: 0.8; }

.variable-row { display: grid; grid-template-columns: 1fr 1fr auto; gap: var(--spacing-sm); margin-bottom: var(--spacing-sm); }
.var-key, .var-value { padding: 8px; background: rgba(0,0,0,0.3); border: 1px solid var(--border-secondary); border-radius: var(--radius-sm); color: var(--text-white); }
.remove-btn-small { background: var(--error-red); color: white; border: none; padding: 4px 10px; border-radius: var(--radius-sm); cursor: pointer; font-weight: 700; }
.remove-btn-small:hover { opacity: 0.8; }

.statement-row { display: grid; grid-template-columns: 1fr auto; gap: var(--spacing-sm); margin-bottom: var(--spacing-sm); }
.statement-input { padding: 8px; background: rgba(0,0,0,0.3); border: 1px solid var(--border-secondary); border-radius: var(--radius-sm); color: var(--text-white); min-height: 50px; resize: vertical; }

.profiles-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: var(--spacing-sm); }
.profile-chip { cursor: pointer; transition: all var(--transition-fast); border-radius: var(--radius-md); }
.profile-chip.selected { outline: 2px solid var(--border-accent); box-shadow: var(--shadow-accent); }
.profile-chip:hover { transform: translateY(-2px); }

.action-buttons-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--spacing-md); margin-top: var(--spacing-lg); }
.cta-backtest, .cta-deploy, .cta-both {
  padding: var(--spacing-md);
  border: none;
  border-radius: var(--radius-md);
  font-weight: 700;
  cursor: pointer;
  transition: all var(--transition-normal);
  text-transform: uppercase;
}
.cta-backtest { background: var(--primary-blue); color: white; }
.cta-deploy { background: var(--warning-orange); color: black; }
.cta-both { background: var(--button-primary); color: black; }
.cta-backtest:hover, .cta-deploy:hover, .cta-both:hover { transform: translateY(-2px); opacity: 0.9; }
.cta-backtest:disabled, .cta-deploy:disabled, .cta-both:disabled { opacity: 0.5; cursor: not-allowed; }
</style>