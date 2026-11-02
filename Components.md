# Components — notes by user job and by folder

**Full table (one row per component: page, area, job step, store, endpoint, owner lane, flags):** `~/Desktop/Strades-comms/swarm-2026-11-02/COMPONENT-MAP.md` (shell, Markets, News) · `COMPONENT-MAP-2.md` (Portfolio, Lab) · `COMPONENT-MAP-3.md` (Community, You, UI kit, **UNUSED** list, duplicates D1–D10). This file keeps the notes that are true today; it does not list every component. Folder rules: Structure.md. Dock icons: Design.md §2. Menu / areas / labels: `utils/routes.ts` + Design.md §10. Step-by-step jobs: `Strades-comms/PROCESSES.md` § Five user jobs.

Rebuilt 2026-11-02 (docs lane): 27 sections that described components that do not exist were removed; sections of UNUSED components carry an **UNUSED** line.

## 0. The five user jobs — components in step order

- **Trade:** `<WidgetDisplayAsset>` / `<AssetHeatmap>` / `<PricesMarketTree>` (find) → `/assets/[id]` `<AssetPredictChart>`, `<AssetDataTree>` (open) → `<AssetQuickPaperBet>` (browser ledger) or `<WalletHandTrade>` (server `POST /api/v1/portfolio/trade/`) → `<WalletPaperPanel>`, `<WalletHero>` + `useOwnBook()`, `<HistoryRiver>` (see it). Bots: `<TradeWalletOnboarding>`, `<TradeBotLauncher>`, `<TradeBotCard>` on /trade.
- **Predict:** `<AssetPredictChart>` + `<AssetPredictPanel>` (state the call) → `stores/predictions.ts` + `plugins/predictionsSync.client.ts` (pending) → `<NotificationRow>` / `<NotificationUpcoming>`, `<HistoryRiver>` (scored). Markets: `/predict` + `<PredictBotForm>`.
- **Communicate · share · comment:** `<CommunityPersonCard>`, `<ChatNewMessageModal>` (people) → `pages/conversations/[id].vue` inline composer (`<ChatComposer>` is unused, D5), `<ChatShareBar>`, `<ChatSharePayload>`, `<ChatSharedContextPanel>`, `<CardSharedData>`, `<ButtonDatabase>` (share into a room) → `<NewsItemCard>` (comment / share an article). `<ChatShareTo>` (C9, wave 2 — written by the social lane) shares a strategy / bot / call.
- **Review:** `<WalletHero>`, `<WalletSwitcher>`, `<WalletPositions>`, `<WalletTrades>`, `<UIValueTree>` (wallets) → `<BotFillsList>`, `<BotLinkRow>` (/bots/[id]) → `<StrategySavedList>`, `<CardStrategy>`, `<StrategyBoard>` (/strategies) → `<StrategyTradeList>`, `<StrategyRunByPanel>`, `<StrategyEquityCurve>` (/strategy/[id]; the curve is seeded — D3).
- **Direct + train:** `<ProfileHero>`, `<IntelligenceAvatar>`, `<IntelligenceMirror>` (/profile) → `<SettingsPrimaryValues>` (/settings), `<IntelligenceDirective>` (/insights) → `<AgentAvatarCard>` + `<LabBench>` (/agents, plug) → `<StrategySwarmPlugs>` (/creator).

## 0b. Live families that had no entry (short notes; details in COMPONENT-MAP)

### Intelligence/* (15) — the server avatar (`/profile`, `/insights`)
Read `composables/useIntelligence.ts` (`/api/v1/intelligence/*`); only `Mirror` fetches itself, the rest take props from the page. `/profile`: `Avatar` (learned avatar + walk-forward forecasts), `Mirror` (how the desk reads you), `Truth`, `Eigen`, `Intelligences`, `SpaceMap` + `SpaceStrips` (where you sit among traders, `space/`), `Entourage` (`entourage/`). `/insights`: `Directive` (agent directive; edits go to `usePrimarySettings`), `Hierarchy` (`hierarchy/`), `RelationList` + `RelationDetail` + `Member` (`relations/<id>/`), `ProfileCard` (`users/<id>/`, `compare/<id>/`), `WeekTimeline`. Another user's profile hides accuracy, scores and the avatar (backend S3). Contract C6 adds `inputs` to `me/` (wave 2, avatar lane).

### Trade/* (3) — paper bots (`/trade`)
`WalletOnboarding` creates or imports a paper wallet (`POST /api/v1/wallets/`, `wallets/import/`); `BotLauncher` starts a bot on that wallet (`POST wallets/<id>/bots/`; fee / slippage / risk budget come from Settings > directive > engine default); `BotCard` shows one running bot (stop / pause / visibility). Bots are paper and carry the Simulated banner.

### Wallet/HandTrade.vue — server paper order (`/wallet`)
Buy / sell at the server price through `POST /api/v1/portfolio/trade/`; reads the book from `useOwnBook()` and refreshes it after a trade. C1 (wave 2, core-api) adds `client_id` (no double fill) and `fill {price, price_source, quantity, total_value, fee}`.

### Asset/QuickPaperBet.vue — browser paper order (`/assets/[id]`, `/CandleChart`)
Writes `stores/paper.ts` (localStorage `strades_paper_ledger_v1`). Handles a missing price. Second ledger next to HandTrade (D2).

### Predict/BotForm.vue (`/predict`)
Launches a paper bot on a prediction market (Kalshi) via `launchBot`; twin of `<TradeBotLauncher>` for assets (D7).

### Chat/NewMessageModal, ShareBar, SharePayload, SharedContextPanel (`/chat`, `/conversations/[id]`)
`NewMessageModal` picks a person (`GET /api/v1/social/profiles/`, rows carry `is_bot` / `can_message` since C2) and opens or creates the conversation (`POST social/conversations/`). `ShareBar` + `SharePayload` render what is shared into a room (in-app links open in place); `SharedContextPanel` lists what the room has shared.

### UI/SourceChip.vue — where a number comes from
`<UISourceChip source="sample|simulated|paper|pending" note="…">`. Every number that is not the user's own live data carries one; with no number, show "—" + a one-line reason.

### UI/ValueTree.vue — how a number is built
`<UIValueTree>` over `utils/valueTree.ts`: a KPI unfolds into its inputs and the settings that drive it (Wallet "Your paper", Risk, Strategy return, Insights). Pure props.

### Settings/PrimaryValues.vue — the roots of every derived number (`/settings#primary`)
18 options in 6 groups via `composables/usePrimarySettings.ts` (`GET/PATCH /api/v1/settings/primary/`); every option shown even when unset, each with an anchor `#set-<key>` and the sentence of what it drives. Wired: backtest capital, fee, slippage, opening cash, bot risk budget.

### Navigation/BackLink.vue, AreaLinks.vue (C10, landed by the nav lane)
`<NavigationBackLink />` renders "← <area home>" from `utils/routes.ts`; `<NavigationAreaLinks area="lab" />` lists an area's drawer pages as chips. The parent inserts them into detail pages.

### Agent/CompareTray.vue (review lane, wave 2)
New in wave 2; see `impl-review.md` for its role.

## News Intelligence Workspace (`/news`, `/articles/[id]`)

### Primary components
- `components/News/FilterToolbar.vue`
  - sticky search, view selection, sort selection, high-value facets, date range, import/write actions
- `components/News/ItemCard.vue`
  - canonical story presentation for social, editorial, and imported links
  - includes provenance, axis/sentiment labels, allocation, prediction context, save/share/comment/judgment actions
- `components/News/ExternalImportModal.vue`
  - manual provenance capture for external URLs
- `components/News/ComposerModal.vue`
  - user-authored signal/article creation with category, sentiment, optional assets, optional geography, optional allocation

### Rail
- `components/News/InfluencerRail.vue`
  - read-mostly signal rail with follow action
- (`Social/ArticlePost.vue` and `Widget/NewsCard.vue` are UNUSED copies — `<NewsItemCard>` is the only news card; D9.)

### Interaction contract
- Save, comment, share, like/dislike, and political judgment all dispatch through the news store.
- History events are created for read/save/share/comment/judge/publish/import actions.
- Story cards must not mutate props directly.

---

---

## 1. Global & System Components

### App/DynamicThemeController.vue
Headless controller at the root of `app.vue`. Subscribes to `stores/macro.ts` and injects CSS custom properties into `:root`.

| Data key | CSS variable | Effect |
|----------|-------------|--------|
| `global_volatility_index` | `--app-animation-speed` | 0.3s–1.5s transition duration |
| `geopolitical_stress` | `--app-lighting-hue` | oklch base hue shift (blue→amber) |
| `dominant_asset_class` | `--app-border-radius` | crypto=2px, fiat=16px |
| `market_sentiment` | `--light-angle` | Shadow depth + gradient angle |

### App/SkeletonLoader.vue
Reactive skeleton that inherits the user's `personality_matrix.risk` (compact vs. spacious) before real data arrives.

---

## 2. Navigation: The Living Icons (Micro-Dashboards)

The bottom bar (`Navigation/Bar.vue`, mounted once in `layouts/default.vue`, so it is on every page) has five tabs. Each icon is a micro-dashboard of the panel it opens and reads the same store field that panel shows at the top, so the bar never disagrees with the page.

| Panel | Route (tab also selected on) | Icon component | Data source (store field) | What is drawn | Value line |
|-------|------------------------------|----------------|---------------------------|---------------|------------|
| Prices | `/prices` (`/assets`, `/predict`, `/deals`) | `Navigation/Icons/PricesIcon.vue` | `assets.liveMarket.history` (hourly returns). When the live tree has no aggregate, `blendHistory` of the live assets' `return_history`, cap-weighted by `market_cap` | Sparkline of today's cumulative move from 00:00 GMT to the time of the last quote fetch (hours aligned on `assets[].live.at`, not the clock) on a fixed 24 h axis, with 06/12/18 h ticks, a dotted zero line and an end dot. Green / red (`--app-color-up/down`) beyond ±0.01 %, blue otherwise | Signed % since 00:00 GMT (falls back to `liveMarket.ret` over 24 h); `—` with no live quote |
| News | `/news` (`/articles`, `/summarizer`) | `Navigation/Icons/NewsGlobeIcon.vue` | `news.items[].readByUser`; the shared clock `now` | Dot-matrix Earth (Natural Earth 110m on a 4° grid, `utils/navGlobeLand.ts`) tilted 18° and turned so the meridian where it is noon right now faces the viewer; a red vertical line marks that meridian. A blue dot sits on the rim while something is unread (it pings only when News is selected) | `N new` or `all read` |
| Wallet | Portfolio area pages (`/wallet`, `/trade`, `/risk`, `/historic`) | `Navigation/Icons/WalletIcon.vue` | the user's own paper book via `useOwnBook()` (`ownWalletDock`, wave 2 nav lane); before wave 2 it was `wallet.wallets` (the sample catalog) | Two rings: outer = paper wallets vs portfolio, inner = asset types (cash grey) | Own total (`compactUsd`); `—` + reason when signed out, not read or empty |
| Lab | Lab area pages (`/strategies`, `/strategy/[id]`, `/agents`, `/bots`, `/creator`, …) | `Navigation/Icons/LabSphereIcon.vue` | `strategies.ownStrategies` (the user's own; samples excluded) — `useNavPanels.ts:174-176`; with no own strategy the dock shows "—" (`LAB_DOCK_EMPTY`, wave 2) | CSS 3-D globe, one dot per own strategy. Colour = run state (green active/backtesting, orange paused, red stopped), latitude = risk, longitude = return, size = √trades. Turns only while Lab is selected | `N run` / state counts; `—` with none |
| Chat | `/chat` (`/conversations`) | `Navigation/Icons/ChatBadgeIcon.vue` | `chat.conversations` (only the user's own, summing `unread_count_<userId>`: exactly the badges `pages/chat.vue` draws) and `chat.getEmotionalUrgency(userId)` | Speech bubble with a red dot holding the unread count (`99+` past 99). When Chat is selected and urgency > 0.7 the dot throbs | `unread` or `no new` (the number is in the dot) |

The selected tab is the page's area in `utils/routes.ts` (`dockFor(path)`), so detail pages keep their area's tab selected. `StrategyOrbitIcon.vue` no longer exists; `LabSphereIcon.vue` replaced it.

**Data flow.** Pinia stores → `composables/useNavPanels.ts` (one view model per panel: route, accent, value line, screen-reader summary, icon props) → `Navigation/Bar.vue` (layout + selected state) → `Navigation/Icons/*.vue` (presentational: props in, SVG/CSS out, no store, no timer). Every number comes from pure functions in `utils/navIcons.ts` (`intradayCurve`, `blendHistory`, `sparkline`, `walletRings`, `sharesToArcs`, `donutArcPath`, `agentSphere`, `subsolarLongitude`, `orthographic`, `unreadFor`, `badgeLabel`, `activePanelFor`, `compactUsd`, `signedPct`), plus `utils/navGlobe.ts` (News land dots) and `utils/navSphere.ts` (Lab dot placement). Tests: `tests/navIcons.test.ts`, `tests/navGlobe.test.ts`, `tests/navSphere.test.ts`. On mount, `useNavPanels` also loads any of the assets, wallet, agents or chat stores that are still empty, because the bar can't assume the current page loaded them.

**Clock and refresh.** One 30 s clock (`now`, client only, ticks while the tab is visible and again when it becomes visible) drives the News globe rotation and the end of the Prices curve. Every 5 min, while the tab is visible and only if no quote fetch happened in the last 4.5 min (/prices pulls every 30 s itself), live quotes are re-pulled with `assets.mergeLiveQuotes()`.

**Selected state.** One style for every tab: the icon scales to 1.2 inside the bar (sizes are chosen so it never crosses the bar's top edge), a 2 px accent bar lights up at the top of the tab, a halo and wash in the panel's accent fade in, the label turns white and bold, and the value line takes the accent colour (unselected value lines are neutral grey; up/down/waiting/error colours stay because they are state). Each icon also switches to its own zoomed `active` drawing: Prices enlarges the plot, tightens the value span (0.35 % instead of 0.6 %) and pings the end dot; News zooms the globe (radius 9.5 → 10.8) and brightens the land; Wallet thickens the rings, shrinks the hole and turns them −12° once; Lab zooms ×1.15, starts turning and makes running dots breathe; Chat scales the bubble to 1.06 and blinks the typing dots when something is unread.

**Sizes.** Icons get a pixel size from `matchMedia` because the Lab globe uses px geometry: 32 px at ≤ 379 px wide, 36 px by default, 38 px from 768 px, 40 px from 1600 px. The server render uses 36 px.

**SSR placeholder.** Live readouts differ between server and client, so the bar passes `ready = false` until it has mounted. Until then each icon draws a static placeholder (Prices: dashed flat line; News: ocean disc, outline and noon line without land; Wallet: empty track rings; Lab: globe body and wireframe, no dots, no spin; Chat: bubble without badge), the value line is empty, and the link's `aria-label` is the plain label. Once mounted, `aria-label` carries the panel's summary sentence. `aria-current` is `page` on the tab's own route and `true` on its detail routes.

**Motion.** Animations use transform and opacity only (glows are static `box-shadow`). The News globe is not animated: it re-renders on the 30 s clock and only recomputes dots when the noon longitude moves by 0.25°. Loops run only on the selected tab (measured: 0 running animations in the bar with Wallet selected, 1 on Prices/News, 3 on Chat, 20 on Lab). Under `prefers-reduced-motion` every transition and animation in the bar and its icons is off (measured: 0 on every tab).

**Land map.** `utils/navGlobeLand.ts` is generated; do not edit it by hand. Regenerate with `deno run -A scripts/nav-globe-land.ts`. The run touches `deno.lock`; revert that file afterwards.

### Navigation/Top.vue
Composes the brand/menu button, the search bar (`Navigation/SearchBar.vue`), the context actions and the GMT clock. It holds no living icons; those are in the bottom bar above. SearchBar logs `search_used` training events.

### Navigation/DrawerMenu.vue
Right-hand sheet opened from the brand button (and the ☰ cue). It does not fetch. It renders the six areas of `utils/routes.ts` (`drawerGroups()`: Markets, News, Portfolio, Lab, Community, You — all open by default) plus the footer links Help / About / Contact. Width reads `--drawer-width` (`clamp(16rem, 32vw, 22rem)`). The current route is marked `is-current`. Hints hide under 640px.

---

## 3. Wallet & 100% Allocation Engine

### Wallet/Hero.vue
Primary wallet header — total balance, period PnL, available/invested/today breakdown.
- **Data**: `wallet.total_value`, `wallet.performance_history[period]`, `wallet.daily_change`
- **Visual**: color-coded PnL, period selector tabs
- **Swarm ghost overlay**: when `opinions.activeCount > 0 && mode === 'advisory'`, shows swarm divergence, confidence badge, "Match" button (Phase 22.1, 24.3)

### Wallet/PaperPanel.vue (Phase 20)
Paper-trading dashboard: Live/Paper mode toggle, KPI strip, mini equity curve, open positions with close buttons, recent closed list.
- **Data**: `paper.trades`, `paper.openPnlValue`, `paper.realizedPnlValue`, `paper.winRate`, `paper.equityCurve`
- **Visual**: dashed border, `P` chip, 60%-saturation accent (Design.md §4)

### Wallet/AllocationSlider.vue
Four linked sliders that enforce `fiat + crypto + stocks + commodities = 100%`. Dragging any slider compresses the others proportionally.
- **Data**: `allocation.allocationPie`
- **Visual**: per-class swatches, dominant-class highlight, swarm ghost bar when agents are plugged
- **Events**: fires `allocation_change` training events

### Wallet/FlowVisualizer.vue
Background canvas particle effect behind the wallet page. Particle speed = `macro.flow_velocity`.

### Wallet/Positions.vue
Holdings table from `wallet.assets[]`. Row height proportional to `allocation_percentage`. Click to navigate to `/assets/[id]`.

### Wallet/EquityCurve.vue
SVG sparkline from `wallet.performance_history` or synthetic historical points.

### Wallet/Trades.vue
Transaction rows from `wallet.transactions[]`. Color-coded buy/sell.

### Wallet/BotContribution.vue
How much of today's PnL came from automated strategies vs. manual trades.

### Wallet/Switcher.vue
Multi-wallet selector when the user has multiple sub-wallets.

---

## 4. Strategy & Creator

### Strategy/Card.vue
Strategy summary card — name, category mark, PnL, win rate, status, target assets, and a wealth-transfer picture.
- **Data**: `strategy.category` → `Strategy/Mark.vue` (crypto, stocks, commodities, forex, or a hexagon)
- **Data**: return, Sharpe, win rate, and risk → `Strategy/WealthFlow.vue` opens on calm, shock, trend, or chop. The four words on the card switch the picture.
- **Visual**: equity is the metric row. The wealth widget is beads of capital, not a second price chart.

### Strategy/Board.vue
Under the desk on `/strategies`. Three readings of the same books: Performance (every return path stretched across its own window, with the high, the zero, and the low marked), Spread (return, drawdown, Sharpe, win rate, trades, risk, with the axis ends numbered), and Calendar (each book as a lane across the months it was open). A lane click opens that book's own moves from open to close. Selected cards stay bright and the others dim. `utils/strategyBoard.ts`.

### Comparator.vue
Equip sheet for two selected strategies on `/strategies`. The first card is the one already in the slot. The second is the one in hand. Each return is drawn across that book's own open-to-close window, so a long book and a short book stay readable. The line ends on the recorded return and touches the recorded drawdown. The verdict still quotes the days both were open. Equip puts the book in hand into the slot when its recorded return wins. Swap flips the two either way. Green and red gaps are printed on the book in hand.

### Strategy/Mark.vue
16 px category icon drawn on both strategy cards (`Strategy/Card.vue` and `Card/Strategy.vue`).

### Strategy/WealthFlow.vue
Artistic transfer of capital under calm, shock, trend, and chop. Positions come from `wealthBeads()` in `utils/labField.ts`. Motion pauses when the system asks for reduced motion. The compact strategy row uses the `dense` prop and keeps the inferred condition.

### Strategy/EquityCurve.vue
Deterministic random-walk SVG chart used on strategy detail and bot detail pages.

### Strategy/CodeView.vue
Read-only strategy code viewer. The Creator passes its live form. The summarizer passes `strategyToCodeView()` from the catalog in `core/strategies.json` (entry/exit assets, indicators, period, owner, agent). It does not read `strategies/codes/*.json`. An unknown allocation renders as an em dash, not 50%.

### Strategy/SwarmPlugs.vue (Phase 15)
Plug/unplug agents into the strategy with weighted sliders. Live preview bar.
- **Data**: `opinions.plugs`, `opinions.swarmVector`, `opinions.diversityScore`

### Strategy/ConsensusMeter.vue (Phase 14)
Community sentiment gauge — bullish/bearish/neutral split with controversy shake animation.

### Strategy/CounterpartyCard.vue (Phase 15)
Supply-chain exposure for each strategy target: suppliers, customers, facilities, commodities.

### Strategy/TradeList.vue
Strategy trade history table.

### Strategy/RunByPanel.vue
Shows which agents/bots are running the strategy.

### Strategy/DealRow.vue
Cross-strategy deal pipeline row (Phase 17).

## 5. Builder (Creator Page Canvas)

### Builder/NodeCanvas.vue
> **UNUSED** — no page renders it (COMPONENT-MAP-3 § UNUSED). Delete or adopt; do not build on it.
SVG infinite grid for the node-based strategy creator. d3-force layout in a WebWorker.

### Builder/Condition.vue
Conditional logic node (price cross_above/below, MA, RSI, etc).

### Builder/Action.vue
Action node (rebalance, alert, deploy, pause).

### Builder/Nodes/AvatarNode.vue
> **UNUSED** — no page renders it (COMPONENT-MAP-3 § UNUSED). Delete or adopt; do not build on it.
Avatar plug-in node with confidence opacity, execution heartbeat, personality-shaped frame.

---

## 6. AI Avatars & Swarm

### Agent/AvatarCard.vue
Summary card for any avatar. Plug/fork/compare actions.
- **Data**: `agent.personality_matrix` → frame shape (hexagon/circle/rounded)
- **Data**: `agent.training_state.loss_ema` → SVG progress ring (**simulated**: moved by the in-browser loop in `stores/training.ts` with a random reward; not the user's server avatar — CodingAgent.md §0)
- **Data**: `agent.confidence` → card opacity
- **Data**: `agent.performance.last_30d_curve` → sparkline
- **Data**: `agent.role` → a role pill on the twelve desk agents (optimisation, trader, designer, experience, security, red team, data, ai, risk, macro, execution, archive). Catalog archetypes stay unlabeled.

### Lab/Bench.vue
The bench on `/agents`, under the source tabs and above the filters. It shows the machine stamp, the field, and the operator graph for whoever the current filters leave in view.
- **Data**: `utils/labField.ts` (axes, projection, the four operators) and `utils/labRoster.ts` (the twelve desk agents, merged in `stores/agents.ts`).
- **Map**: X and Y are any of risk, patience, contrarian, aggression, speed, live PnL, Sharpe, compute (1 − training loss).
- **Globe**: the same `agentSphere` / `orthographic` placement as the nav Lab icon, with a turn control.
- **Operators**: together (money agrees, personalities close), against (money disagrees), junction (personalities meet, money has not chosen), apart (far, little shared result). Counts cover every pair in view. The drawing keeps the strongest links.
- **Stamp**: the signed-in name, the clock timezone, the viewport, and the cores this browser reports, so a screenshot carries the machine it was taken on.

### Lab/Field.vue
The map and the globe. A dot focuses that agent for the operator graph. Labels stay on when the set is fourteen or fewer.

### Lab/Operators.vue
The relation drawing. Focusing one agent dims every link that does not touch it.

### Lab/Stamp.vue
One line of who and what machine. Client only.

### Agent/PersonalityRadar.vue (Phase 23)
5-axis spider chart (risk/aggression/speed/patience/contrarian) for the Trader DNA.
- **Props**: `matrix`, optional `compare` ghost overlay
- **Visual**: concentric grid rings, dominant-axis highlight, center-of-gravity dot

### Agent/OpinionVector.vue
Stacked bar showing fiat/crypto/stocks/commodities percentages.

### Agent/Compare.vue
> **UNUSED** — no page renders it (COMPONENT-MAP-3 § UNUSED). Delete or adopt; do not build on it.
Side-by-side comparison of two agents' matrices and opinion vectors.

### Agent/TrainingTimeline.vue
History of training events: epochs, loss curve, reward EMA — **simulated** in the browser (`stores/training.ts`, random reward, not persisted); the real profile is server-side (`<IntelligenceAvatar>`).

---

## 7. Profiles (Own & Others)

### Profile/Hero.vue
Profile header: avatar, cover, name, bio, role, follower/following counts, KPI strip (portfolio, win rate, trades, strategies).

### Profile/PsychCard.vue
Psychology profile: MBTI, FOMO, revenge-trading tendency, loss aversion, discipline score.

### Profile/InvestorCard.vue
Investment style derived from wallet history: risk tolerance, horizon, preferred classes.

### Profile/PoliticalCard.vue
Static self-reported political profile (from `user.political_profile`). Multi-axis bars.

### Profile/OpinionProfileCard.vue (Phase 21)
Live article-derived opinion profile: political axis, economic axis, sentiment bias, topic affinity, influenced-by list, friend-circle small-multiples comparison.
- **Data**: `opinionProfile.getProfile(userId)`, `topTopics`, `topInfluencers`

### Profile/PersonalityMatrix.vue
Five horizontal bars for the avatar personality matrix. Used on agent detail page.

### Profile/ExperienceBar.vue
XP/level progress toward next rank.

### Profile/AvatarsSection.vue
> **UNUSED** — no page renders it (COMPONENT-MAP-3 § UNUSED). Delete or adopt; do not build on it.
List of avatars owned by the user — personal + forked.

### Profile/StrategiesSection.vue
User's strategies with status, PnL, win rate.

### Profile/PostsFeed.vue
User's social posts with political-leaning background tint, embedded allocation bar, controversy shake animation (Phase 19 fixed — uses canonical `interactions.*` shape).

### Profile/CommunitySection.vue
> **UNUSED** — no page renders it (COMPONENT-MAP-3 § UNUSED). Delete or adopt; do not build on it.
Communities the user belongs to.

### Profile/ContactsRail.vue
> **UNUSED** — no page renders it (COMPONENT-MAP-3 § UNUSED). Delete or adopt; do not build on it.
Friend list with avatar, trading style, online status.

### Profile/AchievementsSection.vue
Unlocked achievements by rarity tier.

### Profile/TradingCalendar.vue
> **UNUSED** — no page renders it (COMPONENT-MAP-3 § UNUSED). Delete or adopt; do not build on it.
Day-by-day PnL heatmap grid.

### Profile/TradingRecords.vue
> **UNUSED** — no page renders it (COMPONENT-MAP-3 § UNUSED). Delete or adopt; do not build on it.
Trade history summary table for the profile page.

---

## 8. Asset & Supply Chain

### Asset/CommodityPipeline.vue (Phase 14)
Per-commodity exposure grid from supply chain data.

### Asset/Heatmap.vue
Market-wide or sector-wide heatmap of price changes.

### Chart/Workspace.vue
The full candle / line chart used by `/CandleChart` (panes, indicators, drawings, zoom). See §15.

## 9. Social & News

### Social/ArticlePost.vue
> **UNUSED** — no page renders it (COMPONENT-MAP-3 § UNUSED). Delete or adopt; do not build on it.
Social feed post card with full NLP metadata visualization (Phase 23, 24).
| Data | Visual |
|------|--------|
| `political_leaning` | oklch background tint (blue↔red) |
| `controversy_index` | Comment icon shake if > 0.7 |
| `embedded_allocation` | Inline mini-pie bar |
| `weight` | Sort weight bar |
| `category` | Asset-class chip color |

**Tracking**: auto-logs `article_read` after 3s dwell, `article_political_view` + `article_dwell` training events, `share_article` on share click (2× opinion weight).

### News/InfluencerRail.vue
Top signal providers with their latest calls.

### Widget/NewsCard.vue
> **UNUSED** — no page renders it (COMPONENT-MAP-3 § UNUSED). Delete or adopt; do not build on it.
Editorial news card (from `news.json`) with category, title, excerpt.

### Widget/Sentiment.vue
> **UNUSED** — no page renders it (COMPONENT-MAP-3 § UNUSED). Delete or adopt; do not build on it.
Bullish/bearish/neutral gauge.

---

## 10. UI Primitives (Pure Presentation)

No store access — inputs are props only.

| Component | Role |
|-----------|------|
| UI/Card.vue | Generic content card with optional title, slot, padding |
| UI/PageHeader.vue | Page title + subtitle + action slot |
| UI/Stat.vue | Single metric: label, value, tone, suffix, precision |
| UI/MetricRow.vue | Responsive row of Stat components |
| UI/Pill.vue | Badge/chip with tone, dot, count |
| UI/SectionTabs.vue | Tab bar for section switching |
| UI/ScreenShell.vue | Page chrome: header, tabs, KPIs, content slot |
| UI/EmptyState.vue | Empty-slate placeholder with icon + message + action |
| UI/KpiStrip.vue | Horizontal KPI strip (/wallet, /agents, /chat, /news, /arena) |
| UI/OpChips.vue | Operator / filter chips |
| UI/SourceChip.vue | Where a number comes from: `sample` / `simulated` / `paper` / `pending` (+ `note`) — see §0b |
| UI/ValueTree.vue | How a number is built (inputs + driving settings), over `utils/valueTree.ts` — see §0b |

(`UI/DateRangePicker.vue` no longer exists. `UI/Card.vue` reads `useLivingUI` — the one primitive that is not props-only.)

---

## 11. Widgets & Charts

### Widget/DisplayAsset.vue
Price-list card. Name flush left on top, friends who called the asset top right (button: show / hide their calls, hidden by default), logo with the ticker under it, price + 24h move, mini chart (time scale bottom, prices right, the user's calls at their date + price). Click the card → `/assets/:id`; click the chart → the card morphs (View Transitions) into `Asset/PredictPanel`. No Details / Predict buttons.

### Asset/PredictChart.vue
The one SVG price chart (line or candles from `appearance.chartStyle`). `size="mini"` for cards, `"large"` for the prediction / alert charts. Right-hand future zone: x = target date, y = price; calls, friends' calls, paper trades and alert levels all go through `utils/assetChart.makeScales`, so a dot is drawn where it was placed (tests/assetChart.test.ts).

### Asset/PredictPanel.vue
> v2 (2026-10-20): the point is a draft until **Save prediction** (on the card: save & close; the call stays on the mini chart). Magnets at exactly 1D/1W/1M/… and at the right edge (the zone covers the price scale). Range ≥ 3σ of the expected move, widens when pushed against an edge. Your and friends' predictions are listed under the chart.
Record a call: horizon chips (1D…1Y, past shown = 1.5 × horizon), tap / drag / arrow keys in the future zone, release saves (`predictions.savePrediction`, keeps revisions) and sends `prediction_set` to the training buffer + `prediction_create` to the backend activity log. Offered range = largest rise / fall seen over the same length in the past (×1.25).

### Asset/ChartStyleToggle.vue
Line / Candles for every chart at once (prices page and asset page tops).

### Asset/SupplyTree.vue
Suppliers → asset → clients tree for the asset page, with similar assets stacked under the asset (dashed). Link width follows each partner's share; nodes show share % and nominal value, column headers show the totals. Nodes that are listed assets open their page. Data: `public/data/supply_chain/<id>.json` (shares, values), else names from `public/data/asset_profiles.json`.

### Asset/WorldMap.vue
Dot-matrix world map (land grid shared with the nav globe, `utils/navGlobe.landPoints`) with headquarters, facilities, suppliers, clients and market hubs; arcs from suppliers into the HQ and out to clients. (Not `Map/WorldMap.vue`, the founder's news map.)

`public/data/asset_profiles.json`: hand-curated public facts per asset and per bet-ticker prefix (tags, people, institutions, linked companies, supplier/client names, places, recurring calendar). No invented figures.

### Asset/DataTree.vue
Renders any asset JSON (backend `/api/assets/<sym>/detail/`, bundled company files) as label/value grids, chips and tables, so the asset page shows all available data.

### Widget/Quest.vue
> **UNUSED** — no page renders it (COMPONENT-MAP-3 § UNUSED). Delete or adopt; do not build on it.
Quest/progress widget.

## 12. Selectors & Buttons

### Selector/Asset.vue
Searchable single-asset picker.

### Selector/Assets.vue
> **UNUSED** — no page renders it (COMPONENT-MAP-3 § UNUSED). Delete or adopt; do not build on it.
Multi-asset picker with chips.

### Selector/Datasources.vue
Data-source selector for strategy nodes.

### Button/*.vue
Icon-only buttons: Avatar, Bookmark, Notification, Settings, Database. Reusable across the app.

---

## 13. Domain-Specific Cards

### Card/Avatar.vue
Avatar mini-card with personality indicators.

### Card/SharedData.vue
Shared strategy/data card for the feed.

---

## 14. Notifications (`/notifications`)

`pages/notifications.vue` composes four domain components over `stores/notifications.ts` and the pure model in `utils/notifications.ts`.
- **Sources:** the server feed and what this device can prove, merged by `key`.
- **Contract:** `types/notification.ts` (the 5W fields plus outcome and state). Full spec, vocabulary and copy rules: `Strades-comms/notifications-vision.md`.
- **SSR:** the store fills on the client only. The server renders the shell and a skeleton, and every time-dependent text waits for mount and reads `store.now`.
- **Opening a row:** calls `store.open(n, {surface, rank, listLen})`, which marks the row read and opened on the server and tracks `notification_open`, then `navigateTo(location)`.
  - Locations are allowlisted in-app routes.
  - `pages/assets/[id].vue` scrolls to the `#sec-…` anchor once the asset has loaded.
- **Rendering cap:** 200 rows. "Load more" first shows more of what is already held, then calls `store.loadMore()`.
- **Badge:** `layouts/default.vue` reads `store.unreadCount`; the old `social/notifications.json` seed is no longer used.

### Notification/Row.vue
One notification. Props `n: AppNotification`, `now: number`; emits `open`, `toggle-read`, `archive`. No store.

| Data | Visual |
|------|--------|
| `state.read_at === null` | Bold title, filled dot, sr-only "New", full-opacity left bar (never colour alone) |
| `domain` | Glyph and left-bar colour from `DOMAIN_META`; `paper` = dashed edge and 60 % saturation |
| `severity`, `priority === 3` | UIPill (Success/Warning/Alert) with icon; "Urgent" ghost pill |
| `when.occurred_at` / `when.due_at` | WHEN chip: relative time, plus "due in …" when the deadline is ahead; full date in `title` |
| `what.*`, `where.label` | WHAT chip (symbol in `--font-market-data`, then action · subject) and WHERE chip |
| `who.*` | WHO chip: avatar (http(s) or `/` URLs only) or actor-type glyph, plus label |
| `from.*` | FROM chip: source label, plus a dashed "device" badge when `origin === 'client'` |
| `outcome.*` | HOW WELL chip: `fmtSigned` value in `--app-color-up/down` with ▲/▼ and an sr-only tone, spliced into the label; benchmark muted |

- The title is a real `<a href>` stretched over the row. Click or Enter emits `open`; ⌘/ctrl-click keeps the browser default.
- Read-toggle and archive are 28 px icon buttons above the link, each with its own aria-label.
- The 5W chips are a `<dl>` and wrap at 375 px.

### Notification/Filters.vue
- **Controls:**
  - Domain chips: All plus each domain present, with unread count, `DOMAIN_META` glyph, label and colour stripe, `aria-pressed`, multi-select.
  - "Unread only" `role="switch"`.
  - Search input; Esc clears it.
  - Removable "Day: Tue 27 Oct" chip, set by the calendar.
- **Bindings:** `v-model:domains | unreadOnly | q | day`; prop `counts` from `countByDomain`. No store.

### Notification/Calendar.vue
- **Grid:** month from `monthGrid()`, Monday first, with prev / next / Today. `v-model` = the selected day, `YYYY-MM-DD | null`; clicking the selected day again clears it.
- **Markers:** up to 3 per day, then "+N". Shape differs as well as colour:
  - call due: blue ring
  - hit: filled up-colour dot
  - missed: filled down-colour diamond
  - not scored: dashed grey ring
  - market event: grey square
  - other deadline (e.g. a bot's next order): bar in the domain colour
- **States:** today = inset blue ring; selected = blue fill and underlined date.
- **Keyboard and labels:** cells are buttons with labels like "Tue 27 Oct: 2 calls due, 1 event". One tab stop (roving tabindex); arrows, Home/End and PageUp/PageDown move between days. Cells are at least 44 px tall on phones.
- **Legend:** under the grid.
- **Agenda:** the selected day (else today), one line per item: time, symbol (`--font-market-data`), and a label linking to the item through `notificationLocation`, with a text tone (Due / Hit / Missed / Event).
- **Client only:** the page wraps it in `<ClientOnly>` with a same-height fallback.
- **Items:**
  - `predictionCalendarItems` (calls held on this device)
  - `notificationCalendarItems(items, localCallIds)` (deadlines, and calls made on another device)
  - `botCalendarItems` (live bots' next order, within 7 days)
  - `eventCalendarItems(/data/global/events.json)`

### Notification/Digest.vue
A UIMetricRow of 4 UIStat:
- **Unread.**
- **Calls due in 24 h:** with the next one as a relative time.
- **Hit rate over 30 days:** accurate ÷ scored calls; "—" plus "no call scored in 30 days" when there are none.
- **Bots P&L today:** Σ `outcome.value` of today's `bot.daily` rows, in USD, signed, with up/down tone; "—" plus "no bot traded today".

It reads `usePredictionsStore` for calls and prints "—" until mounted, so SSR and client HTML match.

## 15. Chart workspace (`/CandleChart`)

`pages/CandleChart.vue` (default layout) wraps `components/Chart/Workspace.vue`, with all the maths in `utils/chartIndicators.ts` (tested in `tests/chartIndicators.test.ts`). It replaces the old Bitcoin-only d3 page; those files (`Chart/CandleChart.vue`, `Screener/*`, `layouts/candle.vue`, `stores/bitcoin.ts`, `public/Bitcoin.json`) were deleted.

- **Data:** comes from `useAssetSeries`, the same source as every card: real Binance candles (now with volume from `/api/market/history`), otherwise the seeded simulated path, labelled "sim".
- **Header:**
  - Asset picker covering every asset (type colour), price and 24 h change.
  - Global Line/Candles switch (`ChartStyleToggle`).
  - PNG export (computed colours inlined), copy-link, and full screen.
- **Toolbar:**
  - Range: 1D–1Y.
  - Interval: Auto, or any interval giving 10–500 candles.
  - Scale: linear, log or %.
  - Indicators: SMA 20/50, EMA 20, Bollinger 20·2, VWAP, volume, RSI 14, MACD 12·26·9. Indicators that need volume are disabled when the asset has no real volume.
  - Overlays: your calls, friends' calls (reveal-gated), paper trades, price alerts, drawings, market events.
  - Compare: up to 2 assets, shown in %.
- **Tool rail:** cursor (drag to pan), trend line, level, ruler, note, alert; zoom in / out and reset.
  - Hotkeys: V T H R N L, Esc.
  - Chart keys: ← →, + −, 0, Delete.
  - Wheel or pinch zooms; double click resets.
- **Chart:**
  - Price pane plus volume, RSI and MACD panes, with a time axis at the bottom and the price scale on the right.
  - Crosshair with price and time labels, plus an OHLCV legend that includes the indicator values.
  - A future zone after "now", where your calls and friends' calls are drawn from the point they were made to their target.
  - Drawings are saved per asset in `stores/assetAnnotations.ts` (new optional `ts_a`/`ts_b`). Alerts use the same store's triggers and show up in Notifications.
- **Side panel:**
  - Predict (`PredictPanel`).
  - Paper trade (`QuickPaperBet`).
  - Alerts: list with % distance, add by price.
  - Drawings: list, delete one or clear all.
  - Info: range change, high and low, distance from the high, volatility per day and per year, RSI, distance from SMA 50, average volume, data source.
- **URL:** the view is stored in the URL (`?asset=&range=&interval=&ind=&scale=&cmp=`), so it can be shared. The asset page links to it ("Full chart ↗").
- **Phones (≤ 640 px):**
  - The toolbar keeps only the range chips; interval, scale, indicators, overlays, compare and PNG / link / full screen sit behind one "⚙ Settings" button.
  - The tool rail is a single 34 px row.
  - Tapping the chart shows that candle in the legend, since touch has no hover.

## Data Flow Map

One copy only: Data.md §10 (visual state inheritance). Per-component reads and endpoints: COMPONENT-MAP.

## 16. History (`/historic`) — past · now · next (2026-10-26)

One view of the user across time. Data only from `composables/useHistoryTimeline.ts`; merge, tense,
filters, summary and river maths in `utils/historyTimeline.ts` (pure, `tests/historyTimeline.test.ts`).

| Component | Purpose |
|---|---|
| `History/YouCard.vue` | "You, so far": how you call (exact counts + server EMAs labelled *recent*), what your money did (realised paper P&L, open positions, best backtest), your agents (running, personal agent, followed), your opinions (articles judged, reading sentiment — no political profiling), score strip of every resolved call, hour × weekday activity heatmap. |
| `History/River.vue` | SVG lanes (Predictions, Trades, Agents, Opinions, Activity, Profile) on one time axis; NOW fixed at 70 %, future hatched. Dot = instant, bar = span, hollow dashed = paper, diamond = backtest, faded = sample. Mouse picks a row; the lists are the keyboard path (SVG is one labelled image). |
| `History/Filters.vue` | Past range (7D…All — limits the past only), lane chips (dbl-click = solo), Real/Paper/Backtest, Sample toggle, all-words search. |
| `History/NowPanel.vue` | In progress, grouped: calls in play (progress to target), agents at work (live P&L on demand), in the market, opinions followed, account clocks. |
| `History/EventRow.vue` | One row: lane glyph, title, chips (kind, mode, Sample, Device, status, asset), value (P&L > score > % > amount), time; opens inline facts + link. |

Rules: the page body is `<ClientOnly>` (it merges localStorage stores); Sample = pre-filled demo history or
catalog data, always chipped; progress bars only on spans with a scheduled end; one expanded row at a time.
