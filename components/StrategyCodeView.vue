<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ code: Record<string, any> }>()

function escapeHtml(str: string) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function colorize(value: unknown): string {
  if (typeof value === 'number') return `<span class="num">${value}</span>`
  if (typeof value === 'boolean') return `<span class="bool">${value}</span>`
  if (value === null) return `<span class="null">null</span>`
  return `<span class="str">"${escapeHtml(String(value))}"</span>`
}

function formatObject(obj: any, indent = 0): string {
  if (Array.isArray(obj)) {
    const items = obj.map(v => formatObject(v, indent + 2)).join(',\n')
    return `[\n${' '.repeat(indent + 2)}${items}\n${' '.repeat(indent)}]`
  }
  if (obj && typeof obj === 'object') {
    const entries = Object.entries(obj).map(([k, v]) => {
      const key = `<span class="key">"${escapeHtml(k)}"</span>`
      const value = (v && typeof v === 'object') ? formatObject(v, indent + 2) : colorize(v)
      return `${' '.repeat(indent + 2)}${key}: ${value}`
    }).join(',\n')
    return `{\n${entries}\n${' '.repeat(indent)}}`
  }
  return colorize(obj)
}

const rendered = computed(() => formatObject(props.code, 0))
</script>

<template>
  <div class="code-view" v-html="rendered" />
  
</template>

<style scoped>
.code-view {
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  padding: var(--spacing-md);
  color: var(--text-white);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 12px;
  overflow: auto;
}
.key { color: var(--primary-blue); }
.str { color: var(--primary-green); }
.num { color: #ffa500; }
.bool { color: #ff6666; }
.null { color: var(--text-gray); }
</style>


