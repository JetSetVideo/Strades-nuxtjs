/**
 * /bots index rows: the user's paper bots (server, GET /api/wallets/<id>/bots/) and the sample catalog
 * (public/data/core/bots.json). Pure so the labels are tested (tests/botsIndex.test.ts).
 */
import { fmtMoney, fmtPctFromPercent, fmtSignedMoney } from '~/utils/format'
import { botStatusText } from '~/utils/strategyRun'

/** The fields of composables/useTradingApi BotStatus this page reads. */
export interface ServerBotLike {
  bot_id: string
  wallet_id?: string
  alive: boolean
  paused?: boolean
  kind?: 'behaviour' | 'rules' | 'prediction'
  equity?: number | null
  pnl?: number | null
  pnl_pct?: number | null
  stats?: { closed?: number } | null
  market_ticker?: string
  market?: { ticker?: string; title?: string } | null
  strategy?: { id?: string; name?: string; symbol?: string } | null
}

/** The fields of stores/bots Bot this page reads. */
export interface SampleBotLike {
  id: string
  name: string
  status: 'live' | 'paused' | 'stopped' | 'error' | string
  pnl_30d_usd?: number | null
  pnl_30d_pct?: number | null
  capital_allocated_usd?: number | null
}

export type BotTone = 'up' | 'down' | 'muted'

export interface BotRow {
  id: string
  name: string
  /** Second line: what it trades / where it lives. */
  detail: string
  status: string
  money: string
  moneyLabel: string
  pnl: string
  pnlPct: string
  tone: BotTone
  to: string
}

const toneOf = (v: number | null | undefined): BotTone =>
  typeof v === 'number' && Number.isFinite(v) && v !== 0 ? (v > 0 ? 'up' : 'down') : 'muted'

const KIND: Record<string, string> = { behaviour: 'Behaviour mix', rules: 'Rules', prediction: 'Prediction market' }

export function serverBotRow(b: ServerBotLike, walletLabel = ''): BotRow {
  const market = b.market?.title || b.market?.ticker || b.market_ticker || ''
  const name = b.strategy?.name
    || (b.kind === 'prediction' && market ? `Prediction · ${market}` : `${KIND[b.kind ?? ''] ?? 'Paper'} bot`)
  const status = !b.alive ? 'Stopped' : b.paused ? 'Paused' : 'Running'
  const parts = [KIND[b.kind ?? ''] ?? 'Paper bot', b.strategy?.symbol, walletLabel ? `wallet ${walletLabel}` : '']
  return {
    id: b.bot_id,
    name,
    detail: parts.filter(Boolean).join(' · '),
    status,
    money: fmtMoney(b.equity ?? null),
    moneyLabel: 'Equity',
    pnl: fmtSignedMoney(b.pnl ?? null),
    pnlPct: fmtPctFromPercent(b.pnl_pct ?? null, { signed: true }),
    tone: toneOf(b.pnl),
    // Server bots are managed on the Trade page (pages/bots/[id] shows catalog bots only).
    to: '/trade',
  }
}

export function sampleBotRow(b: SampleBotLike): BotRow {
  // Same words as the bot page (pages/bots/[id]): a catalog bot never says "live".
  const status = botStatusText(String(b.status), false)
  return {
    id: b.id,
    name: b.name,
    detail: 'Sample catalog bot',
    status,
    money: fmtMoney(b.capital_allocated_usd ?? null, { decimals: 0 }),
    moneyLabel: 'Capital',
    pnl: fmtSignedMoney(b.pnl_30d_usd ?? null),
    pnlPct: fmtPctFromPercent(b.pnl_30d_pct ?? null, { signed: true }),
    tone: toneOf(b.pnl_30d_usd),
    to: `/bots/${b.id}`,
  }
}
