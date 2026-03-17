import { defineStore } from 'pinia'

export interface BuilderNode {
  id: string
  type: 'condition' | 'action' | 'avatar' | 'variable'
  x: number
  y: number
  confidence_score: number
  execution_frequency: number
  params: any
}

export interface BuilderEdge {
  source: string
  target: string
  capital_flow: number
}

export interface BuilderState {
  nodes: BuilderNode[]
  edges: BuilderEdge[]
}

export const useBuilderStore = defineStore('builder', {
  state: (): BuilderState => ({
    nodes: [
      { id: 'n1', type: 'variable', x: 100, y: 100, confidence_score: 0.9, execution_frequency: 0.1, params: { name: 'BTC Price' } },
      { id: 'n2', type: 'condition', x: 300, y: 150, confidence_score: 0.6, execution_frequency: 0.8, params: { operator: '>', value: 50000 } },
      { id: 'n3', type: 'avatar', x: 500, y: 100, confidence_score: 0.95, execution_frequency: 0.5, params: { userId: 'u_123', riskProfile: 0.8 } }
    ],
    edges: [
      { source: 'n1', target: 'n2', capital_flow: 10 },
      { source: 'n2', target: 'n3', capital_flow: 50 }
    ]
  }),
  actions: {
    addNode(node: BuilderNode) {
      this.nodes.push(node)
    },
    updateNodePosition(id: string, x: number, y: number) {
      const n = this.nodes.find(node => node.id === id)
      if (n) {
        n.x = x
        n.y = y
      }
    }
  }
})
