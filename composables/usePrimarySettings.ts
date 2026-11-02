/**
 * usePrimarySettings — the user's primary values (the roots of every derived number) from
 * GET/PATCH /api/v1/settings/primary/ (backend apps/users/primary.py: schema + values + defaults).
 */
import { ref, shallowRef } from 'vue'

export interface PrimaryDrive { label: string; where: string; status: 'wired' | 'planned' | string }
export interface PrimaryField {
  key: string; label: string; kind: 'money' | 'bps' | 'pct' | 'int' | 'choice' | 'bool'; unit?: string
  default: number | string | boolean | null; min?: number; max?: number; choices?: (string | number)[]
  locked?: boolean; help: string; drives: PrimaryDrive[]
}
export interface PrimaryGroup { group: string; title: string; fields: PrimaryField[] }
export type PrimaryValues = Record<string, number | string | boolean | null>
interface Payload { values: PrimaryValues; defaults: PrimaryValues; schema: PrimaryGroup[] }

const values = ref<PrimaryValues>({})
const defaults = ref<PrimaryValues>({})
const schema = shallowRef<PrimaryGroup[]>([])
const status = ref<'idle' | 'loading' | 'ready' | 'error' | 'signed-out'>('idle')
const error = ref('')
let inflight: Promise<void> | null = null

export function usePrimarySettings() {
  const auth = useAuth()
  const api = () => useNuxtApp().$api as typeof $fetch

  async function load(force = false) {
    if (!import.meta.client) return
    if (!auth.isAuthenticated.value) { status.value = 'signed-out'; return }
    if (status.value === 'ready' && !force) return
    if (inflight) return inflight
    status.value = 'loading'
    inflight = (async () => {
      try {
        const d = await api()<Payload>('/api/v1/settings/primary/')
        values.value = d.values; defaults.value = d.defaults; schema.value = d.schema
        status.value = 'ready'; error.value = ''
      } catch (e: any) {
        status.value = 'error'
        error.value = e?.data?.detail || "Couldn't load your settings."
      } finally { inflight = null }
    })()
    return inflight
  }

  /** Save one value (null = back to the default). Returns an error message, or '' when saved. */
  async function save(key: string, value: number | string | boolean | null): Promise<string> {
    try {
      const d = await api()<{ values: PrimaryValues; errors?: Record<string, string> }>('/api/v1/settings/primary/', { method: 'PATCH', body: { [key]: value } })
      values.value = d.values
      // the $api plugin may hand a 400 body back instead of throwing: never report "Saved" for a refusal
      if (d.errors && Object.keys(d.errors).length) return d.errors[key] || Object.values(d.errors)[0]
      return ''
    } catch (e: any) {
      return e?.data?.errors?.[key] || e?.data?.detail || "Couldn't save."
    }
  }

  return { values, defaults, schema, status, error, load, save }
}
