import { describe, expect, it } from 'vitest'
import { drillable, findPath, headline } from '~/utils/valueTree'
import { STRAT_IDS, STRAT_RETURN_FORMULA, stratSettings, strategyReturnTree, type StratRunLike } from '~/utils/strategyTree'

const SETTINGS = { starting_capital: 10000, fee_bps: 10, slippage_bps: 5, benchmark: 'BTC' }

// A real-shaped result (rules_backtest.py): capital 10,000 → equity 10,523.4, 3 closed trades.
const RUN: StratRunLike = {
  capital: 10000,
  equity: 10523.4,
  equity_curve: [{ ts: 1, equity: 10000 }, { ts: 2, equity: 10523.4 }],
  trades: [{ pnl: 300 }, { pnl: -120.5 }, { pnl: 360 }],
  metrics: { return_pct: 5.234, trades: 3, win_rate: 66.67, fees: 61.2 },
  benchmark: { buy_hold_pct: 8.1 },
  window: { symbol: 'BTCUSDT', bars: 500 },
  assumptions: { capital_usd: 10000, fee_bps: 10, slippage_bps: 5, source: 'settings/primary' },
}

const ids = (n: { id: string; inputs?: any[] }): string[] => [n.id, ...(n.inputs ?? []).flatMap(ids)]

describe('strategyTree — "Strategy return"', () => {
  it('the return equals (final equity − capital) / capital, from the same result', () => {
    const t = strategyReturnTree({ run: RUN, settings: SETTINGS })
    expect(t.formula).toBe(STRAT_RETURN_FORMULA)
    const cap = t.inputs!.find(i => i.id === STRAT_IDS.capital)!.value as number
    const eq = t.inputs!.find(i => i.id === STRAT_IDS.equity)!.value as number
    expect(((eq - cap) / cap) * 100).toBeCloseTo(t.value as number, 3)
    expect(headline(t)).toEqual({ text: '+5.2%', muted: '' })
    expect(t.inputs!.map(i => i.label)).toEqual([
      'Starting capital', 'Final equity', 'Closed trades', 'Fees paid', 'Slippage assumption', 'Buy & hold BTC (comparison)',
    ])
    expect(t.settings!.map(s => s.href)).toEqual([
      '/settings#set-starting_capital', '/settings#set-fee_bps', '/settings#set-slippage_bps', '/settings#set-benchmark',
    ])
  })

  it('inputs carry the run assumptions and the settings that drive them', () => {
    const t = strategyReturnTree({ run: RUN, settings: SETTINGS })
    const fees = findPath(t, STRAT_IDS.feeBps)
    expect(fees.map(n => n.label)).toEqual(['Strategy return', 'Fees paid', 'Fee per side'])
    expect(headline(fees[2]).text).toBe('10 bps')
    expect(headline(findPath(t, STRAT_IDS.fees)[1]).text).toBe('$61.20')
    expect(headline(findPath(t, STRAT_IDS.slippage)[1]).text).toBe('5 bps')
    expect(findPath(t, STRAT_IDS.closedPnl).at(-1)!.value).toBeCloseTo(539.5, 6)
    expect(headline(findPath(t, STRAT_IDS.winRate).at(-1)!).text).toBe('66.7%')
    const bh = findPath(t, STRAT_IDS.buyHold).at(-1)!
    expect(headline(bh).text).toBe('+8.1%')
    expect(bh.explain).toContain('worse by 2.9 points')
    expect(bh.settings!.map(s => s.key)).toEqual(['benchmark'])
  })

  it('a setting changed since the run marks the capital stale with the new value', () => {
    const t = strategyReturnTree({ run: RUN, settings: { ...SETTINGS, starting_capital: 5000 } })
    const cap = t.inputs![0]
    expect(cap.status).toBe('stale')
    expect(headline(cap)).toEqual({ text: '$10,000.00', muted: 'Your setting is now $5,000.00: re-run to use it.' })
  })

  it('zero trades: still drillable, win rate "—" with a reason, P&L 0', () => {
    const t = strategyReturnTree({ run: { ...RUN, trades: [], equity: 10000, metrics: { return_pct: 0, trades: 0, win_rate: null, fees: 0 } }, settings: SETTINGS })
    expect(drillable(t)).toBe(true)
    expect(headline(t).text).toBe('0.0%')
    const trades = t.inputs!.find(i => i.id === STRAT_IDS.trades)!
    expect(trades.value).toBe(0)
    expect(headline(trades)).toEqual({ text: '0', muted: 'Your entry rule never held in this window: nothing was tested.' })
    expect(t.inputs!.find(i => i.id === STRAT_IDS.buyHold)!.explain).toMatch(/never traded here/)
    expect(headline(trades.inputs![0])).toEqual({ text: '—', muted: 'No closed trade: nothing to score.' })
    expect(trades.inputs![1].value).toBe(0)
  })

  it('saved summary (no curve, no trades, no assumptions): derives equity, says what is missing', () => {
    const t = strategyReturnTree({ run: { capital: 0, equity: 0, metrics: { return_pct: 5.234, trades: 3, win_rate: 66.67, fees: 61.2 }, benchmark: { buy_hold_pct: 8.1 }, window: { symbol: 'ETHUSDT' } }, settings: SETTINGS })
    expect(t.value).toBe(5.234)
    expect(headline(t.inputs![0]).muted).toMatch(/re-run/)
    expect(t.inputs![1].value).toBeNull()
    expect(t.inputs![2].inputs![1].value).toBeNull()
    // with the capital kept by the server summary, equity is derived (computed source)
    const t2 = strategyReturnTree({ run: { capital: 10000, equity: 0, metrics: { return_pct: 5.234, trades: 3 } }, settings: SETTINGS })
    expect(t2.inputs![1].value).toBeCloseTo(10523.4, 6)
    expect(t2.inputs![1].source!.kind).toBe('computed')
  })

  it('not run / failed / running: every input listed with "—", same ids', () => {
    const run = strategyReturnTree({ run: RUN })
    for (const [state, status] of [[{}, 'empty'], [{ error: 'no candles' }, 'error'], [{ running: true }, 'loading']] as const) {
      const t = strategyReturnTree({ run: null, ...state })
      expect(t.status).toBe(status)
      expect(t.value).toBeNull()
      expect(drillable(t)).toBe(true)
      expect(t.inputs!.map(i => i.id)).toEqual(run.inputs!.map(i => i.id))
      expect(t.inputs!.every(i => i.value === null && !!i.reason)).toBe(true)
    }
    expect(strategyReturnTree({ run: null, error: 'no candles' }).reason).toBe('The backtest failed: no candles')
  })

  it('ids are stable and unique', () => {
    const a = ids(strategyReturnTree({ run: RUN }))
    expect(new Set(a).size).toBe(a.length)
    expect(a).toEqual(ids(strategyReturnTree({ run: RUN, settings: SETTINGS })))
    expect(a).toContain('strategy.return.fees.fee_bps')
  })

  it('settings links: "—" before the settings are read, "not set" never invented', () => {
    expect(stratSettings().map(s => s.value)).toEqual(['—', '—', '—', '—'])
    expect(stratSettings(SETTINGS).map(s => s.value)).toEqual(['$10,000.00', '10 bps', '5 bps', 'BTC'])
    expect(stratSettings({ fee_bps: null }, { fee_bps: 10 })[1].value).toBe('10 bps')
  })
})
