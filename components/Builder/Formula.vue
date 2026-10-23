<script setup lang="ts">
import { ref, watch } from 'vue'
import { FORMULA_OPS, type FormulaData, type FormulaOp } from '~/utils/strategyDraft'

const props = defineProps<{ modelValue: Partial<FormulaData> }>()
const emit = defineEmits<{ 'update:modelValue': [v: FormulaData] }>()

const local = ref<FormulaData>({
  op: 'if',
  left: '',
  right: '',
  into: '',
  ...props.modelValue,
  op: (props.modelValue?.op as FormulaOp) || 'if',
})

watch(() => props.modelValue, v => { if (v) local.value = { ...local.value, ...v } }, { deep: true })

function emit_() { emit('update:modelValue', { ...local.value }) }

function setOp(id: FormulaOp) {
  local.value.op = id
  emit_()
}

const hint = () => FORMULA_OPS.find(op => op.id === local.value.op)?.hint ?? ''
</script>

<template>
  <div class="formula">
    <div class="ops">
      <button
        v-for="op in FORMULA_OPS"
        :key="op.id"
        type="button"
        class="op"
        :class="{ on: local.op === op.id, math: op.id === 'add' || op.id === 'sub' || op.id === 'mul' || op.id === 'div' }"
        :title="op.hint"
        @click="setOp(op.id)"
      >{{ op.label }}</button>
    </div>
    <div class="expr">
      <input v-model="local.left" class="expr-in" :placeholder="local.op === 'exchange' ? 'From asset' : 'Left'" @input="emit_()" />
      <span class="op-read">{{ FORMULA_OPS.find(op => op.id === local.op)?.label }}</span>
      <input v-model="local.right" class="expr-in" :placeholder="local.op === 'exchange' ? 'To asset' : 'Right'" @input="emit_()" />
      <span class="op-read">→</span>
      <input v-model="local.into" class="expr-in" :placeholder="local.op === 'exchange' ? 'Percent' : 'Name'" @input="emit_()" />
    </div>
    <p class="hint">{{ hint() }}</p>
  </div>
</template>

<style scoped>
.formula { display: flex; flex-direction: column; gap: 8px; }
.ops, .expr { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
.op, .expr-in {
  border: 1px solid var(--border-secondary);
  background: transparent;
  color: var(--text-gray);
  border-radius: 999px;
  font: inherit;
}
.op {
  padding: 3px 9px;
  font-size: 0.68rem;
  cursor: pointer;
}
.op.math { font-family: ui-monospace, monospace; }
.op.on {
  color: #c084fc;
  border-color: rgba(192,132,252,0.7);
  background: rgba(192,132,252,0.12);
}
.expr { width: 100%; }
.expr-in {
  flex: 1;
  min-width: 0;
  border-radius: var(--radius-sm);
  padding: 7px 10px;
  color: var(--text-white);
  background: rgba(0,0,0,0.25);
}
.op-read { font-size: 0.68rem; color: #c084fc; flex-shrink: 0; }
.hint { margin: 0; font-size: 0.65rem; color: var(--text-gray); }
</style>
