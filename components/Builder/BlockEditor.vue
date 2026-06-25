<script setup lang="ts">
interface Block {
  id: number | string
  type: string
  data: any
}

defineProps<{ blocks: Block[] }>()

defineEmits<{
  (e: 'update-block', blockId: Block['id'], newData: any): void
  (e: 'remove-block', blockId: Block['id']): void
}>()
</script>

<template>
  <div class="block-editor">
    <div v-for="block in blocks" :key="block.id" :class="['block', `block-${block.type}`]">
      <span class="block-tag">{{ block.type }}</span>
      <slot :name="block.type" :block="block" />
      <button
        type="button"
        class="remove-block"
        :aria-label="`Remove ${block.type} block`"
        @click="$emit('remove-block', block.id)"
      >×</button>
    </div>
  </div>
</template>

<style scoped>
.block-editor {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.block {
  position: relative;
  padding: 0.6rem 0.7rem;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: var(--app-border-radius, 6px);
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
.block-condition { border-left: 3px solid var(--primary-blue, #00aaff); }
.block-action    { border-left: 3px solid var(--primary-green, #00ff88); }

.block-tag {
  font-size: 0.55rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-weight: 800;
  color: rgba(255,255,255,0.5);
}
.block-condition .block-tag { color: var(--primary-blue, #00aaff); }
.block-action    .block-tag { color: var(--primary-green, #00ff88); }

.remove-block {
  position: absolute;
  top: 0.45rem;
  right: 0.5rem;
  width: 22px; height: 22px;
  background: rgba(255,77,106,0.1);
  border: 1px solid rgba(255,77,106,0.3);
  color: #ff4d6a;
  border-radius: 6px;
  font-size: 1rem;
  line-height: 1;
  cursor: pointer;
  font-family: inherit;
  font-weight: 800;
  transition: background 0.15s ease;
}
.remove-block:hover { background: rgba(255,77,106,0.2); }
</style>
