import { onMounted } from 'vue'
import { useAgentsStore } from '~/stores/agents'
import { useStrategiesStore } from '~/stores/strategies'
import type { PaperTrade } from '~/stores/paper'

/**
 * Shared display helpers for paper-trade rows (Wallet/PaperPanel, historic Paper tab).
 *
 *  - money: sign goes before the currency symbol ("-$44.85", never "$-44.85")
 *  - notional: thousands separators ("$10,060")
 *  - source: resolves strategy_id / agent_id to the display name, falling back to the raw id
 */
export function usePaperFormat() {
  const agents = useAgentsStore()
  const strategies = useStrategiesStore()

  onMounted(() => {
    if (!strategies.strategies.length) strategies.fetchStrategies()
  })

  const usd = (v: number, digits = 0) =>
    Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })

  /** "+$351.70" / "-$44.85" */
  const signedUsd = (v: number, digits = 2) => `${v < 0 ? '-' : '+'}$${usd(v, digits)}`

  /** "$10,060" */
  const notional = (v: number) => `$${usd(v, 0)}`

  const strategyName = (id: string) => strategies.getStrategyById(id)?.name ?? id
  const agentName = (id: string) => agents.byId[id]?.name ?? id

  function sources(t: Pick<PaperTrade, 'strategy_id' | 'agent_id'>) {
    const out: { kind: 'strategy' | 'agent'; id: string; name: string; to: string }[] = []
    if (t.strategy_id) out.push({ kind: 'strategy', id: t.strategy_id, name: strategyName(t.strategy_id), to: `/strategy/${t.strategy_id}` })
    if (t.agent_id) out.push({ kind: 'agent', id: t.agent_id, name: agentName(t.agent_id), to: `/agents/${t.agent_id}` })
    return out
  }

  return { signedUsd, notional, sources }
}
