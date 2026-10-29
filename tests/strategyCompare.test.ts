import { describe, expect, it } from 'vitest'
import {
  compareSide, equipCall, returnPath, samplePath, sharedWindow, statRows, strategySpan,
} from '~/utils/strategyCompare'

const eth = {
  id: 'strategy_002',
  name: 'ETH/SOL Pair Reversion',
  category: 'crypto',
  target_assets: ['ETH', 'SOL'],
  total_return_percentage: 7.1,
  max_drawdown: 4.2,
  sharpe_ratio: 1.96,
  win_rate: 64,
  total_trades: 142,
  total_return: 318,
  current_capital: 4818,
  created_at: '2026-02-12',
  last_run: '2026-05-30',
}

const gold = {
  id: 'strategy_004',
  name: 'Gold Momentum Overlay',
  category: 'commodities',
  target_assets: ['GOLD'],
  total_return_percentage: 4.1,
  max_drawdown: 2.1,
  sharpe_ratio: 1.74,
  win_rate: 65,
  total_trades: 16,
  total_return: 285,
  current_capital: 7285,
  created_at: '2026-04-10',
  last_run: '2026-05-30',
}

describe('return path', () => {
  it('opens at zero, closes on the recorded return, and touches the drawdown', () => {
    const path = returnPath('strategy_002', Date.UTC(2026, 1, 12), Date.UTC(2026, 4, 30), 7.1, 4.2)
    expect(path[0]?.pct).toBe(0)
    expect(path[path.length - 1]?.pct).toBeCloseTo(7.1, 6)
    expect(Math.min(...path.map(point => point.pct))).toBeCloseTo(-4.2, 6)
    expect(path[0]!.t).toBeLessThan(path[path.length - 1]!.t)
  })

  it('does not sample outside the book', () => {
    const path = returnPath('a', 0, 10 * 86_400_000, 5, 1)
    expect(samplePath(path, -1)).toBeNull()
    expect(samplePath(path, 0)).toBe(0)
    expect(samplePath(path, 10 * 86_400_000)).toBe(5)
  })
})

describe('the two selected books', () => {
  const pair = compareSide(eth)
  const haven = compareSide(gold)

  it('names the transfer and the life of each book', () => {
    expect(pair.transfer).toBe('ETH → SOL')
    expect(haven.transfer).toBe('GOLD')
    expect(strategySpan(eth).start).toBe(Date.parse('2026-02-12T00:00:00Z'))
    expect(strategySpan(gold).end).toBe(Date.parse('2026-05-30T00:00:00Z'))
    expect(pair.end).toBeGreaterThan(haven.start)
  })

  it('measures the days both were open', () => {
    const shared = sharedWindow(haven, pair)
    expect(shared).not.toBeNull()
    expect(shared!.days).toBe(50)
    expect(Number.isFinite(shared!.equipped)).toBe(true)
    expect(Number.isFinite(shared!.candidate)).toBe(true)
  })

  it('equips the book that returned more, and keeps it when it is already in the slot', () => {
    const takeEth = equipCall(haven, pair)
    expect(takeEth.verb).toBe('equip')
    expect(takeEth.name).toBe('ETH/SOL Pair Reversion')
    const already = equipCall(pair, haven)
    expect(already.verb).toBe('keep')
    expect(already.name).toBe('ETH/SOL Pair Reversion')
  })

  it('colours the return gap on the book in hand', () => {
    const rows = statRows(haven, pair)
    const ret = rows.find(row => row.id === 'return')!
    expect(ret.gap).toBeCloseTo(3, 6)
    const dd = rows.find(row => row.id === 'drawdown')!
    expect(dd.gap).toBeCloseTo(2.1, 6)
    expect(dd.higherBetter).toBe(false)
  })
})
