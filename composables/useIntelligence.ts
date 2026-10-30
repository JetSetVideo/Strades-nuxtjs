/**
 * useIntelligence — the only place /insights gets its data from.
 *
 * Server (client-side, Bearer via $api): GET /api/v1/intelligence/me/, /relations/<id>/, /compare/<user>/,
 * /users/<id>/, /hierarchy/, /similar/ (throttle scope 'intelligence', 60/min), POST /refresh/ (throttled 12/hour). Formatting and maths live in
 * utils/intelligence.ts; this file only fetches, caches and tracks status.
 */
import { computed, ref, shallowRef } from 'vue'
import {
  splitRelations,
  type HierarchyPayload, type IntelMePayload, type IntelRefreshPayload, type IntelRelationDetail, type IntelUserPayload,
} from '~/utils/intelligence'
import type { IntelEntourage, IntelMePayloadV2, IntelSpacePayload } from '~/utils/intelligenceV2'
import type { IntelSimilarPayload } from '~/utils/intelligenceV3'

export type IntelStatus = 'idle' | 'loading' | 'ready' | 'error' | 'signed-out'

const DETAIL_TTL = 5 * 60_000
/** /space/ is throttled (60/min): one fetch per (x, y) pair per 10 minutes, shared across instances. */
const SPACE_TTL = 10 * 60_000
const spaceCache = new Map<string, { at: number; data: IntelSpacePayload }>()
/** Shared across instances: relation details are heavy and rarely change between pipeline runs. */
const detailCache = new Map<string, { at: number; data: IntelRelationDetail }>()
/**
 * me/ and entourage/ are read by the profile section and /insights; a page that re-mounts while the auth
 * state settles used to fire each request twice. One in-flight promise per URL, reused for SHARED_TTL.
 */
const SHARED_TTL = 30_000
const shared = new Map<string, { at: number; p: Promise<unknown> }>()
function once<T>(key: string, fetcher: () => Promise<T>, force = false): Promise<T> {
  const hit = shared.get(key)
  if (hit && !force && Date.now() - hit.at < SHARED_TTL) return hit.p as Promise<T>
  const p = fetcher()
  shared.set(key, { at: Date.now(), p })
  p.catch(() => shared.delete(key))         // never cache a failure
  return p
}

function errMessage(e: any, fallback: string): string {
  const code = e?.statusCode ?? e?.status ?? e?.response?.status
  if (code === 429) return 'Re-analysis is limited to 12 runs an hour. Try again a little later.'
  if (code === 404) return e?.data?.detail && e.data.detail !== 'Not found.' ? e.data.detail : 'Not available to you (or not measured yet).'
  if (code === 401) return 'Your session expired. Sign in again.'
  return e?.data?.detail || e?.message || fallback
}

export function useIntelligence() {
  const auth = useAuth()

  const me = shallowRef<IntelMePayload | null>(null)
  const status = ref<IntelStatus>('idle')
  const error = ref<string | null>(null)

  const refreshing = ref(false)
  const refreshError = ref<string | null>(null)
  const refreshedAt = ref<number | null>(null)

  /** The relation (or compare result) shown in the detail panel. */
  const selectedId = ref<string | null>(null)
  const detail = shallowRef<IntelRelationDetail | null>(null)
  const detailStatus = ref<IntelStatus>('idle')
  const detailError = ref<string | null>(null)
  /** set when the detail came from /compare/<userId>/ */
  const compareUserId = ref<string | null>(null)

  const hierarchy = shallowRef<HierarchyPayload | null>(null)
  const hierarchyStatus = ref<IntelStatus>('idle')
  const hierarchyError = ref<string | null>(null)

  let seq = 0
  let detailSeq = 0

  const api = () => useNuxtApp().$api as typeof $fetch
  const signedIn = () => {
    if (!import.meta.client) return false
    if (!auth.isAuthenticated.value) return false
    return true
  }

  async function load(force = false) {
    if (!import.meta.client) return
    if (!signedIn()) { status.value = 'signed-out'; return }
    const mine = ++seq
    if (!me.value) status.value = 'loading'
    error.value = null
    try {
      const data = await once(`me:${auth.user.value?.id ?? ''}`, () => api()<IntelMePayload>('/api/v1/intelligence/me/'), force)
      if (mine !== seq) return
      me.value = { ...data, relations: data.relations ?? [] }
      status.value = 'ready'
    } catch (e: any) {
      if (mine !== seq) return
      error.value = errMessage(e, 'Insights could not be loaded')
      status.value = 'error'
    }
  }

  /** POST /refresh/: recompute the user (and their neighbours) now, then reload relations. */
  async function refresh() {
    if (!signedIn() || refreshing.value) return
    refreshing.value = true
    refreshError.value = null
    try {
      const data = await api()<IntelRefreshPayload>('/api/v1/intelligence/refresh/', { method: 'POST' })
      if (me.value) me.value = { ...me.value, profile: data.profile ?? me.value.profile, directive: data.directive ?? me.value.directive }
      refreshedAt.value = Date.now()
      detailCache.clear()
      spaceCache.clear()
      shared.clear()
      await load(true)
      if (selectedId.value) {
        if (compareUserId.value) await compareWith(compareUserId.value)
        else await loadRelation(selectedId.value)
      }
    } catch (e: any) {
      refreshError.value = errMessage(e, 'Re-analysis failed')
    } finally {
      refreshing.value = false
    }
  }

  async function fetchDetail(key: string, url: string, force = false) {
    const hit = detailCache.get(key)
    if (!force && hit && Date.now() - hit.at < DETAIL_TTL) return hit.data
    const data = await api()<IntelRelationDetail>(url)
    detailCache.set(key, { at: Date.now(), data })
    if (data?.id && key !== data.id) detailCache.set(data.id, { at: Date.now(), data })
    return data
  }

  async function loadRelation(id: string, force = false) {
    if (!signedIn() || !id) return
    const mine = ++detailSeq
    selectedId.value = id
    compareUserId.value = null
    detailError.value = null
    const cached = detailCache.get(id)
    if (cached && !force && Date.now() - cached.at < DETAIL_TTL) {
      detail.value = cached.data
      detailStatus.value = 'ready'
      return
    }
    detailStatus.value = 'loading'
    try {
      const data = await fetchDetail(id, `/api/v1/intelligence/relations/${encodeURIComponent(id)}/`, force)
      if (mine !== detailSeq) return
      detail.value = data
      detailStatus.value = 'ready'
    } catch (e: any) {
      if (mine !== detailSeq) return
      detail.value = null
      detailError.value = errMessage(e, 'This relation could not be loaded')
      detailStatus.value = 'error'
    }
  }

  /** GET /compare/<userId>/: the pair between me and that user (computed on demand server-side). */
  async function compareWith(userId: string) {
    if (!signedIn() || !userId) return
    const mine = ++detailSeq
    compareUserId.value = userId
    detailError.value = null
    detailStatus.value = 'loading'
    try {
      const data = await fetchDetail(`compare:${userId}`, `/api/v1/intelligence/compare/${encodeURIComponent(userId)}/`)
      if (mine !== detailSeq) return
      detail.value = data
      selectedId.value = data?.id ?? null
      detailStatus.value = 'ready'
    } catch (e: any) {
      if (mine !== detailSeq) return
      detail.value = null
      selectedId.value = null
      detailError.value = errMessage(e, 'Comparison not available')
      detailStatus.value = 'error'
    }
  }

  function clearSelection() {
    detailSeq++
    selectedId.value = null
    compareUserId.value = null
    detail.value = null
    detailStatus.value = 'idle'
    detailError.value = null
  }

  async function loadHierarchy(force = false) {
    if (!signedIn()) { hierarchyStatus.value = 'signed-out'; return }
    if (hierarchy.value && !force) return
    hierarchyStatus.value = 'loading'
    hierarchyError.value = null
    try {
      hierarchy.value = await api()<HierarchyPayload>('/api/v1/intelligence/hierarchy/')
      hierarchyStatus.value = 'ready'
    } catch (e: any) {
      hierarchyError.value = errMessage(e, 'The community hierarchy could not be loaded')
      hierarchyStatus.value = 'error'
    }
  }

  /** GET /users/<id>/: someone else's public profile (no advice/weaknesses). null when not allowed. */
  async function loadUser(userId: string): Promise<IntelUserPayload | null> {
    if (!signedIn() || !userId) return null
    try {
      return await api()<IntelUserPayload>(`/api/v1/intelligence/users/${encodeURIComponent(userId)}/`)
    } catch {
      return null
    }
  }

  // ── v2: community space (/space/) and entourage (/entourage/) — profile mirror ──

  const space = shallowRef<IntelSpacePayload | null>(null)
  const spaceStatus = ref<IntelStatus>('idle')
  const spaceError = ref<string | null>(null)
  let spaceSeq = 0

  /** GET /space/?x=&y= (throttled 60/min server-side): cached per (x, y) for SPACE_TTL, shared across instances. */
  async function loadSpace(x: string, y: string, force = false): Promise<IntelSpacePayload | null> {
    if (!signedIn()) { spaceStatus.value = 'signed-out'; return null }
    const key = `${x}|${y}`
    const mine = ++spaceSeq
    const hit = spaceCache.get(key)
    if (!force && hit && Date.now() - hit.at < SPACE_TTL) {
      space.value = hit.data
      spaceStatus.value = 'ready'
      spaceError.value = null
      return hit.data
    }
    spaceStatus.value = 'loading'
    spaceError.value = null
    try {
      const data = await api()<IntelSpacePayload>(`/api/v1/intelligence/space/?x=${encodeURIComponent(x)}&y=${encodeURIComponent(y)}`)
      spaceCache.set(key, { at: Date.now(), data })
      if (mine !== spaceSeq) return data
      space.value = data
      spaceStatus.value = 'ready'
      return data
    } catch (e: any) {
      if (mine !== spaceSeq) return null
      spaceError.value = e?.statusCode === 429 || e?.status === 429 ? 'Too many map requests in a minute. Wait a moment and pick again.' : errMessage(e, 'The map could not be loaded')
      spaceStatus.value = 'error'
      return null
    }
  }

  const entourage = shallowRef<IntelEntourage | null>(null)
  const entourageStatus = ref<IntelStatus>('idle')
  const entourageError = ref<string | null>(null)

  async function loadEntourage(force = false) {
    if (!signedIn()) { entourageStatus.value = 'signed-out'; return }
    if (entourage.value && !force) return
    entourageStatus.value = 'loading'
    entourageError.value = null
    try {
      entourage.value = await once(`entourage:${auth.user.value?.id ?? ''}`, () => api()<IntelEntourage>('/api/v1/intelligence/entourage/'), force)
      entourageStatus.value = 'ready'
    } catch (e: any) {
      entourageError.value = errMessage(e, 'Your entourage could not be loaded')
      entourageStatus.value = 'error'
    }
  }

  // ── v3: people who behave like you (/similar/, throttled 60/min — one fetch per page view, deduped per user) ──

  const similar = shallowRef<IntelSimilarPayload | null>(null)
  const similarStatus = ref<IntelStatus>('idle')
  const similarError = ref<string | null>(null)

  async function loadSimilar(force = false) {
    if (!signedIn()) { similarStatus.value = 'signed-out'; return }
    if (similar.value && !force) return
    similarStatus.value = 'loading'
    similarError.value = null
    try {
      const data = await once(`similar:${auth.user.value?.id ?? ''}`, () => api()<IntelSimilarPayload>('/api/v1/intelligence/similar/?k=8'), force)
      similar.value = { ...data, results: data?.results ?? [] }
      similarStatus.value = 'ready'
    } catch (e: any) {
      const code = e?.statusCode ?? e?.status ?? e?.response?.status
      similarError.value = code === 429 ? 'Too many requests in a minute. Wait a moment and retry.' : errMessage(e, 'People like you could not be loaded')
      similarStatus.value = 'error'
    }
  }

  /** me/ payload seen through the v2 types (profile.space/truth/… + top-level community). */
  const meV2 = computed(() => me.value as IntelMePayloadV2 | null)
  const community = computed(() => meV2.value?.community ?? null)
  const profileV2 = computed(() => meV2.value?.profile ?? null)

  const profile = computed(() => me.value?.profile ?? null)
  const directive = computed(() => me.value?.directive ?? null)
  const relations = computed(() => me.value?.relations ?? [])
  const split = computed(() => splitRelations(relations.value))
  const lastRun = computed(() => me.value?.last_run ?? null)

  return {
    me, status, error, profile, directive, relations, pairs: computed(() => split.value.pairs), groups: computed(() => split.value.groups), lastRun,
    refreshing, refreshError, refreshedAt,
    selectedId, detail, detailStatus, detailError, compareUserId,
    hierarchy, hierarchyStatus, hierarchyError,
    load, refresh, loadRelation, compareWith, clearSelection, loadHierarchy, loadUser,
    community, profileV2, space, spaceStatus, spaceError, loadSpace, entourage, entourageStatus, entourageError, loadEntourage,
    similar, similarStatus, similarError, loadSimilar,
  }
}
