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