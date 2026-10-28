import { describe, expect, it } from 'vitest'
import {
  notificationKey, parseNotificationKey, isValidNotificationKey, deriveFromPredictions, deriveFromPaper,
  deriveFromTriggers, deriveFromBots, deriveFromTraining, mergeNotifications, filterNotifications, countByDomain,
  groupByDay, notificationLocation, monthGrid, predictionCalendarItems, relativeTime, fmtSigned, dayKey,
  botCalendarItems, targetOf, formatCountdown, formatCountdownMinutes, upcomingNotices, deriveClosing,
  type PredictionLike, type TriggerLike,
} from '~/utils/notifications'
import type { AppNotification } from '~/types/notification'

const H = 3_600_000
const NOW = new Date(2026, 9, 20, 12, 0, 0).getTime()

const call = (over: Partial<PredictionLike> = {}): PredictionLike => ({
  id: 'pred_1_a', userId: 'current_user', assetId: 'BTC', assetName: 'Bitcoin', timestamp: new Date(NOW - 7 * 24 * H).toISOString(),
  currentPrice: 100, predictedPrice: 110, predictedChangePct: 10, timeframe: '1W',
  targetDate: '', targetTs: NOW + 12 * H, horizonHours: 168, status: 'pending', ...over,
})

describe('keys', () => {
  it('builds, sanitises and parses the id code', () => {
    const k = notificationKey('prediction', 'due_soon', 'pred_1_a', '24h')
    expect(k).toBe('prediction.due_soon:pred_1_a:24h')
    expect(isValidNotificationKey(k)).toBe(true)
    expect(parseNotificationKey(k)).toEqual({ domain: 'prediction', event: 'due_soon', subjectId: 'pred_1_a', qualifier: '24h' })
    expect(notificationKey('alert', 'fired', 'a b/c?<x>')).toBe('alert.fired:a-b-c--x-')
  })
})

describe('deriveFromPredictions', () => {
  it('24 h warning only for calls of 3 days or more, 1 h warning, nothing from the future', () => {
    const keys = (p: PredictionLike, now = NOW) => deriveFromPredictions([p], now).map(n => n.key)
    expect(keys(call())).toEqual(['prediction.due_soon:pred_1_a:24h'])
    expect(keys(call({ targetTs: NOW + 30 * 60_000 }))).toEqual(['prediction.due_soon:pred_1_a:24h', 'prediction.due_soon:pred_1_a:1h'])
    expect(keys(call({ horizonHours: 24, targetTs: NOW + 12 * H }))).toEqual([])
    expect(keys(call({ targetTs: NOW + 3 * 24 * H }))).toEqual([])
    const n = deriveFromPredictions([call()], NOW)[0]!
    expect(Date.parse(n.when.occurred_at)).toBeLessThanOrEqual(NOW)
  })
  it('due_now after the target, resolved with the score as outcome', () => {
    expect(deriveFromPredictions([call({ targetTs: NOW - H })], NOW).map(n => n.event)).toEqual(['due_now'])
    const r = deriveFromPredictions([call({ targetTs: NOW - H, status: 'accurate', accuracyScore: 82, actualPrice: 108 })], NOW)[0]!
    expect(r.key).toBe('prediction.resolved:pred_1_a')
    expect(r.outcome).toMatchObject({ metric: 'score', value: 82, tone: 'up', benchmark: { value: 8 } })
    expect(r.where).toMatchObject({ route: '/assets/btc', anchor: 'sec-chart' })
  })
  it('ignores demo personas and other users', () => {
    expect(deriveFromPredictions([call({ demo: true }), call({ userId: 'kevin' })], NOW)).toEqual([])
  })
  it('a local expiry is not a verdict; old calls age out; date-only targets end the local day', () => {
    expect(deriveFromPredictions([call({ targetTs: NOW - H, status: 'expired' })], NOW).map(n => n.event)).toEqual(['due_now'])
    expect(deriveFromPredictions([call({ targetTs: NOW - 40 * 24 * H, status: 'accurate', accuracyScore: 80 })], NOW)).toEqual([])
    expect(new Date(targetOf(call({ targetTs: undefined, targetDate: '2026-10-30' }))).getDate()).toBe(30)
  })
  it('hit means score >= 60, direction is said separately', () => {
    const r = deriveFromPredictions([call({ targetTs: NOW - H, status: 'accurate', accuracyScore: 54, actualPrice: 100.4 })], NOW)[0]!
    expect(r.title).toMatch(/missed · 54\/100/)
    expect(r.body).toMatch(/Direction right/)
  })
})

describe('other sources', () => {
  it('paper, triggers, bots, training', () => {
    const paper = deriveFromPaper([{ id: 'pt1', timestamp: new Date(NOW - H).toISOString(), asset_id: 'eth', asset_symbol: 'ETH', side: 'buy', wallet_pct: 5,
      simulated_price: 3000, status: 'closed', closed_at: new Date(NOW).toISOString(), closed_price: 3100, realized_pnl_pct: 3.33, realized_pnl_value: 16.6 }])
    expect(paper[0]).toMatchObject({ key: 'paper.closed:pt1', severity: 'success', outcome: { unit: '%', tone: 'up' } })
    const trig = deriveFromTriggers([{ id: 't1', asset_id: 'btc', kind: 'cross_above', target_price: 110, current_price_at_creation: 100, status: 'triggered', created_at: NOW - H, triggered_at: NOW },
      { id: 't2', asset_id: 'btc', kind: 'cross_below', target_price: 90, current_price_at_creation: 100, status: 'armed', created_at: NOW }])
    expect(trig.map(n => n.key)).toEqual(['alert.fired:t1'])
    expect(trig[0]!.where.anchor).toBe('sec-chart')
    const bots = deriveFromBots([{ id: 'bot_1', owner_id: 'u', name: 'DCA', agent_id: 'a', status: 'live', trades_today: 2, pnl_today_usd: -12.5, pnl_30d_pct: 4.8,
      capital_allocated_usd: 10000, next_action_at: new Date(NOW + 2 * H).toISOString() }], NOW, 'u')
    expect(bots.map(n => n.event)).toEqual(['daily'])
    expect(bots[0]!.outcome).toMatchObject({ value: -12.5, tone: 'down', unit: 'USD' })
    expect(bots[0]!.title).not.toMatch(/today/)
    const someoneElses = { id: 'bot_2', owner_id: 'user_001', name: 'Sample', agent_id: 'a', status: 'live', trades_today: 1, pnl_today_usd: 3,
      pnl_30d_pct: 1, capital_allocated_usd: 1000, next_action_at: new Date(NOW + 2 * H).toISOString() }
    expect(deriveFromBots([someoneElses], NOW, 'u')).toEqual([])
    const demo = deriveFromBots([someoneElses], NOW, 'u', { demo: true })
    expect(demo[0]).toMatchObject({ group_key: 'demo', priority: 0 })
    expect(demo[0]!.title.startsWith('Demo · ')).toBe(true)
    expect(botCalendarItems([someoneElses], NOW)[0]).toMatchObject({ domain: 'bot', route: '/bots/bot_2' })
    const tr = deriveFromTraining([{ agent_id: 'av1', applied_at: NOW, delta: { risk: 0.012, patience: -0.003 }, source_event_ids: ['e1', 'e2'] }], { av1: 'Mirror' })
    expect(tr[0]).toMatchObject({ domain: 'agent', title: 'Mirror learned from 2 of your actions', outcome: { metric: 'risk' } })
  })
})

const mk = (key: string, at: number, over: Partial<AppNotification> = {}): AppNotification => ({
  v: 1, id: `loc:${key}`, key, domain: 'prediction', event: 'x', severity: 'info', priority: 1, title: key, body: '',
  when: { occurred_at: new Date(at).toISOString() }, what: { action: '', subject_type: 'prediction', subject_id: key, subject_label: key },
  where: { route: '/x', label: '' }, who: { actor_type: 'user', actor_id: 'u', actor_label: 'You' }, to: { recipient_id: 'u' },
  from: { source: 'prediction', origin: 'client' }, state: { read_at: null }, ...over,
})

describe('merge / filter / group', () => {
  it('server wins, local read state applies, archived and expired are dropped, newest first', () => {
    const local = [mk('a', NOW - H), mk('b', NOW - 2 * H), mk('c', NOW), mk('d', NOW, { expires_at: new Date(NOW - 1).toISOString() })]
    const server = [mk('a', NOW - H, { id: 'uuid-a', from: { source: 'prediction', origin: 'server' } })]
    const m = mergeNotifications(server, local, { b: new Date(NOW).toISOString(), 'archived:c': 'x' }, NOW)
    expect(m.map(n => n.key)).toEqual(['a', 'b'])
    expect(m[0]!.id).toBe('uuid-a')
    expect(m[1]!.state.read_at).not.toBeNull()
  })
  it('filters by domain, unread, day and text; counts; groups by local day', () => {
    const list = [mk('a', NOW), mk('b', NOW - 26 * H, { domain: 'bot', state: { read_at: 'r' } })]
    expect(filterNotifications(list, { domains: ['bot'] }).map(n => n.key)).toEqual(['b'])
    expect(filterNotifications(list, { unreadOnly: true }).map(n => n.key)).toEqual(['a'])
    expect(filterNotifications(list, { day: dayKey(NOW) }).map(n => n.key)).toEqual(['a'])
    expect(filterNotifications(list, { q: 'B' }).map(n => n.key)).toEqual(['b'])
    expect(countByDomain(list).bot).toEqual({ total: 1, unread: 0, unopened: 1 })
    expect(filterNotifications(list, { unopenedOnly: true }).map(n => n.key)).toEqual(['a', 'b'])
    expect(groupByDay(list, NOW).map(g => g.label)).toEqual(['Today', groupByDay(list, NOW)[1]!.label])
  })
  it('location never leaves the app', () => {
    for (const route of ['https://evil.example', '//evil.example', '/\\evil.example', '/\tevil', '/admin/', 'javascript:alert(1)']) {
      expect(notificationLocation(mk('a', NOW, { where: { route, label: '' } })).path).toBe('/notifications')
    }
    expect(notificationLocation(mk('a', NOW, { where: { route: '/assets/btc', anchor: 'sec-chart"><x', label: '' } }))).toEqual({ path: '/assets/btc', query: undefined, hash: undefined })
    expect(notificationLocation(mk('a', NOW, { where: { route: '/assets/btc', anchor: 'sec-chart', query: { call: 'p1', 'bad key': 'x' }, label: '' } })))
      .toEqual({ path: '/assets/btc', query: { call: 'p1' }, hash: '#sec-chart' })
  })
  it('results supersede deadlines; a server row keeps its own read state', () => {
    const due = mk('prediction.due_now:p1', NOW - H, { event: 'due_now', what: { action: '', subject_type: 'prediction', subject_id: 'p1', subject_label: '' } })
    const res = mk('prediction.resolved:p1', NOW - H, { event: 'resolved', what: { action: '', subject_type: 'prediction', subject_id: 'p1', subject_label: '' },
      from: { source: 'prediction', origin: 'server' } })
    expect(mergeNotifications([res], [due], {}, NOW).map(n => n.key)).toEqual(['prediction.resolved:p1'])
    const d24 = mk('prediction.due_soon:p2:24h', NOW - 23 * H, { event: 'due_soon', what: { action: '', subject_type: 'prediction', subject_id: 'p2', subject_label: '' } })
    const d1 = mk('prediction.due_soon:p2:1h', NOW - 0.5 * H, { event: 'due_soon', what: { action: '', subject_type: 'prediction', subject_id: 'p2', subject_label: '' } })
    expect(mergeNotifications([], [d24, d1], {}, NOW).map(n => n.key)).toEqual(['prediction.due_soon:p2:1h'])
    expect(mergeNotifications([res], [], { 'prediction.resolved:p1': 'x' }, NOW)[0]!.state.read_at).toBeNull()
    const opened = mergeNotifications([], [mk('a', NOW)], { 'opened:a': '2026-10-20T00:00:00.000Z' }, NOW)[0]!
    expect(opened.state.opened_at).toBe('2026-10-20T00:00:00.000Z')
    expect(opened.state.read_at).toBeNull()
  })
  it('groups by day newest first even when rows are not sorted', () => {
    const g = groupByDay([mk('a', NOW - 30 * H), mk('b', NOW), mk('c', NOW - 31 * H)], NOW)
    expect(g.map(x => x.items.map(n => n.key))).toEqual([['b'], ['a', 'c']])
  })
})

describe('calendar', () => {
  it('month grid is 6 x 7, Monday first, items on their day', () => {
    const items = predictionCalendarItems([call({ targetTs: new Date(2026, 9, 27, 9).getTime() })])
    const g = monthGrid(new Date(2026, 9, 1), items, NOW)
    expect(g.length).toBe(6)
    expect(g.every(w => w.length === 7)).toBe(true)
    expect(new Date(2026, 8, 28).getDay()).toBe(1)      // 28 Sep 2026 is the Monday starting the grid
    expect(g[0]![0]!.date).toBe(28)
    const cell = g.flat().find(c => c.day === dayKey(new Date(2026, 9, 27).getTime()))!
    expect(cell.items[0]).toMatchObject({ kind: 'call_due', tone: 'pending', symbol: 'BTC' })
    expect(g.flat().find(c => c.isToday)?.day).toBe(dayKey(NOW))
  })
})

describe('formatting', () => {
  it('signs and units', () => {
    expect(fmtSigned(12.5, 'USD')).toBe('+$12.50')
    expect(fmtSigned(-3.2, '%')).toBe('−3.20 %')
    expect(fmtSigned(82.4, 'score')).toBe('82/100')
    expect(relativeTime(new Date(NOW + 3 * H).toISOString(), NOW)).toBe('in 3 h')
    expect(relativeTime(new Date(NOW - 26 * H).toISOString(), NOW)).toBe('yesterday')
    // Tue 12:00 → Thu 08:00 is 44 h but two calendar days away, not "tomorrow"
    expect(relativeTime(new Date(NOW + 44 * H).toISOString(), NOW)).toBe('in 2 days')
    expect(relativeTime(new Date(new Date(NOW).setHours(23, 30)).toISOString(), NOW)).toBe('in 12 h')
  })
  it('countdown always carries minutes and seconds', () => {
    expect(formatCountdown(8 * H + 14 * 60_000 + 2_000)).toBe('8h 14m 02s')
    expect(formatCountdown(14 * 60_000 + 2_000)).toBe('14m 02s')
    expect(formatCountdown(2_000)).toBe('00m 02s')
    expect(formatCountdown(0)).toBe('00m 00s')
    expect(formatCountdown(-5_000)).toBe('−00m 05s')
    expect(formatCountdown(2 * 24 * H + 3_000)).toBe('2d 00h 00m 03s')
    expect(formatCountdownMinutes(8 * H + 5 * 60_000 + 35_000)).toBe('8h 05m')
    expect(formatCountdownMinutes(2 * 24 * H + 3_000)).toBe('2d 00h 00m')
    expect(formatCountdownMinutes(-5_000)).toBe('−00m')
  })
  it('upcoming notices keep every pending call, and only the near bots and other deadlines', () => {
    const calls = [call({ targetTs: NOW + 8 * H }), call({ id: 'pred_far', targetTs: NOW + 10 * 24 * H })]
    const bots = [{ id: 'bot_1', owner_id: 'u', name: 'DCA', agent_id: 'a', status: 'live', trades_today: 0, pnl_today_usd: 0,
      pnl_30d_pct: 0, capital_allocated_usd: 1000, next_action_at: new Date(NOW + 2 * H).toISOString() }]
    const due = mk('prediction.due_soon:pred_1_a:1h', NOW, {
      event: 'due_soon', domain: 'prediction',
      when: { occurred_at: new Date(NOW).toISOString(), due_at: new Date(NOW + 8 * H).toISOString() },
      what: { action: 'Prediction', subject_type: 'prediction', subject_id: 'pred_1_a', subject_label: 'BTC' },
    })
    const other = mk('alert.fired:t1', NOW, {
      domain: 'alert',
      when: { occurred_at: new Date(NOW).toISOString(), due_at: new Date(NOW + 3 * H).toISOString() },
      title: 'ETH alert',
    })
    const list = upcomingNotices([due, other], calls, bots, NOW)
    expect(list.map(n => n.id)).toEqual(['bot:bot_1', 'n:alert.fired:t1', 'call:pred_1_a', 'call:pred_far'])
    expect(list.filter(n => n.id.includes('pred_1_a'))).toHaveLength(1)
    expect(list.find(n => n.id === 'call:pred_far')?.more).toContain('target')
  })
  it('a call inside the last 20% of its gap leads the board, and a far alert does not', () => {
    const calls = [call({ targetTs: NOW + 8 * H })]
    const quiet = upcomingNotices([], calls, [], NOW, { prices: { BTC: 100 } })
    expect(quiet[0]?.urgent).toBe(false)
    const hot = upcomingNotices([], calls, [], NOW, { prices: { BTC: 108 } })
    expect(hot[0]?.id).toBe('call:pred_1_a')
    expect(hot[0]?.urgent).toBe(true)
    expect(hot[0]?.detail).toContain('nearing')
    expect(hot[0]?.more).toContain('80% of the gap closed')
    const level: TriggerLike = {
      id: 't_far', asset_id: 'bitcoin', kind: 'cross_above', target_price: 200,
      current_price_at_creation: 100, status: 'armed', created_at: NOW - 24 * H,
    }
    const still = upcomingNotices([], [], [], NOW, { prices: { bitcoin: 110 }, levels: [level], symbols: { bitcoin: 'BTC' } })
    expect(still).toHaveLength(0)
    const close = upcomingNotices([], [], [], NOW, { prices: { bitcoin: 185 }, levels: [level], symbols: { bitcoin: 'BTC' } })
    expect(close.map(n => n.id)).toEqual(['alert:t_far'])
    expect(close[0]?.detail).toContain('limit')
  })
})

describe('deriveClosing', () => {
  const level = (price: number): TriggerLike => ({
    id: 't1', asset_id: 'bitcoin', kind: 'cross_above', target_price: 110,
    current_price_at_creation: 100, status: 'armed', created_at: NOW - 24 * H,
  })
  it('warns only inside the last fifth of the gap, for calls and armed limits', () => {
    expect(deriveClosing([call()], [], { BTC: 108 }, NOW).map(n => n.key)).toEqual(['prediction.closing:pred_1_a'])
    expect(deriveClosing([call()], [], { BTC: 100 }, NOW)).toHaveLength(0)
    expect(deriveClosing([call()], [], { BTC: 110 }, NOW)).toHaveLength(0)
    const armed = deriveClosing([], [level(185)], { bitcoin: 108 }, NOW, 'current_user', { bitcoin: 'BTC' })
    expect(armed.map(n => n.event)).toEqual(['closing'])
    expect(armed[0]?.domain).toBe('alert')
    expect(deriveClosing([], [{ ...level(185), status: 'triggered', triggered_at: NOW }], { bitcoin: 108 }, NOW)).toHaveLength(0)
  })
})
