<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { Competition, Contribution } from '~/types/quests'
import { useCreditsStore } from '~/stores/credits'
import UICard from '@/components/UI/Card.vue'
import UIPill from '@/components/UI/Pill.vue'

/**
 * Leaderboard/Competition.vue — community prize pots.
 *
 * Contributions are paid in free house credits (stores/credits.ts, the same
 * bankroll the Arena uses — never real money). The amount is clamped to
 * [1, balance], and credits.spend() is the source of truth for what was paid.
 */

const props = defineProps<{
  competitions: Competition[]
  contributions: Contribution[]
}>()

const emit = defineEmits<{ (e: 'add:contribution', c: { competitionId: string; amount: number }): void }>()

const credits = useCreditsStore()

const selectedId = ref(props.competitions[0]?.id ?? '')
watch(() => props.competitions, list => {
  if (!list.find(c => c.id === selectedId.value)) selectedId.value = list[0]?.id ?? ''
})

const amount = ref(10)
const PRESETS = [10, 50, 100]

const selected = computed(() => props.competitions.find(c => c.id === selectedId.value))
const pool = computed(() => props.contributions.filter(c => c.competitionId === selectedId.value))
const pot = computed(() => (selected.value?.pot ?? 0) + pool.value.reduce((s, c) => s + c.amount, 0))
const backers = computed(() => new Set(pool.value.map(c => c.userId)).size)

const clamped = computed(() => Math.max(1, Math.min(Math.round(Number(amount.value) || 0), credits.balance)))
const canContribute = computed(() => !!selected.value && credits.balance >= 1)

function contribute() {
  if (!canContribute.value || !selected.value) return
  const paid = credits.spend(clamped.value, `competition:${selected.value.id}`, selected.value.id)
  if (paid > 0) emit('add:contribution', { competitionId: selected.value.id, amount: paid })
}

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 })
</script>

<template>
  <UICard title="Competitions" padding="normal">
    <template v-if="selected">
      <div v-if="competitions.length > 1" class="comp-switch" role="tablist">
        <button
          v-for="c in competitions"
          :key="c.id"
          role="tab"
          :aria-selected="c.id === selectedId"
          :class="{ active: c.id === selectedId }"
          @click="selectedId = c.id"
        >{{ c.name }}</button>
      </div>

      <div class="comp-body">
        <div class="comp-copy">
          <h3>{{ selected.name }}</h3>
          <p>{{ selected.description }}</p>
          <div class="comp-meta">
            <UIPill tone="info">{{ backers }} backer{{ backers === 1 ? '' : 's' }}</UIPill>
            <UIPill>House credits · no real money</UIPill>
          </div>
        </div>

        <div class="comp-pot">
          <span class="pot-label">Live pot</span>
          <span class="pot-value">{{ fmt(pot) }}<span class="pot-unit">cr</span></span>
        </div>
      </div>

      <div class="comp-contribute">
        <div class="presets">
          <button v-for="p in PRESETS" :key="p" :class="{ active: amount === p }" @click="amount = p">{{ p }}</button>
        </div>
        <input
          v-model.number="amount"
          type="number"
          min="1"
          :max="credits.balance"
          step="1"
          class="amount-input"
          aria-label="Contribution in credits"
        />
        <button class="contribute-btn" :disabled="!canContribute" @click="contribute">
          Contribute {{ fmt(clamped) }} cr
        </button>
        <span class="balance">Balance {{ fmt(credits.balance) }} cr</span>
      </div>
    </template>
    <p v-else class="empty">No competitions are running right now.</p>
  </UICard>
</template>

<style scoped>
.comp-switch { display: flex; gap: 0.25rem; flex-wrap: wrap; margin-bottom: 0.6rem; }
.comp-switch button,
.presets button {
  background: none;
  border: 1px solid var(--edge-soft, rgba(255,255,255,0.08));
  color: rgba(255,255,255,0.6);
  padding: 0.3rem 0.6rem;
  border-radius: 6px;
  font-size: 0.72rem;
  font-weight: 600;
  cursor: pointer;
}
.comp-switch button.active,
.presets button.active {
  color: var(--app-color-up, var(--primary-green, #00ff88));
  border-color: currentColor;
}

.comp-body {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  flex-wrap: wrap;
  min-width: 0;
}
.comp-copy { min-width: 0; flex: 1 1 16rem; }
.comp-copy h3 { margin: 0 0 0.2rem; font-size: 0.95rem; font-weight: 700; }
.comp-copy p { margin: 0 0 0.5rem; font-size: 0.78rem; color: rgba(255,255,255,0.6); }
.comp-meta { display: flex; gap: 0.35rem; flex-wrap: wrap; }

.comp-pot { display: flex; flex-direction: column; align-items: flex-end; }
.pot-label { font-size: 0.62rem; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(255,255,255,0.5); }
.pot-value {
  font-size: 1.6rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  color: var(--app-color-up, var(--primary-green, #00ff88));
}
.pot-unit { font-size: 0.7rem; margin-left: 0.2rem; opacity: 0.6; }

.comp-contribute {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
  margin-top: 0.75rem;
  padding-top: 0.6rem;
  border-top: 1px solid var(--edge-soft, rgba(255,255,255,0.06));
}
.presets { display: flex; gap: 0.25rem; }
.amount-input {
  width: 5.5rem;
  background: var(--surface-sunken, rgba(0,0,0,0.25));
  border: 1px solid var(--edge-soft, rgba(255,255,255,0.08));
  color: inherit;
  border-radius: 6px;
  padding: 0.3rem 0.5rem;
  font-size: 0.8rem;
  font-variant-numeric: tabular-nums;
}
.contribute-btn {
  background: var(--app-color-up, var(--primary-green, #00ff88));
  color: #06140c;
  border: none;
  border-radius: 6px;
  padding: 0.35rem 0.8rem;
  font-size: 0.75rem;
  font-weight: 700;
  cursor: pointer;
}
.contribute-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.balance { margin-left: auto; font-size: 0.7rem; color: rgba(255,255,255,0.5); font-variant-numeric: tabular-nums; }
.empty { margin: 0; font-size: 0.8rem; color: rgba(255,255,255,0.55); }
</style>
