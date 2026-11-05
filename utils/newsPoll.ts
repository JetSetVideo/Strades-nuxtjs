import type { NewsPoll } from '~/types/news'

/** Move this person's vote onto one option. A second click on the same option leaves it there. */
export function castPollVote(poll: NewsPoll, userId: string, optionId: string): NewsPoll {
  if (!poll.options.some(option => option.id === optionId)) return poll
  return {
    ...poll,
    options: poll.options.map(option => {
      const voterIds = option.voterIds.filter(id => id !== userId)
      if (option.id === optionId) voterIds.push(userId)
      return { ...option, voterIds }
    }),
  }
}

export function pollVoteTotal(poll: NewsPoll): number {
  return poll.options.reduce((sum, option) => sum + option.voterIds.length, 0)
}
