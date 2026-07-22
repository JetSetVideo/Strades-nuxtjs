# Coding Agent & AI Implementation Schema

This document details the ML pipelines, allocation enforcer, swarm aggregator, opinion profiler, and paper-trading engine that power Strades.

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

## 2. Avatar Training Pipeline

The avatar learns to trade *like the user would*. Training is currently simulated client-side; the schema is designed so a real backend can plug in later without changing the frontend contract.

### 2.1 Feature engineering (tracking → tensors)
Raw events from `tracking/user_interactions.json` are aggregated per user into a feature vector:

| Feature | Derived from |
|---------|--------------|
| `risk_appetite` | Avg % of wallet allocated to crypto + commodities during volatile periods |
| `reaction_speed_ms` | Time between a high-weight news event and the user's next allocation change |
| `patience` | Median hold time across paper trades |
| `aggression` | Avg trade size as % of wallet |
| `contrarian` | Correlation between user's buys and crowd sentiment (negative = contrarian) |
| `political_leaning` | Weighted moving average of `political_leaning` across articles read |
| `economic_leaning` | Weighted moving average of `economic_leaning` across articles read |
| `active_hours` | Histogram of activity by hour of day |
| `topic_affinity` | Histogram of article categories engaged with |

### 2.2 Personality matrix compression
The feature vector is compressed (PCA in the real pipeline; simple weighted sums in the mock) into the 5-axis personality matrix exposed on `Agent.personality_matrix`:
```
risk, aggression, reaction_speed, patience, contrarian   ∈ [0, 1]
```

### 2.3 Opinion vector emission
Every pipeline tick, the avatar emits an opinion vector:
```
opinion_vector = softmax( W · features ) × 100
```
where `W` is a learned weight matrix. The vector always sums to 100 — it is a valid input to the allocation enforcer.

### 2.4 Reinforcement learning reward
`reward_ema_pnl` is an exponential moving average of the P&L the avatar would have generated over the last 30 days had its opinion vector been applied to the user's wallet. This is the primary training signal.

---

## 3. Swarm Intelligence Aggregator

The swarm opinion is the whole point of Strades.

### Implementation (`stores/opinions.ts`)
```ts
swarmVector = normalize( Σᵢ wᵢ × agentᵢ.opinion_vector )
```
- `wᵢ` is the weight the user gives each plugged avatar (0–1).
- `normalize()` ensures the result sums to 100%.

### Modes
- **Advisory** — `swarmVector` is rendered as a ghost overlay on the wallet page; the user can accept it with one click.
- **Auto** — `swarmVector` is applied directly to the allocation enforcer on every tick.

### Diversity bonus
The aggregator computes a **diversity score** = variance across plugged avatars' personality matrices. Higher diversity → higher confidence in the swarm vector (wisdom of crowds requires *independent* opinions). This score is surfaced in `Strategy/ConsensusMeter.vue`.

---

## 4. Opinion Profiler (Article Analysis)

Every article read or share event enriches the user's opinion profile.

### Pipeline
1. **Capture** — `tracking` store logs `article_read` / `article_share` with the post's NLP metadata.
2. **Decay-weighted average** — recent articles weigh more:
   ```
   leaning_new = α · post.leaning + (1 − α) · leaning_old     (α ≈ 0.15)
   ```
3. **Topic affinity** — increment histogram bucket for `post.category`.
4. **Influence web** — record `(reader_id, author_id, weight)` edges. Used to render the "influenced by" graph on the profile page.

### Output (stored on the user record)
```ts
opinion_profile: {
  political_leaning: number      // -1..+1
  economic_leaning: number       // -1..+1
  topic_affinity: Record<Category, number>
  influence_web: Array<{ from: UserId; weight: number }>
}
```

### Friend aggregation
The same pipeline runs for every friend. The profile page renders a small multiples chart comparing the user's leaning to their five closest friends, so users can see how their circle skews.

---

## 5. Paper Trading Engine

Paper trades are simulated bets expressed as **percentages of the wallet**, never absolute amounts.

### Flow
1. User toggles *Paper* mode on the wallet page.
2. Any strategy or manual action generates a `PaperOrder { asset_id, wallet_pct, side }`.
3. The engine marks the order to the current mid-price and writes a row to the paper ledger.
4. The ledger is persisted to `tracking/activity_log.json` so it survives reloads.

### Ledger schema
```ts
PaperTrade {
  id: string
  timestamp: string
  asset_id: string
  side: 'buy' | 'sell'
  wallet_pct: number              // 0–100
  simulated_price: number
  hypothetical_pnl_pct: number    // marked-to-market
  strategy_id?: string
  is_paper: true
}
```

### Historical replay
`pages/historic.vue` filters the activity log by `is_paper` and renders the paper ledger with a dotted left border. Users can toggle *Live* / *Paper* / *Both* to compare their simulated decisions against real ones.

---

## 6. Predictive Pre-fetching Engine

A Markov-chain model in a WebWorker predicts the next click.

### Implementation (`stores/prefetch.ts`)
- **Inputs**: mouse coordinates, hover duration on nav icons, current page, time of day, historical `behavioral_history.click_priors`.
- **Trigger**: hover > 200 ms on any nav icon.
- **Action**: if `P(click) > 0.65`, silently `$fetch` the target page's JSON into the relevant Pinia store.

### Routes currently wired
```ts
{
  '/news':   ['/news.json', '/data/social/posts.json'],
  '/wallet': ['/data/core/wallets.json', '/data/core/wallet_history.json'],
  '/profile/[id]': ['/data/user/users.json', '/data/social/posts.json'],
  '/creator': ['/data/agents/avatars.json', '/data/core/strategies.json']
}
```

---

## 7. Real-time Rendering Performance

- **WebSocket batching**: 100 ms chunks, applied via `requestAnimationFrame`.
- **CSS var batching**: `DynamicThemeController` collects all macro-driven CSS var changes per frame and writes them in a single `style.setProperty` batch.
- **WebWorkers**: D3 force simulations for `Corporate/NetworkGraph.vue` and `Builder/NodeCanvas.vue` run off the main thread. Workers return flat `[id, x, y]` arrays.
- **Canvas swap**: any graph with > 500 nodes switches from SVG to Canvas automatically.

---

## 8. Mock Data Generation Rules

When authoring new mock data, respect these invariants:

1. **Opinion vectors sum to 100.** Never emit `{ fiat: 30, crypto: 30, stocks: 30, commodities: 30 }`.
2. **Political & economic leanings are in [-1, 1].** Most users should sit between -0.6 and +0.6.
3. **Controversy index is in [0, 1].** > 0.7 should be rare (these are the posts that shake).
4. **Avatar personality matrices are in [0, 1].** Avoid all-five-axes-at-0.5 — that is a boring avatar.
5. **Paper trades use `wallet_pct`, never absolute amounts.** A paper trade is a *bet sizing decision*, not a transfer.
6. **Every post must have a valid `geographic_origin`** so the news globe always has somewhere to point.
7. **`published_at` is ISO-8601 UTC.** Never use locale-specific date strings.

---

## 9. Future Backend Plug-in Points

The frontend is designed so the following can be swapped to real services without UI changes:

| Current mock | Future service |
|--------------|----------------|
| `plugins/00.dataPipeline.client.ts` synthetic ticks | Real WebSocket feed |
| `useBacktest.ts` GBM simulation | Server-side backtester with real historical data |
| Avatar training in `agents.ts` | Python ML service (PyTorch / JAX) |
| Opinion profiler in `tracking.ts` | NLP service (transformer-based) |
| Paper ledger in `tracking/activity_log.json` | Postgres `paper_trades` table |
