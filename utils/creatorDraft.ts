/**
 * Reopen a strategy in the Creator (/creator?id=<id>).
 *
 * Two sources, best first:
 *  1. the Creator's own code payload kept in the strategies store (exact: blocks,
 *     sources, pool, variables as the user left them);
 *  2. the server copy (GET /api/strategies/<id>/): assets, frequency, entry rules and
 *     stop / take-profit only. The server stores the TRADED asset as `assets_entry`
 *     and the other side as `assets_exit`, so the flow is rebuilt as exit → entry
 *     (a buy). A sell flow (BTC → USD) saved on the server reopens as USD → BTC:
 *     the engine copy can't tell them apart (documented, see utils/strategyServer.ts).
 */
import type { CreatorCondition } from '~/utils/strategyServer'

export type CreatorDraftBlock = { type: 'condition' | 'action' | 'formula'; id: number; data: Record<string, unknown> }

export interface CreatorDraft {
  name: string
  description: string
  category: string
  dataSources: string[]
  assetFrom: string
  assetTo: string
  allocation: number
  pool: { id: string; op: 'include' | 'exclude' }[]
  frequency: string
  variables: { key: string; value: string }[]
  blocks: CreatorDraftBlock[]
  selectedProfiles: string[]
  period: { start: string | null; end: string | null }
}

const asArray = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : [])
const asString = (v: unknown, d = ''): string => (typeof v === 'string' ? v : d)

function varsToList(v: unknown): { key: string; value: string }[] {
  if (Array.isArray(v)) return v.filter(x => x && typeof x === 'object').map(x => ({ key: String((x as any).key ?? ''), value: String((x as any).value ?? '') }))
  if (v && typeof v === 'object') return Object.entries(v as Record<string, unknown>).map(([key, value]) => ({ key, value: String(value ?? '') }))
  return []
}

/** From the creator payload saved with the strategy (buildCodePayload in pages/creator.vue). */
export function draftFromCreatorCode(meta: { name?: string; description?: string; category?: string }, code: Record<string, unknown>, idSeed = 1): CreatorDraft {
  const assets = (code.assets ?? {}) as Record<string, unknown>
  const period = (code.period ?? {}) as Record<string, unknown>
  let id = idSeed
  const block = (type: CreatorDraftBlock['type']) => (data: unknown): CreatorDraftBlock => ({ type, id: id++, data: { ...(data as Record<string, unknown>) } })
  return {
    name: meta.name ?? asString(code.name),
    description: meta.description ?? '',
    category: meta.category || 'multi-asset',
    dataSources: asArray<string>(code.dataSources).map(String),
    assetFrom: asString(assets.from ?? assets.entry),
    assetTo: asString(assets.to ?? (assets.from === undefined ? assets.exit : '')),
    allocation: Number.isFinite(Number(assets.allocation)) ? Number(assets.allocation) : 50,
    pool: asArray<{ id: string; op: 'include' | 'exclude' }>(code.pool).filter(p => p && typeof p.id === 'string'),
    frequency: asString(code.frequency, '1D'),
    variables: varsToList(code.variables),
    blocks: [
      ...asArray<unknown>(code.conditions).filter(c => c && typeof c === 'object').map(block('condition')),
      ...asArray<unknown>(code.actions).filter(c => c && typeof c === 'object').map(block('action')),
      ...asArray<unknown>(code.formulas).filter(c => c && typeof c === 'object').map(block('formula')),
    ],
    selectedProfiles: asArray<string>(code.profiles).map(String),
    period: { start: asString(period.start) || null, end: asString(period.end) || null },
  }
}

const OP_BACK: Record<string, string> = { '>': 'gt', '<': 'lt', '>=': 'gte', '<=': 'lte', '==': 'eq', cross_over: 'crosses_up', cross_under: 'crosses_dn' }

/** Engine condition → creator IF block data. */
export function creatorConditionFromServer(c: Record<string, unknown>): CreatorCondition | null {
  const ind = asString(c.indicator).toUpperCase()
  const op = OP_BACK[asString(c.operator)]
  if (!ind || !op) return null
  const out: CreatorCondition = { indicator: ind, operator: op, value: 0, valueType: 'static', timeframe: asString(c.timeframe) || undefined }
  if (typeof c.period === 'number') out.indicatorParam = c.period
  if (typeof c.value === 'number') out.value = c.value
  else if (typeof c.value === 'string') {
    const [name, period] = c.value.split(':')
    out.valueType = 'indicator'
    out.valueIndicator = (name ?? '').toUpperCase()
    if (period && Number.isFinite(Number(period))) out.valueIndicatorParam = Number(period)
  }
  return out
}

/** From the server copy. Only the entry side is the user's rule (the exit is its negation). */
export function draftFromServer(s: {
  name: string; description?: string; category?: string; assets_entry: string; assets_exit?: string
  frequency?: string; conditions?: unknown[]; parameters?: Record<string, unknown>
}, idSeed = 1): CreatorDraft {
  let id = idSeed
  const rules = asArray<Record<string, unknown>>(s.conditions)
    .filter(c => c && typeof c === 'object' && (c.side ?? 'entry') === 'entry')
    .map(creatorConditionFromServer)
    .filter((c): c is CreatorCondition => c !== null)
  const p = s.parameters ?? {}
  const variables: { key: string; value: string }[] = []
  if (p.stop_loss !== undefined && p.stop_loss !== null) variables.push({ key: 'stop_loss', value: String(p.stop_loss) })
  if (p.take_profit !== undefined && p.take_profit !== null) variables.push({ key: 'take_profit', value: String(p.take_profit) })
  const size = Number(p.position_size)
  return {
    name: s.name, description: s.description ?? '', category: s.category || 'multi-asset', dataSources: [],
    assetFrom: (s.assets_exit || 'USD').toUpperCase(), assetTo: (s.assets_entry || '').toUpperCase(),
    allocation: Number.isFinite(size) && size > 0 ? Math.round(size * 100) : 50,
    pool: [], frequency: s.frequency || '1D', variables,
    blocks: rules.map(r => ({ type: 'condition' as const, id: id++, data: { ...r } })),
    selectedProfiles: [], period: { start: null, end: null },
  }
}
