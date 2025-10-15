# Data‑Driven Backlog (uses @public/data only)

## Scope

Rewrite the backlog as actionable items grounded strictly in `@public/data/` (`public/data/**`). Each item includes: objective, data sources, deliverables, and acceptance criteria. No external APIs; simulated data only.

## Conventions

- Paths use the alias `@public/data` → `public/data/`
- Types map to keys documented in `Data.md`
- UI/UX follows `Design.md`; architecture follows `Structure.md`

---

## 1) Quests page and widget
- **Objective**: Show locked/unlocked quests; filter by category; two visual states.
- **Data sources**: `@public/data/quests/quests.json`, `@public/data/quests/categories.json`
- **Load**: Page-level in `pages/quest.vue` via `useLocalJson`/`useAsyncData`.
- **Data flow**:
  - Page computes `filteredQuests` from `selectedCategory`.
  - Pass `categories`, `selectedCategory` to `components/Quest/Filter.vue` (props). Emits `update:selectedCategory`.
  - Render `components/Widget/Quest.vue` per quest (prop `quest`, `isCompleted`).
- **Acceptance**: Locked greyed; completed with golden reflection; filter works; no child fetches.

## 2) Notifications page and counter reset
- **Objective**: List notifications with date/time; grey when read; reset counter on open.
- **Data sources**: `@public/data/social/notifications.json`
- **Load**: Page-level in `pages/notifications.vue`.
- **Data flow**:
  - Page marks as read on mount (local state and `localStorage` timestamp for dev).
  - `components/Button/Notification.vue` receives `unreadCount` via prop from layout; resets counter when navigating to page.
- **Acceptance**: Read state grey; counter resets after opening page.

## 3) Top‑bar search side panel
- **Objective**: Click search → slide-over; show history + suggestions; icon quarter-turn.
- **Data sources**: `@public/data/search/history.json`, `@public/data/search/suggestions.json`
- **Load**: Layout-level (e.g., `layouts/default.vue`) using page/layout loader.
- **Data flow**:
  - Pass `history`, `suggestions` into `components/SearchBar.vue`.
  - Component emits `update:query` and `select:suggestion`; filtering done in component; persistence optional to `localStorage`.
- **Acceptance**: Panel animates from left; suggestions filter while typing; icon animates.

## 4) Chat: group, reactions, profile links
- **Objective**: Support 1:1 and group; dedup reactions; avatar links to profile.
- **Data sources**: `@public/data/chat/conversations.json`, `@public/data/chat/messages.json`, `@public/data/core/users.json`
- **Load**: Shared via `stores/chat.ts` and `stores/users.ts`.
- **Data flow**:
  - `pages/chat.vue` reads from stores and passes threads/messages to thread/message components.
  - Store action `addReaction(messageId, reaction, userId)` dedupes per user+emoji (increment, don’t duplicate).
  - Avatars route to `pages/profile/[id].vue`.
  - “+” floating button state owned by page; pass selected participants + new message to store `sendMessage`.
- **Acceptance**: Group sample present; reactions dedupe; avatar click navigates.

## 5) DisplayAsset expand + trade modal (status: cancelled)
- **Status**: Cancelled — keep item for context; no implementation.

## 6) Wallet layout and behaviors
- **Objective**: Align evolution/allocation; sync selections; summary header and spacing.
- **Data sources**: `@public/data/core/wallets.json`, (optional) `@public/data/core/wallet_history.json`
- **Load**: Shared via `stores/wallets.ts`.
- **Data flow**:
  - `pages/wallet.vue` reads wallets and owns selection state (walletId, timeframe, assetFilter).
  - Pass selection and derived series to `Wallet/Evolution.vue` and `Wallet/EvolutionAllocation.vue`.
  - Allocation interactions emit selection changes to page; page re-computes and passes down.
- **Acceptance**: Allocation click filters evolution; header merged; extra bottom spacing.

## 7) News categories and bookmarking
- **Objective**: Tabs for categories; toggle bookmark per article.
- **Data sources**: `@public/data/news.json`, `@public/data/social/bookmarks.json`
- **Load**: Shared via `stores/newsStore.ts`.
- **Data flow**:
  - Page selects category/tab; passes articles and `bookmarkedIds` into `components/Widget/NewsListItem.vue`.
  - Component emits `toggle:bookmark(articleId)`; store updates bookmarks (dev persistence: `localStorage`).
- **Acceptance**: Bookmark state reflects and persists in dev.

## 8) Leaderboard competition
- **Objective**: Users contribute tokens to a pot; show live pot.
- **Data sources**: `@public/data/competitions/competitions.json`, `@public/data/competitions/contributions.json`
- **Load**: Page-level in `pages/leaderboard.vue` (feature-local).
- **Data flow**:
  - Pass competition + contributions to `components/Leaderboard/Competition.vue`.
  - Component emits `add:contribution(payload)`; page updates local state and persists to `localStorage` (dev).
- **Acceptance**: Adding contribution updates displayed pot immediately.

## 9) Shop cards and tracking
- **Objective**: Replace widgets with strategy cards and track actions.
- **Data sources**: `@public/data/core/strategies.json`, `@public/data/tracking/user_interactions.json`
- **Load**: Strategies via `stores/strategies.ts`; tracking via `stores/tracking.ts` (in-memory + optional `localStorage`).
- **Data flow**:
  - `pages/Shop.vue` renders cards from strategies store; card emits Buy/Rent/Share.
  - Page or card calls tracking store `logInteraction(event)`.
- **Acceptance**: Cards render; clicks logged in store buffer.

## 10) Strategy filters: data‑driven ranges and UI
- **Objective**: Compute min/max from dataset; style adjustments.
- **Data sources**: `@public/data/core/strategies.json`
- **Load**: Shared via `stores/strategies.ts`.
- **Data flow**:
  - Store exposes selectors: `getRange(key)` → `{ min, max }` for fields (e.g., `total_return_percentage`, `sharpe_ratio`).
  - `pages/strategies.vue` gets ranges from store and passes to `components/Filters.vue` via props; component is stateless UI.
- **Acceptance**: Sliders reflect dataset extents; active tag colored blue; horizontal options.

## 11) Profile page enhancement
- **Objective**: Rich profile with tiles, achievements, preferences, portfolio snapshot.
- **Data sources**: `@public/data/core/users.json`, `@public/data/relationships/user_assets.json`
- **Load**: Shared via `stores/users.ts` (+ `stores/assets.ts` as needed).
- **Data flow**:
  - `pages/profile/[id].vue` aggregates user + holdings; passes slices to tiles/components.
  - Default avatar fallback handled in page before passing.
- **Acceptance**: Sections render for selected id; default avatar used when missing.
