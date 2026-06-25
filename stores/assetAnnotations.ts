import { defineStore } from 'pinia'

export type AnnotationKind = 'trendline' | 'level' | 'note'

export interface Annotation {
  id: string
  asset_id: string
  kind: AnnotationKind
  created_at: number
  // Coordinates are price-space for levels/trendlines (so the line follows the chart)
  price_a?: number  // primary price (level uses just price_a)
  price_b?: number  // secondary price (trendline)
  time_a_idx?: number  // candle index (0..n-1) for trendline
  time_b_idx?: number
  label?: string
  color?: string
}

export type TriggerKind = 'cross_above' | 'cross_below'
export type TriggerStatus = 'armed' | 'triggered' | 'cancelled'

export interface PriceTrigger {
  id: string
  asset_id: string
  kind: TriggerKind
  target_price: number
  current_price_at_creation: number
  note?: string
  status: TriggerStatus
  created_at: number
  triggered_at?: number
}

export interface AssetTag {
  id: string
  asset_id: string
  label: string
  created_at: number
}

export interface AssetAnnotationsState {
  annotationsById: Record<string, Annotation>
  triggersById: Record<string, PriceTrigger>
  tagsById: Record<string, AssetTag>
  hydrated: boolean
}

const STORAGE_KEY = 'strades.assetAnnotations.v1'

const nextId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

function loadFromStorage(): Partial<AssetAnnotationsState> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

function saveToStorage(state: AssetAnnotationsState) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      annotationsById: state.annotationsById,
      triggersById: state.triggersById,
      tagsById: state.tagsById
    }))
  } catch { /* quota — ignore */ }
}

export const useAssetAnnotationsStore = defineStore('assetAnnotations', {
  state: (): AssetAnnotationsState => ({
    annotationsById: {},
    triggersById: {},
    tagsById: {},
    hydrated: false
  }),
  actions: {
    hydrateFromStorage() {
      const loaded = loadFromStorage()
      this.$patch({
        annotationsById: loaded.annotationsById ?? {},
        triggersById: loaded.triggersById ?? {},
        tagsById: loaded.tagsById ?? {},
        hydrated: true
      })
    },
    addAnnotation(a: Omit<Annotation, 'id' | 'created_at'>) {
      const ann: Annotation = { ...a, id: nextId('ann'), created_at: Date.now() }
      this.annotationsById[ann.id] = ann
      saveToStorage(this.$state)
      return ann
    },
    removeAnnotation(id: string) {
      delete this.annotationsById[id]
      saveToStorage(this.$state)
    },
    addTrigger(t: Omit<PriceTrigger, 'id' | 'created_at' | 'status'>) {
      const trig: PriceTrigger = { ...t, id: nextId('trg'), status: 'armed', created_at: Date.now() }
      this.triggersById[trig.id] = trig
      saveToStorage(this.$state)
      return trig
    },
    removeTrigger(id: string) {
      delete this.triggersById[id]
      saveToStorage(this.$state)
    },
    fireTrigger(id: string) {
      const t = this.triggersById[id]
      if (!t) return
      t.status = 'triggered'
      t.triggered_at = Date.now()
      saveToStorage(this.$state)
    },
    addTag(asset_id: string, label: string) {
      const tag: AssetTag = { id: nextId('tag'), asset_id, label, created_at: Date.now() }
      this.tagsById[tag.id] = tag
      saveToStorage(this.$state)
      return tag
    },
    removeTag(id: string) {
      delete this.tagsById[id]
      saveToStorage(this.$state)
    },
    /** Walk all armed triggers and fire any whose target has been crossed. */
    evaluatePrice(asset_id: string, current_price: number) {
      const fired: PriceTrigger[] = []
      Object.values(this.triggersById).forEach(t => {
        if (t.asset_id !== asset_id || t.status !== 'armed') return
        const wasBelow = t.current_price_at_creation < t.target_price
        const wasAbove = t.current_price_at_creation > t.target_price
        if (t.kind === 'cross_above' && wasBelow && current_price >= t.target_price) {
          this.fireTrigger(t.id); fired.push({ ...t, status: 'triggered' })
        } else if (t.kind === 'cross_below' && wasAbove && current_price <= t.target_price) {
          this.fireTrigger(t.id); fired.push({ ...t, status: 'triggered' })
        }
      })
      return fired
    }
  },
  getters: {
    annotationsByAsset: (s) => (asset_id: string) =>
      Object.values(s.annotationsById).filter(a => a.asset_id === asset_id),
    triggersByAsset: (s) => (asset_id: string) =>
      Object.values(s.triggersById).filter(t => t.asset_id === asset_id),
    tagsByAsset: (s) => (asset_id: string) =>
      Object.values(s.tagsById).filter(t => t.asset_id === asset_id),
    armedTriggerCount: (s) =>
      Object.values(s.triggersById).filter(t => t.status === 'armed').length
  }
})
