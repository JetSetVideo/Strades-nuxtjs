/** Live book totals for the strategies page. One pass over the canonical list. */

export interface DeskStrategy {
  id: string
  name: string
  status: string
  current_capital?: number
  total_return?: number
  total_return_percentage?: number
  win_rate?: number
}

export interface DeskName {
  id: string
  name: string
  pct: number
}

export interface DeskSnapshot {
  active: number
  paused: number
  stopped: number
  capital: number
  pnl: number
  winRate: number
  best: DeskName | null
  worst: DeskName | null
}

export function strategyDesk(list: readonly DeskStrategy[]): DeskSnapshot {
  let active = 0
  let paused = 0
  let stopped = 0
  let capital = 0
  let pnl = 0
  let winSum = 0
  let winN = 0
  let best: DeskName | null = null
  let worst: DeskName | null = null

  for (const s of list) {
    if (s.status === 'active') active++
    else if (s.status === 'paused') paused++
    else if (s.status === 'stopped') stopped++
    capital += s.current_capital ?? 0
    pnl += s.total_return ?? 0
    if (typeof s.win_rate === 'number') { winSum += s.win_rate; winN++ }
    const pct = s.total_return_percentage ?? 0
    const row = { id: s.id, name: s.name, pct }
    if (!best || pct > best.pct) best = row
    if (!worst || pct < worst.pct) worst = row
  }

  if (best && worst && best.id === worst.id) worst = null

  return {
    active, paused, stopped, capital, pnl,
    winRate: winN ? winSum / winN : 0,
    best, worst,
  }
}
