<script setup lang="ts">
/**
 * One person in an Insights relation: avatar (or initials), name, bot/demo chip, declared code and role.
 * The role explanation opens on click (no hover-only info).
 */
import { computed, ref } from 'vue'
import { ROLE_EXPLAIN, intelInitials, intelSigned, memberChip, type IntelMember } from '~/utils/intelligence'

const props = withDefaults(defineProps<{
  member: IntelMember
  /** marks the signed-in user */
  me?: boolean
  showRole?: boolean
  showInfluence?: boolean
  compact?: boolean
}>(), { me: false, showRole: false, showInfluence: false, compact: false })

const chip = computed(() => memberChip(props.member))
const open = ref(false)
const roleText = computed(() => ROLE_EXPLAIN[props.member.role ?? ''] ?? '')
const imgOk = ref(true)
</script>

<template>
  <div class="im" :class="{ compact }">
    <span class="im-av" aria-hidden="true">
      <img v-if="member.avatar_url && imgOk" :src="member.avatar_url" alt="" loading="lazy" @error="imgOk = false">
      <template v-else>{{ intelInitials(member.name) }}</template>
    </span>
    <span class="im-main">
      <span class="im-name">
        {{ member.name }}<span v-if="me" class="im-you"> (you)</span>
        <span v-if="chip" class="im-chip" :data-kind="chip" :title="chip === 'bot' ? 'Seeded bot account' : 'Demo account'">{{ chip }}</span>
        <span v-if="member.mbti && !compact" class="im-code" title="Code declared on their profile">{{ member.mbti }}</span>
      </span>
      <span v-if="showRole && member.role" class="im-role-line">
        <button type="button" class="im-role" :aria-expanded="open" @click="open = !open">{{ member.role }}</button>
        <span v-if="showInfluence && typeof member.influence_out === 'number'" class="im-inf num">influence {{ intelSigned(member.influence_out, 2) }}</span>
      </span>
      <span v-if="open && roleText" class="im-role-x">{{ roleText }}</span>
    </span>
  </div>
</template>

<style scoped>
.im { display: flex; align-items: flex-start; gap: 0.5rem; min-width: 0; }
.im-av {
  flex: none; width: 1.9rem; height: 1.9rem; border-radius: 50%; overflow: hidden;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 0.66rem; font-weight: 700; color: var(--text-white);
  background: var(--surface-overlay); border: 1px solid var(--edge-lit);
}
.compact .im-av { width: 1.5rem; height: 1.5rem; font-size: 0.58rem; }
.im-av img { width: 100%; height: 100%; object-fit: cover; }
.im-main { display: flex; flex-direction: column; gap: 0.1rem; min-width: 0; }
.im-name { font-size: 0.8rem; color: var(--text-white); display: inline-flex; flex-wrap: wrap; align-items: center; gap: 0.3rem; overflow-wrap: anywhere; }
.compact .im-name { font-size: 0.74rem; }
.im-you { color: var(--text-gray); }
.im-chip {
  font-size: 0.58rem; text-transform: uppercase; letter-spacing: 0.06em; padding: 0.05rem 0.3rem; border-radius: var(--radius-sm);
  color: var(--domain-agent); background: color-mix(in oklch, var(--domain-agent) 14%, transparent);
}
.im-chip[data-kind='demo'] { color: var(--warning-orange); background: color-mix(in oklch, var(--warning-orange) 12%, transparent); }
.im-code { font-family: var(--font-market-data); font-size: 0.64rem; color: var(--text-light-gray); border: 1px solid var(--edge-raised); border-radius: var(--radius-sm); padding: 0 0.25rem; }
.im-role-line { display: inline-flex; flex-wrap: wrap; gap: 0.4rem; align-items: center; }
.im-role {
  all: unset; cursor: pointer; font-size: 0.66rem; color: var(--primary-blue); text-transform: capitalize;
  border-bottom: 1px dotted currentColor; min-height: 20px; display: inline-flex; align-items: center;
}
.im-role:focus-visible { outline: 2px solid var(--primary-blue); outline-offset: 2px; border-radius: 2px; }
.im-inf { font-size: 0.64rem; color: var(--text-gray); }
.im-role-x { font-size: 0.68rem; color: var(--text-light-gray); }
.num { font-family: var(--font-market-data); font-variant-numeric: tabular-nums; }
</style>
