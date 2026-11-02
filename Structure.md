# Application Structure & Data Inheritance

This document defines the top-to-bottom architecture of Strades: how data enters, which store owns it, and the folder rules for components. Page registry, areas and labels: `utils/routes.ts`. Component → page → job table: the latest swarm `COMPONENT-MAP*.md` (`~/Desktop/Strades-comms/swarm-2026-11-02/`). Process map: `Strades-comms/PROCESSES.md`.

## The Inheritance Tree: Top-to-Bottom Data Flow

Data flows downwards. Pinia stores are the single source of truth, filled by **REST calls (polling where freshness matters) and synthetic ticks** — there is no WebSocket feed — and distributed to the component tree via props and Pinia getters.

1. **Global App Layout (`app.vue`, `layouts/default.vue`)**
   - `plugins/00.dataPipeline.ts` fetches `global/macro_state.json`, preferences, and the wallet catalog on the server and the client, through `publicAssetUrl`.
   - *Provides* this macro state to the entire app. No component should fetch macro data independently.
   - Synthetic ticks (news pointer, training buffer drain, opinion re-aggregation) start in `app:mounted`, after the server markup has hydrated (`plugins/00.dataPipeline.ts:120-178`).

2. **Bottom Navigation (`components/Navigation/Bar.vue`)**
   - Renders the five Living Icons from `composables/useNavPanels.ts`. Which store field each icon reads is owned by **Design.md §2** (e.g. Lab = `strategies.ownStrategies`, `useNavPanels.ts:174-176`). The icons themselves never touch a store.

3. **Page Level (e.g., `pages/wallet.vue`)**
   - Checks if required data is already cached in Pinia (or a shared composable such as `useOwnBook()`); if not, requests it.
   - Listens to the `flow_velocity` state to determine the animation speeds of page-level components.

4. **Component Level (e.g., `components/Wallet/Hero.vue`)**
   - Purely reactive. Computes visual styles (forms, colors) based on the inherited macro state and specific prop data.

## State Management (Pinia Stores)

Stores are divided by domain. Which JSON file or server endpoint each store reads: **Data.md §0**.

### 1. `stores/macro.ts`
- **Role**: Manages `global_volatility_index`, `market_sentiment`, `geopolitical_stress`.
- **Optimization**: Throttles UI updates to max 30fps.

### 2. `stores/wallet.ts` and `stores/allocation.ts`
- **Role**: `wallet.ts` holds portfolios and the trade ledger. `allocation.ts` is the 100% engine (`fiat + crypto + stocks + commodities = 100`).
- **Logic**: When a strategy node shifts capital, the allocation store redistributes the pie.
- The user's own paper total is read through `composables/useOwnBook.ts` (C8, landed in wave 2 of swarm 11-02 per `impl-review.md`): one shared read for the dock and /wallet.

### 3. Base currency
There is no `stores/currency.ts`. Prices stay in the asset's quote currency and the wallet catalog's `currency` field. Do not add a second FX store for display.

### 4. `stores/prefetch.ts` (roadmap, not wired)
- The store is instantiated (`plugins/00.dataPipeline.ts:47`) but `prefetchRoute` has no caller: there is no hover-intent prefetch today. The Markov/WebWorker prefetcher is a roadmap item (CodingAgent.md § Roadmap).

### 5. Server-backed stores and composables
- `stores/notifications.ts` → `/api/v1/notifications/` (polls), `stores/chat.ts` → `/api/v1/social/…`, `plugins/predictionsSync.client.ts` → `/api/v1/predictions/sync/`, `composables/useIntelligence.ts` → `/api/v1/intelligence/*`, `composables/usePrimarySettings.ts` → `/api/v1/settings/primary/`, `stores/opinions.ts` → `/api/v1/settings/plugs/`, `composables/useTradingApi.ts` → wallets / bots / strategies / portfolio (still through the deprecated `/api/` alias). Full list: `Strades-comms/API.md`.

## Data Loading, Time, and Space Optimization

### Freshness: polling + synthetic ticks
- Quotes come through the Nuxt route `/api/market/quotes` (per-symbol cache, stale-while-revalidate); notifications poll incrementally (`stores/notifications.ts:135`).
- Visual motion between fetches is synthetic and labelled as such where it shows numbers (`<UISourceChip source="simulated">`).

### Managing D3.js and Canvas Spaces
- Graphs (`/agents` bench `Lab/*`, `Asset/SupplyTree`, `Strategy/Board`) render SVG. A Canvas swap or WebWorker physics is not implemented (roadmap).

### Skeleton Loaders & Spatial Memory
- When data is fetching, UI space is reserved using skeleton loaders (`<AppSkeletonLoader>`) that mimic the predicted shape of the data.
- If a user's risk profile dictates a "compact UI" (per `Design.md`), the skeleton loader must also be compact.

## Factorization & Modularity

- **UI Modifiers as Composables**: use `const { dynamicStyles } = useLivingUI(assetData, macroState)`; it returns CSS variables bound to the component's root.
- **Living Icons**: presentational components in `components/Navigation/Icons/` that take props from `composables/useNavPanels.ts`; maths in `utils/navIcons.ts`, `utils/navGlobe.ts`, `utils/navSphere.ts` (tested in `tests/nav*.test.ts`).
- **Shared foundations (reuse, never duplicate):** `utils/format.ts`, `utils/routes.ts` (`routeLabel(path)`), `utils/valueTree.ts` + `<UIValueTree>`, `<UISourceChip>`, `composables/usePrimarySettings.ts`.

## Component Folder Layout

Every component lives inside a domain folder. Pages compose domain components; domain components compose UI primitives. Counts observed 2026-11-02 (193 components). Per-component page / job / owner: `COMPONENT-MAP*.md`. Names marked † are UNUSED (no page reaches them; deletion list in COMPONENT-MAP-3.md).

```
components/
├── App/           (2)  DynamicThemeController, SkeletonLoader
├── UI/            (12) Card, EmptyState, KpiStrip, MetricRow, OpChips, PageHeader, Pill, ScreenShell,
│                       SectionTabs, SourceChip, Stat, ValueTree
├── Navigation/    (11) Bar, DrawerMenu, SearchBar, Top, Top/ContextActions, Top/GmtClock,
│                       Icons/{Prices,NewsGlobe,Wallet,LabSphere,ChatBadge}Icon
│                       (+ BackLink, AreaLinks — C10, wave 2 — landing)
├── Button/        (17) Bookmark, Database, Notification (+14 †: Avatar, Settings, Delete, Down/Uparrow, Help,
│                       Leaderboard, Options, Post, Quest, Send, Share, Shop, Transfer)
├── Overlay/       (2)  CountdownModal, Slideover†
│  ── Markets
├── Prices/        (2)  ApiPanel, MarketTree
├── Asset/         (13) BotChip, ChartStyleToggle, CommodityPipeline, DataTree, Heatmap, PredictChart,
│                       PredictPanel, QuickPaperBet, SupplyTree, WorldMap (+ Geography†, Shipments†, Suppliers†)
├── Chart/         (2)  AxisEnds, Workspace
├── Map/           (4)  MapButton, MapOverlay, PricesMap, WorldMap
├── Predict/       (1)  BotForm
├── Calendar/      (1)  EventRow
├── Widget/        (5)  DisplayAsset (+ ActiveFriendsOverlay†, NewsCard†, Quest†, Sentiment†)
│  ── News
├── News/          (5)  ComposerModal, ExternalImportModal, FilterToolbar, InfluencerRail, ItemCard
├── Social/        (1)  ArticlePost†
│  ── Portfolio
├── Wallet/        (11) AllocationSlider, BotContribution, EquityCurve, FlowVisualizer, HandTrade, Hero,
│                       PaperPanel, PlatformBreakdown, Positions, Switcher, Trades
├── Trade/         (3)  BotCard, BotLauncher, WalletOnboarding
├── History/       (5)  EventRow, Filters, NowPanel, River, YouCard
│  ── Lab
├── Strategy/      (15) Board, Card, CodeView, ConsensusMeter, CounterpartyCard, DealRow, EquityCurve,
│                       LiveDesk, Mark, Rating, RunByPanel, SavedList, SwarmPlugs, TradeList, WealthFlow
├── Card/          (3)  Avatar, SharedData, Strategy (duplicate of Strategy/Card — D1)
├── Creator/       (4)  AllocationWheel, Blueprint, FrequencySelector, StrategyFlow
├── Builder/       (5)  Action, Condition, Formula (+ NodeCanvas†, Nodes/AvatarNode†)
├── Selector/      (4)  Asset, Datasources (+ Assets†, Conditions†)
├── Lab/           (4)  Bench, Field, Operators, Stamp
├── Agent/         (7)  AvatarCard, OpinionVector, PersonalityRadar, RegimeClassifier, TrainingTimeline,
│                       Compare† (+ CompareTray — review lane, wave 2 — landing)
├── Bot/           (2)  FillsList, LinkRow
│  ── Community
├── Chat/          (5)  NewMessageModal, ShareBar, SharePayload, SharedContextPanel, Composer†
│                       (+ ShareTo — C9, wave 2 — landing)
├── Community/     (1)  PersonCard
├── Arena/         (2)  ChallengeCard, PostChallengeModal
├── Leaderboard/   (1)  Competition
│  ── You
├── Profile/       (17) AchievementsSection, ActivityYear, ExperienceBar, Hero, InvestorCard, Mark,
│                       OpinionProfileCard, PersonalityMatrix, PoliticalCard, PostsFeed, PsychCard,
│                       StrategiesSection (+ AvatarsSection†, CommunitySection†, ContactsRail†,
│                       TradingCalendar†, TradingRecords†)
├── Intelligence/  (15) Avatar, Directive, Eigen, Entourage, Hierarchy, Intelligences, Member, Mirror,
│                       ProfileCard, RelationDetail, RelationList, SpaceMap, SpaceStrips, Truth, WeekTimeline
├── Notification/  (5)  Calendar, Digest, Filters, Row, Upcoming
├── Settings/      (1)  PrimaryValues
├── APIs/          (3)  AddConnectionModal, FeedBoard, PlatformCard
└── (root)         (3)  Carousel, Comparator, Filters — break the "no loose root files" rule; move to Strategy/ (Todo 43.20)
```

`components/Screener/` is an empty folder (its files were deleted in Phase 39).

### Folder rules

- **Pages** (`pages/`) own data fetching and orchestration only. They compose `UI/*` for chrome and one or more **domain components** per section. Every page is registered in `utils/routes.ts` (`tests/routes.test.ts`).
- **Domain components** (e.g. `Wallet/Hero.vue`) are *opinionated* to their domain. They may call domain stores but should not fetch raw JSON.
- **UI primitives** (`UI/*`) are pure presentation — no store access, no data fetches. Inputs are props only.
- **Naming**: PascalCase files inside PascalCase folders. The folder name is implicit in Nuxt's auto-import key (`WalletHero`, `UIPageHeader`). Never repeat the folder prefix in the filename (`Strategy/Card.vue` not `Strategy/StrategyCard.vue`; the two `Map/Map*.vue` files predate the rule).
- **Auto-imports are global**: a new component/composable/util name must be unique in the repo.
- **No loose root-level components**. If a component does not belong in an existing folder, create a new folder rather than dropping a `.vue` at the root.

## Profile and menu

- `/profile` is the signed-in desk (`pages/profile/index.vue`): the server avatar (`<IntelligenceAvatar>`, `<IntelligenceMirror>`, `/api/v1/intelligence/me/`) and the persona; `bookId` is for portrait layout only, never numbers.
- `/profile/:id` is someone else's public page (`pages/profile/[id].vue`). It is a different surface and stays separate.
- Menu: areas, labels and drawer groups come from `utils/routes.ts` (`drawerGroups()`); the human-readable table is Design.md §10.
- Layout density lives in `assets/css/variables.css` as min, preferred, and max. Do not add a second gutter scale in a page.

## News workspace (client)

### State boundary
- `stores/news.ts` is the source of truth for normalized `NewsItem[]`, per-user persisted state, filters and route-query sync, and workflow mutations (save, reaction, judgment, comment, share, import, compose, history).
- `pages/news.vue` orchestrates layout and route sync only; it must not own shadow copies of posts or editorial arrays.

### Data adapters
- Seed sources: `public/data/social/posts.json`, `public/news.json`, `public/data/social/bookmarks.json`, `public/data/user/users.json`, `public/data/core/influencers.json`, `public/data/predictions.json` — adapted at the store boundary into the canonical `NewsItem` before rendering.

### Persistence boundary
- The browser keeps news interactions in localStorage (`strades_news_workspace_v2`, `stores/news.ts:115`).
- **The server half exists:** backend `apps/news` serves feed, bookmark, reaction, comments, share, read, import, publish and history (`/api/v1/news/…`, backend startup.md § News API). `stores/news.ts:116-126` only declares those paths as `NEWS_API_CONTRACT`; wiring them is open (Todo 40.6 / 43.18; share delivery = contract C5, wave 2 — landing).
- External URLs are stored as manual provenance entries unless the backend enriches them.
