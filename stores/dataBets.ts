import { defineStore } from 'pinia'
import { useCreditsStore } from '~/stores/credits'
import { useAssetsStore } from '~/stores/assets'
import { useCurrentUser } from '~/composables/useCurrentUser'
import {
  clampStake, computeParimutuelPayout, MIN_STAKE,
  type DataChallenge, type DataBet, type ChallengeKind, type BetSide
} from '~/types/dataBet'

export type { DataChallenge, DataBet, ChallengeKind, ChallengeStatus, BetSide } from '~/types/dataBet'

export interface DataBetsState {
  challenges: DataChallenge[]
  bets: DataBet[]
  hydrated: boolean
  nextChallengeId: number
  nextBetId: number
}

const STORAGE_KEY = 'strades_arena_v1'
/** Custom (community-voted) challenges past deadline with zero votes are voided after this long — otherwise they'd never resolve. */
const VOTE_GRACE_MS = 24 * 60 * 60 * 1000

export const useDataBetsStore = defineStore('dataBets', {
  state: (): DataBetsState => ({
    challenges: [],
    bets: [],
    hydrated: false,
    nextChallengeId: 1,
    nextBetId: 1
  }),

  getters: {
    openChallenges: (s) => s.challenges.filter(c => c.status === 'open').sort(
      (a, b) => new Date(a.resolves_at).getTime() - new Date(b.resolves_at).getTime()
    ),
    settledChallenges: (s) => s.challenges.filter(c => c.status !== 'open'),

    betsForChallenge: (s) => (challengeId: string): DataBet[] =>
      s.bets.filter(b => b.challenge_id === challengeId),

    myBets(): DataBet[] {
      const userId = useCurrentUser().getUserId()
      return this.bets.filter(b => b.user_id === userId)
    },

    /** Net free-credit P&L across all settled bets — the Arena leaderboard metric. */
    myNetResult(): number {
      return this.myBets
        .filter(b => b.settled)
        .reduce((sum, b) => {
          const stakeBack = b.payout ?? 0
          return sum + (stakeBack - b.stake)
        }, 0)
    },

    /** Current pool split, 0-100, for the UI odds bar. */
    poolSplit: () => (challenge: DataChallenge): { yesPct: number; noPct: number } => {
      const total = challenge.pool_yes + challenge.pool_no
      if (total <= 0) return { yesPct: 50, noPct: 50 }
      return { yesPct: (challenge.pool_yes / total) * 100, noPct: (challenge.pool_no / total) * 100 }
    }
  },

  actions: {
    hydrate() {
      if (this.hydrated || typeof window === 'undefined') return
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY)
        if (raw) {
          const parsed = JSON.parse(raw)
          this.challenges = parsed.challenges ?? []
          this.bets = parsed.bets ?? []
          this.nextChallengeId = parsed.nextChallengeId ?? 1
          this.nextBetId = parsed.nextBetId ?? 1
        }
      } catch { /* fresh start */ }
      this.hydrated = true
      this.resolveDue()
    },

    persist() {
      if (typeof window === 'undefined') return
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
          challenges: this.challenges,
          bets: this.bets,
          nextChallengeId: this.nextChallengeId,
          nextBetId: this.nextBetId
        }))
      } catch { /* quota full — non-fatal */ }
    },

    /**
     * Post a data challenge. `market` kind auto-resolves later from the live
     * feed; `custom` kind is the "post your own data" path — the author
     * states a claim in plain language and the community votes it out.
     */
    postChallenge(args: {
      author_id: string
      kind: ChallengeKind
      title: string
      description: string
      resolves_in_hours: number
      asset_id?: string
      asset_symbol?: string
      comparator?: 'above' | 'below'
      target_price?: number
    }): DataChallenge {
      const hours = Math.max(1, Math.min(24 * 30, args.resolves_in_hours || 24)) // 1h .. 30d
      const challenge: DataChallenge = {
        id: `chal_${String(this.nextChallengeId++).padStart(4, '0')}`,
        author_id: args.author_id,
        kind: args.kind,
        title: args.title.slice(0, 140),
        description: args.description.slice(0, 500),
        created_at: new Date().toISOString(),
        resolves_at: new Date(Date.now() + hours * 3_600_000).toISOString(),
        status: 'open',
        asset_id: args.asset_id,
        asset_symbol: args.asset_symbol,
        comparator: args.comparator,
        target_price: args.target_price,
        votes_yes: [],
        votes_no: [],
        pool_yes: 0,
        pool_no: 0
      }
      this.challenges.unshift(challenge)
      this.persist()
      return challenge
    },

    /**
     * Place a free-credit wager. Returns null if the challenge is closed, the
     * user already bet on it, or their balance can't cover the minimum stake.
     * `stakeFraction`/`againstMajority` are handed back so the caller can feed
     * a `data_bet_placed` training event without the store depending on the tracker.
     */
    placeBet(challengeId: string, side: BetSide, rawStake: number):
      { bet: DataBet; stakeFraction: number; againstMajority: boolean } | null {
      const challenge = this.challenges.find(c => c.id === challengeId)
      if (!challenge || challenge.status !== 'open') return null
      const userId = useCurrentUser().getUserId()
      if (this.bets.some(b => b.challenge_id === challengeId && b.user_id === userId)) return null

      const credits = useCreditsStore()
      const stake = clampStake(rawStake, credits.balance)
      if (stake < MIN_STAKE) return null

      const spent = credits.spend(stake, 'arena_bet', challengeId)
      if (spent < MIN_STAKE) return null

      const totalBefore = challenge.pool_yes + challenge.pool_no
      const againstMajority = totalBefore > 0 && (
        (side === 'yes' && challenge.pool_yes < challenge.pool_no) ||
        (side === 'no' && challenge.pool_no < challenge.pool_yes)
      )

      const bet: DataBet = {
        id: `bet_${String(this.nextBetId++).padStart(5, '0')}`,
        challenge_id: challengeId,
        user_id: userId,
        side,
        stake: spent,
        placed_at: new Date().toISOString(),
        settled: false
      }
      this.bets.push(bet)
      if (side === 'yes') challenge.pool_yes += spent
      else challenge.pool_no += spent
      this.persist()

      return { bet, stakeFraction: spent / Math.max(1, credits.balance + spent), againstMajority }
    },

    castVote(challengeId: string, userId: string, side: BetSide) {
      const c = this.challenges.find(x => x.id === challengeId)
      if (!c || c.kind !== 'custom' || c.status !== 'open') return
      c.votes_yes = (c.votes_yes ?? []).filter(id => id !== userId)
      c.votes_no = (c.votes_no ?? []).filter(id => id !== userId)
      if (side === 'yes') c.votes_yes.push(userId)
      else c.votes_no.push(userId)
      this.persist()
    },

    /** Sweep every open challenge past its deadline and settle payouts. Safe to call repeatedly. */
    resolveDue() {
      const assets = useAssetsStore()
      const now = Date.now()
      for (const c of this.challenges) {
        if (c.status !== 'open') continue
        const due = new Date(c.resolves_at).getTime() <= now
        if (!due) continue

        if (c.kind === 'market') {
          const price = assets.getAssetById(c.asset_id ?? '')?.current_price
          if (price === undefined) continue // no price yet — try again next sweep
          c.resolution_price = price
          if (c.target_price === undefined) { c.status = 'void' }
          else if (price === c.target_price) { c.status = 'void' }
          else {
            const met = c.comparator === 'above' ? price > c.target_price : price < c.target_price
            c.status = met ? 'resolved_yes' : 'resolved_no'
          }
        } else {
          const yes = c.votes_yes?.length ?? 0
          const no = c.votes_no?.length ?? 0
          const overdue = now - new Date(c.resolves_at).getTime() > VOTE_GRACE_MS
          if (yes === 0 && no === 0) {
            if (overdue) c.status = 'void'
            else continue // give the community more time to vote
          } else if (yes === no) {
            c.status = 'void'
          } else {
            c.status = yes > no ? 'resolved_yes' : 'resolved_no'
          }
        }
        this.settlePayouts(c)
      }
      this.persist()
    },

    /** Pari-mutuel settlement: losers' pool splits pro-rata across winners; refund everyone on 'void'. */
    settlePayouts(challenge: DataChallenge) {
      const credits = useCreditsStore()
      const bets = this.bets.filter(b => b.challenge_id === challenge.id && !b.settled)
      const winSide: BetSide | null =
        challenge.status === 'resolved_yes' ? 'yes' :
        challenge.status === 'resolved_no' ? 'no' : null

      for (const b of bets) {
        const payout = computeParimutuelPayout({
          stake: b.stake, side: b.side, winSide,
          pool_yes: challenge.pool_yes, pool_no: challenge.pool_no
        })
        b.payout = Math.round(payout)
        b.settled = true
        if (b.payout > 0) credits.grant(b.payout, winSide === null ? 'arena_refund' : 'arena_payout', challenge.id)
      }
    },

    /** Seed a couple of demo challenges for first-time visitors. */
    seedDemo() {
      if (this.challenges.length > 0) return
      const btc = useAssetsStore().getAssetById('bitcoin')
      this.postChallenge({
        author_id: 'system_famous',
        kind: 'market',
        title: 'BTC closes above $70,000 within 48h',
        description: 'Auto-settled against the live BTC feed.',
        resolves_in_hours: 48,
        asset_id: 'bitcoin',
        asset_symbol: 'BTC',
        comparator: 'above',
        target_price: btc ? Math.round(btc.current_price * 1.05) : 70_000
      })
      this.postChallenge({
        author_id: 'user_003',
        kind: 'custom',
        title: 'My on-chain whale-wallet indicator flips bullish this week',
        description: 'Posting my own accumulation-score dataset — community votes on whether it flips by the deadline.',
        resolves_in_hours: 24 * 5
      })
    }
  }
})
