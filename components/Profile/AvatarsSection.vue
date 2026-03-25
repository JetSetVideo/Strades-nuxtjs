<script setup lang="ts">
import type { AiAvatar } from '@/stores/users'

const props = defineProps<{
  avatars: AiAvatar[]
}>()

/** Heartbeat animation duration from execution_frequency (CodingAgent.md) */
const pulseDuration = (freq: number): string =>
  `${Math.round(3000 - freq * 2400)}ms`

/** Node shape class from risk level (Builder/Nodes/AvatarNode.vue logic) */
const nodeShape = (risk: number): string => {
  if (risk > 0.7) return 'shape-hex'
  if (risk > 0.4) return 'shape-diamond'
  return 'shape-circle'
}

const pnlColor = (pnl: number): string => {
  if (pnl >= 0) return 'var(--success-green)'
  return 'var(--error-red)'
}
</script>

<template>
  <div class="avatars-section">
    <div v-if="!avatars?.length" class="empty">No AI Avatars configured.</div>

    <div
      v-for="av in avatars"
      :key="av.id"
      class="avatar-card"
      :style="{
        '--pulse-duration': pulseDuration(av.execution_frequency),
        opacity: 0.4 + av.confidence_score * 0.6
      }"
    >
      <div class="avatar-image-wrap" :class="nodeShape(av.personality_matrix.risk)">
        <img :src="av.avatar_url" :alt="av.name" class="avatar-img" />
        <!-- Heartbeat ring -->
        <div class="pulse-ring" />
      </div>

      <div class="avatar-info">
        <div class="avatar-name">{{ av.name }}</div>
        <div class="avatar-style">{{ av.trading_style.replace(/_/g, ' ') }}</div>

        <div class="avatar-metrics">
          <span class="metric">
            <span class="metric-label">30d</span>
            <span class="metric-val" :style="{ color: pnlColor(av.pnl_30d) }">
              {{ av.pnl_30d >= 0 ? '+' : '' }}{{ av.pnl_30d.toFixed(1) }}%
            </span>
          </span>
          <span class="metric">
            <span class="metric-label">Conf.</span>
            <span class="metric-val">{{ Math.round(av.confidence_score * 100) }}%</span>
          </span>
          <span class="metric">
            <span class="metric-label">Freq.</span>
            <span class="metric-val">{{ Math.round(av.execution_frequency * 100) }}%</span>
          </span>
        </div>

        <!-- Personality bar trio -->
        <div class="matrix-bars">
          <div class="mat-bar" title="Risk">
            <div class="mat-fill risk" :style="{ width: `${av.personality_matrix.risk * 100}%` }" />
          </div>
          <div class="mat-bar" title="Aggression">
            <div class="mat-fill agg" :style="{ width: `${av.personality_matrix.aggression * 100}%` }" />
          </div>
          <div class="mat-bar" title="Speed">
            <div class="mat-fill spd" :style="{ width: `${av.personality_matrix.reaction_speed * 100}%` }" />
          </div>
        </div>

        <div class="avatar-footer">
          <span v-if="av.is_public" class="tag-public">Public · {{ av.followers }} followers</span>
          <span v-else class="tag-private">Private</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.avatars-section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.empty {
  font-size: 0.8rem;
  color: var(--text-gray);
  padding: var(--spacing-md);
}

.avatar-card {
  display: flex;
  gap: var(--spacing-md);
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  padding: var(--spacing-sm) var(--spacing-md);
  transition: opacity var(--transition-normal), border-color var(--transition-fast);
}

.avatar-card:hover {
  border-color: var(--border-accent);
}

/* ── Node shapes from AvatarNode.vue (Builder) ─── */
.avatar-image-wrap {
  position: relative;
  flex-shrink: 0;
  width: 52px;
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.shape-circle .avatar-img  { border-radius: 50%; }
.shape-diamond .avatar-img { clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%); }
.shape-hex .avatar-img     { clip-path: polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%); }

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border: 2px solid var(--border-accent);
}

/* Heartbeat ring (execution_frequency → animation speed) */
.pulse-ring {
  position: absolute;
  inset: -4px;
  border-radius: inherit;
  border: 1.5px solid var(--primary-green);
  animation: avatarPulse var(--pulse-duration, 2s) ease-in-out infinite;
  pointer-events: none;
}

@keyframes avatarPulse {
  0%, 100% { opacity: 0.15; transform: scale(1); }
  50%       { opacity: 0.6;  transform: scale(1.08); }
}

.avatar-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.avatar-name {
  font-weight: 700;
  font-size: 0.9rem;
  color: var(--text-white);
}

.avatar-style {
  font-size: 0.7rem;
  color: var(--text-gray);
  text-transform: capitalize;
}

.avatar-metrics {
  display: flex;
  gap: var(--spacing-md);
}

.metric {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
}

.metric-label {
  font-size: 0.6rem;
  color: var(--text-gray);
  text-transform: uppercase;
}

.metric-val {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--text-white);
}

/* Personality matrix bars */
.matrix-bars {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.mat-bar {
  height: 3px;
  background: rgba(255,255,255,0.07);
  border-radius: 999px;
  overflow: hidden;
}

.mat-fill {
  height: 100%;
  border-radius: 999px;
  transition: width 0.6s ease;
}

.mat-fill.risk { background: var(--error-red); }
.mat-fill.agg  { background: var(--warning-orange); }
.mat-fill.spd  { background: var(--primary-blue); }

.avatar-footer {
  margin-top: 2px;
}

.tag-public, .tag-private {
  font-size: 0.62rem;
  padding: 2px 8px;
  border-radius: 999px;
}

.tag-public  {
  background: rgba(0,255,136,0.08);
  border: 1px solid rgba(0,255,136,0.25);
  color: var(--success-green);
}

.tag-private {
  background: rgba(255,255,255,0.05);
  border: 1px solid var(--border-secondary);
  color: var(--text-gray);
}
</style>
