import { describe, expect, it } from 'vitest'
import { strategyDesk } from '~/utils/strategyDesk'

describe('strategyDesk', () => {
  it('sums the book and names the best and worst', () => {
    const desk = strategyDesk([
      { id: 'a', name: 'Alpha', status: 'active', current_capital: 1000, total_return: 100, total_return_percentage: 10, win_rate: 60 },
      { id: 'b', name: 'Beta', status: 'paused', current_capital: 500, total_return: -40, total_return_percentage: -8, win_rate: 40 },
      { id: 'c', name: 'Gamma', status: 'stopped', current_capital: 0, total_return: 0, total_return_percentage: 0, win_rate: 50 },
    ])
    expect(desk.active).toBe(1)
    expect(desk.paused).toBe(1)
    expect(desk.stopped).toBe(1)
    expect(desk.capital).toBe(1500)
    expect(desk.pnl).toBe(60)
    expect(desk.winRate).toBe(50)
    expect(desk.best?.name).toBe('Alpha')
    expect(desk.worst?.name).toBe('Beta')
  })

  it('does not repeat a single strategy as both best and worst', () => {
    const desk = strategyDesk([
      { id: 'a', name: 'Only', status: 'active', total_return_percentage: 4 },
    ])
    expect(desk.best?.name).toBe('Only')
    expect(desk.worst).toBeNull()
  })
})
