/**
 * Pure mapping between the local predictions store and /api/v1/predictions/ (Strades-backend).
 * Used by plugins/predictionsSync.client.ts; tested in tests/predictionSync.test.ts.
 */
import type { Prediction } from '~/stores/predictions'

export const PREDICTION_OWNER = 'current_user'
const TIMEFRAMES = new Set(['1D', '1W', '1M', '3M', '6M', '1Y'])
const HOURS: Record<string, number> = { '1D': 24, '1W': 168, '1M': 720, '3M': 2160, '6M': 4368, '1Y': 8760 }

export interface ServerPrediction {
  id: string; client_id: string; asset_symbol: string; asset_type: string; timeframe: string
  made_at: string; target_at: string; horizon_hours: number; reference_price: number
  predicted_price: number; predicted_change_pct: number; direction: Prediction['direction']
  confidence: number; note: string; range_min: number | null; range_max: number | null
  range_position: number | null; saw_friends_first: boolean; status: string
  resolved_price: number | null; score: number | null; revision_count: number
}

/** Exact target instant of a local call (old calls only stored a day). */
export function predictionTargetTs(p: Pick<Prediction, 'targetTs' | 'targetDate' | 'timestamp' | 'timeframe'>): number {
  if (p.targetTs) return p.targetTs
  const t = Date.parse(p.targetDate)
  if (Number.isFinite(t)) return t
  return Date.parse(p.timestamp) + (HOURS[p.timeframe] ?? 24) * 3_600_000
}

/** Decimal string the API accepts (positive, <= 10 decimals), or null. */
export function apiDecimal(x: unknown): string | null {
  const n = Number(x)
  if (!Number.isFinite(n) || n <= 0) return null
  return n.toFixed(10).replace(/\.?0+$/, '')
}

/** What the server stores for a call: equal signatures = nothing to send. */
export function predictionSyncSignature(p: Prediction): string {
  return `${Number(p.predictedPrice)}|${predictionTargetTs(p)}|${p.note ?? ''}|${p.confidence ?? ''}`
}

/** The calls this device mirrors to the server: the user's own, pending, not demo, still ahead. */
export function isPredictionSyncable(p: Prediction, now = Date.now()): boolean {
  return p.userId === PREDICTION_OWNER && !p.demo && p.status === 'pending' && TIMEFRAMES.has(p.timeframe)
    && predictionTargetTs(p) > now + 5 * 60_000 && Number(p.predictedPrice) > 0 && Number(p.currentPrice) > 0
}

export function predictionToApi(p: Prediction): Record<string, unknown> {
  const body: Record<string, unknown> = {
    client_id: p.id,
    asset_symbol: p.assetId,
    timeframe: p.timeframe,
    made_at: p.timestamp,
    target_at: new Date(predictionTargetTs(p)).toISOString(),
    client_price: apiDecimal(p.currentPrice),
    predicted_price: apiDecimal(p.predictedPrice),
    confidence: Math.min(5, Math.max(1, Math.round(Number(p.confidence) || 3))),
    note: (p.note ?? '').slice(0, 280),
    saw_friends_first: !!p.sawFriendsFirst,
    source: p.source === 'detail' || p.source === 'legacy' ? p.source : 'card',
    chart_style: p.chartStyle ?? '',
    simulated_history: !!p.simulatedHistory,
  }
  const lo = apiDecimal(p.rangeMin)
  const hi = apiDecimal(p.rangeMax)
  if (lo && hi && Number(lo) < Number(hi)) { body.range_min = lo; body.range_max = hi }
  if (typeof p.rangePosition === 'number' && Number.isFinite(p.rangePosition)) body.range_position = Math.max(-1, Math.min(1, p.rangePosition))
  if (typeof p.friendsCountAtRecord === 'number' && Number.isFinite(p.friendsCountAtRecord)) {
    body.friends_count_at_record = Math.max(0, Math.min(10000, Math.round(p.friendsCountAtRecord)))
  }
  return body
}

export function predictionFromApi(c: ServerPrediction): Prediction {
  return {
    id: c.client_id, userId: PREDICTION_OWNER, assetId: c.asset_symbol, assetName: c.asset_symbol,
    timestamp: c.made_at, currentPrice: c.reference_price, predictedPrice: c.predicted_price,
    predictedChangePct: c.predicted_change_pct, direction: c.direction, timeframe: c.timeframe,
    targetDate: c.target_at, targetTs: Date.parse(c.target_at), horizonHours: c.horizon_hours,
    confidence: c.confidence, note: c.note,
    status: (c.status === 'withdrawn' ? 'expired' : c.status) as Prediction['status'],
    actualPrice: c.resolved_price ?? undefined, accuracyScore: c.score ?? undefined,
    rangeMin: c.range_min ?? undefined, rangeMax: c.range_max ?? undefined, rangePosition: c.range_position ?? undefined,
    sawFriendsFirst: c.saw_friends_first, assetType: c.asset_type,
  }
}
