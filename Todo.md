# Data‑Driven Backlog (uses @data/ only)

## Scope

Rewrite the backlog as actionable items grounded strictly in `@data/` (`public/data/**`). Each item includes: objective, data sources, deliverables, and acceptance criteria. No external APIs; simulated data only.

## Conventions

- Paths use the alias `@data/` → `public/data/`
- Types map to keys documented in `Data.md`
- UI/UX follows `Design.md`; architecture follows `Structure.md`

### 1) Dashboard – Favorites and Lists

- Objective: Implement favorites and watchlists backed by relationship data.
- Data: `@data/relationships/user_assets.json` (id, user_id, asset_id, is_favorite, is_watchlisted), `@data/core/assets.json` (id, name, symbol, current_price)
- Deliverables: Toggle favorite/watchlist; lists with sorting; empty states.
- Acceptance:
  - Toggling updates reactive state derived from `user_assets`.
  - Lists render only assets referenced in `user_assets` for the active user.
  - Sorting by name/symbol/price matches values from `core/assets.json`.

### 2) Shared Strategies – Administration Controls

- Objective: Expose governance for public/premium strategies shown in shared panels.
- Data: `@data/core/strategies.json` (id, creator_id, is_public, is_premium, price, status, tags), `@data/shared_data.json` (shared articles/entries referencing strategies)
- Deliverables: Visibility toggles; premium pricing input; status badges; shared panel filters.
- Acceptance:
  - Public/premium flags reflect `strategies.json` values.
  - Shared view filters by `is_public=true` and optional `is_premium`.
  - Price displays exactly the `price` field for premium strategies.

### 3) Profile – Comprehensive User Overview

- Objective: Build a consolidated profile from core and relationship tables.
- Data: `@data/core/users.json` (id, username, bio, risk_tolerance, win_rate, active_strategies_count, achievements, notification_preferences), `@data/core/wallets.json` (by user_id: assets, performance_history, transactions), `@data/relationships/user_assets.json` (holdings/watchlist)
- Deliverables: About, achievements, portfolio snapshot, performance tiles, privacy/notification preferences.
- Acceptance:
  - Achievements render from `users.achievements[*]` with icon, name, unlocked_date.
  - Portfolio totals match `wallets.total_value` and `total_return_percentage` where present.
  - Preferences UI reflects `notification_preferences` booleans precisely.

### 4) Real‑Time Metrics (Dev Reactivity)

- Objective: Derive live-looking metrics from reactive stores bound to `@data/` sources.
- Data: `@data/core/users.json`, `@data/core/wallets.json`, `@data/relationships/user_assets.json`
- Deliverables: Computed KPIs (win_rate, total_trades, allocation diversity) updated when underlying store data changes.
- Acceptance:
  - Metrics recompute without page reload when store data updates.
  - No hardcoded constants; values come from the above files.

### 5) Quests via Achievements

- Objective: Model quest progression using existing achievements and tracked interactions.
- Data: `@data/core/users.json.achievements[*]`, `@data/tracking/user_interactions.json`
- Deliverables: Progress bars per achievement; unlock logic keyed to interaction metrics.
- Acceptance:
  - Progress is computed from `user_interactions` (e.g., event counts) and caps at unlock threshold.
  - Unlocks display with `unlocked_date` populated when criteria are met.

### 6) Leaderboard – Categories and Ranks

- Objective: Rank entities using only strategy and user KPIs.
- Data: `@data/core/strategies.json` (total_return_percentage, sharpe_ratio, win_rate, followers_count), `@data/core/wallets.json` (diversity via assets count), `@data/core/users.json` (total_trades, total_returns)
- Deliverables: Categories: Most Profitable, Most Diverse Wallet, Most Consistent (win_rate), Most Followed.
- Acceptance:
  - Sorting is deterministic and derived from exact numeric fields.
  - Top 3 show positions 1/2/3 with gold/silver/bronze visuals.

### 7) Messaging – Rich Interactions

- Objective: Enable reactions, attachments, mentions, hashtags, replies, edit/delete.
- Data: `@data/chat/messages.json` (id, sender_id, recipient_ids, content, attachments, reactions[*], reply_to, is_edited, is_read, timestamp), `@data/chat/conversations.json`
- Deliverables: UI affordances for each interaction; thread rendering by `reply_to`.
- Acceptance:
  - Reactions list mirrors `reactions[*]` (reaction, timestamp, user_id) exactly.
  - Edited messages show last `edited_at` value; deleted messages display placeholder when `deleted=true`.

### 8) Bugfix – Reaction Not Sent After Focusing Message Box

- Objective: Ensure reaction dispatch is independent of input focus.
- Data: `@data/chat/messages.json.reactions`
- Deliverables: Deterministic reaction event path; idempotent UI state.
- Acceptance:
  - Adding a reaction always updates the reactions collection for that message.
  - No dependency on textarea focus for reaction triggers.

### 9) Chat Assistant (Data‑Aware Helper)

- Objective: Provide search/suggestion assistant powered purely by local data.
- Data: `@data/shared_data.json` (articles), `@data/core/strategies.json` (names, tags, categories)
- Deliverables: Autocomplete intents (strategy lookup, tag surfacing); no external inference.
- Acceptance:
  - Suggestions derive from titles/tags present in `shared_data.json` and `strategies.json` only.

### 10) Chart Analysis & Alerts (Local Series)

- Objective: Provide overlays and threshold alerts using available local time series.
- Data: `@data/core/wallets.json.performance_history` (1d/7d/30d/90d)
- Deliverables: Line chart of performance_history; user-drawn lines; local threshold notifications.
- Acceptance:
  - Alert triggers evaluate against the selected performance series only.
  - No references to non‑@data price feeds.

### 11) Notifications – List and Preferences

- Objective: Render a notifications list with timestamps and respect preferences.
- Data: `@data/Users.json.notifications` (legacy), `@data/core/users.json.notification_preferences` (authoritative preferences)
- Deliverables: Unified notification center; filter by prefs (email, sms, push, trade/price alerts).
- Acceptance:
  - Each notification shows date/time; visibility governed by `notification_preferences`.
  - Document deprecation of `@data/Users.json.notifications` if overlapping with core.

### 12) Price Widget – Horizontal Layout

- Objective: Replace placeholder with data‑driven compact module.
- Data: `@data/core/assets.json` (current_price), `@data/core/wallets.json.performance_history` (sparkline)
- Deliverables: Horizontal layout showing name, current price, miniature sparkline, single tag.
- Acceptance:
  - Sparkline values map to the chosen performance window from `performance_history`.

### 13) Wallet – Settings Button Visibility

- Objective: Ensure settings control is not occluded.
- Data: N/A (layout-only)
- Deliverables: Panel width/stacking adjustments compliant with `Design.md` spacing and z‑index guidance.
- Acceptance:
  - Settings button is fully visible at all breakpoints.

### 14) News Layout – Top Bar

- Objective: Add standard top bar to the news layout.
- Data: N/A (layout-only)
- Deliverables: Reuse existing top bar organism from layouts; consistent spacing/contrast.
- Acceptance:
  - Bar appears across news routes using the news layout.

### 15) News – Hover State Color Fix

- Objective: Make hover color white for filter buttons.
- Data: N/A (style-only)
- Deliverables: CSS token usage per `assets/css/variables.css`; hover tokens updated.
- Acceptance:
  - Hover state displays white; accessible contrast preserved.

### 16) Shop – Strategies Catalog

- Objective: Display strategies for buy/rent/share scenarios.
- Data: `@data/core/strategies.json` (name, description, price, is_premium, is_public, tags)
- Deliverables: Cards with pricing, premium badge, filters (category/tags/public/premium).
- Acceptance:
  - Only `is_public=true` strategies are listed; pricing matches `price`.

### 17) Notifications Page – Chronological List

- Objective: Standardize notification rendering with timestamps.
- Data: `@data/Users.json.notifications`
- Deliverables: Grouped by date; time shown; read/unread state if provided.
- Acceptance:
  - Sort order strictly by timestamp descending.

### 18) Calendar – Vertical Hourly View

- Objective: Redesign hourly view to vertical timeline.
- Data: `@data/core/wallets.json.transactions[*].timestamp` (for time markers)
- Deliverables: Sticky hour markers; transaction overlays by time.
- Acceptance:
  - Hours ordered top→bottom early→late; items placed by timestamp.

### 19) Data Hygiene – Standardize Sources

- Objective: Resolve duplicate users datasets and direct file access.
- Data: `@data/core/users.json` (authoritative), `@data/Users.json` (legacy)
- Deliverables: Document that components should consume core tables via stores; deprecate legacy roots.
- Acceptance:
  - All references in documentation point to `@data/core/*` equivalents where available.

## Notes

- All features must be type-safe using interfaces aligned to `Data.md`.
- No reliance on `public/Bitcoin.json` or non-`@data/` feeds.
- Keep state reactive via Pinia stores; do not mutate JSON files directly in dev mode.

The quest page should show a list of the quests that are "greyed out" when the user has not unlocked the quest. Create a list of quests that are not unlocked and show them in greyed out. Also, for the development purpose, create some quests that are furfilled. The quest widget in components/widget/ folder has 2 states: The greyed out one that show the level of difficulty (and points earned) on the left, the name on the top middle with the current progress bar under it. on the right side of the widget, add a button to show the details of the quest. The success state, is giving a golden reflection style to the widgent whe it has been fully completer. A filter should be added to the quest page to filter the quests by category.

Upgrade the notifications page to show the notifications in a list with the date and the time of the notification. Show in grey the notifications that have been read already. This is updated after the user has opened the notifications page. It makes the notification button counter reset (therefor disappear) after the user has opened the notifications page.

Upgrade the search fonction in all the layouts top bar components so that it opens a side panel when clicked on it. The search icon button should do a quarter of turn on itself while the panel appears from 
the left. The search button is staying on the left of the top bars. The panel show the old searchs, the proposed similar searches while taping in the text box.

The Chat page should display the discussion with 2 of them and a group discussion where the user is discussing with 2 of them at the same time. Create a group discussion where the user is discussing with 2 of them at the same time (add the related data and strategies to the discussion). The background color of their respective messages should be different from one another, but the same as the background color of the avatar picture. Create a floating button "+" in the down right corner of the chat layout that opens a modal with the form to create a new message with the horizontal list of characters to choose from. The message should be sent to the chat and the message should be displayed in the chat. 
Fix the reaction system when clicking on the reaction button in the message box; it should add the reaction to the message and the message should be updated with the new reaction; if the message has already a reaction, adding the same reaction should not add a new reaction but should update and show the counter to the existing one. Create fake characters data for each avatar pictures; if the user doesn't have a picture, display a default one. Fix the problem where the image of the users in a conversation/[id].vue doesn't lead to their relevant profile/[id].vue page showing their personal informations in the public/data/users/ directory.

Create Buy and Sell buttons in the components/Button/ folder. This buttons should be horizontally aligned under the DisplayAsset component in its opened form (located in the components/widget/ folder). Rework the DisplayAsset component so that it has 2 states: the default one and the expanded one. 
The default one is showing from the left: the UpArrow and DownArrow buttons, the picture, the name, the price, the tag and the chart and the Button/Expand.vue button component on the right.
The expanded one is showing the same default configuration but the ButtonExpand button is turned 45 degrees pointing down to the now visible expanded part with a background color a gradient under the default one. This part shows from the left: the ButtonBookmark, the ButtonBuy and the ButtonSell.   
Buying or selling a financial asset should open a modal with the form to buy or sell the asset with the amount, the price, the total amount and the buttons to confirm or cancel the transaction. This transaction is registered in the transactions history in the Wallet page. The user can buy or sell 

The Wallet page is good but the TradesHistory component is now in the component/Wallet/ folder and must be modified to show the trades history in a list with the date, the time, the asset, the type of trade, the price, the quantity and the total amount. The Total Portfolio Value information in the WalletCapitalCounter component should be mixed with the wallet-header in the wallet page. The button to switch the wallet should simply display the name of the wallet to switch to another wallet; add the symbol of the current currency.
Portfolio Allocation should be in the same div as Portfolio Evolution, right underneath it. The selection made by the user should also update the Portfolio Evolution component to the same values selected in the Portfolio Allocation component.
Add more space at the end of the page because the Navbar is covering the last part of the page.

The News page has 3 types of categories: the News, the Analysis and the Events. Each can be filtered by various parameters. The component displaying the news is in Widget/ NewsListItem.vue component; add the bookmark button on the right side of the news item.

In the Leaderboard page, create a Competition component where the users can add any token crypto they have to the pot to compete against each others in a tournament format where the best trader compete over a give time period and classes of assets.

Replace the widgets in the shop page by cards with the strategy name, the description, the price, the premium badge, the public badge, the tags and the buttons to buy, rent or share the strategy.

Update the strategy page, the strategy Filters component components/Filters.vue should be updated to define the min and max values based on the one from the data in the strategies.
Change the color for the "active" tag to blue.
Add the Create Button in the Strategy Actions component when nothing is selected.
The Select status should have its options buttons horizontally aligned instead of the current dropdown.

Profile pages should be updated to show the user's profile with the avatar, the name, the bio, the risk tolerance, the win rate, the active strategies count, the achievements, the number of followers and a "Follow +" button. Add the notification preferences, the portfolio snapshot, the performance tiles, the privacy/notification preferences. The achievements should be displayed with the icon, the name, the unlocked date. The portfolio snapshot should be displayed with the assets, the allocation percentage, the amount, the value, the percentage of the total portfolio. The performance tiles should be displayed with the title, the profit, the duration, the type, the index. The privacy/notification preferences should be displayed with the email, the sms, the push, the trade/price alerts.
