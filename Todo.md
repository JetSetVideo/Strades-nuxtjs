# Granular Actionable Backlog

This backlog outlines the step-by-step technical execution plan to realize the "Living Financial Organism" vision, following the top-to-bottom architecture.

## Phase 1: The Core Data & State Engine (Top Level)
- [x] **1.1 Mock Global State Engine**: Update `data/global/macro_state.json` with volatility, sentiment, and stress keys.
- [x] **1.2 Pinia Global Stores**: Scaffold `stores/macro.ts`, `stores/wallet.ts`, and `stores/currency.ts` to fetch and hold the global data inheritance tree.
- [x] **1.3 Dynamic Theme Controller (Headless)**: Build `App/DynamicThemeController.vue`. Link `macro.ts` data to CSS custom properties (`--app-animation-speed`, `--app-lighting-hue`) attached to the root document.

## Phase 2: The Living Navigation (Micro-Dashboards)
- [x] **2.1 Wallet Allocation Pie Icon**: Replace the static wallet icon in `Navigation/Top.vue` with `Navigation/Icons/WalletIcon.vue`. Use D3 to render the 100% allocation data directly into the 24px SVG space.
- [x] **2.2 Fluctuating Prices Icon**: Build `PricesIcon.vue`. Map the `global_volatility_index` to a CSS `@keyframes` pulse animation duration.
- [x] **2.3 Rotating News Globe Icon**: Build `NewsGlobeIcon.vue`. Map the latest news `geographic_origin` coordinates to an SVG 3D rotation transform.

## Phase 3: The 100% Allocation UI
- [x] **3.1 Proportional Allocation Slider**: Build `Wallet/AllocationSlider.vue`. Ensure that dragging one asset class slider mathematically shrinks the others so the sum is always exactly 100%.
- [x] **3.2 Flow Visualizer Background**: Build `Wallet/FlowVisualizer.vue` using Canvas. Spawn particles moving between wallet cards, setting the particle velocity equal to the `flow_velocity` state.

## Phase 4: Strategy Creator & Node Physics
- [x] **4.1 Canvas Engine Foundation**: Implement `Builder/NodeCanvas.vue` using SVG for rendering and WebWorkers for d3-force simulation.
- [x] **4.2 Data-Driven Node Forms**: Implement logic in `AvatarNode.vue` where the CSS `border-radius` and `scale` are reactively bound to the user's `personality_matrix.risk` score.
- [x] **4.3 Node Confidence Opacity**: Bind the `confidence_score` JSON key to the node's CSS `opacity`.
- [x] **4.4 Node Execution Heartbeat**: Add a CSS scale pulse animation bound to the `execution_frequency` key.

## Phase 5: Market Intelligence & Corporate Links
- [x] **5.1 Dynamic Network Graph**: Build `Corporate/NetworkGraph.vue`. Map `supply_chain_health` to SVG `<line>` stroke-width and `fluctuation_velocity` to node pulse speed.
- [x] **5.2 Asset Liquidity Glow**: In `Widget/DisplayAsset.vue`, map `liquidity_depth` to a CSS `box-shadow` to simulate spatial depth and volume.

## Phase 6: Social Platform & Sentiments
- [x] **6.1 Political Leaning Backgrounds**: In `Social/ArticlePost.vue`, translate the `political_leaning` (-1.0 to 1.0) into a subtle `oklch` background tint.
- [x] **6.2 Controversy Animations**: Bind the `controversy_index` of a post to a CSS shake/vibration keyframe on the comment counter icon.
- [x] **6.3 Embedded Allocation Opinions**: Allow `ArticlePost.vue` to parse and render a mini 100% allocation pie chart directly inline in the text flow.

## Phase 7: Predictive UX Optimization
- [x] **7.1 Skeleton Forms**: Update all loading states to check the user's `dominant_asset_class` preference to determine if the skeleton loader should have sharp or rounded edges.
- [x] **7.2 Hover Intent Pre-fetching**: Implement `stores/prefetch.ts`. Add `@mouseenter` hooks to Top Navigation icons that trigger data fetching if hovered for >200ms.

## Phase 8: Component Tree Cleanup
- [x] **8.1 Delete orphaned root-level components**: 28 dead `.vue` files at `components/` root removed (Profil, Calendar, Comparator, FinancialChart, Radar, Search, Timer, Navbar, NavBarCircle, Asset, Strategies, Strategy, Filters, Carousel, GlobalCategories, …).
- [x] **8.2 Relocate live root-level components**: `SearchBar`→`Navigation/`, `DateRangePicker`→`UI/`, `BlockEditor`→`Builder/`, `CountdownModal`→`Overlay/`, `StrategyVisualizer/CodeView/Rating`→`Strategy/`, `Widget/news.vue`→`Widget/NewsCard.vue`, `Card/Strategy.vue`→`Strategy/MarketplaceCard.vue`. All imports updated.
- [x] **8.3 Refactor `pages/creator.vue` to the design system**: Replace raw HTML with `UIPageHeader`/`UICard`/`UIPill`/`UIStat`/`UIMetricRow`/`UIEmptyState`. Page broken into ten numbered steps (Identity → Action Bar) with completion-aware pills and a sticky action bar.
- [x] **8.4 Extract page sub-sections into domain components**:
    - `pages/wallet.vue` → `Wallet/PlatformList.vue`
    - `pages/prices.vue` → `Asset/MoversStrip.vue`
    - `pages/news.vue`   → `News/InfluencerRail.vue`
    - `pages/chat.vue`   → `Community/PersonCard.vue`, `Chat/ConversationList.vue`
    - `pages/strategies.vue` → `Strategy/BotCard.vue`
- [x] **8.5 Delete sandbox pages** (`components.vue`, `test.vue`, `testest.vue`, `auth.vue`) that only referenced deleted components.
- [x] **8.6 Migrate the remaining stores to a single case convention** (`wallets.ts` merged into `wallet.ts` for portfolio data; 100% allocation engine moved to `allocation.ts` with `useAllocationStore`).
- [x] **8.7 Convert `pages/historic.vue` and `pages/contact.vue` stubs** to the design-system shell — both now use `UIPageHeader`/`UICard`/`UIMetricRow` plus reusable components (`historic.vue` reuses `Wallet/Trades.vue`; `contact.vue` got a two-column layout with a contact form and other channels).

## Phase 9: Page-Level Refactors
- [x] **9.1 Refactor `pages/apis.vue` (569 → 130 LOC)**: Extract `APIs/PlatformCard.vue` and `APIs/AddConnectionModal.vue`. Page becomes pure orchestration.
- [x] **9.2 Refactor `pages/calendar.vue` (408 → 220 LOC)**: Extract `Calendar/EventRow.vue`. Page handles only day grouping and filtering.
- [x] **9.3 Modernize `pages/Shop.vue`**: Replaced broken legacy `MarketplaceCard` (data shape mismatch with current `useStrategiesStore`) with `Strategy/Card.vue`. Added category tabs, tier filter, design-system shell, premium/free pill via new `#footer-extra` slot on `Strategy/Card`. Updated `Button/Database.vue` import. Deleted `Strategy/MarketplaceCard.vue`.
- [x] **9.4 Resolve duplicate TypeScript interface auto-import collisions**: `userPreferences.PersonalityMatrix` → `UserPersonalityMatrix`; `training.TrainingState` → `TrainingStoreState` (kept agent-side names canonical).
- [ ] **9.5 Silence remaining `actions` auto-import warnings**: pre-existing `@pinia/nuxt` scanner picks up the `actions:` key from Pinia options-stores. Requires migrating stores to setup-store style — out of scope here.

## Phase 10: Detail-Page Refactors
- [x] **10.1 Store cleanup**: deleted 5 dead stores (`MessagesStore`, `DiscussionsStore`, `DatasourcesStore`, `FriendsStore`, `priceStore`); renamed `newsStore.ts` → `news.ts` and `BitcoinStore.ts` → `bitcoin.ts` (callsites updated).
- [x] **10.2 `pages/assets/[id].vue` 805 → 463 LOC**: extracted `Asset/LiveSignalsStrip`, `Asset/AnalysisPanel`, `Asset/FacilityList`. Moved shared `COUNTRY_LATLNG` table to `composables/useCountryLatLng`.
- [x] **10.3 `pages/strategy/[id].vue` 675 → 391 LOC**: extracted `Strategy/EquityCurve` (deterministic random-walk SVG), `Strategy/TradeList`, `Strategy/RunByPanel`. Moved `cyrb53` + `mulberry32` to `composables/useSeededRandom`.
- [x] **10.4 `pages/bots/[id].vue` 508 → 337 LOC**: extracted `Bot/LinkRow` (agent/strategy/platform variants) and `Bot/FillsList`. Reuses `Strategy/EquityCurve` and `useSeededRandom`.
- [x] **10.5 `pages/conversations/[id].vue` 680 → 404 LOC**: extracted `Chat/MessageBubble` and `Chat/Composer` (with keyboard handling).
- [x] **10.6 `pages/profile/index.vue` 536 → 409 LOC**: extracted `Profile/Hero` and `Profile/PersonalityMatrix`. Both reused on `pages/profile/[id].vue`, which was modernized from a 103 LOC stub into a proper design-system page (Hero, KPIs, portfolio table, achievements).
- [x] **10.7 Deleted 5 obsolete stub Profile components**: `Profile/Header.vue`, `UserStats.vue`, `Achievements.vue`, `Preferences.vue`, `PortfolioSnapshot.vue`. None had meaningful styling; all replaced by the new Hero + inline UI primitives.

## Phase 11: Trailing-Page Refactors
- [x] **11.1 `pages/articles/[id].vue` 394 → 256 LOC**: page didn't use the design system at all (custom `.article-page` shell + inline tile styling). Rewritten as `UIPageHeader` + hero card with cover + metadata grid + `WidgetSentiment`.
- [x] **11.2 `pages/agents/[id].vue` modernized**: replaced inline custom pills/stat-grids with `UIPill` / `UIStat` / `UIMetricRow`, and inlined `Profile/PersonalityMatrix` for the 5-axis bars. Tighter, design-system-consistent.
- [x] **11.3 `pages/summarizer/[id].vue` 100 → 195 LOC** (now functional, was broken): old version dumped raw JSON and navigated to `/result` (which doesn't exist). Rewritten as a proper review page using `Strategy/CodeView`, `UIMetricRow`, with backtest → strategy detail navigation.
- [x] **11.4 Dead-component cleanup**: deleted 25 unwired components (~2 700 LOC), kept `Builder/NodeCanvas.vue` and `Corporate/NetworkGraph.vue` since they're referenced in the design vision. Empty `Transactions/`, `Leaderboard/`, `Quest/` folders removed.
- [x] **11.5 Verified `quest.vue`, `leaderboard.vue`, `notifications.vue`, `settings.vue`**: already clean, design-system-consistent, no extraction needed.

## Phase 12: Wiring, Types, Cleanup
- [x] **12.1 Wired `Corporate/NetworkGraph.vue`** into the asset Supply Chain tab — rewritten to consume the real supply-chain JSON shape (HQ + facilities + suppliers + customers as nodes, weighted edges by share_pct), with a colour-coded legend, deterministic d3-force layout, and accessible aria labels.
- [x] **12.2 Type-safety pass on substantive JS components**: converted `Builder/BlockEditor.vue`, `Builder/Action.vue`, `Builder/Condition.vue`, `Strategy/Visualizer.vue`, `Selector/Asset.vue`, `Selector/Datasources.vue`, `Card/SharedData.vue`, `Widget/NewsCard.vue`, `pages/CandleChart.vue`, `pages/index.vue` to `lang="ts"` with typed props/emits. The Builder + Selector trio got design-system styling on the way (the Creator page now uses consistent chips/inputs instead of bare `<select>`/`<input>` defaults).
- [x] **12.3 Second-wave dead-component cleanup**: deleted 12 more unwired components (~2 840 LOC) — `Wallet/AssetsDistribution`, `CapitalCounter`, `EvolutionAllocation`, `Evolution` (657 LOC d3 chart, superseded by `EquityCurve`), `OverallStratstats`, `Portfolio` (superseded by `Positions`), `PositionTracker`, `SelectStrats`, `TradesHistory`, `Navigation/Creator`, `Navigation/Analyse`, `Selector/Users`.
- [x] **12.4 CSS variables audit**: confirmed `assets/css/variables.css` is complete; `--app-*` runtime variables (border-radius, animation-speed, glass-blur, ambient, glow, news-pulse, light-angle) are intentionally set by `App/DynamicThemeController.vue` at runtime from macro store state.

## Phase 13: Profile Page Integration
- [x] **13.1 Merge origin/main into local main**: Resolved all rebase/merge conflicts (22 files). Kept local design-system refactors; discarded stale upstream versions of `Builder/Action.vue`, `Builder/Condition.vue`, `Profile/Hero.vue`, `Selector/Datasources.vue`, `Widget/DisplayAsset.vue`, `layouts/default.vue`, and 10 pages. Deleted dead components (`Card/Friend`, `Card/Strategy`, `Carousel`, `Filters`, `StrategyVisualizer`, `FriendsStore`).
- [x] **13.2 Wire new Profile components into `pages/profile/[id].vue`**: Replaced the 255-LOC stub with a full design-system profile page using `useProfile` composable. Sections now wired: `Hero`, `ExperienceBar`, `PsychCard`, `PoliticalCard`, `InvestorCard`, `TradingCalendar`, `AvatarsSection`, `StrategiesSection`, `PostsFeed`, `CommunitySection`, `ContactsRail`, `AchievementsSection`, plus portfolio snapshot and KPI strip.
- [x] **13.3 Fix broken imports in new components**: `ContactsRail.vue` now imports `CommunityUser` from `stores/community.ts` (not deleted `FriendsStore`); `useProfile.ts` now imports `useWalletStore` from `stores/wallet.ts` (not deleted `wallets.ts`).
- [x] **13.4 Verify build passes**: `npm run build` completes successfully after merge and profile integration.

## Phase 14: Trading Platform Enhancements
- [x] **14.1 Monte Carlo Backtesting Engine** (`composables/useBacktest.ts`): GBM-based price path simulation with strategy condition evaluation (cross_above/below, MA, RSI). 250+ runs per batch, yields Sharpe/Sortino/Calmar/max-DD/profit factor. Counterparty risk & commodity correlation multipliers. Batched async execution with progress tracking.
- [x] **14.2 Swap Consensus** (`components/Strategy/ConsensusMeter.vue`): Community sentiment gauge aggregating predictions from all users. Bullish/bearish/neutral split with controversy animation. Wired into strategy detail page and risk dashboard.
- [x] **14.3 Risk & Exposure Dashboard** (`pages/risk.vue`): VaR (95% 1d), asset-class risk breakdown with weighted volatility, counterparty/supply-chain exposure list, 4 stress-test scenarios (supply shock, volatility crisis, commodity spike, rate hike) each running Monte Carlo simulation, community sentiment on holdings. Accessible via drawer menu.
- [x] **14.4 Commodity Pipeline** (`components/Asset/CommodityPipeline.vue`): Maps each strategy's target_assets to real commodities via supply-chain JSON data. Per-commodity exposure, price strip with volatility color, strategy×commodity mapping. Wired into asset detail page (Relationships tab) and risk dashboard.
- [x] **14.5 Backtest tab update** (`pages/strategy/[id].vue`): Replaced dummy backtest with real Monte Carlo engine. Shows 12-metric result grid (Sharpe, Sortino, Calmar, max DD, Vol, Win Rate, Profit Factor, Avg Win/Loss, Total Trades). Progress bar, community consensus on strategy assets.
- [x] **14.6 Wire navigation**: Added "Risk & Exposure" item to drawer menu for discoverability.
- [x] **14.7 Build verified**: `npm run build` passes clean after all enhancements.

## Phase 15: Swarm Intelligence, Strategy Monitor & Counterparty Linkage
- [x] **15.1 Swarm Intelligence in Creator** (`components/Strategy/SwarmPlugs.vue`): Added "Swarm" section between AI Avatars and Variables in the creator page. Users plug community members or AI avatars with weighted sliders. Uses `stores/opinions.ts` engine — weighted sum → normalized allocation vector. Live preview bar shows swarm-weighted allocation.
- [x] **15.2 Real Monte Carlo backtest in Creator**: `onCountdownFinish` now builds a proper `BacktestConfig` from the strategy form state (conditions from blocks, variables, targets) and runs `useBacktest().runBacktest(config, 250)` instead of the old fake `backtestStrategy()`.
- [x] **15.3 Strategy Monitor** (`pages/monitor.vue`): Live dashboard showing all strategies with P&L tick simulation, status filter tabs (active/paused/all), search, aggregate KPIs (total capital, total P&L, avg win rate), best/worst performers, per-strategy quick backtest button, per-strategy live metrics (return, capital, win rate, Sharpe, max DD, trades). Accessible via drawer menu.
- [x] **15.4 Counterparty & Commodity Exposure** (`components/Strategy/CounterpartyCard.vue`): Fetches supply chain JSON for each target asset, extracts suppliers/customers/facilities/commodities with weight percentages. Shows risk breakdown by role type (supplier/customer/facility/commodity) adjusted by macro volatility. Wired into strategy detail page performance tab.
- [x] **15.5 Build verified**: `npm run build` passes — 691 modules, 1.71 MB, 0 errors.

## Phase 16: Data Catalog & Swarm-informed Backtest
- [x] **16.1 Data Catalog** (`pages/data.vue`): Browsable catalog of 25+ data sources across 10 categories (Core, Macro, Supply Chain, Agents, Strategies, Social, Chat, Relationships, Competitions, Quests). Each card shows path, schema keys, type, size, description, and which pages consume it. Searchable by name/key/description, filterable by category. Navigation entry in drawer menu.
- [x] **16.2 Swarm-informed backtest**: `useBacktest.ts` accepts `swarmVector` in `BacktestConfig`. When plugged agents have a consensus allocation (e.g. 60% crypto), the GBM drift is biased toward that asset class (up to ±12% annualized). Wired into Creator (`onCountdownFinish`) and strategy detail page (`onRunBacktest`) via `opinionsStore.swarmVector`.
- [x] **16.3 Build verified**: `npm run build` passes — 697 modules, 1.72 MB, 0 errors.

## Phase 19: Documentation Overhaul & Data-Schema Normalization
- [x] **19.1 README.md rewrite**: repositioned Strades as a gamified trading hub (centralized wallets + trader profiles + AI avatars + swarm intelligence + paper trading + article NLP). Added explicit "6-step loop" (Centralize → Profile → Avatar → Swarm → Paper-trade → Read together) and a documentation map.
- [x] **19.2 Design.md rewrite**: added First-Run avatar bootstrap journey, Paper-Trading visual language section (color, badge, ledger borders), Article-card & Opinion visualization section, Avatar & Swarm visual language (frames, opacity, swarm plugs), and Accessibility section.
- [x] **19.3 Data.md rewrite**: added full data-source map (table of every JSON file → consuming store), canonical Post schema (TS interface), Agent schema (TS interface), PaperTrade ledger schema, Opinion Profile schema, and a Visual State Inheritance diagram (ASCII tree).
- [x] **19.4 CodingAgent.md rewrite**: added Avatar training pipeline (feature engineering table), Swarm aggregator with diversity bonus, Opinion Profiler (article → leaning pipeline), Paper Trading Engine (flow + ledger schema + historical replay), Mock data generation invariants, and Future backend plug-in points.
- [x] **19.5 Fix `public/data/social/posts.json` merge conflict**: HEAD vs `ccc9f82` had two incompatible post schemas. Resolved to the newer NLP-enriched shape (`interactions`, `published_at`, `economic_leaning`, `sentiment`, `weight`, `geographic_origin.name`), expanded from 5 → 8 posts across 4 categories, and added `is_pinned` flags.
- [x] **19.6 Normalize `PostSummary` type**: `composables/useProfile.ts` updated to canonical shape (interactions sub-object, `published_at`, optional NLP fields).
- [x] **19.7 Fix `Profile/PostsFeed.vue`**: switched from legacy flat fields (`likes_count`, `timestamp`) to canonical (`interactions.likes`, `published_at`); made `timeAgo` defensive against invalid timestamps; extended `categoryColor` map for `commodities`; made `post.title` optional.

## Phase 20: Paper Trading Engine
- [x] **20.1 Paper store** (`stores/paper.ts`): paper trades as % of wallet (not absolute amounts), open/closed lifecycle, mark-to-market simulation, equity curve getter, localStorage persistence, demo seeding. Enforces `is_paper: true` discriminator and 0.1–50% wallet_pct clamp per CodingAgent.md §5.
- [x] **20.2 Wallet integration** (`components/Wallet/PaperPanel.vue` + `pages/wallet.vue`): Live/Paper mode toggle, 4 KPI strip (open/realized P&L, win rate, positions), mini equity curve, open-positions list with per-trade close button, recent-closed details. Visual language per Design.md §4: dashed border, `P` chip, 60%-saturation accent.
- [x] **20.3 Paper ledger in `pages/historic.vue`**: new "Paper" tab with dotted-left-border rows, `P` chip on each trade, side-colored borders (buy=blue/sell=red), open/closed status tags, notional + wallet_pct + timestamp + strategy/agent source.

## Phase 21: Article NLP Enrichment & Opinion Profiler
- [x] **21.1 `stores/opinionProfile.ts`**: decay-weighted moving average (α=0.15) for political & economic leaning per user; sentiment bias; topic affinity histogram; influence web (author → weight); confidence grows logarithmically with sample count; localStorage persistence.
- [x] **21.2 `components/Profile/OpinionProfileCard.vue`**: dual-axis visualization (political left↔right, economic dove↔hawk), sentiment bias pill, topic affinity chips with per-category colors, influenced-by avatars, friend-circle small-multiples comparison grid. Confidence badge showing sample size.
- [x] **21.3 `composables/useArticleTracker.ts`**: reusable composable that auto-logs `article_read` events after 5s dwell time (or on page unload after 30s). Wired into `pages/articles/[id].vue`.
- [x] **21.4 Profile page integration**: `OpinionProfileCard` rendered alongside `PoliticalCard` on `pages/profile/[id].vue` political section; friends passed via `user.friends`.

## Phase 24: Avatar Learning Drift & Swarm Diversity Confidence
- [x] **24.1 Avatar opinion drift** (`plugins/00.dataPipeline.client.ts`): the personal avatar's opinion vector drifts 3%/tick toward the wallet's dominant-class profile every 12s. The avatar literally learns "trades like you would" — if you lean crypto-heavy, so does your avatar.
- [x] **24.2 Swarm diversity score** (`stores/opinions.ts`): new `diversityScore` getter computes the variance across all plugged agents' 5 personality axes. High diversity = independent opinions = higher "wisdom of crowds" confidence. New `swarmConfidence` getter combines count + diversity into a 0–1 score.
- [x] **24.3 Swarm confidence badge** (`components/Wallet/Hero.vue`): the ghost overlay now shows `XX%` confidence badge next to the swarm message, with a tooltip revealing diversity and confidence breakdowns.
- [x] **24.4 Like/share interaction tracking** (`components/Social/ArticlePost.vue`): share button is now clickable; calls `opinionStore.recordShare()` with 2× weight and fires `share_article` training events. Like button is local-UI only (stub for future server sync).

## Phase 29: Behavior Timeline Visibility
- [x] **29.1 Training stream on agent detail page** — `AgentTrainingTimeline.vue` (existed but was orphaned) now renders on `pages/agents/[id].vue` below the Trader DNA card. Shows recent gradient chips, applied epochs with reward, buffered events.
- [x] **29.2 Build verified**: 1.87 MB, 0 errors.

## Phase 28: In-Context Paper Trading on Asset Page
- [x] **28.1 `Asset/QuickPaperBet.vue`** — inline paper trading panel for the asset detail page. Buy/sell toggle, wallet % slider, notional, open positions with close, P&L summary.
- [x] **28.2 Asset page integration** — new "Paper Trade" tab on `pages/assets/[id].vue`.
- [x] **28.3 Build verified**: 1.87 MB, 0 errors.

## Phase 27: Centralized Platform Hub — Wallet Platform Breakdown
- [x] **27.1 `Wallet/PlatformBreakdown.vue`** — new component showing the consolidated portfolio across all connected trading platforms. Stacked bar by platform type (exchange/broker/bank/vault), per-platform cards with balance, PnL, asset count, available balance, fees, last sync. The "centralized hub" view the vision describes.
- [x] **27.2 Wallet page** — PlatformBreakdown replaces the old inline PlatformList. Import cleaned up, dead CSS removed.
- [x] **27.3 Build verified**: 1.86 MB, 0 errors.

## Phase 26: Avatar Marketplace & Navigation Polish
- [x] **26.1 `pages/agents/index.vue`** transformed from a redirect stub into a full Avatar Marketplace. Search, filter by trading style (5 types), sort by PnL/confidence/popularity, KPI strip (total agents, plugged count, top PnL, avg confidence), per-agent plug button, grid layout. Reuses `Agent/AvatarCard` with frame shapes + training rings.
- [x] **26.2 Middleware removed**: `middleware/agents-redirect.ts` gutted — `/agents` no longer redirects to `/strategies`.
- [x] **26.3 Drawer menu**: added "Avatars" link to the discover group.
- [x] **26.4 Brand link**: brand logo in `Navigation/Top.vue` now links to `/dashboard` instead of being a drawer toggle. Separate hamburger button added for drawer access. Dead CSS cleaned up.

## Phase 25: Dashboard & Documentation Finale
- [x] **25.1 `Components.md` rewrite**: full audit — 60+ components documented with their exact data sources, visual mappings, and tracking behaviors. Added a Data Flow Map (read-only path diagram). Matches current Phase 20–24 additions.
- [x] **25.2 Drawer menu**: added `Dashboard` as the first item in the "you" group (`components/Navigation/DrawerMenu.vue`).
- [x] **25.3 `pages/dashboard.vue`**: consolidated hub showing portfolio KPI strip, market pulse chips (bull/bear, stress, volatility), personal avatar card, quick-link grid to 6 key pages, paper-trading snapshot (open positions, win rate, realized P&L), and swarm status bar.

## Phase 23: Avatar Training Loop Closure & Trader DNA Visualization
- [x] **23.1 News-feed opinion tracking** (`components/Social/ArticlePost.vue`): every post now auto-logs `article_read` into the Opinion Profiler after 3s visible dwell, plus `article_political_view` and `article_dwell` events into the Avatar training pipeline. This closes the loop: articles read → opinion profile evolves → avatar trains.
- [x] **23.2 `Agent/PersonalityRadar.vue`**: 5-axis spider chart rendering the personality matrix (risk / aggression / reaction_speed / patience / contrarian). Concentric grid rings, axis labels, dominant-axis highlight, optional ghost-comparison polygon, and a "Dominant X%" read-out.
- [x] **23.3 Agent detail page integration** (`pages/agents/[id].vue`): "Trader DNA" section now shows the radar side-by-side with the existing bar matrix in a responsive grid.

## Phase 22: Avatar & Swarm Polish
- [x] **22.1 Swarm ghost overlay** on wallet page when `opinions.mode === 'advisory'`: pulsing banner inside `Wallet/Hero.vue` showing `SWARM ×N` chip, top divergence message ("Agents want +X% class"), and "Match" button. Ghost allocation bar below shows the swarm vector split. Driven by `opinions.swarmVector` vs `allocation.allocationPie`.
- [x] **22.2 Avatar personality shape encoding** in `Agent/AvatarCard.vue`: hexagon clip-path for aggressive (`risk + aggression > 0.65`), circle for conservative (`< 0.35`), rounded square for balanced. Frame glow color matches personality (red for aggressive, blue for conservative).
- [x] **22.3 Training progress ring** around the avatar image driven by `training_state.loss_ema`. SVG ring with `stroke-dashoffset` bound to `1 - (loss / 0.5)`, transitioning smoothly as training improves.

## Phase 30: Codebase Cleanup & Data-Flow Consolidation
- [x] **30.0** Committed in-flight auth/API/price-cache/nav work as foundation commit.
- [x] **30.1** Fixed broken runtime: `macroStore.macroState` → direct fields, removed dead `$socket`, summarizer uses strategies store, chat loading fix, merged `/profile` conflict.
- [x] **30.2** Canonical types in `types/{asset,strategy,user,allocation,agent}.ts`; stores re-export.
- [x] **30.3** Merged strategies/portfolio parallel paths; deleted `sharedData` + JSON `tracking` stores; `useCurrentUser` resolves auth.
- [x] **30.4** `$api` 401 refresh/retry; prefetch stores bodies; price cache cleared on logout.
- [x] **30.5** Deleted dead server routes, ~20 orphaned components, legacy root JSONs, unused currency store.
- [x] **30.6** Design tokens + typed props + `useLivingUI` on DisplayAsset.
- [x] **30.7** `npm run build` passes (1.81 MB, 0 errors).
