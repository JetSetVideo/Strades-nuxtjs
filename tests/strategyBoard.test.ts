import { describe, expect, it } from 'vitest'
import { axisText, boardFrame, boardSeries, calendarLanes, monthTicks, spreadPoints } from '~/utils/strategyBoard'

const books = [
  {
    id: 'strategy_001',
    name: 'Mean Reversion BTC',
    category: 'crypto',
    risk_level: 'medium',
    target_assets: ['BTC'],
    total_return_percentage: 20,
    max_drawdown: 12,
    sharpe_ratio: 1.2,
    win_rate: 58,
    total_trades: 120,
    created_at: '2023-01-01',
    last_run: '2024-12-31',
    backtest_period: { start: '2023-01-01', end: '2024-12-31' },
  },
  {
    id: 'strategy_004',
    name: 'Gold Momentum Overlay',
    category: 'commodities',
    risk_level: 'low',
    target_assets: ['GOLD'],
    total_return_percentage: 4.1,
    max_drawdown: 2.1,
    sharpe_ratio: 1.74,
    win_rate: 65,
    total_trades: 16,
    created_at: '2026-04-10',
    last_run: '2026-05-30',
  },
]

describe('strategy board', () => {
  it('draws every book from its open to its recorded return', () => {
    const frame = boardFrame(boardSeries(books))
    expect(frame).not.toBeNull()
    expect(frame!.series).toHaveLength(2)
    const btc = frame!.series[0]!
    expect(btc.side.path[0]?.pct).toBe(0)
    expect(btc.side.path.at(-1)?.pct).toBe(20)
    expect(frame!.t0).toBeLessThan(frame!.t1)
  })

  it('spreads return against drawdown so the two books do not stack', () => {
    const points = spreadPoints(books, 'return', 'drawdown')
    expect(points[0]!.x).not.toBeCloseTo(points[1]!.x, 2)
    expect(points[0]!.y).not.toBeCloseTo(points[1]!.y, 2)
    expect(points[0]!.xValue).toBe(20)
    expect(points[1]!.yValue).toBe(2.1)
    expect(axisText('return', 20)).toBe('+20%')
    expect(axisText('return', -9.6)).toBe('−9.6%')
  })

  it('gives each book a lane inside the shared calendar', () => {
    const series = boardSeries(books)
    const calendar = calendarLanes(series)
    expect(calendar!.lanes).toHaveLength(2)
    for (const lane of calendar!.lanes) {
      expect(lane.start).toBeGreaterThanOrEqual(0)
      expect(lane.end).toBeLessThanOrEqual(1)
      expect(lane.end).toBeGreaterThan(lane.start)
      expect(lane.marks.length).toBeGreaterThan(0)
      expect(lane.marks.length).toBeLessThan(series.find(row => row.id === lane.id)!.side.path.length)
      expect(lane.marks.at(-1)!.along).toBeCloseTo(1, 5)
    }
    const btc = calendar!.lanes[0]!
    expect(btc.marks.some(mark => !mark.up)).toBe(true)
    expect(btc.marks.some(mark => mark.up)).toBe(true)
    const ticks = monthTicks(calendar!.t0, calendar!.t1)
    expect(ticks[0]!.label).toContain('’23')
    expect(ticks.at(-1)!.t).toBeGreaterThanOrEqual(Date.parse('2026-05-01'))
    expect(ticks.length).toBeLessThan(10)
  })
})