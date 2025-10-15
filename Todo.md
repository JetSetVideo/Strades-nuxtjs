# Data‑Driven Backlog (uses @public/data only)

## Scope

Rewrite the backlog as actionable items grounded strictly in `@public/data/` (`public/data/**`). Each item includes: objective, data sources, deliverables, and acceptance criteria. No external APIs; simulated data only.

## Conventions

- Paths use the alias `@public/data` → `public/data/`
- Types map to keys documented in `Data.md`
- UI/UX follows `Design.md`; architecture follows `Structure.md`


---

## 1) Quests page and widget

- Objective: Show locked/unlocked quests; filter by category; 2 visual states (greyed/complete glow).
- Data sources: `@public/data/quests/quests.json`, `@public/data/quests/categories.json`
- Deliverables:
  - `pages/quest.vue` (lists quests, applies category filter)
  - `components/Widget/Quest.vue` card (difficulty, points, progress, details)
  - `components/Quest/Filter.vue` (category select)
- Acceptance:
  - Locked quests greyed; completed has golden reflection; filter works.

## 2) Notifications page and counter reset

- Objective: List notifications with date/time; grey when read; reset counter after open.
- Data sources: `@public/data/social/notifications.json`
- Deliverables: `pages/notifications.vue`, `components/Button/Notification.vue`
- Acceptance: Read state grey; counter resets after opening page.

## 3) Top‑bar search side panel

- Objective: Click search to open panel; show history + suggestions.
- Data sources: `@public/data/search/history.json`, `@public/data/search/suggestions.json`
- Deliverables: `components/SearchBar.vue` with slide‑over panel
- Acceptance: Panel animates from left; suggestions filter while typing.

## 4) Chat: group, reactions, profile links

- Objective: Support 1:1 and group; fix reactions; avatar links to profile.
- Data: `@public/data/chat/conversations.json`, `@public/data/chat/messages.json`, `@public/data/core/users.json`
- Deliverables: group sample; reactions; profile links in thread view
- Acceptance: Reactions dedupe by user; avatar click navigates.

## 5) DisplayAsset expand + trade modal (status: cancelled)

- Objective: Expand DisplayAsset to show Bookmark/Buy/Sell; modal to record transaction.
- Data: `@public/data/core/assets.json`, `@public/data/core/wallets.json`
- Deliverables: expanded region, modal, in‑memory transaction update
- Acceptance: Confirm adds transaction and visible in history.

## 6) Wallet layout and behaviors

- Objective: Align evolution and allocation; sync selections; improve header and spacing.
- Data: `@public/data/core/wallets.json`, `@public/data/core/wallet_history.json`
- Deliverables: header summary; synced `Wallet/Evolution.vue` + `Wallet/EvolutionAllocation.vue`
- Acceptance: Allocation click filters evolution; extra bottom spacing.

## 7) News categories and bookmarking

- Objective: Tabs for categories; toggle bookmark per article.
- Data: `@public/data/news.json`, `@public/data/social/bookmarks.json`
- Deliverables: `stores/newsStore.ts`; `components/Widget/NewsListItem.vue` bookmark
- Acceptance: Bookmark reflects and persists (dev) locally.

## 8) Leaderboard competition

- Objective: Users contribute tokens to a competition pot; show live pot.
- Data: `@public/data/competitions/competitions.json`, `@public/data/competitions/contributions.json`
- Deliverables: `components/Leaderboard/Competition.vue`, mounted in page
- Acceptance: Adding contribution updates the displayed pot.

## 9) Shop cards and tracking

- Objective: Replace widgets with strategy cards and track actions.
- Data: `@public/data/core/strategies.json`, `@public/data/tracking/user_interactions.json`
- Deliverables: `pages/shop.vue` cards + Buy/Rent/Share tracking
- Acceptance: Cards render; clicks logged.

## 10) Strategy filters: data‑driven ranges and UI

- Objective: Compute min/max from dataset; style updates per design.
- Data: `@public/data/core/strategies.json`
- Deliverables: `components/Filters.vue` derives ranges from dataset; UI tweaks
- Acceptance: Sliders reflect dataset extents; tag color; horizontal options.

## 11) Profile page enhancement

- Objective: Rich profile with tiles, achievements, preferences, portfolio snapshot.
- Data: `@public/data/core/users.json`, `@public/data/relationships/user_assets.json`
- Deliverables: header/tiles/achievements/preferences/portfolio sections
- Acceptance: Sections render for selected id; default avatar used when missing.

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
