<script setup lang="ts">
import { ref, computed } from 'vue';
import type { Competition, Contribution } from '@/types';

const props = defineProps({
  competitions: {
    type: Array as () => Competition[],
    required: true,
  },
  contributions: {
    type: Array as () => Contribution[],
    required: true,
  },
});

const emit = defineEmits(['add:contribution']);

const selectedCompetitionId = ref(props.competitions[0]?.id);
const contributionAmount = ref(10);

const selectedCompetition = computed(() => {
  return props.competitions.find(c => c.id === selectedCompetitionId.value);
});

const competitionPot = computed(() => {
  if (!selectedCompetition.value) return 0;
  const competitionContributions = props.contributions.filter(c => c.competitionId === selectedCompetitionId.value);
  return selectedCompetition.value.pot + competitionContributions.reduce((total, c) => total + c.amount, 0);
});

const addContribution = () => {
  if (selectedCompetitionId.value) {
    emit('add:contribution', {
      competitionId: selectedCompetitionId.value,
      amount: contributionAmount.value,
    });
  }
};
</script>

<template>
  <div class="competition-component">
    <h2>Competitions</h2>
    <select v-model="selectedCompetitionId">
      <option v-for="comp in competitions" :key="comp.id" :value="comp.id">
        {{ comp.name }}
      </option>
    </select>

    <div v-if="selectedCompetition">
      <h3>{{ selectedCompetition.name }}</h3>
      <p>{{ selectedCompetition.description }}</p>
      <div class="pot">
        Live Pot: {{ competitionPot }} tokens
      </div>
      <div class="contribute">
        <input type="number" v-model="contributionAmount" />
        <button @click="addContribution">Contribute</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Add styles for competition component */
.competition-component {
  background: var(--card-bg);
  padding: var(--spacing-lg);
  border-radius: var(--radius-lg);
}
.pot {
  font-size: 1.5rem;
  font-weight: bold;
  color: var(--primary-green);
}
</style>


