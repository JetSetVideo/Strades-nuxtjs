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

Every nav icon is a live component that double-dashes as an info display.

| Icon component | Data source | Visual behavior |
|----------------|-------------|-----------------|
| `Navigation/Icons/WalletIcon.vue` | `allocation.allocationPie` | Tiny D3 pie chart inside 24×24px |
| `Navigation/Icons/PricesIcon.vue` | `macro.global_volatility_index` | Pulse frequency tied to volatility |
| `Navigation/Icons/NewsGlobeIcon.vue` | `prefetch.latestNewsCoords` | Smooth 3D rotation toward geography |
| `Navigation/Icons/ChatBadgeIcon.vue` | `chat.unread[].emotional_urgency` | Badge + pulse speed |
| `Navigation/Icons/StrategyOrbitIcon.vue` | `max execution_frequency` | Orbiting nodes |

### Navigation/Top.vue
Composes the 5 living icons + the search bar (`Navigation/SearchBar.vue`). SearchBar logs `search_used` training events.

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
Syntax-highlighted strategy code viewer.

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
Asset card with price, change%, liquidity glow, specials, price intuition slider.

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
              ├─> PricesIcon (pulse)
              ├─> NewsGlobeIcon (rotation)
              ├─> FlowVisualizer (particles)
              ├─> AllocationSlider (dominant highlight)
              └─> Widget/DisplayAsset (sentiment tone)

allocationPie ──┬─> WalletIcon (nav pie)
                ├─> AllocationSlider
                ├─> Wallet/Hero (swarm ghost)
                └─> Wallet/Positions (row heights)

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
