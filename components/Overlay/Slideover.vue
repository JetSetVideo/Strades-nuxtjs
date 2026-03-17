<script setup>
import { computed, onMounted, onUnmounted, watch } from 'vue'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  side: { type: String, default: 'left' }, // 'left' | 'right'
  overlay: { type: Boolean, default: true },
  width: { type: String, default: 'clamp(18rem, 50vw, 32rem)' }
})

const emit = defineEmits(['update:modelValue'])

const isOpen = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
})

function close() {
  isOpen.value = false
}

function onKeydown(e) {
  if (e.key === 'Escape') close()
}

watch(
  () => props.modelValue,
  (open) => {
    if (typeof document === 'undefined') return
    document.body.style.overflow = open ? 'hidden' : ''
  }
)

onMounted(() => {
  if (typeof window !== 'undefined') window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  if (typeof window !== 'undefined') window.removeEventListener('keydown', onKeydown)
  if (typeof document !== 'undefined') document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <Transition name="slideover-fade">
      <div v-if="isOpen" class="slideover-root" :data-side="side">
        <div
          v-if="overlay"
          class="slideover-overlay"
          aria-hidden="true"
          @click="close"
        />

        <Transition :name="side === 'right' ? 'slideover-panel-right' : 'slideover-panel-left'">
          <aside
            class="slideover-panel"
            role="dialog"
            aria-modal="true"
            :style="{ width }"
            @click.stop
          >
            <slot :close="close" />
          </aside>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.slideover-root {
  position: fixed;
  inset: 0;
  z-index: 3000; /* above headers/nav */
}

.slideover-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(2px);
}

.slideover-panel {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  background: var(--bg-primary, #000);
  color: var(--text-white, #fff);
  border-right: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.65);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.slideover-root[data-side="right"] .slideover-panel {
  left: auto;
  right: 0;
  border-right: none;
  border-left: 1px solid rgba(255, 255, 255, 0.12);
}

/* Root fade */
.slideover-fade-enter-active,
.slideover-fade-leave-active {
  transition: opacity 160ms ease;
}
.slideover-fade-enter-from,
.slideover-fade-leave-to {
  opacity: 0;
}

/* Panel slide */
.slideover-panel-left-enter-active,
.slideover-panel-left-leave-active,
.slideover-panel-right-enter-active,
.slideover-panel-right-leave-active {
  transition: transform 220ms cubic-bezier(0.22, 1, 0.36, 1);
  will-change: transform;
}

.slideover-panel-left-enter-from,
.slideover-panel-left-leave-to {
  transform: translateX(-102%);
}

.slideover-panel-right-enter-from,
.slideover-panel-right-leave-to {
  transform: translateX(102%);
}
</style>

