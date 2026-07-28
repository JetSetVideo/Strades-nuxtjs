<script setup lang="ts">
const props = withDefaults(defineProps<{
  modelValue?: boolean
  label?: string
}>(), {
  modelValue: false,
  label: 'Save article',
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'toggle', value: boolean): void
}>()

const toggleBookmark = () => {
  const next = !props.modelValue
  emit('update:modelValue', next)
  emit('toggle', next)
}
</script>

<template>
  <button
    class="bookmark-btn"
    type="button"
    :aria-pressed="modelValue"
    :aria-label="modelValue ? 'Remove from saved articles' : label"
    @click.stop="toggleBookmark"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="1.15em"
      height="1.15em"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        v-if="modelValue"
        d="M5 21V5q0-.825.588-1.412T7 3h10q.825 0 1.413.588T19 5v16l-7-3z"
      />
      <path
        v-else
        d="M5 21V5q0-.825.588-1.412T7 3h10q.825 0 1.413.588T19 5v16l-7-3zm2-3.05l5-2.15l5 2.15V5H7z"
      />
    </svg>
    <span>{{ modelValue ? 'Saved' : 'Save' }}</span>
  </button>
</template>

<style scoped>
.bookmark-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.45rem 0.65rem;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.04);
  color: rgba(255, 255, 255, 0.82);
  cursor: pointer;
  transition: background-color var(--transition-fast, 0.2s ease), border-color var(--transition-fast, 0.2s ease);
  font-size: 0.68rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  font-weight: 700;
}

.bookmark-btn:hover,
.bookmark-btn[aria-pressed='true'] {
  border-color: rgba(0, 255, 136, 0.35);
  background: rgba(0, 255, 136, 0.12);
  color: var(--primary-green, #00ff88);
}
</style>
