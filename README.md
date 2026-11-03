# Strades

> **A gamified trading hub that centralizes every trading platform, profiles each user into a living AI avatar, and harnesses swarm intelligence so humans predict better in groups.**

Strades is a closed-beta, **paper-trading** social platform: no real money moves, no order is executed. Users see markets, paper-trade ideas, make price calls, talk and share with other traders, review their own wallets/bots/strategies, and direct a behaviour profile ("avatar") that the server learns from what they do. Every number on screen is either the user's own, paper, sample, simulated or pending — and says so (`<UISourceChip>`).

---

## Five user jobs

Everything in the app serves one of five jobs: **trade** (Prices → asset → paper order → Wallet/History), **predict** (Markets › Predict or an asset page → call → pending → scored), **communicate / share / comment** (Chat dock, News, articles), **review** wallets, agents and strategies (Wallet dock, Lab dock), and **direct + train** the avatar (drawer → You / Profile, Insights, Settings). The step-by-step map — which page, which click, which component, which endpoint, what works and what is missing — lives in **`~/Desktop/Strades-comms/PROCESSES.md` § "Five user jobs"**; the component → page → job table is the latest swarm `COMPONENT-MAP*.md`.

---

## The Vision

Strades is built around a single belief: **the best market predictions come from groups of humans, not from isolated individuals or opaque algorithms.**

1. **Centralize** — connect trading platforms into one wallet view; balances, positions and histories flow into a single 100% allocation pie.
2. **Profile** — interactions (pages, reads, shares, calls, paper trades, strategies followed) are tracked in batches (`composables/useTracking.ts` → `/api/auth/tracking/batch/`) and rolled up **server-side** into a behaviour profile.
3. **Avatar** — the learned avatar is computed by the backend (`apps/intelligence`, `GET /api/v1/intelligence/me/`; method in backend `docs/intelligence.md`) and shown on `/profile` (`<IntelligenceAvatar>`, `<IntelligenceMirror>`). The in-browser "training" buffer (`stores/training.ts`) is a **simulated** animation (random reward, in memory, resets on reload) — it is not the user's model.
4. **Swarm** — avatars and agents can be plugged into other users' strategies (`/agents`, `/creator`); plugs are saved via `/api/v1/settings/plugs/`. The swarm vector is the weighted sum of plugged opinions, normalized to 100% (`stores/opinions.ts`).
5. **Paper-trade everything** — paper orders are logged so users can review "what would have happened". Two ledgers exist today: the browser ledger (`stores/paper.ts`, per-user localStorage `strades_paper_ledger_v1`) and the server portfolio (`<WalletHandTrade>` → `POST /api/v1/portfolio/trade/`); see Data.md §3.
6. **Read the news together** — the backend serves a news API with comments, reactions and shares (`apps/news`); the `/news` workspace still stores its interactions locally (Todo 40.6).

---

## The 4 Distinct Pillars

### 1. Market & Corporate Intelligence
Prices, corporate data and the web between companies, suppliers, clients and competitors. Asset pages carry a supply-chain tree and a world map.

### 2. Social Platform & Article Analysis
News and posts enriched with topic, political/economic leaning, sentiment, controversy and the author's allocation. These roll up into each user's *Opinion Profile* (`stores/opinionProfile.ts`).

### 3. Wallet & Strategy Creator (The 100% Allocation Engine)
`fiat + crypto + stocks + commodities = 100%`. The strategy creator (`/creator`) wires conditions, actions, data sources and other users' avatars; strategies are saved and backtested on the server (`/api/v1/strategies/`, `…/backtest/`).

### 4. Messaging & Community
Conversations, reactions and shared context (`/chat`, `/conversations/[id]`, `/api/v1/social/…`). Society bots seeded on the backend give a new user people to talk to.

---

## Core Paradigms

### 100% Perpetual Allocation
The wallet is a closed pie. Allocation sliders squeeze; they never simply add.

### Living Navigation & Micro-Dashboards
The five dock icons are small live components (owner of this list: **Design.md §2**; registry of pages, areas and labels: `utils/routes.ts`).

### Data-Driven UI Metamorphosis
Secondary data shapes the UI: volatility drives animation speed, geopolitical stress shifts ambient hue, risk tolerance drives border radius (Design.md).

---

## Architecture (how it works today)

- **Loading & State**: boot data is loaded once in `plugins/00.dataPipeline.ts` (server + client) and inherited downwards; Pinia stores are the source of truth.
- **Freshness = polling + synthetic ticks.** Server data is re-fetched on intervals (quotes through the Nuxt route `/api/market/quotes`, notifications in `stores/notifications.ts:135`); the remaining motion is synthetic ticks started after hydration (`plugins/00.dataPipeline.ts:120-178`). There is **no WebSocket** feed and **no Markov/WebWorker prefetcher** (`stores/prefetch.ts` has no caller). Those remain roadmap items (CodingAgent.md § Roadmap).
- **API**: the Django backend (`../Strades-backend`) at `/api/v1/…`, auth at `/api/auth/…` (httpOnly refresh cookie `strades_rt`). Contract: `~/Desktop/Strades-comms/API.md`.

---

## Documentation Map

| File | Owns |
|---|---|
| [README.md](./README.md) | Vision, five jobs, run, this map |
| [Structure.md](./Structure.md) | Architecture, boot pipeline, store layout, component folder **rules** |
| [Design.md](./Design.md) | Brand, dock icons (§2), menu/areas (§10), living-UI rules, data → form/colour/motion |
| [Data.md](./Data.md) | Data contracts: JSON files and server endpoints each store reads, paper ledgers |
| [Components.md](./Components.md) | Component notes by job; full table = swarm `COMPONENT-MAP*.md` |
| [CodingAgent.md](./CodingAgent.md) | Algorithms that exist (allocation, swarm, paper engine) + Roadmap (not built) |
| [Todo.md](./Todo.md) | Done / open ledger (latest phase on top of the open list) |
| `utils/routes.ts` | THE page registry: 6 areas, 5 dock tabs, drawer groups, labels |
| `~/Desktop/Strades-comms/PROCESSES.md` | Five user jobs step by step (who/what/where/when/why) |
| `~/Desktop/Strades-comms/API.md` | HTTP contract with the backend |

---

## Run & test

```bash
deno task dev     # nuxt dev → http://localhost:3000 (backend on http://127.0.0.1:8000, see backend startup.md)
deno task test    # vitest run
deno task build   # nuxt build
```

## Technical Stack

| Layer | Choice |
|-------|--------|
| Framework | Nuxt 4 (SSR) |
| Runtime | Deno tasks / Node-compatible |
| Language | TypeScript |
| Frontend | Vue 3 Composition API |
| State | Pinia |
| Visualization | D3.js + Canvas/SVG |
| Freshness | REST polling + synthetic ticks (no WebSocket) |
| Build / test | Vite, Vitest |

---

## Where to Go From Here

- **New contributor?** README → `utils/routes.ts` → Structure.md → PROCESSES.md (five jobs) → COMPONENT-MAP.
- **Designer?** Design.md, then Components.md.
- **ML / avatar work?** Backend `docs/intelligence.md` (the real profile), then CodingAgent.md.
- **Building a page?** Register it in `utils/routes.ts`, follow Structure.md folder rules, reuse `components/UI/` (`<UISourceChip>`, `<UIValueTree>`, `<UIEmptyState>`), `utils/format.ts` and `composables/usePrimarySettings.ts`.
