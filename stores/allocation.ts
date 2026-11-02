import { defineStore } from 'pinia'
import type { AllocationPie } from '~/types/allocation'
import { EMPTY_ALLOCATION_PIE } from '~/types/allocation'

export type { AllocationPie } from '~/types/allocation'

export interface AllocationState {
  userId: string
  baseCurrency: string
  /**
   * The allocation of the book on screen, written from actual holdings (Wallet's
   * AllocationSlider, Risk derives its own from the account's book) or by the swarm.
   * Starts at all zeros: "no holdings known yet". It used to start at 25/25/25/25,
   * which Risk showed as the user's allocation (board-data P1 #6).
   */
  allocationPie: AllocationPie
  flowVelocity: number
}

export const useAllocationStore = defineStore('allocation', {
  state: (): AllocationState => {
    // No fallback to the demo id: an unknown user is '' (board-security: user_001 fallbacks).
    let userId = ''
    try {
      userId = useCurrentUser().getUserId()
    } catch { /* early init */ }
    return {
      userId,
      baseCurrency: 'USD',
      allocationPie: { ...EMPTY_ALLOCATION_PIE },
      flowVelocity: 0.1
    }
  },
  actions: {
    /** Replace the pie with weights derived from holdings (all zeros when there are none). */
    setFromHoldings(pie: AllocationPie) {
      this.allocationPie = { ...pie }
    },
    updateAllocation(category: keyof AllocationPie, newPercentage: number) {
      const oldPercentage = this.allocationPie[category]
      const difference = newPercentage - oldPercentage

      let remainingTotal = 0
      for (const [key, val] of Object.entries(this.allocationPie)) {
        if (key !== category) {
          remainingTotal += val
        }
      }

      if (remainingTotal === 0) {
        const spread = Math.max(0, -difference / 3)
        for (const key of Object.keys(this.allocationPie) as Array<keyof AllocationPie>) {
          if (key !== category) {
            this.allocationPie[key] = spread
          }
        }
      } else {
        for (const key of Object.keys(this.allocationPie) as Array<keyof AllocationPie>) {
          if (key !== category) {
            const currentVal = this.allocationPie[key]
            const proportion = currentVal / remainingTotal
            this.allocationPie[key] = Math.max(0, currentVal - (difference * proportion))
          }
        }
      }

      this.allocationPie[category] = newPercentage

      let sum = 0
      for (const val of Object.values(this.allocationPie)) sum += val
      if (sum !== 100) {
        this.allocationPie.fiat += (100 - sum)
      }
    },
    setFlowVelocity(velocity: number) {
      this.flowVelocity = velocity
    }
  },
  getters: {
    getAllocationValues: (state) => Object.values(state.allocationPie),
    is100Percent: (state) => {
      const sum = Object.values(state.allocationPie).reduce((acc, val) => acc + val, 0)
      return Math.abs(sum - 100) < 0.01
    }
  }
})
