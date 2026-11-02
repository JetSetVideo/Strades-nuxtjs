import { describe, expect, it } from 'vitest'
import { sampleBotRow, serverBotRow } from '~/utils/botsIndex'

describe('/bots rows', () => {
  it('a running server bot: strategy name, wallet, equity and signed P&L through utils/format', () => {
    const r = serverBotRow({
      bot_id: 'b1', alive: true, kind: 'rules', equity: 10234.5, pnl: 234.5, pnl_pct: 2.345,
      strategy: { id: 's1', name: 'RSI dip', symbol: 'BTC' },
    }, 'Main')
    expect(r).toMatchObject({
      id: 'b1', name: 'RSI dip', detail: 'Rules · BTC · wallet Main', status: 'Running',
      money: '$10,234.50', moneyLabel: 'Equity', pnl: '+$234.50', pnlPct: '+2.3%', tone: 'up', to: '/trade',
    })
  })
  it('paused / stopped / prediction / losses / unknown numbers', () => {
    expect(serverBotRow({ bot_id: 'b', alive: true, paused: true }).status).toBe('Paused')
    const p = serverBotRow({ bot_id: 'p', alive: false, kind: 'prediction', market: { title: 'Fed cut in Dec' }, pnl: -12, pnl_pct: -1.2 })
    expect(p).toMatchObject({ name: 'Prediction · Fed cut in Dec', status: 'Stopped', pnl: '\u2212$12.00', pnlPct: '\u22121.2%', tone: 'down' })
    const blank = serverBotRow({ bot_id: 'x', alive: true })
    expect(blank).toMatchObject({ name: 'Paper bot', money: '—', pnl: '—', pnlPct: '—', tone: 'muted' })
  })
  it('a sample bot never says live and links its catalog page', () => {
    const r = sampleBotRow({ id: 'bot_001', name: 'BTC DCA Daily', status: 'live', pnl_30d_usd: 482.3, pnl_30d_pct: 4.8, capital_allocated_usd: 10000 })
    expect(r).toMatchObject({ status: 'running (simulated)', money: '$10,000', pnl: '+$482.30', pnlPct: '+4.8%', tone: 'up', to: '/bots/bot_001' })
    expect(r.status.toLowerCase()).not.toBe('live')
  })
})
