import { defineStore } from 'pinia'

export interface AllocationPie {
  fiat: number
  crypto: number
  stocks: number
  commodities: number
}

export interface WalletState {
  userId: string
  baseCurrency: string
  allocationPie: AllocationPie
  flowVelocity: number
}

export const useWalletStore = defineStore('wallet', {
  state: (): WalletState => ({
    userId: 'default_user',
    baseCurrency: 'USD',
    allocationPie: {
      fiat: 25,
      crypto: 25,
      stocks: 25,
      commodities: 25
    },
    flowVelocity: 0.1
  }),
  actions: {
    // Enforces the 100% rule
    updateAllocation(category: keyof AllocationPie, newPercentage: number) {
      const oldPercentage = this.allocationPie[category]
      const difference = newPercentage - oldPercentage
      
      // We need to distribute the -difference across the other 3 categories proportionally
      let remainingTotal = 0
      for (const [key, val] of Object.entries(this.allocationPie)) {
        if (key !== category) {
          remainingTotal += val
        }
      }

      if (remainingTotal === 0 && difference > 0) {
        // Edge case: all others were 0, just spread equally
        const spread = -difference / 3
        for (const key of Object.keys(this.allocationPie) as Array<keyof AllocationPie>) {
          if (key !== category) {
            this.allocationPie[key] = spread
          }
        }
      } else {
        // Proportional distribution
        for (const key of Object.keys(this.allocationPie) as Array<keyof AllocationPie>) {
          if (key !== category) {
            const currentVal = this.allocationPie[key]
            const proportion = currentVal / remainingTotal
            this.allocationPie[key] = Math.max(0, currentVal - (difference * proportion))
          }
        }
      }
      
      this.allocationPie[category] = newPercentage
      
      // Correct floating point precision issues to ensure exactly 100
      let sum = 0
      for (const val of Object.values(this.allocationPie)) sum += val
      if (sum !== 100) {
         // adjust fiat as base
         this.allocationPie['fiat'] += (100 - sum)
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
      return Math.abs(sum - 100) < 0.01 // allow tiny floating point difference
    }
  }
})
