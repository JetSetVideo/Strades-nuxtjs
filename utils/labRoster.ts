/**
 * Twelve desk agents for the laboratory. They belong to the demo owner
 * (user_001) and merge into the catalog roster without replacing it.
 * Red Team reviews a book for the trade that breaks it. It does not attack anything.
 */
import type { Agent, AgentStatus, AssetClass, OpinionVector, PersonalityMatrix } from '~/types/agent'

const FACES = [
  '/avatars/Ellipse5.png',
  '/avatars/Ellipse6.png',
  '/avatars/Ellipse7.png',
  '/avatars/avatar_famous_cognis.png',
  '/avatars/avatar_famous_meridian.png',
  '/avatars/avatar_famous_helios.png',
  '/avatars/avatar_famous_ignis.png',
  '/avatars/avatar_famous_atlas.png',
  '/avatars/avatar_jev_classifier.png',
]

interface Seed {
  slug: string
  name: string
  role: string
  tagline: string
  style: string
  spec: AssetClass[]
  personality: PersonalityMatrix
  opinion: OpinionVector
  confidence: number
  loss: number
  epochs: number
  status: AgentStatus
  pnl: number
  backtest: number
  win: number
  sharpe: number
  dd: number
  trades: number
  curve: number[]
}

function desk(seed: Seed, face: number): Agent {
  return {
    id: `avatar_desk_${seed.slug}`,
    name: seed.name,
    owner_id: 'user_001',
    kind: 'public',
    model_type: 'generative',
    avatar_url: FACES[face % FACES.length]!,
    tagline: seed.tagline,
    specialization: seed.spec,
    trading_style: seed.style,
    personality_matrix: seed.personality,
    opinion_vector: seed.opinion,
    confidence: seed.confidence,
    role: seed.role,
    training_state: {
      version: 3,
      epochs: seed.epochs,
      last_trained_at: '2026-10-20T09:00:00Z',
      samples_observed: seed.epochs * 40,
      samples_since_last_train: seed.status === 'training' ? 40 : 0,
      reward_ema_pnl: seed.pnl / 1000,
      loss_ema: seed.loss,
      status: seed.status,
    },
    performance: {
      live_pnl_pct: seed.pnl,
      backtest_pnl_pct: seed.backtest,
      win_rate: seed.win,
      sharpe: seed.sharpe,
      max_drawdown_pct: seed.dd,
      trades_total: seed.trades,
      last_30d_curve: seed.curve,
    },
    lineage: { parent_id: null, forked_at: null },
    share_state: { is_public: true, price_credits: 0, license: 'open' },
    created_at: '2026-06-01T08:00:00Z',
  }
}

const SEEDS: Seed[] = [
  {
    slug: 'optimiser', name: 'Optimiser', role: 'optimisation',
    tagline: 'Spends compute where the Sharpe still moves',
    style: 'optimisation', spec: ['stocks', 'fiat'],
    personality: { risk: 0.25, aggression: 0.3, reaction_speed: 0.4, patience: 0.85, contrarian: 0.2 },
    opinion: { fiat: 30, crypto: 10, stocks: 45, commodities: 15 },
    confidence: 0.8, loss: 0.08, epochs: 4200, status: 'live',
    pnl: 11.2, backtest: 14.4, win: 0.63, sharpe: 1.9, dd: -4.1, trades: 240,
    curve: [100, 101, 102, 103, 104, 105, 106, 108],
  },
  {
    slug: 'trader', name: 'Trader', role: 'trader',
    tagline: 'Takes the break and cuts it when it fails',
    style: 'discretionary', spec: ['crypto', 'stocks'],
    personality: { risk: 0.92, aggression: 0.88, reaction_speed: 0.95, patience: 0.12, contrarian: 0.15 },
    opinion: { fiat: 5, crypto: 60, stocks: 25, commodities: 10 },
    confidence: 0.7, loss: 0.22, epochs: 1800, status: 'live',
    pnl: 34.5, backtest: 28.1, win: 0.51, sharpe: 1.35, dd: -18.4, trades: 1640,
    curve: [100, 108, 104, 118, 110, 130, 122, 140],
  },
  {
    slug: 'designer', name: 'Designer', role: 'designer',
    tagline: 'Shapes the card so the number can be read',
    style: 'design', spec: ['stocks', 'commodities'],
    personality: { risk: 0.4, aggression: 0.2, reaction_speed: 0.35, patience: 0.7, contrarian: 0.3 },
    opinion: { fiat: 20, crypto: 15, stocks: 40, commodities: 25 },
    confidence: 0.66, loss: 0.15, epochs: 900, status: 'training',
    pnl: 4.2, backtest: 6.1, win: 0.57, sharpe: 0.9, dd: -6.2, trades: 80,
    curve: [100, 101, 102, 101, 103, 102, 104, 103],
  },
  {
    slug: 'experience', name: 'Experience', role: 'experience',
    tagline: 'Checks whether a filter can be used one-handed',
    style: 'experience', spec: ['fiat', 'stocks'],
    personality: { risk: 0.35, aggression: 0.18, reaction_speed: 0.4, patience: 0.75, contrarian: 0.28 },
    opinion: { fiat: 35, crypto: 10, stocks: 40, commodities: 15 },
    confidence: 0.72, loss: 0.14, epochs: 760, status: 'live',
    pnl: 3.1, backtest: 4.4, win: 0.55, sharpe: 0.7, dd: -5.4, trades: 64,
    curve: [100, 100, 103, 100, 100, 104, 100, 101],
  },
  {
    slug: 'sentinel', name: 'Sentinel', role: 'security',
    tagline: 'Keeps the book inside the limits you already set',
    style: 'security', spec: ['fiat', 'commodities'],
    personality: { risk: 0.2, aggression: 0.25, reaction_speed: 0.5, patience: 0.8, contrarian: 0.7 },
    opinion: { fiat: 50, crypto: 5, stocks: 15, commodities: 30 },
    confidence: 0.84, loss: 0.06, epochs: 5100, status: 'live',
    pnl: -6.4, backtest: 2.2, win: 0.58, sharpe: 0.4, dd: -7.8, trades: 190,
    curve: [100, 97, 99, 94, 96, 90, 92, 86],
  },
  {
    slug: 'red', name: 'Red Team', role: 'red_team',
    tagline: 'Looks for the trade that breaks a book before the market does',
    style: 'red_team', spec: ['crypto', 'stocks'],
    personality: { risk: 0.78, aggression: 0.7, reaction_speed: 0.9, patience: 0.22, contrarian: 0.82 },
    opinion: { fiat: 10, crypto: 45, stocks: 30, commodities: 15 },
    confidence: 0.61, loss: 0.28, epochs: 2400, status: 'live',
    pnl: 19.6, backtest: 11.2, win: 0.48, sharpe: 0.95, dd: -21.0, trades: 420,
    curve: [100, 106, 103, 112, 108, 120, 115, 128],
  },
  {
    slug: 'surveyor', name: 'Surveyor', role: 'data',
    tagline: 'Counts what the curve actually did',
    style: 'research', spec: ['stocks', 'crypto'],
    personality: { risk: 0.45, aggression: 0.32, reaction_speed: 0.48, patience: 0.62, contrarian: 0.4 },
    opinion: { fiat: 15, crypto: 25, stocks: 40, commodities: 20 },
    confidence: 0.77, loss: 0.04, epochs: 8600, status: 'live',
    pnl: 8.4, backtest: 9.8, win: 0.6, sharpe: 1.25, dd: -5.9, trades: 510,
    curve: [100, 101, 103, 102, 105, 106, 107, 109],
  },
  {
    slug: 'oracle', name: 'Oracle', role: 'ai',
    tagline: 'Fits a model, then checks it against the last month',
    style: 'model', spec: ['crypto', 'commodities'],
    personality: { risk: 0.55, aggression: 0.48, reaction_speed: 0.72, patience: 0.5, contrarian: 0.45 },
    opinion: { fiat: 10, crypto: 40, stocks: 20, commodities: 30 },
    confidence: 0.69, loss: 0.05, epochs: 12000, status: 'training',
    pnl: 16.8, backtest: 22.4, win: 0.56, sharpe: 1.55, dd: -11.2, trades: 880,
    curve: [100, 103, 102, 108, 111, 109, 116, 120],
  },
  {
    slug: 'quartermaster', name: 'Quartermaster', role: 'risk',
    tagline: 'Sizes the position so a bad week is survivable',
    style: 'risk', spec: ['fiat', 'stocks'],
    personality: { risk: 0.15, aggression: 0.2, reaction_speed: 0.35, patience: 0.9, contrarian: 0.25 },
    opinion: { fiat: 40, crypto: 5, stocks: 40, commodities: 15 },
    confidence: 0.86, loss: 0.07, epochs: 3000, status: 'live',
    pnl: 6.8, backtest: 8.1, win: 0.66, sharpe: 1.7, dd: -2.4, trades: 120,
    curve: [100, 100.5, 101, 102, 102.5, 103, 104, 105],
  },
  {
    slug: 'cartographer', name: 'Cartographer', role: 'macro',
    tagline: 'Places the book on rates, growth, and the dollar',
    style: 'macro', spec: ['commodities', 'fiat'],
    personality: { risk: 0.48, aggression: 0.36, reaction_speed: 0.3, patience: 0.88, contrarian: 0.66 },
    opinion: { fiat: 25, crypto: 10, stocks: 25, commodities: 40 },
    confidence: 0.73, loss: 0.11, epochs: 2100, status: 'live',
    pnl: 9.1, backtest: 12.6, win: 0.54, sharpe: 1.05, dd: -9.5, trades: 70,
    curve: [100, 99, 101, 98, 102, 97, 103, 96],
  },
  {
    slug: 'courier', name: 'Courier', role: 'execution',
    tagline: 'Gets the order to the market while the price is still there',
    style: 'execution', spec: ['crypto', 'stocks'],
    personality: { risk: 0.8, aggression: 0.85, reaction_speed: 0.98, patience: 0.08, contrarian: 0.2 },
    opinion: { fiat: 8, crypto: 52, stocks: 30, commodities: 10 },
    confidence: 0.64, loss: 0.19, epochs: 6400, status: 'live',
    pnl: 2.4, backtest: 7.7, win: 0.49, sharpe: 0.55, dd: -14.6, trades: 3200,
    curve: [100, 90, 120, 80, 130, 70, 140, 110],
  },
  {
    slug: 'archivist', name: 'Archivist', role: 'archive',
    tagline: 'Keeps the run, the filter, and the result next to each other',
    style: 'archive', spec: ['stocks', 'fiat'],
    personality: { risk: 0.3, aggression: 0.15, reaction_speed: 0.1, patience: 0.95, contrarian: 0.5 },
    opinion: { fiat: 30, crypto: 10, stocks: 45, commodities: 15 },
    confidence: 0.9, loss: 0.09, epochs: 400, status: 'idle',
    pnl: 1.1, backtest: 1.4, win: 0.52, sharpe: 0.3, dd: -1.2, trades: 18,
    curve: [100, 100.2, 100.1, 100.3, 100.2, 100.4, 100.3, 100.5],
  },
]

export function deskAgents(): Agent[] {
  return SEEDS.map((seed, i) => desk(seed, i))
}

/** Catalog first, then any desk agent the file does not already contain. */
export function withDeskAgents(list: readonly Agent[]): Agent[] {
  const seen = new Set(list.map(agent => agent.id))
  const extra = deskAgents().filter(agent => !seen.has(agent.id))
  return [...list, ...extra]
}
