import { defineStore } from 'pinia'

export type PipelineStage = 'idle' | 'hydrating' | 'streaming' | 'error'

export interface StageStatus {
  name: string
  state: PipelineStage
  lastTickMs: number
  errors: number
}

export interface PipelineState {
  bootstrapped: boolean
  startedAt: number
  stages: Record<string, StageStatus>
  globalState: PipelineStage
  ticksPerSecond: number
}

export const usePipelineStore = defineStore('pipeline', {
  state: (): PipelineState => ({
    bootstrapped: false,
    startedAt: 0,
    stages: {
      macro: { name: 'macro', state: 'idle', lastTickMs: 0, errors: 0 },
      wallet: { name: 'wallet', state: 'idle', lastTickMs: 0, errors: 0 },
      news: { name: 'news', state: 'idle', lastTickMs: 0, errors: 0 },
      assets: { name: 'assets', state: 'idle', lastTickMs: 0, errors: 0 },
      preferences: { name: 'preferences', state: 'idle', lastTickMs: 0, errors: 0 }
    },
    globalState: 'idle',
    ticksPerSecond: 0
  }),
  actions: {
    markStage(name: string, state: PipelineStage) {
      const stage = this.stages[name]
      if (!stage) return
      stage.state = state
      stage.lastTickMs = Date.now()
      if (state === 'error') stage.errors += 1
      // Roll up global state
      const states = Object.values(this.stages).map(s => s.state)
      if (states.includes('error')) this.globalState = 'error'
      else if (states.every(s => s === 'streaming' || s === 'idle')) this.globalState = 'streaming'
      else this.globalState = 'hydrating'
    },
    bootstrap() {
      this.bootstrapped = true
      this.startedAt = Date.now()
    },
    recordTick() {
      this.ticksPerSecond = Math.min(60, this.ticksPerSecond + 1)
      // Decay
      setTimeout(() => {
        this.ticksPerSecond = Math.max(0, this.ticksPerSecond - 1)
      }, 1000)
    }
  },
  getters: {
    uptimeSec: (state) => state.startedAt === 0 ? 0 : Math.floor((Date.now() - state.startedAt) / 1000),
    isHealthy: (state) => state.globalState !== 'error'
  }
})
