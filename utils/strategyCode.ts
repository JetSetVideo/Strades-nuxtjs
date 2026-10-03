import type { Strategy, StrategyCondition } from '~/types/strategy'

/**
 * Creator-shaped view of a canonical Strategy.
 * `public/data/strategies/codes/*.json` is a legacy file set (strategy_001 there
 * is "BTC Momentum", owned by user_simon). The catalog in core/strategies.json
 * is the source of truth — CodeView and generated complements read this shape.
 */
export interface StrategyCodeViewModel {
  id: string
  name: string
  description: string
  category: string
  assetFrom: string
  assetTo: string
  allocation: number | null
  frequency: string
  period: { start: string; end: string }
  dataSources: string[]
  conditions: Array<{
    indicator: string
    operator?: string
    value?: string | number | boolean
    timeframe: string
  }>
  actions: Array<{ type: string; allocation?: number; timing?: string }>
  profiles: string[]
  variables: Record<string, string | number>
}

export interface CanonicalStrategyCode {
  id: string
  name: string
  assets: { entry: string; exit: string }
  period: { start: string; end: string }
  frequency: string
  conditions: Array<Record<string, unknown> & { operator?: string }>
  profiles: string[]
  parameters: Record<string, unknown>
  rights: { owners: string[]; editors: string[]; viewers: string[]; is_public: boolean }
}

function frequencyFromDuration(raw: string | undefined): string {
  const value = (raw ?? '').trim().toLowerCase()
  if (!value) return '1D'
  if (value.endsWith('m') && !value.endsWith('mo')) return '15m'
  if (value.endsWith('h')) return '1h'
  if (value.endsWith('w')) return '1W'
  return '1D'
}

function conditionRow(c: StrategyCondition, side: 'entry' | 'exit') {
  return {
    indicator: c.indicator,
    operator: c.condition,
    value: c.value,
    timeframe: c.timeframe || '1D',
    side,
  }
}

export function strategyToStrategyCode(strategy: Strategy): CanonicalStrategyCode {
  const targets = (strategy.target_assets ?? []).filter(Boolean)
  const entry = targets[0] ?? ''
  const exit = targets[1] ?? (entry ? 'USD' : '')
  const declared = [
    ...(strategy.entry_conditions ?? []).map(c => conditionRow(c, 'entry')),
    ...(strategy.exit_conditions ?? []).map(c => conditionRow(c, 'exit')),
  ]
  const conditions = declared.length
    ? declared
    : (strategy.indicators ?? []).map(indicator => ({
        indicator,
        timeframe: '1D',
        side: 'indicator' as const,
      }))

  const agentId = strategy.agent_id
  return {
    id: strategy.id,
    name: strategy.name,
    assets: { entry, exit },
    period: {
      start: strategy.backtest_period?.start ?? '',
      end: strategy.backtest_period?.end ?? '',
    },
    frequency: frequencyFromDuration(strategy.average_trade_duration),
    conditions,
    profiles: agentId ? [agentId] : [],
    parameters: {
      risk_level: strategy.risk_level,
      indicators: strategy.indicators ?? [],
    },
    rights: {
      owners: strategy.creator_id ? [strategy.creator_id] : [],
      editors: [],
      viewers: [],
      is_public: strategy.is_public,
    },
  }
}

export function strategyToCodeView(strategy: Strategy): StrategyCodeViewModel {
  const code = strategyToStrategyCode(strategy)
  const variables: Record<string, string | number> = {}
  if (strategy.risk_level) variables.risk_level = strategy.risk_level
  if (Number.isFinite(strategy.win_rate)) variables.win_rate = strategy.win_rate
  if (Number.isFinite(strategy.sharpe_ratio)) variables.sharpe_ratio = strategy.sharpe_ratio

  return {
    id: strategy.id,
    name: strategy.name,
    description: strategy.description,
    category: strategy.category,
    assetFrom: code.assets.entry,
    assetTo: code.assets.exit,
    allocation: null,
    frequency: code.frequency,
    period: code.period,
    dataSources: strategy.indicators ?? [],
    conditions: code.conditions.map(c => ({
      indicator: String(c.indicator ?? ''),
      operator: typeof c.operator === 'string' ? c.operator : undefined,
      value: c.value as string | number | boolean | undefined,
      timeframe: String(c.timeframe ?? '1D'),
    })),
    actions: (strategy.exit_conditions ?? []).map(c => ({
      type: 'exit',
      timing: c.timeframe || '1D',
    })),
    profiles: code.profiles,
    variables,
  }
}
