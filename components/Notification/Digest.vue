<script setup lang="ts">
/**
 * Digest strip: three numbers that summarise the feed.
 *   Unread (not opened) · 30-day call hit rate · Bots P&L today.
 * The upcoming-deadlines board lives above this row, where the page header was.
 * Until `ready` (client mounted) it prints "—" so server and client HTML match.
 */
import { computed } from 'vue'
import type { AppNotification } from '~/types/notification'
import { dayKey, fmtSigned, parseNotificationKey, targetOf } from '~/utils/notifications'
import type { PredictionLike } from '~/utils/notifications'
import { usePredictionsStore } from '~/stores/predictions'
import UIMetricRow from '@/components/UI/MetricRow.vue'
import UIStat from '@/components/UI/Stat.vue'

const props = defineProps<{ items: AppNotification[]; now: number; ready: boolean; recipient?: string }>()

const HOUR = 3_600_000
const DAY = 24 * HOUR
const predictions = usePredictionsStore()

const mine = computed<PredictionLike[]>(() => {
  if (!props.ready) return []
  const who = props.recipient ?? 'current_user'
  return (predictions.predictions as unknown as PredictionLike[]).filter(p => p.userId === who && !p.demo)
})

/** Not clicked open. Grey at 0, orange at 1 or more. Seen-but-unopened still counts. */
const unopened = computed(() => (props.ready ? props.items.filter(n => !n.state.opened_at).length : null))

const hit = computed(() => {
  if (!props.ready) return { v: null as string | null, hint: '' }
  const from = props.now - 30 * DAY
  let acc = 0
  let miss = 0
  for (const p of mine.value) {
    if (p.status !== 'accurate' && p.status !== 'missed') continue
    const t = targetOf(p)
    if (!Number.isFinite(t) || t < from || t > props.now) continue
    if (p.status === 'accurate') acc++
    else miss++
  }
  const n = acc + miss
  if (!n) return { v: null, hint: 'no call scored in 30 days' }
  return { v: `${Math.round((acc / n) * 100)} %`, hint: `${acc} of ${n} scored calls` }
})

const bots = computed(() => {
  if (!props.ready) return { v: null as string | null, tone: 'neutral' as const, hint: '' }
  const utcDay = new Date(props.now).toISOString().slice(0, 10)
  const localDay = dayKey(props.now)
  let sum = 0
  let rows = 0
  for (const n of props.items) {
    if (n.domain !== 'bot' || n.event !== 'daily' || !n.outcome || n.outcome.unit !== 'USD') continue
    const q = parseNotificationKey(n.key)?.qualifier
    const today = q ? q === utcDay || q === localDay : dayKey(Date.parse(n.when.occurred_at)) === localDay
    if (!today) continue
    sum += n.outcome.value
    rows++
  }
  if (!rows) return { v: null, tone: 'neutral' as const, hint: 'no bot traded today' }
  return {
    v: fmtSigned(sum, 'USD'),
    tone: sum > 0 ? 'positive' as const : sum < 0 ? 'negative' as const : 'neutral' as const,
    hint: `${rows} bot${rows === 1 ? '' : 's'} traded${sum > 0 ? ' · gain' : sum < 0 ? ' · loss' : ''}`,
  }
})
</script>

<template>
  <section class="ndg" aria-label="Notifications digest">
    <UIMetricRow :cols="3">
      <UIStat
        class="stat-unread"
        :class="{ hot: (unopened ?? 0) > 0 }"
        label="Unread"
        :value="unopened"
        :precision="0"
        size="sm"
        :hint="ready ? (unopened ? 'not opened' : 'all caught up') : ''"
      />
      <UIStat label="Hit rate · 30 d" :value="hit.v" size="sm" :hint="hit.hint" />
      <UIStat label="Bots P&L today" :value="bots.v" :tone="bots.tone" size="sm" :hint="bots.hint" />
    </UIMetricRow>
  </section>
</template>

<style scoped>
.ndg { min-width: 0; }
.ndg :deep(.metric-row) { align-items: stretch; }
.ndg :deep(.ui-stat) {
  height: 100%;
  justify-content: flex-start;
  background: var(--surface-raised, linear-gradient(180deg, rgba(27,29,38,0.92), rgba(16,17,24,0.95)));
  border: 1px solid var(--edge-soft, rgba(255,255,255,0.05));
}
.ndg :deep(.stat-label) { min-height: 0.8rem; }
.ndg :deep(.stat-value) { min-height: 1.15rem; line-height: 1.15rem; }
.ndg :deep(.stat-hint) {
  min-height: 0.9rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ndg :deep(.stat-unread .stat-value) { color: var(--text-gray, #888888); }
.ndg :deep(.stat-unread.hot .stat-value) { color: var(--warning-orange, #ffa500); }
</style>
