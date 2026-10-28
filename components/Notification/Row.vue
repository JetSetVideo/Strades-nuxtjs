<script setup lang="ts">
/**
 * One notification. Props in, events out — no store access.
 * The title is a real link (stretched over the row): click / Enter → `open`; ctrl/⌘/shift-click
 * keeps the browser's default (new tab). The read toggle and archive buttons sit above the
 * stretched link and never trigger `open`.
 * Unread is shown without colour: bold title, filled dot, sr-only "New", accent bar.
 */
import { computed, ref } from 'vue'
import type { AppNotification, NotificationActorType, NotificationSeverity } from '~/types/notification'
import { DOMAIN_META, fmtSigned, notificationLocation, relativeTime } from '~/utils/notifications'
import { APP_LOCALE } from '~/utils/locale'
import UIPill from '@/components/UI/Pill.vue'

const props = defineProps<{ n: AppNotification; now: number }>()
const emit = defineEmits<{
  (e: 'open', n: AppNotification): void
  (e: 'toggle-read', n: AppNotification): void
  (e: 'archive', n: AppNotification): void
}>()

const SEVERITY: Record<NotificationSeverity, { label: string; tone: 'info' | 'success' | 'warning' | 'danger'; icon: string }> = {
  info:    { label: 'Info',    tone: 'info',    icon: 'i' },
  success: { label: 'Success', tone: 'success', icon: '✓' },
  warning: { label: 'Warning', tone: 'warning', icon: '!' },
  danger:  { label: 'Alert',   tone: 'danger',  icon: '✕' },
}
const ACTOR_GLYPH: Record<NotificationActorType, string> = {
  user: '◉', bot: '⚙', agent: '⬡', friend: '☺', system: 'ⓘ',
}

const meta = computed(() => DOMAIN_META[props.n.domain] ?? DOMAIN_META.system)
const unread = computed(() => !props.n.state.read_at)
const opened = computed(() => !!props.n.state.opened_at)
const sev = computed(() => SEVERITY[props.n.severity] ?? SEVERITY.info)

const href = computed(() => {
  const loc = notificationLocation(props.n)
  const q = loc.query && Object.keys(loc.query).length ? `?${new URLSearchParams(loc.query).toString()}` : ''
  return `${loc.path}${q}${loc.hash ?? ''}`
})

function fullDate(iso: string | null | undefined): string {
  const t = iso ? Date.parse(iso) : NaN
  return Number.isFinite(t) ? new Date(t).toLocaleString(APP_LOCALE, { dateStyle: 'medium', timeStyle: 'short' }) : ''
}

const when = computed(() => relativeTime(props.n.when.occurred_at, props.now))
const whenTitle = computed(() => fullDate(props.n.when.occurred_at))
const dueFuture = computed(() => {
  const d = props.n.when.due_at ? Date.parse(props.n.when.due_at) : NaN
  return Number.isFinite(d) && d > props.now
})
const due = computed(() => (dueFuture.value ? `due ${relativeTime(props.n.when.due_at!, props.now)}` : ''))
const dueTitle = computed(() => (dueFuture.value ? `Due ${fullDate(props.n.when.due_at)}` : ''))

const whatText = computed(() => [props.n.what.action, props.n.what.subject_label].filter(Boolean).join(' · '))
const sourceLabel = computed(() => DOMAIN_META[props.n.from.source]?.label ?? props.n.from.source)

const avatarFailed = ref(false)
const avatar = computed(() => {
  const u = props.n.who.avatar_url
  if (!u || avatarFailed.value) return null
  return /^(https?:\/\/|\/(?!\/))/.test(u) ? u : null
})

/** HOW WELL: the coloured, signed value is spliced into the label when the label already prints it. */
const outcome = computed(() => {
  const o = props.n.outcome
  if (!o) return null
  const value = fmtSigned(o.value, o.unit)
  const i = o.label.indexOf(value)
  const bench = o.benchmark ? `${o.benchmark.label} ${fmtSigned(o.benchmark.value, o.benchmark.unit)}` : ''
  return {
    tone: o.tone,
    arrow: o.tone === 'up' ? '▲' : o.tone === 'down' ? '▼' : '',
    toneText: o.tone === 'up' ? 'positive' : o.tone === 'down' ? 'negative' : '',
    value,
    before: i >= 0 ? o.label.slice(0, i) : '',
    after: i >= 0 ? o.label.slice(i + value.length) : o.label ? ` · ${o.label}` : '',
    bench,
  }
})

function onLink(e: MouseEvent) {
  // Let the browser open a new tab on modified clicks; the plain click goes through the store.
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
  e.preventDefault()
  emit('open', props.n)
}
</script>

<template>
  <li
    class="nr"
    :class="[{ unread, paper: n.domain === 'paper', urgent: n.priority === 3 }]"
    :style="{ '--nr-accent': meta.color }"
    :data-nkey="n.key"
  >
    <span class="nr-glyph" aria-hidden="true" :title="meta.label">{{ meta.glyph }}</span>

    <div class="nr-main">
      <div class="nr-head">
        <span class="nr-dot" aria-hidden="true" />
        <a class="nr-link" :href="href" @click="onLink">
          <span v-if="unread" class="sr-only">New: </span>
          <span class="nr-title">{{ n.title }}</span>
        </a>
        <span class="nr-pills">
          <UIPill v-if="opened" tone="neutral">Opened</UIPill>
          <UIPill v-if="n.priority === 3" tone="danger" ghost>Urgent</UIPill>
          <UIPill v-if="n.severity !== 'info'" :tone="sev.tone">
            <span class="sev-ico" aria-hidden="true">{{ sev.icon }}</span>{{ sev.label }}
          </UIPill>
        </span>
      </div>

      <p v-if="n.body" class="nr-body">{{ n.body }}</p>

      <dl class="w5">
        <div class="w5c">
          <dt>When</dt>
          <dd>
            <time :datetime="n.when.occurred_at" :title="whenTitle">{{ when }}</time>
            <time v-if="due" class="due" :datetime="n.when.due_at!" :title="dueTitle"> · {{ due }}</time>
          </dd>
        </div>
        <div v-if="whatText" class="w5c">
          <dt>What</dt>
          <dd>
            <span v-if="n.what.asset?.symbol" class="sym">{{ n.what.asset.symbol }}</span>
            {{ whatText }}
          </dd>
        </div>
        <div v-if="n.where.label" class="w5c">
          <dt>Where</dt>
          <dd>{{ n.where.label }}</dd>
        </div>
        <div class="w5c">
          <dt>Who</dt>
          <dd class="who">
            <img v-if="avatar" :src="avatar" alt="" class="face" loading="lazy" @error="avatarFailed = true">
            <span v-else class="actor-g" aria-hidden="true">{{ ACTOR_GLYPH[n.who.actor_type] ?? '◉' }}</span>
            <span>{{ n.who.actor_label }}</span>
            <span class="sr-only"> ({{ n.who.actor_type }})</span>
          </dd>
        </div>
        <div class="w5c">
          <dt>From</dt>
          <dd>
            {{ sourceLabel }}
            <span
              v-if="n.from.origin === 'client'"
              class="device"
              title="Worked out on this device from your local data"
            >device</span>
          </dd>
        </div>
        <div v-if="outcome" class="w5c how">
          <dt>How well</dt>
          <dd>
            {{ outcome.before }}<span class="out-v" :class="outcome.tone"><span v-if="outcome.arrow" aria-hidden="true">{{ outcome.arrow }} </span>{{ outcome.value }}<span v-if="outcome.toneText" class="sr-only"> ({{ outcome.toneText }})</span></span>{{ outcome.after }}
            <span v-if="outcome.bench" class="bench"> · {{ outcome.bench }}</span>
          </dd>
        </div>
      </dl>
    </div>

    <div class="nr-actions">
      <button
        type="button"
        class="nr-btn"
        :aria-label="unread ? `Mark as read: ${n.title}` : `Mark as unread: ${n.title}`"
        :title="unread ? 'Mark as read' : 'Mark as unread'"
        @click.stop="emit('toggle-read', n)"
      >
        <svg v-if="unread" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>
        <svg v-else viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><circle cx="8" cy="8" r="4" fill="currentColor" /></svg>
      </button>
      <button
        type="button"
        class="nr-btn"
        :aria-label="`Archive: ${n.title}`"
        title="Archive"
        @click.stop="emit('archive', n)"
      >
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M2.5 3.5h11v3h-11zM3.5 6.5v6h9v-6M6.5 9h3" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round" /></svg>
      </button>
    </div>
  </li>
</template>

<style scoped>
.nr {
  position: relative;
  display: grid;
  grid-template-columns: 26px minmax(0, 1fr) auto;
  gap: 0.55rem;
  align-items: start;
  padding: 0.5rem 0.55rem 0.5rem 0.7rem;
  background: var(--surface-raised, linear-gradient(180deg, rgba(27,29,38,0.92), rgba(16,17,24,0.95)));
  border: 1px solid var(--edge-soft, rgba(255,255,255,0.05));
  border-radius: var(--app-border-radius, 6px);
  min-width: 0;
  overflow: hidden;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}
.nr::before {
  content: '';
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 3px;
  background: var(--nr-accent, var(--primary-blue, #00aaff));
  opacity: 0.18;
}
.nr.unread::before { opacity: 1; }
.nr.unread { border-color: var(--edge-raised, rgba(255,255,255,0.09)); }
.nr:hover { border-color: var(--edge-lit, rgba(255,255,255,0.14)); }
/* Paper trades: dashed edge + 60 % saturation (Design DoD). */
.nr.paper { border-style: dashed; }
.nr.paper .nr-glyph, .nr.paper .out-v { filter: saturate(0.6); }

.nr-glyph {
  width: 26px; height: 26px;
  display: inline-flex; align-items: center; justify-content: center;
  border-radius: 50%;
  font-size: 0.8rem;
  font-weight: 800;
  color: var(--nr-accent, var(--primary-blue, #00aaff));
  border: 1px solid currentColor;
  background: rgba(255,255,255,0.03);
  margin-top: 1px;
}

.nr-main { display: flex; flex-direction: column; gap: 0.2rem; min-width: 0; }
.nr-head { display: flex; align-items: baseline; gap: 0.4rem; min-width: 0; flex-wrap: wrap; }
.nr-dot {
  flex: 0 0 auto;
  width: 7px; height: 7px;
  border-radius: 50%;
  border: 1.5px solid var(--text-gray, #888888);
  align-self: center;
}
.nr.unread .nr-dot { background: var(--text-white, #ffffff); border-color: var(--text-white, #ffffff); }

.nr-link {
  color: inherit;
  text-decoration: none;
  min-width: 0;
  flex: 1 1 12rem;
}
/* Stretched link: the whole row opens; actions sit above it. */
.nr-link::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  z-index: 0;
}
.nr-link:focus { outline: none; }
.nr-link:focus-visible::after {
  outline: 2px solid var(--primary-blue, #00aaff);
  outline-offset: -2px;
  border-radius: var(--app-border-radius, 6px);
}
.nr-title {
  font-size: 0.82rem;
  font-weight: 500;
  color: rgba(255,255,255,0.78);
  line-height: 1.3;
  overflow-wrap: anywhere;
}
.nr.unread .nr-title { font-weight: 800; color: var(--text-white, #ffffff); }
.nr-pills { display: inline-flex; gap: 0.25rem; flex-wrap: wrap; }
.sev-ico { font-weight: 900; margin-right: 0.15rem; }

.nr-body {
  margin: 0;
  font-size: 0.72rem;
  line-height: 1.4;
  color: rgba(255,255,255,0.6);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  overflow-wrap: anywhere;
}

.w5 {
  margin: 0.1rem 0 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  min-width: 0;
}
.w5c {
  display: inline-flex;
  align-items: baseline;
  gap: 0.3rem;
  min-width: 0;
  max-width: 100%;
  padding: 1px 6px;
  border-radius: 4px;
  background: rgba(255,255,255,0.03);
  border: 1px solid var(--edge-soft, rgba(255,255,255,0.05));
}
.w5c dt {
  flex: 0 0 auto;
  font-family: var(--font-chrome, inherit);
  font-size: 0.5rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-weight: 700;
  color: rgba(255,255,255,0.4);
}
.w5c dd {
  margin: 0;
  min-width: 0;
  font-size: 0.65rem;
  color: rgba(255,255,255,0.72);
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}
.due { color: var(--warning-orange, #ffa500); font-weight: 700; }
.sym { font-family: var(--font-market-data, monospace); font-weight: 700; color: var(--text-white, #ffffff); margin-right: 0.15rem; }
.who { display: inline-flex; align-items: center; gap: 0.25rem; }
.face {
  width: 14px; height: 14px; border-radius: 50%;
  object-fit: cover;
  border: 1px solid var(--edge-raised, rgba(255,255,255,0.09));
  background: var(--bg-tertiary, #1a1a1a);
}
.actor-g { font-size: 0.65rem; opacity: 0.8; }
.device {
  margin-left: 0.2rem;
  font-size: 0.48rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-weight: 800;
  padding: 0 4px;
  border-radius: 3px;
  border: 1px dashed rgba(255,255,255,0.25);
  color: rgba(255,255,255,0.55);
}
.out-v { font-family: var(--font-market-data, monospace); font-weight: 700; color: rgba(255,255,255,0.85); white-space: nowrap; }
.out-v.up { color: var(--app-color-up, #00ff88); }
.out-v.down { color: var(--app-color-down, #ff4444); }
.bench { color: rgba(255,255,255,0.45); font-family: var(--font-market-data, monospace); }

.nr-actions {
  position: relative;
  z-index: 1;
  display: flex;
  gap: 0.2rem;
  align-items: flex-start;
}
.nr-btn {
  width: 28px; height: 28px;
  min-width: 24px; min-height: 24px;
  display: inline-flex; align-items: center; justify-content: center;
  background: rgba(255,255,255,0.03);
  border: 1px solid var(--edge-soft, rgba(255,255,255,0.05));
  border-radius: var(--app-border-radius, 6px);
  color: rgba(255,255,255,0.6);
  cursor: pointer;
  padding: 0;
  transition: color 0.15s ease, border-color 0.15s ease;
}
.nr-btn:hover { color: var(--text-white, #ffffff); border-color: var(--edge-lit, rgba(255,255,255,0.14)); }
.nr-btn:focus-visible { outline: 2px solid var(--primary-blue, #00aaff); outline-offset: 1px; }

.sr-only {
  position: absolute !important;
  width: 1px; height: 1px;
  padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0 0 0 0);
  white-space: nowrap; border: 0;
}

@media (max-width: 640px) {
  .nr { grid-template-columns: 22px minmax(0, 1fr) auto; gap: 0.4rem; padding: 0.45rem 0.4rem 0.45rem 0.6rem; }
  .nr-glyph { width: 22px; height: 22px; font-size: 0.7rem; }
  .nr-actions { flex-direction: column; }
  .nr-title { font-size: 0.78rem; }
}

@media (prefers-reduced-motion: reduce) {
  .nr, .nr-btn { transition: none; }
}
</style>
