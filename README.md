# Strades

> **A gamified trading hub that centralizes every trading platform, profiles each user into a living AI avatar, and harnesses swarm intelligence so humans predict better in groups.**

Strades is not just a dashboard — it is a continuously breathing, data-driven financial ecosystem. Users connect wallets from every trading platform, see their own trader profile and the profiles of others, paper-trade ideas without risking real money, and train an AI avatar that learns to trade exactly like they would. That avatar then becomes a pluggable node other users can drop into their own strategies — turning individual judgment into collective, swarm-level prediction.

---

## The Vision

Strades is built around a single belief: **the best market predictions come from groups of humans, not from isolated individuals or opaque algorithms.**

The application makes this concrete:

1. **Centralize** — connect every trading platform (Binance, Coinbase, IBKR, Kraken, …) into one wallet view. All balances, positions and histories flow into a single 100% allocation pie.
2. **Profile** — every click, scroll, dwell-time, article read, article shared, trade simulated, and strategy followed is tracked. These interactions are compressed into a trader profile that captures *who the user is as a market participant*.
3. **Avatar** — from that profile, Strades trains an AI avatar that mirrors the user's habits: their risk appetite, time-of-day activity, political & economic biases, reading preferences, and reaction speed. The avatar trades *like they would*.
4. **Swarm** — avatars can be shared, forked, and plugged into other users' strategy graphs. Combining many avatars creates a weighted swarm vector that outperforms any single trader.
5. **Paper-trade everything** — users can simulate any idea as a *percentage of their wallet* without touching real money. Simulated trades write to historical logs, so users can review "what would have happened" alongside their real activity.
6. **Read the news together** — articles read and shared are NLP-analyzed for topic, author, audience, opinion polarity, embedded data, political leaning and economic leaning. This builds a social knowledge graph: *who reads what, who influences whom, and what opinions define each user and their friends*.

---

## The 4 Distinct Pillars

### 1. Market & Corporate Intelligence
Watch live prices, deep corporate data, and the living web between companies, employees, factories, suppliers, clients and competitors. Every asset has a supply-chain graph, a sentiment fingerprint and a fluctuation velocity.

### 2. Social Platform & Article Analysis
An opinion and news engine where users post articles, alerts, and market theses. NLP enriches every post with:
- **Topic classification** (crypto / stocks / forex / commodities / macro)
- **Political leaning** (-1.0 left → +1.0 right)
- **Economic leaning** (-1.0 dovish/pro-stimulus → +1.0 hawkish/austerity)
- **Sentiment** (-1.0 bearish → +1.0 bullish)
- **Controversy index** (0.0 consensus → 1.0 polarized)
- **Embedded allocation** (the author's own 100% pie attached to the post)

These enrichments roll up into each user's *Opinion Profile* — a living vector of political + economic beliefs — and the same is computed for their friends, so the social graph carries ideological signal.

### 3. Wallet & Strategy Creator (The 100% Allocation Engine)
Capital is never idle. Holding fiat is an active strategy. The wallet mathematically enforces that `fiat + crypto + stocks + commodities = 100%`. A node-based strategy creator lets users wire conditions, actions, macro data sources, *other users' avatars*, and swarm vectors into an automated rebalancing code.

**Paper trading** is built in: any strategy can run in simulation mode, betting percentages of the wallet as fake transactions. Every simulated fill is logged to a historical paper-trading ledger the user can audit.

### 4. Messaging & Community
A robust messaging layer where users share live strategies, debate articles, and form trading communities. Conversations carry inline tickers and embedded allocations. Community consensus feeds back into the swarm engine.

---

## Core Paradigms

### 100% Perpetual Allocation
The wallet is a closed pie. Increasing any asset class automatically compresses the others. Allocation sliders squeeze; they never simply add.

### Living Navigation & Micro-Dashboards
Every menu icon is a tiny live component:
- **Prices icon** pulses at a frequency derived from global volatility.
- **News globe** rotates to face the geographic origin of the latest high-weight post.
- **Wallet icon** is a miniature live pie chart of the 100% allocation.
- **Chat badge** pulses with the emotional urgency of unread messages.
- **Strategy orbit** spins at the frequency of the user's most active bot.

### User AI Avatars (Swarm Intelligence)
Every user cultivates an avatar trained from their tracked behavior. Avatars expose:
- A **personality matrix** (risk / aggression / reaction_speed / patience / contrarian)
- An **opinion vector** (fiat/crypto/stocks/commodities weights summing to 100%)
- A **trading style** and **specializations**
- A **performance record** from both backtests and live paper trading

Other users can drop these avatars into their node-based strategy graphs. The swarm opinion vector is the weighted sum of all plugged avatars, normalized to 100%.

### Paper Trading with Historical Logs
Simulated trades are not ephemeral — they write real rows into a paper-trading log. Users can:
- See every simulated transaction (timestamp, asset, % of wallet, price, P&L).
- Replay simulations against historical market data.
- Compare simulated vs. real performance side-by-side.

### Article-Derived Opinion Profiles
The articles a user reads and shares are continuously mined to maintain:
- A **political leaning score** and **economic leaning score** per user.
- A **topic affinity map** (which sectors they pay attention to).
- A **friend-graph influence web** — whose posts they engage with, and how that shifts their own scores over time.

### Data-Driven UI Metamorphosis
Secondary data physically shapes the UI. Volatility drives animation speed. Geopolitical stress shifts ambient lighting hue. Risk tolerance drives border radius. Dominant asset class drives the visual motif (crypto = sharp/cyber, fiat = soft/banking).

---

## Methodical Top-to-Bottom Architecture

- **Loading & State**: Data is fetched once globally and inherited downwards. Pinia stores are the single source of truth — no component fetches macro data independently.
- **Predictive Pre-fetching**: A Markov-chain engine in a WebWorker watches hover intent and pre-caches the next page's payload, giving zero-latency transitions.
- **WebSocket Batching**: Live updates arrive in 100ms batches, applied via `requestAnimationFrame` to keep 60fps rendering under load.

---

## Documentation Map

- **[Data.md](./Data.md)** — Exhaustive data schema: macro indicators, allocation rules, avatar model, post NLP fields, paper-trading ledger, and visual-state mappings. *Start here for the data backbone.*
- **[Structure.md](./Structure.md)** — Data inheritance tree, Pinia store layout, WebSocket batching, component folder rules.
- **[Design.md](./Design.md)** — User journey, living-UI rules, and how secondary data maps to form, size, color, and animation.
- **[Components.md](./Components.md)** — Per-component mapping of data keys to visual props and living behaviors.
- **[CodingAgent.md](./CodingAgent.md)** — Avatar training pipeline, swarm aggregation algorithm, 100% enforcer, predictive pre-fetch, paper-trading engine.
- **[Todo.md](./Todo.md)** — Granular, actionable execution plan with phase tracking.

---

## Technical Stack

| Layer | Choice |
|-------|--------|
| Framework | Nuxt.js 4 (SSR + static generation) |
| Runtime | Node.js 22.x |
| Language | TypeScript |
| Frontend | Vue 3 Composition API (`v-memo`, Provide/Inject) |
| State | Pinia |
| Visualization | D3.js + Canvas API |
| Real-time | WebSocket (batched) |
| Build | Vite |

---

## Where to Go From Here

- **New contributor?** Read `Data.md` → `Structure.md` → `Components.md` in that order.
- **Designer?** Read `Design.md` and `Components.md` only.
- **ML engineer?** Read `CodingAgent.md` and the avatar / swarm sections of `Data.md`.
- **Building a page?** Follow the folder rules in `Structure.md` and pick primitives from `components/UI/`.
