## News Intelligence Workspace

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

### Adapted legacy components
- `components/Social/ArticlePost.vue`
  - now acts as a thin adapter around the canonical news card
- `components/Widget/NewsCard.vue`
  - now acts as a thin adapter around the canonical news card for editorial items
- `components/News/InfluencerRail.vue`
  - read-mostly signal rail with follow action

### Interaction contract
- Save, comment, share, like/dislike, and political judgment all dispatch through the news store.
- History events are created for read/save/share/comment/judge/publish/import actions.
- Story cards must not mutate props directly.
## Menu sheet

`components/Navigation/DrawerMenu.vue` is the right-hand sheet opened from the brand button. It does not fetch. It renders four groups (You, Together, Desk, Support) from a static list. Width reads `--drawer-width` (`clamp(16rem, 32vw, 22rem)`). The current route is marked with `is-current` when the path equals the link or starts with it plus a slash. Hints hide under 640px.

The Wallet top-bar action list in `components/Navigation/Top/ContextActions.vue` does not include a Trade link. Prices stays on the bottom bar.

# Components Data Usage Analysis & Visual Mapping

This document maps **every data key from `Data.md` to the Vue component that consumes it**, and specifically how each key drives form, size, color, or animation of the living UI.

> **Folder rules** (from `Structure.md`): every component lives in a PascalCase domain folder. Pages compose domain components; domain components compose UI primitives. No loose `.vue` files at `components/` root.

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
| Wallet | `/wallet` (`/trade`, `/risk`) | `Navigation/Icons/WalletIcon.vue` | `wallet.wallets` (`total_value`, `available_balance`, `assets[].current_value`) | Two rings: outer = each wallet's share of the total (amber, pink, teal, yellow, lime; the last wallet never repeats the first's colour), inner = asset types across every wallet (`assetClassTheme` colours, cash grey). Centre pip in the largest type's colour | Total (`compactUsd`, same as the switcher's TOTAL BALANCE); `—` when no wallet is loaded |
| Lab | `/strategies` (`/strategy`, `/agents`, `/bots`, `/creator`, `/monitor`, `/arena`) | `Navigation/Icons/LabSphereIcon.vue` | `agents.byId` (`training_state.status`, `personality_matrix.risk/patience/contrarian`, `performance.trades_total`) | CSS 3-D globe, one dot per agent (at most 24: errors first, then waiting, then the busiest). Latitude = risk, longitude = patience nudged by contrarian, size = √trades. Agents without personality data are spread by an id hash. Green running (live/training), orange waiting, red error. Turns once per 18 s only while Lab is selected; otherwise the spin is paused at its angle | `N run`; with several states `●8 ●2 ●1` on phones and `8 run 2 wait 1 error` from 768 px; `—` with no agents |
| Chat | `/chat` (`/conversations`) | `Navigation/Icons/ChatBadgeIcon.vue` | `chat.conversations` (only the user's own, summing `unread_count_<userId>`: exactly the badges `pages/chat.vue` draws) and `chat.getEmotionalUrgency(userId)` | Speech bubble with a red dot holding the unread count (`99+` past 99). When Chat is selected and urgency > 0.7 the dot throbs | `unread` or `no new` (the number is in the dot) |

The selected tab is the longest matching route prefix (`activePanelFor`), so detail pages keep their tab selected. `StrategyOrbitIcon.vue` no longer exists; `LabSphereIcon.vue` replaced it.

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
Side drawer with links to all pages. Highlights the current route.

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

### Wallet/RiskPanel.vue
Inline risk metrics: concentration risk, VaR contribution, class volatility.

### Wallet/PlatformList.vue
Connected platform cards from `platforms.list`. Shows balance, daily PnL, status.

### Wallet/BotContribution.vue
How much of today's PnL came from automated strategies vs. manual trades.

### Wallet/Switcher.vue
Multi-wallet selector when the user has multiple sub-wallets.

---

## 4. Strategy & Creator

### Strategy/Card.vue
Strategy summary card — name, PnL, win rate, status, target assets.
- **Data**: `strategy.is_paper` → Paper badge
- **Visual**: equity-curve sparkline, asset chips

### Strategy/EquityCurve.vue
Deterministic random-walk SVG chart used on strategy detail and bot detail pages.

### Strategy/Visualizer.vue
Read-only SVG view of a strategy's node tree.

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

### Strategy/BotCard.vue
Agent-driven strategy card showing the bot's PnL, Sharpe, status.

---

## 5. Builder (Creator Page Canvas)

### Builder/NodeCanvas.vue
SVG infinite grid for the node-based strategy creator. d3-force layout in a WebWorker.

### Builder/BlockEditor.vue
Property panel for editing a selected node's conditions and actions.

### Builder/Condition.vue
Conditional logic node (price cross_above/below, MA, RSI, etc).

### Builder/Action.vue
Action node (rebalance, alert, deploy, pause).

### Builder/Nodes/AvatarNode.vue
Avatar plug-in node with confidence opacity, execution heartbeat, personality-shaped frame.

---

## 6. AI Avatars & Swarm

### Agent/AvatarCard.vue
Summary card for any avatar. Plug/fork/compare actions.
- **Data**: `agent.personality_matrix` → frame shape (hexagon/circle/rounded)
- **Data**: `agent.training_state.loss_ema` → SVG progress ring
- **Data**: `agent.confidence` → card opacity
- **Data**: `agent.performance.last_30d_curve` → sparkline
- **Data**: `agent.opinion_vector` → mini stacked bar

### Agent/PersonalityRadar.vue (Phase 23)
5-axis spider chart (risk/aggression/speed/patience/contrarian) for the Trader DNA.
- **Props**: `matrix`, optional `compare` ghost overlay
- **Visual**: concentric grid rings, dominant-axis highlight, center-of-gravity dot

### Agent/OpinionVector.vue
Stacked bar showing fiat/crypto/stocks/commodities percentages.

### Agent/Compare.vue
Side-by-side comparison of two agents' matrices and opinion vectors.

### Agent/TrainingTimeline.vue
History of training events: epochs, loss curve, reward EMA.

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
List of avatars owned by the user — personal + forked.

### Profile/StrategiesSection.vue
User's strategies with status, PnL, win rate.

### Profile/PostsFeed.vue
User's social posts with political-leaning background tint, embedded allocation bar, controversy shake animation (Phase 19 fixed — uses canonical `interactions.*` shape).

### Profile/CommunitySection.vue
Communities the user belongs to.

### Profile/ContactsRail.vue
Friend list with avatar, trading style, online status.

### Profile/AchievementsSection.vue
Unlocked achievements by rarity tier.

### Profile/TradingCalendar.vue
Day-by-day PnL heatmap grid.

### Profile/TradingRecords.vue
Trade history summary table for the profile page.

---

## 8. Corporate & Supply Chain

### Corporate/NetworkGraph.vue
D3 force-directed graph showing HQ + facilities + suppliers + customers.
| Data | Visual |
|------|--------|
| `supply_chain_health` | SVG link stroke width |
| `fluctuation_velocity` | Node pulse speed |
| `factories[].status` | Color (green/yellow/red) |
| `share_pct` | Edge label weight |

### Asset/CommodityPipeline.vue (Phase 14)
Per-commodity exposure grid from supply chain data.

### Asset/LiveSignalsStrip.vue
Live buy/sell signals for a given asset.

### Asset/AnalysisPanel.vue
Long-form analysis text + metrics.

### Asset/FacilityList.vue
Factory/warehouse locations for an asset's company.

### Asset/NewsSnippets.vue
Recent news articles tagged with the asset's ticker. Fetches `social/posts.json`.

### Asset/Heatmap.vue
Market-wide or sector-wide heatmap of price changes.

### Asset/CandleChart.vue
Price candle chart with volume (dedicated page + inline widget).

### Asset/MoversStrip.vue
Scrollable strip of top movers (up/down by category).

---

## 9. Social & News

### Social/ArticlePost.vue
Social feed post card with full NLP metadata visualization (Phase 23, 24).
| Data | Visual |
|------|--------|
| `political_leaning` | oklch background tint (blue↔red) |
| `controversy_index` | Comment icon shake if > 0.7 |
| `embedded_allocation` | Inline mini-pie bar |
| `weight` | Sort weight bar |
| `category` | Asset-class chip color |

**Tracking**: auto-logs `article_read` after 3s dwell, `article_political_view` + `article_dwell` training events, `share_article` on share click (2× opinion weight).

### News/CalendarStrip.vue
Upcoming earnings / economic events.

### News/InfluencerRail.vue
Top signal providers with their latest calls.

### Widget/NewsCard.vue
Editorial news card (from `news.json`) with category, title, excerpt.

### Widget/Sentiment.vue
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
| UI/DateRangePicker.vue | Date range selector |
| UI/KpiStrip.vue | Horizontal KPI strip used on monitor and risk pages |

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

### Asset/PriceChart.vue
Price alerts on the asset page: drag up / down to arm an alert; draws with PredictChart.

### Asset/SupplyTree.vue
Suppliers → asset → clients tree for the asset page, with similar assets stacked under the asset (dashed). Link width follows each partner's share; nodes show share % and nominal value, column headers show the totals. Nodes that are listed assets open their page. Data: `public/data/supply_chain/<id>.json` (shares, values), else names from `public/data/asset_profiles.json`.

### Asset/WorldMap.vue
Dot-matrix world map (land grid shared with the nav globe, `utils/navGlobe.landPoints`) with headquarters, facilities, suppliers, clients and market hubs; arcs from suppliers into the HQ and out to clients. (Not `Map/WorldMap.vue`, the founder's news map.)

`public/data/asset_profiles.json`: hand-curated public facts per asset and per bet-ticker prefix (tags, people, institutions, linked companies, supplier/client names, places, recurring calendar). No invented figures.

### Asset/DataTree.vue
Renders any asset JSON (backend `/api/assets/<sym>/detail/`, bundled company files) as label/value grids, chips and tables, so the asset page shows all available data.

### Widget/Asset.vue
Generic asset display (icon + symbol + price).

### Widget/Chart.vue
Generic chart container (SVG wrapper).

### Widget/BarChart.vue
Horizontal or vertical bar chart.

### Widget/CandleChart.vue
Price candle series (SVG).

### Widget/NewsCard.vue
Editorial news card with category chip, date, excerpt.

### Widget/NewsListItem.vue
Compact news list row.

### Widget/Treemap.vue
Market-cap-weighted treemap.

### Widget/Heatmap.vue
Sector performance grid.

### Widget/Sentiment.vue
Sentiment gauge.

### Widget/Quest.vue
Quest/progress widget.

### Widget/Transactions.vue
Recent transaction row.

---

## 12. Selectors & Buttons

### Selector/Asset.vue
Searchable single-asset picker.

### Selector/Assets.vue
Multi-asset picker with chips.

### Selector/Datasources.vue
Data-source selector for strategy nodes.

### Selector/Condition.vue
Condition-type picker.

### Selector/Entry.vue
Order-type picker (market/limit/stop).

### Button/*.vue
Icon-only buttons: Avatar, Bookmark, Notification, Settings, Database. Reusable across the app.

---

## 13. Domain-Specific Cards

### Card/Asset.vue
Asset mini-card for grids and lists.

### Card/Avatar.vue
Avatar mini-card with personality indicators.

### Card/Datasource.vue
Data-source card for the catalog.

### Card/Friend.vue (removed Phase 14)
Superseded by Community/ContactsRail.

### Card/SharedData.vue
Shared strategy/data card for the feed.

---

## Data Flow Map (Read-Only Paths)

```
macro_state ──┬─> DynamicThemeController ─> :root CSS
              ├─> FlowVisualizer (particles)
              ├─> AllocationSlider (dominant highlight)
              └─> Widget/DisplayAsset (sentiment tone)

allocationPie ──┬─> AllocationSlider
                ├─> Wallet/Hero (swarm ghost)
                └─> Wallet/Positions (row heights)

Bottom bar: stores ─> useNavPanels ─> Navigation/Bar ─> Navigation/Icons/*
assets.liveMarket.history ─> PricesIcon (today's curve since 00:00 GMT)
news.items[].readByUser ───> NewsGlobeIcon (unread dot; noon meridian from the 30 s clock)
wallet.wallets ────────────> WalletIcon (wallet ring + asset-type ring)
agents.byId ───────────────> LabSphereIcon (one dot per agent)
chat.conversations ────────> ChatBadgeIcon (unread badge)

wallets[] ──┬─> Wallet/Hero
            ├─> Wallet/Positions
            ├─> Wallet/Trades
            └─> Wallet/EquityCurve

agents[] ──┬─> Agent/AvatarCard (frame, ring, opacity)
           ├─> Agent/PersonalityRadar
           ├─> Agent/OpinionVector
           ├─> Profile/AvatarsSection
           └─> Strategy/SwarmPlugs

opinionProfile ──┬─> Profile/OpinionProfileCard
                 └─> Profile/PoliticalCard (friend comparison)

tracking ──┬─> training store (avatar learns)
           └─> activityLog (trading profile records)

posts[] ──┬─> Social/ArticlePost (NLP display + tracking)
          ├─> Profile/PostsFeed
          ├─> News globe rotation (coords)
          └─> Asset/NewsSnippets
```
