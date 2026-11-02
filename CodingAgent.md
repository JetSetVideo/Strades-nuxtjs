# Coding Agent & AI Implementation Schema

This document details the algorithms that exist in the frontend today (allocation enforcer, swarm aggregator, opinion profiler, paper-trading engine, strategy code source) and, under **Roadmap (not built)**, the pipelines that are designed but not implemented. If a section here and the code disagree, the code wins — fix this file.

---

## 0. Avatar today (read first)

- **The real avatar is server-side.** Tracked activity (`composables/useTracking.ts` → `POST /api/auth/tracking/batch/`), calls (`/api/v1/predictions/`), trades and messages are turned into a behaviour profile, an avatar with walk-forward forecasts, relation avatars and an agent directive by the backend app `apps/intelligence` (`manage.py analyse`, run by `upkeep`). Method: backend `docs/intelligence.md`.
- **The frontend reads it** through `composables/useIntelligence.ts` (`GET /api/v1/intelligence/me/`, `users/<id>/`, `relations/<id>/`, `compare/<id>/`, `hierarchy/`, `space/`, `entourage/`, `similar/`) and shows it with `components/Intelligence/*` on `/profile` and `/insights`. The user directs it with `<IntelligenceDirective>` and `<SettingsPrimaryValues>` (`/api/v1/settings/primary/`) and plugs agents on `/agents` (`/api/v1/settings/plugs/`). Contract C6 adds `inputs` (what it learned from) to `intelligence/me/` — wave 2, landing.
- **The in-browser "training" is simulated.** `stores/training.ts` drains a behaviour buffer every few seconds and nudges the sample agents' `training_state` with a synthetic reward (`(Math.random() - 0.5) * 0.02` on the previous EMA); nothing is fetched or persisted and the sample agents come from `agents/avatars.json`, so the deltas reset on reload. Treat it as an animation; any number it shows needs `<UISourceChip source="simulated">`.

---

## 1. The 100% Allocation Mathematical Enforcer

Capital is never idle — it is a closed pie constantly rebalanced by user opinions and strategy code.

### Implementation (`stores/allocation.ts`)
- **Constraint**: `fiat + crypto + stocks + commodities ≡ 100`.
- **Update rule**: when a node or user action moves class `c` from `p_old` → `p_new`, the delta `Δ = p_new − p_old` is distributed across the other three classes **proportionally to their current shares**. If the others sum to zero, the delta is split evenly.
- **Risk hierarchy override**: a strategy node can pin a class (e.g. "never let fiat drop below 10%"). The enforcer respects pins before proportional distribution.

### Visual feedback
Every successful rebalance emits a `flow` event with magnitude `|Δ|`, which drives `flowVelocity` and the particle animation on the wallet page.

---

## 2. Swarm Intelligence Aggregator

### Implementation (`stores/opinions.ts`)
```ts
swarmVector = normalize( Σᵢ wᵢ × agentᵢ.opinion_vector )
```
- `wᵢ` is the weight the user gives each plugged avatar (0–1). Plugs are saved on the server (`GET/PUT /api/v1/settings/plugs/`, `utils/plugsSync.ts`); the personal agent is plugged by default.
- `normalize()` ensures the result sums to 100%. A 4 s opinion tick re-aggregates the plugged agents' current opinions (`plugins/00.dataPipeline.ts:174-178`).
- The bot engine does **not** read plugs yet (backend todo.md).

### Modes
- **Advisory** — `swarmVector` is rendered as a ghost overlay on the wallet page; the user can accept it with one click.
- **Auto** — `swarmVector` is applied directly to the allocation enforcer on every tick.

### Diversity score
Computed in `stores/opinions.ts:245` (variance across plugged avatars' personality matrices). It is **not** shown by `<StrategyConsensusMeter>`, which reads only the predictions store.

---

## 3. Opinion Profiler (Article Analysis)

Every article read or share event enriches the user's opinion profile (`stores/opinionProfile.ts`, shown by `<ProfileOpinionProfileCard>` on `/profile/[id]`).

### Pipeline
1. **Capture** — `useAgentTracker` / `useTracking` log `article_read` / `article_share` with the post's NLP metadata.
2. **Decay-weighted average** — recent articles weigh more:
   ```
   leaning_new = α · post.leaning + (1 − α) · leaning_old     (α ≈ 0.15)
   ```
3. **Topic affinity** — increment histogram bucket for `post.category`.
4. **Influence web** — record `(reader_id, author_id, weight)` edges.

### Output
```ts
opinion_profile: {
  political_leaning: number      // -1..+1
  economic_leaning: number       // -1..+1
  topic_affinity: Record<Category, number>
  influence_web: Array<{ from: UserId; weight: number }>
}
```
News reactions/comments are still local to the browser (`stores/news.ts`), so the server opinions lane has no data until they are wired (Todo 40.6).

---

## 4. Paper Trading Engine

Paper trades are simulated bets. Two ledgers exist today (one should win — Todo 43.19):

1. **Browser ledger** — `stores/paper.ts`: `placeOrder` marks the order to the current price and appends a row; persisted per user in localStorage `strades_paper_ledger_v1` via `utils/userStorage` (`stores/paper.ts:64`). Written by `<AssetQuickPaperBet>` on /assets/[id] and /CandleChart; read by `<WalletPaperPanel>` and /historic.
2. **Server portfolio** — `<WalletHandTrade>` on /wallet → `POST /api/v1/portfolio/trade/` (`apps/finance`, live Binance price). The /wallet KPI reads it through `useOwnBook()`. Contract C1 (`client_id`, `fill`) is wave 2 — landing.

Bots trade on the server (`apps/trading` chainbot engine via `POST /api/v1/wallets/<id>/bots/`); their fills are listed on /trade and /bots/[id].

### Browser ledger schema
```ts
PaperTrade {
  id: string
  timestamp: string
  asset_id: string
  side: 'buy' | 'sell'
  wallet_pct: number              // 0–100
  simulated_price: number
  hypothetical_pnl_pct: number    // marked-to-market; "—" when there is no live price
  strategy_id?: string
  is_paper: true
}
```

### Historical replay
`pages/historic.vue` merges server history (`GET /api/v1/history/`), the browser paper ledger, unsynced calls and followed agents (`utils/historyTimeline.ts`) into one past · now · next timeline.

---

## 5. Strategy code source and backtests

The catalog in `public/data/core/strategies.json` is the identity for a sample strategy. `utils/strategyCode.ts` (`strategyToCodeView`, `strategyToStrategyCode`) is what the summarizer, complements, and opposites read. `public/data/strategies/codes/*.json` is legacy and must not be fetched.

The user's own strategies are saved on the server (`/api/v1/strategies/`) and backtested there (`POST /api/v1/strategies/<id>/backtest/`, called from `pages/creator.vue` and `pages/strategy/[id].vue` via `backtestReal`); the result carries `assumptions` (capital, fee, slippage from Settings › Primary values). Editing a saved strategy needs `PATCH` (contract C7, wave 2 — landing).

---

## 6. Rendering performance (today)

- **CSS var batching**: `DynamicThemeController` collects all macro-driven CSS var changes per frame and writes them in a single `style.setProperty` batch.
- **Freshness** = REST polling + synthetic ticks (README § Architecture). Graphs render SVG.

---

## 7. Mock Data Generation Rules

When authoring new mock data, respect these invariants:

1. **Opinion vectors sum to 100.** Never emit `{ fiat: 30, crypto: 30, stocks: 30, commodities: 30 }`.
2. **Political & economic leanings are in [-1, 1].** Most users should sit between -0.6 and +0.6.
3. **Controversy index is in [0, 1].** > 0.7 should be rare.
4. **Avatar personality matrices are in [0, 1].** Avoid all-five-axes-at-0.5.
5. **Paper trades use `wallet_pct`, never absolute amounts** in the browser ledger.
6. **Every post must have a valid `geographic_origin`** so the news globe always has somewhere to point.
7. **`published_at` is ISO-8601 UTC.**
8. **Mock data is labelled.** Anything from `public/data/` shown as a number carries `<UISourceChip source="sample">`.

---

## 8. Backend plug-in points (status 2026-11-02)

| Browser side | Server side | Status |
|---|---|---|
| Price calls in `stores/predictions.ts` | `/api/v1/predictions/` (sync, scoring, `trader_features`) | ✅ mirrored by `plugins/predictionsSync.client.ts` |
| Behaviour events (`useTracking`, `useAgentTracker`) | `/api/auth/tracking/batch/` → `activity_daily` rollup → `apps/intelligence` | ✅ |
| Avatar / profile | `apps/intelligence` (`/api/v1/intelligence/*`) | ✅ server; `stores/training.ts` stays a simulated animation |
| Backtests | `POST /api/v1/strategies/<id>/backtest/` | ✅ (`useBacktest.ts` GBM path is no longer what Creator/Strategy pages call) |
| Plugs, primary values | `/api/v1/settings/plugs/`, `/api/v1/settings/primary/` | ✅ stored; engine reads primary values for bot risk budget, not plugs |
| Paper ledger | `/api/v1/portfolio/trade/` | ⚠ two ledgers (§4) |
| News interactions | `/api/v1/news/…` | ✗ not called (Todo 40.6) |
| Live feed | — | ✗ polling only (Roadmap) |

Model training stays off the request path: `upkeep` runs `analyse` each pass and `analyse --full` daily (backend `docs/intelligence.md`, `docs/data-pipeline.md`).

---

## 9. Agent contract

Strades is a social desk: people build avatars together, and the avatars learn from those people's trades, reads, and attention (server-side, §0).

Before changing a surface, read README.md (doc map), `utils/routes.ts`, Design.md, Data.md, Structure.md, this file and Todo.md, plus `Strades-comms/PROCESSES.md` for the user job the surface belongs to. Do not invent a parallel vocabulary.

Every agent action is one log row. `stores/activityLog.ts` and `middleware/logKeeper.global.ts` write all six fields:

| Field | Meaning |
| --- | --- |
| where | Page, route, component |
| who | Actor id and role: user, avatar, swarm, or system |
| what | Action, target, category |
| when | ISO-8601 UTC on the row |
| why | Intent and context |
| how | Method name and the inputs it used |

`log()` fills `who` with the session user and `how` with the action name when a caller omits them. A folded summary keeps the first row's who and how. Numeric features stay inside the ranges in section 7. Font scale is clamped to [0.85, 1.2].

---

## Roadmap (not built)

Kept as design notes. None of this runs today; do not describe it as implemented.

### R1. In-browser avatar training pipeline (superseded by the server, §0)
- Feature vector per user: `risk_appetite`, `reaction_speed_ms`, `patience`, `aggression`, `contrarian`, `political_leaning`, `economic_leaning`, `active_hours`, `topic_affinity`.
- Compression into the 5-axis personality matrix (`risk, aggression, reaction_speed, patience, contrarian ∈ [0,1]`) by PCA.
- Opinion vector `softmax(W · features) × 100` with a learned `W`; reward `reward_ema_pnl` = 30-day EMA of the P&L the opinion vector would have made.

### R2. Friend small multiples
The profile page would compare the user's leaning to their five closest friends.

### R3. Predictive pre-fetching
A Markov-chain model in a WebWorker would predict the next click from hover duration, page and time of day and `$fetch` the target page's JSON when `P(click) > 0.65`. `stores/prefetch.ts` exists but `prefetchRoute` has no caller; hovering a dock tab only plays a sound.

### R4. Real-time rendering
WebSocket batching (100 ms chunks via `requestAnimationFrame`), WebWorker d3-force physics, automatic SVG → Canvas swap above 500 nodes.
