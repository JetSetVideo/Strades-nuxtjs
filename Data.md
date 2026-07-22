# Data Structure & Inheritance Schema

This document is the **exhaustive data backbone** of Strades. Every data point listed here must influence the UI visually — as raw numbers, text, or as a secondary modifier of a component's form, color, size, or animation.

Data sources live under `public/data/` and are hydrated into Pinia stores at boot via `plugins/00.dataPipeline.client.ts`. Nothing fetches macro state independently.

---

## 0. Data Source Map

| Path | Store(s) | Domain |
|------|-----------|--------|
| `global/macro_state.json` | `macro.ts` | Global market state |
| `global/events.json` | `macro.ts` | Calendar events |
| `global/user_preferences.json` | `userPreferences.ts` | Logged-in user prefs |
| `core/wallets.json` | `wallet.ts` | Wallet + positions |
| `core/wallet_history.json` | `wallet.ts` | Historical P&L |
| `core/users.json` | `users.ts` | User profiles (legacy) |
| `user/users.json` | `users.ts` | Canonical user profiles |
| `core/strategies.json` + `strategies/**` | `strategies.ts` | Strategy catalog |
| `core/bots.json` | `bots.ts` | Bots (running agents) |
| `core/community.json` | `community.ts` | Friends / followers |
| `core/influencers.json` | `influencers.ts` | Signal providers |
| `core/trading_platforms.json` | `platforms.ts` | Connected platforms |
| `agents/avatars.json` | `agents.ts` | AI avatars (swarm nodes) |
| `agents/training_log.json` | `training.ts` | Avatar training history |
| `social/posts.json` | (fetched by pages) | Social posts + NLP enrichment |
| `social/notifications.json` | (via `notifications`) | Notifications |
| `social/bookmarks.json` | `news.ts` | Article bookmarks |
| `chat/conversations.json`, `chat/messages.json` | `chat.ts` | Messaging |
| `companies/{apple,amazon,tesla}.json` | (per-page) | Corporate deep-dives |
| `supply_chain/{btc,eth,sol,aapl,amzn,tsla,usd,eur,cny}.json` | (per-page) | Supply chain graphs |
| `relationships/*.json` | (per-page) | Company/industry/strategy/user graphs |
| `competitions/*.json` | (per-page) | Leaderboards |
| `quests/*.json` | (per-page) | Gamification |
| `tracking/*.json` | `tracking.ts` | Behavior analytics |
| `predictions.json` | `predictions.ts` | Community predictions |
| `shared_data.json` | `sharedData.ts` | Cross-user shared items |
| `search/{suggestions,history}.json` | (per-page) | Search |

---

## 1. Global State (Top of the Inheritance Tree)

### `global/macro_state.json`
*Influences global theme, animation speeds, and lighting engine.*

| Key | Type | Description | Visual mapping |
|-----|------|-------------|----------------|
| `global_volatility_index` | 0.0–1.0 | Market chaos level | `--app-animation-speed` (0.3s–1.5s); Prices-icon pulse frequency |
| `geopolitical_stress` | 0.0–1.0 | Global tension | `--app-lighting-hue` shifts toward warm/amber |
| `market_sentiment` | -1.0–1.0 | Bear ↔ bull | Shadow depth + lighting angle |
| `dominant_asset_class` | enum | `fiat`/`crypto`/`stocks`/`commodities` | `--app-border-radius` (crypto=2px, fiat=16px) |
| `flow_velocity` | 0.0–1.0 | Capital movement rate | Particle speed on wallet page |
| `news_pulse_count` | int | Breaking-news counter | News icon pulse ring |
| `fear_greed` | 0–100 | CNN-style F&G index | Widget gauge + background saturation |
| `volatility_by_class` | object | Per-class volatility | Mini-sparkline speed per asset class |

---

## 2. Market & Corporate Intelligence

### `core/assets.json` *(via `assets.ts`)*
| Key | Visual mapping |
|-----|----------------|
| `id`, `symbol`, `category` | Text + icon |
| `nominal_price_usd` | Converted to user's base currency |
| `liquidity_depth` | Card glow radius + slight scale |
| `fluctuation_velocity` | Node pulse in NetworkGraph |

### `companies/{id}.json` & `supply_chain/{id}.json`
| Key | Visual mapping |
|-----|----------------|
| `market_cap` | Treemap node size |
| `employees[]` | Sub-node count in structural graph |
| `factories[].status` | Color of factory nodes (green/yellow/red) |
| `supply_chain_health` | Link thickness in NetworkGraph |
| `suppliers[]`, `customers[]` | Directional edges in D3 force layout |

---

## 3. Wallet & 100% Allocation Engine

### `core/wallets.json` (via `wallet.ts`)
| Key | Type | Visual mapping |
|-----|------|----------------|
| `total_value`, `available_balance`, `invested_amount` | number | Hero KPIs |
| `assets[]` | array | Positions table; `allocation_percentage` drives row height |
| `performance_history` | object | Equity curve ranges |
| `transactions[]` | array | Trades table; `type=buy/sell` color coding |

### `allocation.ts` (in-memory, not a JSON file)
The 100% allocation engine. Holds:
- `allocationPie: { fiat, crypto, stocks, commodities }` — **sums to exactly 100**
- `flowVelocity` — drives particle animation
- `updateAllocation(category, newPct)` — mathematically redistributes the difference across the other three classes proportionally.

### Paper Trading Ledger (in-memory + `tracking/activity_log.json`)
| Field | Description |
|-------|-------------|
| `is_paper` | Distinguishes simulated from real transactions |
| `wallet_pct` | Trade size as % of total wallet (never absolute amount in paper mode) |
| `simulated_price` | Execution price at simulation time |
| `hypothetical_pnl` | Mark-to-market P&L if closed now |
| `strategy_id` | Which strategy (if any) triggered the trade |

---

## 4. Strategy & Node Graph

### `core/strategies.json` + `strategies/codes/*.json`
| Key | Visual mapping |
|-----|----------------|
| `nodes[].type` | Shape (square=condition, circle=action, hexagon=avatar, diamond=opinion) |
| `nodes[].confidence_score` | Node opacity (`0.4 + 0.6 × score`) |
| `nodes[].execution_frequency` | Heartbeat pulse speed |
| `edges[].capital_flow` | D3 link stroke width |
| `target_assets[]` | Chips on the strategy card |
| `is_paper` | Paper-trade badge |

---

## 5. AI Avatars & Swarm Intelligence

### `agents/avatars.json` (via `agents.ts`)

```ts
interface Agent {
  id: string
  name: string
  owner_id: string             // User this avatar was trained from
  kind: 'personal' | 'public' | 'forked' | 'private'
  personality_matrix: {
    risk: number               // 0–1 conservative ↔ aggressive
    aggression: number         // 0–1 passive ↔ active
    reaction_speed: number     // 0–1 slow ↔ fast
    patience: number           // 0–1 impulsive ↔ patient
    contrarian: number         // 0–1 trend-follower ↔ contrarian
  }
  opinion_vector: {            // Sums to 100
    fiat: number
    crypto: number
    stocks: number
    commodities: number
  }
  trading_style: string
  specialization: AssetClass[]
  confidence: number           // 0–1
  training_state: {
    epochs: number
    samples_observed: number
    loss_ema: number           // Lower = better trained
    reward_ema_pnl: number     // P&L-based reward
    status: 'idle' | 'training' | 'live' | 'paused'
  }
  performance: {
    live_pnl_pct: number
    backtest_pnl_pct: number
    win_rate: number
    sharpe: number
    max_drawdown_pct: number
    trades_total: number
    last_30d_curve: number[]
  }
  share_state: {
    is_public: boolean
    price_credits: number      // Cost to plug into someone else's strategy
    license: 'private' | 'swarm-readonly' | 'open'
  }
}
```

**Visual mappings:**
- `personality_matrix.risk` → avatar frame shape (hexagon vs circle)
- `confidence` → avatar opacity
- `training_state.loss_ema` → progress ring around avatar image
- `opinion_vector` → mini stacked bar on the avatar card
- `performance.last_30d_curve` → sparkline on the avatar card

### Swarm aggregation (in `stores/opinions.ts`)
When a user plugs N avatars with weights `w₁..wₙ`:
```
swarmVector = normalize( Σᵢ wᵢ × agentᵢ.opinion_vector )
```
The result is normalized to sum to 100% and can be:
- **Advisory** — rendered as a ghost pie overlay on the wallet.
- **Auto** — directly applied to the 100% allocation engine.

---

## 6. Social Platform & Article NLP

### `social/posts.json`
*The canonical schema (normalized). All consumers must use this shape.*

```ts
interface Post {
  id: string
  author_id: string
  title?: string
  content: string
  type?: 'analysis' | 'research' | 'trade_idea' | 'opinion' | 'alert'
  category?: 'crypto' | 'stocks' | 'forex' | 'commodities' | 'macro'
  assets?: string[]                     // Tickers mentioned
  geographic_origin?: { lat: number; lng: number; name?: string }
  political_leaning: number             // -1.0 left ↔ +1.0 right
  economic_leaning?: number             // -1.0 dove ↔ +1.0 hawk
  sentiment?: number                    // -1.0 bearish ↔ +1.0 bullish
  controversy_index: number             // 0–1
  weight?: number                       // Editorial weight 0–1
  embedded_allocation?: AllocationPie   // Author's 100% pie
  published_at: string                  // ISO timestamp
  interactions: {
    likes: number
    comments: number
    shares: number
    bookmarks?: number
  }
  tags?: string[]
  is_pinned?: boolean
}
```

**Visual mappings:**
| Field | Mapping |
|-------|---------|
| `political_leaning` | Card background tint (blue ↔ red) |
| `economic_leaning` | Dove↔hawk axis under title |
| `sentiment` | Bull/bear icon color |
| `controversy_index` | Comment icon shake animation if > 0.6 |
| `embedded_allocation` | Inline mini-pie inside the post |
| `weight` | Sort order + slight font-size scaling |
| `geographic_origin` | Drives News globe rotation |

### Article → User Opinion Profile
A background job (currently mocked in `tracking.ts`) aggregates each user's read + shared posts to compute:
- `opinion_profile.political_leaning` — weighted moving average
- `opinion_profile.economic_leaning` — weighted moving average
- `opinion_profile.topic_affinity` — histogram of categories engaged with
- `opinion_profile.influence_web` — graph of who influences this user

These roll up into `Profile/PoliticalCard.vue` and feed back into the avatar's training features.

---

## 7. User Profiles

### `user/users.json` (canonical)
Key fields beyond identity:
| Field | Purpose |
|-------|---------|
| `risk_tolerance`, `trading_experience`, `trading_style` | Drive UI density & avatar prior |
| `psychology` | MBTI, FOMO, revenge-trading, loss-aversion — used in PsychCard |
| `political_profile` | Derived from article analysis |
| `investor_profile` | Derived from wallet history |
| `xp`, `level`, `achievements[]` | Gamification |
| `followers_count`, `following_count` | Social graph size |
| `communities[]` | Group memberships |

---

## 8. Messaging

### `chat/conversations.json` + `chat/messages.json`
| Field | Visual mapping |
|-------|----------------|
| `unread_count` | Badge |
| `emotional_urgency` | Chat icon pulse speed |
| `attached_assets[]` | Inline ticker chips in messages |
| `shared_strategy_id` | Inline strategy card |

---

## 9. Tracking & Behavioral Analytics

### `tracking/user_interactions.json`
Raw event stream. Each event has:
- `event_type` — page_view / component_interaction / asset_view / trade_execution / article_read / article_share
- `duration_ms` — dwell time (used as a proxy for interest)
- `metadata` — free-form JSON (e.g. `{ article_id, political_leaning }` for article reads)

This stream is the **training data** for the avatar ML pipeline and the opinion profiler.

---

## 10. Visual State Inheritance Summary

```
macro_state ────┬─> DynamicThemeController ─> :root CSS vars
                ├─> Navigation icons
                └─> Every page background

allocationPie ──┬─> WalletIcon (nav)
                ├─> AllocationSlider
                └─> Wallet page layout proportions

avatars[] ──────┬─> Agent cards
                ├─> SwarmPlugs (creator)
                ├─> Builder/Nodes/AvatarNode
                └─> Profile/AvatarsSection

posts[] ────────┬─> News globe rotation
                ├─> Social/ArticlePost
                ├─> Profile/PostsFeed
                └─> Profile/PoliticalCard (aggregate)

tracking[] ─────┬─> Avatar training pipeline
                ├─> Opinion profiler
                └─> Prefetch engine
```
