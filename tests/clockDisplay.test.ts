import { describe, expect, it, vi } from 'vitest'
import { formatClock, gmtOffsetLabel } from '~/utils/clockDisplay'

describe('gmtOffsetLabel', () => {
  it('labels UTC as GMT', () => {
    expect(gmtOffsetLabel(new Date(), 'gmt')).toBe('GMT')
  })

  it('formats a positive offset without minutes', () => {
    const date = new Date('2026-06-01T12:00:00Z')
    const spy = vi.spyOn(date, 'getTimezoneOffset').mockReturnValue(-120)
    expect(gmtOffsetLabel(date, 'local')).toBe('GMT+2')
    spy.mockRestore()
  })

  it('formats a negative offset with minutes', () => {
    const date = new Date('2026-06-01T12:00:00Z')
    const spy = vi.spyOn(date, 'getTimezoneOffset').mockReturnValue(330)
    expect(gmtOffsetLabel(date, 'local')).toBe('GMT-5:30')
    spy.mockRestore()
  })
})

describe('formatClock', () => {
  it('prints UTC hours in gmt mode', () => {
    const date = new Date(Date.UTC(2026, 0, 1, 7, 8, 9))
    expect(formatClock(date, 'gmt')).toBe('07:08:09')
  })
})
