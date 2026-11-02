import { describe, expect, it, vi } from 'vitest'
import { isServerStrategyId, writeServerStrategy, type ServerStrategyPayload } from '~/utils/strategyServer'

// C7: Creator Save / Backtest update the strategy (PATCH) instead of adding a row; 405 → today's POST.
const body = { name: 'x' } as unknown as ServerStrategyPayload
const fail = (status: number) => Object.assign(new Error(`HTTP ${status}`), { statusCode: status })

describe('writeServerStrategy', () => {
  it('server id → PATCH, no POST', async () => {
    const api = { patch: vi.fn(async (id: string) => ({ id })), post: vi.fn(async () => ({ id: 'new' })) }
    expect(await writeServerStrategy(api, 'a1b2-uuid', body)).toEqual({ id: 'a1b2-uuid', mode: 'updated', fellBack: null })
    expect(api.patch).toHaveBeenCalledWith('a1b2-uuid', body)
    expect(api.post).not.toHaveBeenCalled()
  })

  it('405 (endpoint not there yet), 404 and 403 fall back to POST', async () => {
    for (const status of [405, 404, 403]) {
      const api = { patch: vi.fn(async () => { throw fail(status) }), post: vi.fn(async () => ({ id: 'new' })) }
      expect(await writeServerStrategy(api, 'a1b2', body)).toEqual({ id: 'new', mode: 'created', fellBack: status })
    }
  })

  it('400 (rules invalid) and 401 are not swallowed', async () => {
    for (const status of [400, 401, 500]) {
      const api = { patch: vi.fn(async () => { throw fail(status) }), post: vi.fn(async () => ({ id: 'new' })) }
      await expect(writeServerStrategy(api, 'a1b2', body)).rejects.toMatchObject({ statusCode: status })
      expect(api.post).not.toHaveBeenCalled()
    }
  })

  it('no id, or a local / sample id → POST', async () => {
    for (const id of [null, undefined, '', 'strategy_1730000000000', 'strategy_001']) {
      const api = { patch: vi.fn(), post: vi.fn(async () => ({ id: 'new' })) }
      expect(await writeServerStrategy(api as any, id, body)).toEqual({ id: 'new', mode: 'created', fellBack: null })
      expect(api.patch).not.toHaveBeenCalled()
    }
    expect(isServerStrategyId('strategy_001')).toBe(false)
    expect(isServerStrategyId('9f0c')).toBe(true)
  })
})
