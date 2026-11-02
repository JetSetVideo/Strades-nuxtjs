<script setup lang="ts">
/**
 * The primary values: the top of the tree every derived number grows from. Every option is shown even when
 * it is not set (with its default), each one says what it drives (wired now / planned), and each has an
 * anchor (#set-<key>) so a number's "Driven by your settings" link lands on it.
 */
import { onMounted, reactive, ref } from 'vue'
import type { PrimaryField } from '~/composables/usePrimarySettings'

const { values, defaults, schema, status, error, load, save } = usePrimarySettings()
const draft = reactive<Record<string, string>>({})
const msg = reactive<Record<string, string>>({})
const busy = ref<string | null>(null)
const openKey = ref<string | null>(null)

onMounted(async () => {
  await load()
  const h = useRoute().hash
  if (h.startsWith('#set-')) {
    openKey.value = h.slice(5)
    await nextTick()
    document.getElementById(h.slice(1))?.scrollIntoView({ block: 'center' })
  }
})

function shown(f: PrimaryField): string {
  const v = values.value[f.key]
  if (v === null || v === undefined) return 'not set'
  if (typeof v === 'boolean') return v ? 'on' : 'off'
  return `${typeof v === 'number' ? v.toLocaleString('en-GB') : v}${f.unit ? ` ${f.unit}` : ''}`
}
const isDefault = (f: PrimaryField) => values.value[f.key] === defaults.value[f.key]

async function commit(f: PrimaryField, raw: string | number | boolean | null) {
  busy.value = f.key
  msg[f.key] = ''
  let v: string | number | boolean | null = raw
  if (typeof raw === 'string' && raw.trim() === '') v = null
  else if (typeof raw === 'string' && ['money', 'bps', 'pct', 'int'].includes(f.kind)) v = Number(raw)
  else if (f.kind === 'choice' && typeof raw === 'string' && f.choices?.some(c => typeof c === 'number')) v = Number(raw)
  const err = await save(f.key, v)
  msg[f.key] = err || 'Saved'
  busy.value = null
  if (!err) delete draft[f.key]
}
</script>

<template>
  <section class="pv" aria-labelledby="pv-t">
    <header class="pv-head">
      <h2 id="pv-t" class="pv-t">Primary values</h2>
      <p class="pv-sub">
        The few numbers everything else is computed from. Change one here and every page that uses it follows.
        Tap a value to see what it drives.
      </p>
    </header>
    <p v-if="status === 'signed-out'" class="pv-msg">Sign in (or start your demo account) to set your primary values.</p>
    <p v-else-if="status === 'error'" class="pv-msg err">{{ error }} <button type="button" class="lnk" @click="load(true)">Retry</button></p>
    <div v-else-if="status !== 'ready'" class="pv-skel" aria-busy="true"><span /><span /><span /></div>
    <div v-else class="pv-groups">
      <div v-for="g in schema" :key="g.group" class="pv-group">
        <h3 class="pv-gt">{{ g.title }}</h3>
        <ul class="pv-list">
          <li v-for="f in g.fields" :id="`set-${f.key}`" :key="f.key" class="pv-row" :class="{ open: openKey === f.key }">
            <button type="button" class="pv-line" :aria-expanded="openKey === f.key" @click="openKey = openKey === f.key ? null : f.key">
              <span class="pv-label">{{ f.label }}</span>
              <span class="pv-val" :class="{ unset: values[f.key] === null }">{{ shown(f) }}</span>
              <span class="pv-tag">{{ f.locked ? 'fixed' : isDefault(f) ? 'default' : 'yours' }}</span>
            </button>
            <div v-if="openKey === f.key" class="pv-body">
              <p class="pv-help">{{ f.help }}</p>
              <div v-if="!f.locked" class="pv-edit">
                <select
                  v-if="f.kind === 'choice'" :value="String(values[f.key] ?? '')" :disabled="busy === f.key"
                  :aria-label="f.label" @change="commit(f, ($event.target as HTMLSelectElement).value)"
                >
                  <option v-for="c in f.choices" :key="String(c)" :value="String(c)">{{ c }}{{ f.unit ? ` ${f.unit}` : '' }}</option>
                </select>
                <template v-else-if="f.kind === 'bool'">
                  <button type="button" class="btn" :disabled="busy === f.key" @click="commit(f, !values[f.key])">
                    Turn {{ values[f.key] ? 'off' : 'on' }}
                  </button>
                </template>
                <form v-else class="pv-form" @submit.prevent="commit(f, draft[f.key] ?? String(values[f.key] ?? ''))">
                  <input
                    :value="draft[f.key] ?? (values[f.key] ?? '')" type="number" inputmode="decimal" :min="f.min" :max="f.max" step="any"
                    :placeholder="f.default === null ? 'not set' : String(f.default)" :aria-label="`${f.label} (${f.unit || ''})`"
                    @input="draft[f.key] = ($event.target as HTMLInputElement).value; msg[f.key] = ''"
                  />
                  <span class="pv-unit">{{ f.unit }}</span>
                  <button type="submit" class="btn" :disabled="busy === f.key">Save</button>
                </form>
                <button v-if="!isDefault(f)" type="button" class="lnk" :disabled="busy === f.key" @click="commit(f, null)">
                  Back to default ({{ defaults[f.key] ?? 'not set' }})
                </button>
                <span v-if="msg[f.key]" class="pv-msg small" :class="{ err: msg[f.key] !== 'Saved' }" role="status">{{ msg[f.key] }}</span>
              </div>
              <p v-else class="pv-msg small">Shown so you know it exists; it cannot be changed yet.</p>
              <div class="pv-drives">
                <span class="pv-dt">Drives</span>
                <span v-if="!f.drives.length" class="pv-msg small">nothing yet</span>
                <span v-for="d in f.drives" :key="d.label + d.where" class="pv-drive" :class="d.status">
                  {{ d.label }} <small>{{ d.where }} · {{ d.status === 'wired' ? 'in use' : 'coming' }}</small>
                </span>
              </div>
            </div>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>

<style scoped>
.pv { display: grid; gap: 0.7rem; }
.pv-t { margin: 0; font-size: 1rem; color: var(--text-white); }
.pv-sub { margin: 0.2rem 0 0; font-size: 0.76rem; color: var(--text-gray); }
.pv-groups { display: grid; gap: 0.8rem; grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr)); align-items: start; }
.pv-gt { margin: 0 0 0.3rem; font-size: 0.68rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-light-gray); }
.pv-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.25rem; }
.pv-row { border: 1px solid var(--edge-soft); border-radius: var(--radius-sm); scroll-margin-top: 5rem; }
.pv-row.open { border-color: var(--edge-lit); }
.pv-line { all: unset; box-sizing: border-box; cursor: pointer; width: 100%; display: grid; grid-template-columns: 1fr auto auto; gap: 0.5rem;
  align-items: baseline; padding: 0.45rem 0.6rem; }
.pv-line:focus-visible { outline: 2px solid var(--primary-blue); outline-offset: 2px; }
.pv-label { font-size: 0.8rem; color: var(--text-light-gray); }
.pv-val { font-variant-numeric: tabular-nums; font-size: 0.82rem; color: var(--text-white); }
.pv-val.unset { color: var(--text-gray); font-style: italic; }
.pv-tag { font-size: 0.6rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-gray); }
.pv-body { display: grid; gap: 0.45rem; padding: 0 0.6rem 0.6rem; }
.pv-help { margin: 0; font-size: 0.74rem; color: var(--text-gray); }
.pv-edit { display: flex; flex-wrap: wrap; gap: 0.4rem; align-items: center; }
.pv-form { display: flex; gap: 0.35rem; align-items: center; }
.pv-form input, .pv-edit select { width: 8rem; padding: 0.35rem 0.5rem; border-radius: 6px; border: 1px solid var(--border-primary, var(--edge-raised));
  background: var(--surface-sunken, transparent); color: var(--text-primary, var(--text-white)); font: inherit; font-size: 0.8rem; }
.pv-unit { font-size: 0.72rem; color: var(--text-gray); }
.btn { padding: 0.35rem 0.7rem; border-radius: 6px; border: 1px solid var(--edge-raised); background: transparent; color: var(--text-white); font: inherit;
  font-size: 0.76rem; cursor: pointer; }
.lnk { all: unset; cursor: pointer; color: var(--primary-blue); font-size: 0.74rem; }
.pv-drives { display: flex; flex-wrap: wrap; gap: 0.3rem; align-items: center; }
.pv-dt { font-size: 0.62rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-gray); }
.pv-drive { font-size: 0.72rem; padding: 0.15rem 0.45rem; border-radius: 999px; border: 1px solid var(--edge-raised); color: var(--text-light-gray); }
.pv-drive.wired { border-color: var(--primary-blue); color: var(--text-white); }
.pv-drive small { color: var(--text-gray); }
.pv-msg { margin: 0; font-size: 0.78rem; color: var(--text-light-gray); }
.pv-msg.small { font-size: 0.7rem; }
.pv-msg.err { color: var(--warning-orange); }
.pv-skel { display: grid; gap: 0.4rem; }
.pv-skel span { height: 2rem; border-radius: var(--radius-sm); background: rgba(255, 255, 255, 0.04); }
</style>
