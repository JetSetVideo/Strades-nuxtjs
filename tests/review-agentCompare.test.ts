import { describe, expect, it } from 'vitest'
import { agentCompareColumns, agentStatusLabel, toggleCompareIds, COMPARE_MAX } from '~/stores/agents'

// REVIEW-15 (compare tray) + REVIEW-16 (no "LIVE" in the paper-only MVP).
describe('agents compare tray helpers', () => {
  it('⇄ adds, removes, and keeps at most 3 (drops the oldest)', () => {
    let ids: string[] = []
    ids = toggleCompareIds(ids, 'a')
    ids = toggleCompareIds(ids, 'b')
    expect(ids).toEqual(['a', 'b']) // 2 clicks → 2 columns
    ids = toggleCompareIds(ids, 'c')
    ids = toggleCompareIds(ids, 'd')
    expect(ids).toEqual(['b', 'c', 'd'])
    expect(ids.length).toBe(COMPARE_MAX)
    expect(toggleCompareIds(ids, 'c')).toEqual(['b', 'd'])
    expect(toggleCompareIds(ids, '')).toEqual(ids)
  })

  it('columns print PnL / Sharpe / Win / DD, "—" when missing', () => {
    const cols = agentCompareColumns([
      { id: 'a', name: 'Hawk', performance: { live_pnl_pct: 12.44, sharpe: 1.416, win_rate: 0.61, max_drawdown_pct: -8.3, trades_total: 312 }, training_state: { status: 'live' } as any },
      { id: 'b', name: 'Bare', performance: null, training_state: null },
      null,
    ])
    expect(cols).toHaveLength(2)
    expect(cols[0]).toMatchObject({ pnl: '+12.4%', sharpe: '1.42', win: '61%', dd: '-8.3%', trades: '312', status: 'Simulated' })
    expect(cols[1]).toMatchObject({ pnl: '—', sharpe: '—', win: '—', dd: '—', trades: '—', status: '—' })
  })

  it('status label never says LIVE', () => {
    expect(agentStatusLabel('live')).toBe('Simulated')
    expect(agentStatusLabel('LIVE')).toBe('Simulated')
    expect(agentStatusLabel('training')).toBe('Training')
    expect(agentStatusLabel(undefined)).toBe('—')
  })
})
