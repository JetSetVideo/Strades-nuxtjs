/**
 * Friends' predictions on one asset, hidden until the user asks to see them.
 *
 * The user's own call should be made before seeing anyone else's, so friends'
 * calls are never drawn by default. Revealing is per asset, shared by the card
 * and the detail page, and recorded on the user's next call (`sawFriendsFirst`).
 *
 * Friends = the demo personas the prediction seeds use + people marked as
 * friends in the community list. Demo friend calls come from
 * /data/predictions-friends.json (relative times and prices), materialised
 * once per browser against the asset's price and flagged `demo: true`.
 */
import { computed, reactive, type Ref } from 'vue'
import type { Asset } from '~/types/asset'
import { usePredictionsStore, type Prediction } from '~/stores/predictions'
import { publicAssetUrl } from '~/composables/useLocalJson'
import { HOUR, simPriceAt, priceKindOf, clamp, horizonById } from '~/utils/assetChart'
import { simSpecOf } from '~/composables/useAssetSeries'

export interface FriendProfile { id: string; name: string; avatar: string }

const PROFILES: Record<string, FriendProfile> = {
  kevin_scalper: { id: 'kevin_scalper', name: 'Kevin', avatar: 'https://i.pravatar.cc/64?u=kevin' },
  simon_trader: { id: 'simon_trader', name: 'Simon', avatar: 'https://i.pravatar.cc/64?u=simon' },
  arthuro_investor: { id: 'arthuro_investor', name: 'Arthuro', avatar: 'https://i.pravatar.cc/64?u=arthuro' },
  user_002: { id: 'user_002', name: 'Bob', avatar: '/avatars/Ellipse6.png' },
  user_003: { id: 'user_003', name: 'Sarah', avatar: '/avatars/Ellipse7.png' },
  user_007: { id: 'user_007', name: 'Lila', avatar: '/avatars/Ellipse5.png' },
}

/** Real friends known from the server (/api/v1/predictions/friends/), by `u_<uuid>` id. */
const remoteProfiles = reactive<Record<string, FriendProfile>>({})
/** Real friends' calls per asset, in memory only: other people's calls are never written to this device's storage. */
const remoteCalls = reactive<Record<string, Prediction[]>>({})

export function friendProfile(userId: string): FriendProfile {
  return PROFILES[userId] ?? remoteProfiles[userId] ?? {
    id: userId,
    name: (userId.split('_')[0] ?? userId).replace(/^\w/, c => c.toUpperCase()),
    avatar: `https://i.pravatar.cc/64?u=${encodeURIComponent(userId)}`,
  }
}

export function isFriend(userId: string): boolean {
  return userId in PROFILES || userId in remoteProfiles
}

interface ServerFriendCall {
  id: string; asset_symbol: string; timeframe: string; made_at: string; target_at: string
  horizon_hours: number; reference_price: number; predicted_price: number; predicted_change_pct: number
  direction: Prediction['direction']; confidence: number; note: string; status: string
  resolved_price: number | null; score: number | null
  user: { id: string; name: string; avatar_url: string | null }
}

/**
 * Fetch friends' real calls on one asset. Called only when the user REVEALS them: the server logs
 * that reveal (and whether the user had already called the asset), which is the bias signal of the
 * trading profile. Signed out, offline or no friends: nothing changes, the demo personas stay.
 */
async function loadRemote(sym: string, assetName: string) {
  const { isAuthenticated, accessToken } = useAuth()
  if (!isAuthenticated.value) return
  try {
    const res = await $fetch<{ results: ServerFriendCall[] }>('/api/v1/predictions/friends/', {
      baseURL: useRuntimeConfig().public.apiBase as string,
      query: { asset: sym },
      headers: { Authorization: `Bearer ${accessToken.value}` },
    })
    remoteCalls[sym] = (res.results ?? []).map((c) => {
      const uid = `u_${c.user.id}`
      remoteProfiles[uid] = { id: uid, name: c.user.name, avatar: c.user.avatar_url || `https://i.pravatar.cc/64?u=${encodeURIComponent(uid)}` }
      return {
        id: `srv_${c.id}`, userId: uid, assetId: sym, assetName,
        timestamp: c.made_at, currentPrice: c.reference_price, predictedPrice: c.predicted_price,
        predictedChangePct: c.predicted_change_pct, direction: c.direction, timeframe: c.timeframe,
        targetDate: c.target_at, targetTs: Date.parse(c.target_at), horizonHours: c.horizon_hours,
        confidence: c.confidence, note: c.note,
        status: (['pending', 'accurate', 'missed', 'expired'].includes(c.status) ? c.status : 'expired') as Prediction['status'],
        actualPrice: c.resolved_price ?? undefined, accuracyScore: c.score ?? undefined,
      }
    })
  } catch { /* the demo personas still answer */ }
}

/** Per-asset reveal switch, shared across components for the session. */
const revealed = reactive<Record<string, boolean>>({})

interface SeedRow {
  userId: string; assetId: string; ageHours: number; timeframe: string
  targetHours: number; predictedChangePct: number; confidence: number; note: string
}
let seedRows: SeedRow[] | null = null
let seedPromise: Promise<void> | null = null
const materialised = new Set<string>()

function loadSeeds(): Promise<void> {
  if (seedRows) return Promise.resolve()
  if (!seedPromise) {
    seedPromise = $fetch<{ predictions: SeedRow[] }>(publicAssetUrl('/data/predictions-friends.json'))
      .then((r) => { seedRows = r.predictions ?? [] })
      .catch(() => { seedRows = [] })
  }
  return seedPromise
}

function materialise(asset: Asset) {
  const sym = asset.symbol
  if (!sym || materialised.has(sym) || !seedRows) return
  materialised.add(sym)
  const store = usePredictionsStore()
  const spec = simSpecOf(asset)
  if (!spec || !(spec.current > 0)) return
  const kind = priceKindOf(asset)
  const now = Date.now()
  const rows = seedRows.filter(r => r.assetId.toUpperCase() === sym.toUpperCase())
  const list: Prediction[] = rows.map((r) => {
    const ts = now - r.ageHours * HOUR
    const target = ts + r.targetHours * HOUR
    const at = asset.live ? spec.current : simPriceAt(spec, r.ageHours)
    let predicted = at * (1 + r.predictedChangePct / 100)
    if (kind === 'probability') predicted = clamp(predicted, 0.001, 0.999)
    return {
      id: `pred_demo_${r.userId}_${sym}_${r.timeframe}`,
      userId: r.userId,
      assetId: sym,
      assetName: asset.name,
      timestamp: new Date(ts).toISOString(),
      currentPrice: at,
      predictedPrice: predicted,
      predictedChangePct: r.predictedChangePct,
      direction: r.predictedChangePct >= 0 ? 'bullish' : 'bearish',
      timeframe: r.timeframe,
      targetDate: new Date(target).toISOString(),
      targetTs: target,
      horizonHours: r.targetHours,
      confidence: r.confidence,
      note: r.note,
      status: 'pending',
      demo: true,
    }
  })
  // Demo calls that have resolved are replaced by fresh ones, so the demo never goes stale.
  const stale = new Set(store.predictions.filter(p => p.demo && p.assetId === sym && p.status !== 'pending').map(p => p.id))
  if (stale.size) store.predictions = store.predictions.filter(p => !stale.has(p.id))
  store.importPredictions(list)
}

/** Target instant of any prediction (old ones only stored a day). */
export function targetTsOf(p: Prediction): number {
  if (p.targetTs) return p.targetTs
  const t = Date.parse(p.targetDate)
  return Number.isFinite(t) ? t : Date.parse(p.timestamp) + horizonById(p.timeframe).hours * HOUR
}

export function useFriendPredictions(asset: Ref<Asset | null | undefined>, userId = 'current_user') {
  const store = usePredictionsStore()
  if (import.meta.client) {
    if (!store.initialized) store.init()
    loadSeeds().then(() => { if (asset.value) materialise(asset.value) })
  }

  const symbol = computed(() => asset.value?.symbol ?? '')

  /** Friends' calls still running, or resolved within the last 30 days. */
  const predictions = computed(() => {
    const cutoff = Date.now() - 30 * 24 * HOUR
    return [...store.predictions, ...(remoteCalls[symbol.value] ?? [])]
      .filter(p => p.assetId === symbol.value && p.userId !== userId && isFriend(p.userId))
      // old seed calls can still say "pending" years after their target: the date decides
      .filter(p => targetTsOf(p) >= cutoff)
      .sort((a, b) => targetTsOf(a) - targetTsOf(b))
  })

  /** One face per friend, most recent call first. */
  const faces = computed(() => {
    const seen = new Map<string, Prediction>()
    for (const p of [...predictions.value].sort((a, b) => b.timestamp.localeCompare(a.timestamp))) {
      if (!seen.has(p.userId)) seen.set(p.userId, p)
    }
    return [...seen.values()].map(p => ({ ...friendProfile(p.userId), direction: p.direction }))
  })

  const isRevealed = computed(() => !!revealed[symbol.value])
  function toggle() {
    const sym = symbol.value
    if (!sym) return
    revealed[sym] = !revealed[sym]
    if (revealed[sym] && import.meta.client) void loadRemote(sym, asset.value?.name ?? sym)
  }

  return { predictions, faces, isRevealed, toggle }
}
