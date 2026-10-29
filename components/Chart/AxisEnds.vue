<script setup lang="ts">
/**
 * The two ends of one chart axis. Hold either end and drag to change that
 * limit: the date axis sideways, the price axis up and down.
 */
import { onBeforeUnmount } from 'vue'

defineProps<{
  orientation: 'horizontal' | 'vertical'
  startLabel: string
  endLabel: string
}>()

const emit = defineEmits<{
  drag: [edge: 'start' | 'end', x: number, y: number, phase: 'start' | 'move' | 'end']
}>()

let edge: 'start' | 'end' | null = null
let frame = 0
let lastX = 0
let lastY = 0

function paint() {
  frame = 0
  if (edge) emit('drag', edge, lastX, lastY, 'move')
}

function down(which: 'start' | 'end', e: PointerEvent) {
  if (e.button > 0) return
  e.preventDefault()
  e.stopPropagation()
  edge = which
  lastX = e.clientX
  lastY = e.clientY
  try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) } catch { /* already released */ }
  emit('drag', which, lastX, lastY, 'start')
}

function move(e: PointerEvent) {
  if (!edge) return
  lastX = e.clientX
  lastY = e.clientY
  if (frame) return
  frame = requestAnimationFrame(paint)
}

function up(e: PointerEvent) {
  if (!edge) return
  if (frame) cancelAnimationFrame(frame)
  frame = 0
  const which = edge
  edge = null
  emit('drag', which, e.clientX, e.clientY, 'end')
}

onBeforeUnmount(() => { if (frame) cancelAnimationFrame(frame) })
</script>

<template>
  <div class="axis" :class="orientation">
    <button
      type="button"
      class="grip start"
      :aria-label="startLabel"
      @pointerdown="down('start', $event)"
      @pointermove="move"
      @pointerup="up"
      @pointercancel="up"
    />
    <button
      type="button"
      class="grip end"
      :aria-label="endLabel"
      @pointerdown="down('end', $event)"
      @pointermove="move"
      @pointerup="up"
      @pointercancel="up"
    />
  </div>
</template>

<style scoped>
.axis { position: absolute; z-index: 3; pointer-events: none; }
.grip {
  position: absolute; pointer-events: auto; border: 0; padding: 0; margin: 0;
  background: transparent; touch-action: none; cursor: ew-resize;
}
.grip::after {
  content: ''; position: absolute; border-radius: 2px; background: rgba(255, 255, 255, 0.78);
}
.grip:hover::after, .grip:focus-visible::after { background: #fff; }
.grip:focus-visible { outline: none; }
.horizontal .grip { top: 0; width: 16px; height: 16px; }
.horizontal .grip.start { left: -6px; }
.horizontal .grip.end { right: -8px; top: 1px; }
.horizontal .grip::after { left: 6px; top: 1px; width: 3px; height: 14px; }
.vertical .grip { left: 0; width: 16px; height: 16px; cursor: ns-resize; }
.vertical .grip.start { bottom: -4px; left: 6px; }
.vertical .grip.end { top: -6px; }
.vertical .grip::after { left: 1px; top: 6px; width: 14px; height: 3px; }
</style>
