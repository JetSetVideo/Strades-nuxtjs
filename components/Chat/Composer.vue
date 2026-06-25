<script setup lang="ts">
import { ref, computed, watch } from 'vue'

const props = defineProps<{
  modelValue: string
  isEditing?: boolean
  placeholder?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: string): void
  (e: 'send'): void
  (e: 'cancelEdit'): void
}>()

const localValue = ref(props.modelValue)
watch(() => props.modelValue, v => { localValue.value = v })
watch(localValue, v => emit('update:modelValue', v))

const canSend = computed(() => localValue.value.trim().length > 0)

function send() {
  if (!canSend.value) return
  emit('send')
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    send()
  } else if (e.key === 'Escape' && props.isEditing) {
    emit('cancelEdit')
  }
}
</script>

<template>
  <div class="composer">
    <div v-if="isEditing" class="edit-banner">
      Editing message
      <button class="edit-cancel" @click="emit('cancelEdit')">cancel</button>
    </div>
    <slot name="toolbar" />
    <div class="composer-row">
      <textarea
        v-model="localValue"
        :placeholder="placeholder || 'Type your message — ⏎ to send, Shift+⏎ for newline'"
        class="composer-input"
        rows="1"
        @keydown="onKeyDown"
      />
      <button
        class="send-btn"
        :disabled="!canSend"
        @click="send"
      >
        {{ isEditing ? 'Save' : 'Send' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.composer {
  flex-shrink: 0;
  background: linear-gradient(135deg, rgba(20,20,28,0.92), rgba(14,14,18,0.92));
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: var(--app-border-radius, 8px);
  padding: 0.45rem 0.55rem;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.edit-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  font-size: 0.6rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--primary-blue, #00aaff);
  font-weight: 700;
}
.edit-cancel {
  background: rgba(255,77,106,0.1);
  border: 1px solid rgba(255,77,106,0.3);
  color: #ff4d6a;
  padding: 1px 7px;
  border-radius: 999px;
  font-size: 0.55rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;
}
.edit-cancel:hover { background: rgba(255,77,106,0.2); }

.composer-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.45rem;
  align-items: flex-end;
}
.composer-input {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  color: #fff;
  border-radius: var(--app-border-radius, 6px);
  padding: 0.5rem 0.65rem;
  font-size: 0.85rem;
  font-family: inherit;
  resize: none;
  min-height: 1.7rem;
  max-height: 200px;
  line-height: 1.5;
  transition: border-color 0.15s ease;
  min-width: 0;
}
.composer-input:focus {
  outline: none;
  border-color: var(--primary-green, #00ff88);
  background: rgba(0,255,136,0.04);
}
.send-btn {
  background: var(--primary-gradient);
  color: #000;
  border: none;
  padding: 0.5rem 0.85rem;
  border-radius: var(--app-border-radius, 6px);
  font-weight: 800;
  font-size: 0.72rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  cursor: pointer;
  font-family: inherit;
  transition: transform 0.15s ease, opacity 0.15s ease;
}
.send-btn:hover:not(:disabled) { transform: translateY(-1px); }
.send-btn:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
