<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'

const props = defineProps<{ open: boolean; seconds?: number }>()
const emit = defineEmits<{ (e: 'finish'): void; (e: 'close'): void }>()

const remaining = ref(props.seconds ?? 3)
let timer: number | null = null

function start() {
  stop()
  remaining.value = props.seconds ?? 3
  timer = window.setInterval(() => {
    remaining.value -= 1
    if (remaining.value <= 0) {
      stop()
      emit('finish')
    }
  }, 1000)
}

function stop() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

watch(() => props.open, (val) => { if (val) start(); else stop() })
onMounted(() => { if (props.open) start() })
onUnmounted(stop)
</script>

<template>
  <div v-if="open" class="backdrop">
    <div class="modal">
      <div class="timer" :class="{ danger: remaining <= 2, safe: remaining <= 0 }">
        {{ Math.max(0, remaining) }}
      </div>
      <div class="status" v-if="remaining <= 0">Validated</div>
    </div>
  </div>
</template>

<style scoped>
.backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: grid; place-items: center; z-index: var(--z-modal); }
.modal { background: var(--bg-secondary); border: 1px solid var(--border-primary); border-radius: var(--radius-lg); padding: var(--spacing-xl); box-shadow: var(--shadow-primary); }
.timer { font-size: 64px; font-weight: 800; color: #ff3333; text-align: center; }
.timer.danger { color: #ff3333; }
.timer.safe { color: var(--primary-green); }
.status { text-align: center; margin-top: var(--spacing-md); color: var(--primary-green); font-weight: 600; }
</style>


