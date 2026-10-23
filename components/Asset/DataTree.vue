<script setup lang="ts">
/**
 * DataTree — renders any JSON the backend or the bundled data gives for an
 * asset, compactly, so no available information is left off the page.
 *
 *  object            → label / value grid (nested objects become sub-sections)
 *  array of values   → chips
 *  array of objects  → a small table when rows share their keys, else cards
 */
import { computed } from 'vue'

defineOptions({ name: 'AssetDataTree' })

const props = withDefaults(defineProps<{
  data: unknown
  depth?: number
  currency?: string
}>(), { depth: 0, currency: 'USD' })

type Entry = { key: string; label: string; value: unknown; kind: 'value' | 'chips' | 'table' | 'cards' | 'object' }

function isPlain(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}
function empty(v: unknown): boolean {
  if (v === null || v === undefined || v === '') return true
  if (Array.isArray(v)) return v.length === 0 || v.every(empty)
  if (isPlain(v)) return Object.values(v).every(empty)
  return false
}

function humanize(key: string): string {
  const s = key
    .replace(/_usd$/i, ' (USD)')
    .replace(/_pct$/i, ' %')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\bttm\b/i, 'TTM').replace(/\bid\b/i, 'ID').replace(/\bpe\b/i, 'P/E').replace(/\bpb\b/i, 'P/B')
    .replace(/\btps\b/i, 'TPS').replace(/\bgdp\b/i, 'GDP').replace(/\burl\b/i, 'link')
    .trim()
  return s.charAt(0).toUpperCase() + s.slice(1)
}

const SKIP = new Set(['id', 'asset', 'asset_id', 'created_at', 'updated_at'])

const entries = computed<Entry[]>(() => {
  const d = props.data
  if (!isPlain(d)) return []
  return Object.entries(d)
    .filter(([k, v]) => !SKIP.has(k) && !empty(v))
    .map(([key, value]) => {
      let kind: Entry['kind'] = 'value'
      if (Array.isArray(value)) {
        if (value.every(x => !isPlain(x) && !Array.isArray(x))) kind = 'chips'
        else {
          const rows = value.filter(isPlain)
          const keys = new Set(rows.flatMap(r => Object.keys(r).filter(k => !SKIP.has(k))))
          const flat = rows.every(r => Object.values(r).every(x => !isPlain(x) && !Array.isArray(x)))
          kind = flat && keys.size <= 7 ? 'table' : 'cards'
        }
      } else if (isPlain(value)) kind = 'object'
      return { key, label: humanize(key), value, kind }
    })
})

const simple = computed(() => entries.value.filter(e => e.kind === 'value'))
const complex = computed(() => entries.value.filter(e => e.kind !== 'value'))

const MONEY_KEY = /(price|revenue|income|assets|equity|liabilit|cap|value|gdp|cost|cash|debt|profit|sales|ebitda|usd)/i
const PCT_KEY = /(_pct|percent|rate|yield|growth|margin|share)$/i
const COUNT_KEY = /(employees|supply|volume|interest|shares|count|population|tps|seconds|rank|year)/i

function fmtValue(key: string, v: unknown, currency = 'USD'): { text: string; href?: string } {
  if (typeof v === 'boolean') return { text: v ? 'Yes' : 'No' }
  if (typeof v === 'number') {
    if (PCT_KEY.test(key)) return { text: `${Math.abs(v) <= 1 && /yield|margin|share/i.test(key) ? (v * 100).toFixed(2) : v.toFixed(2)}%` }
    if (MONEY_KEY.test(key) && !COUNT_KEY.test(key)) return { text: money(v, currency) }
    if (/year/i.test(key)) return { text: String(v) }
    return { text: compact(v) }
  }
  const s = String(v)
  if (/^https?:\/\//i.test(s)) return { text: s.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, ''), href: s }
  if (/^\d{4}-\d{2}-\d{2}(T|$)/.test(s)) {
    const t = Date.parse(s)
    if (Number.isFinite(t)) return { text: new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) }
  }
  if (/^-?\d+(\.\d+)?$/.test(s)) return fmtValue(key, Number(s), currency)
  return { text: s.replace(/_/g, ' ') }
}

function compact(v: number): string {
  const a = Math.abs(v)
  if (a >= 1e12) return `${(v / 1e12).toFixed(2)}T`
  if (a >= 1e9) return `${(v / 1e9).toFixed(2)}B`
  if (a >= 1e6) return `${(v / 1e6).toFixed(2)}M`
  if (a >= 1e4) return `${(v / 1e3).toFixed(1)}k`
  return Number.isInteger(v) ? v.toLocaleString('en-US') : v.toLocaleString('en-US', { maximumFractionDigits: 4 })
}
function money(v: number, currency: string): string {
  const a = Math.abs(v)
  const sym = currency === 'USD' ? '$' : `${currency} `
  if (a >= 1e4) return `${v < 0 ? '-' : ''}${sym}${compact(a)}`
  return `${v < 0 ? '-' : ''}${sym}${a.toLocaleString('en-US', { maximumFractionDigits: a < 1 ? 4 : 2 })}`
}

function tableCols(rows: unknown[]): string[] {
  const keys: string[] = []
  for (const r of rows) if (isPlain(r)) for (const k of Object.keys(r)) if (!SKIP.has(k) && !keys.includes(k) && rows.some(x => isPlain(x) && !empty(x[k]))) keys.push(k)
  return keys
}
</script>

<template>
  <div class="dt" :class="`d${Math.min(depth, 2)}`">
    <dl v-if="simple.length" class="dt-grid">
      <div v-for="e in simple" :key="e.key" class="dt-item">
        <dt>{{ e.label }}</dt>
        <dd>
          <a v-if="fmtValue(e.key, e.value, currency).href" :href="fmtValue(e.key, e.value, currency).href" target="_blank" rel="noopener">{{ fmtValue(e.key, e.value, currency).text }}</a>
          <template v-else>{{ fmtValue(e.key, e.value, currency).text }}</template>
        </dd>
      </div>
    </dl>

    <section v-for="e in complex" :key="e.key" class="dt-sub">
      <h4>{{ e.label }}</h4>
      <div v-if="e.kind === 'chips'" class="dt-chips">
        <span v-for="(c, i) in (e.value as unknown[]).filter(x => x !== null && x !== '')" :key="i" class="dt-chip">{{ fmtValue(e.key, c, currency).text }}</span>
      </div>
      <div v-else-if="e.kind === 'table'" class="dt-table-wrap">
        <table class="dt-table">
          <thead><tr><th v-for="c in tableCols(e.value as unknown[])" :key="c">{{ humanize(c) }}</th></tr></thead>
          <tbody>
            <tr v-for="(r, i) in (e.value as Record<string, unknown>[])" :key="i">
              <td v-for="c in tableCols(e.value as unknown[])" :key="c">{{ empty(r[c]) ? '—' : fmtValue(c, r[c], currency).text }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else-if="e.kind === 'cards'" class="dt-cards">
        <div v-for="(r, i) in (e.value as unknown[])" :key="i" class="dt-card">
          <AssetDataTree v-if="isPlain(r)" :data="r" :depth="depth + 1" :currency="currency" />
          <span v-else>{{ String(r) }}</span>
        </div>
      </div>
      <AssetDataTree v-else :data="e.value" :depth="depth + 1" :currency="currency" />
    </section>
  </div>
</template>

<style scoped>
.dt { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.dt-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 4px 10px; margin: 0; }
.dt-item { min-width: 0; }
.dt-item dt { font-size: 0.6rem; text-transform: uppercase; letter-spacing: .04em; color: var(--text-gray, #9aa0a6); }
.dt-item dd { margin: 0; font-size: 0.78rem; color: var(--text-white, #fff); overflow-wrap: anywhere; font-variant-numeric: tabular-nums; }
.dt-item a { color: var(--primary-blue, #6aa8ff); text-decoration: none; }
.dt-item a:hover { text-decoration: underline; }
.dt-sub h4 { margin: 2px 0 3px; font-size: 0.66rem; text-transform: uppercase; letter-spacing: .05em; color: var(--text-light-gray, rgba(255,255,255,.7)); }
.dt-chips { display: flex; flex-wrap: wrap; gap: 3px; }
.dt-chip { padding: 1px 7px; border-radius: 999px; border: 1px solid var(--border-primary, rgba(255,255,255,.12)); font-size: 0.68rem; color: var(--text-light-gray, rgba(255,255,255,.8)); }
.dt-table-wrap { overflow-x: auto; }
.dt-table { border-collapse: collapse; width: 100%; font-size: 0.7rem; font-variant-numeric: tabular-nums; }
.dt-table th { text-align: left; font-weight: 600; color: var(--text-gray, #9aa0a6); padding: 2px 6px 2px 0; white-space: nowrap; font-size: 0.62rem; }
.dt-table td { padding: 2px 6px 2px 0; border-top: 1px solid rgba(255,255,255,.06); color: var(--text-white, #fff); }
.dt-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 4px; }
.dt-card { padding: 5px 6px; border-radius: 6px; background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.06); min-width: 0; }
.dt.d1 .dt-grid, .dt.d2 .dt-grid { grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); }
</style>
