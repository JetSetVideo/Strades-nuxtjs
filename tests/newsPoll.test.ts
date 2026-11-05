import { describe, expect, it } from 'vitest'
import type { NewsPoll } from '~/types/news'
import { castPollVote, pollVoteTotal } from '~/utils/newsPoll'

const poll = (): NewsPoll => ({
  question: 'Where does BTC go this week?',
  options: [
    { id: 'up', label: 'Higher', voterIds: ['ada'] },
    { id: 'flat', label: 'Sideways', voterIds: [] },
    { id: 'down', label: 'Lower', voterIds: [] },
  ],
})

describe('castPollVote', () => {
  it('records one opinion and moves it when the person changes their mind', () => {
    const first = castPollVote(poll(), 'bob', 'up')
    expect(first.options[0]!.voterIds).toEqual(['ada', 'bob'])
    expect(pollVoteTotal(first)).toBe(2)

    const moved = castPollVote(first, 'bob', 'down')
    expect(moved.options[0]!.voterIds).toEqual(['ada'])
    expect(moved.options[2]!.voterIds).toEqual(['bob'])
    expect(pollVoteTotal(moved)).toBe(2)
  })

  it('keeps the same choice when the person picks it again', () => {
    const again = castPollVote(poll(), 'ada', 'up')
    expect(again.options[0]!.voterIds).toEqual(['ada'])
  })

  it('ignores an option that is not on the poll', () => {
    expect(castPollVote(poll(), 'bob', 'missing')).toEqual(poll())
  })
})
