# Gauntlet: Prices page density, filters, and living asset cards

Execute every item. Do not stop at a subset. Verify on `/prices` after each cluster.

## 1. Top navigation

- **Remove** the contextual `STRATEGY` action (`Build a strategy on these assets`) from the navbar on `/prices` and `/assets/*`. That redirect is unused.
- **Merge the hamburger into the title.** `◈ STRADES` (or the page brand mark) is the only menu control. Clicking it opens the drawer. It must not navigate to `/dashboard`.
- **Delete** the separate `menu-btn` hamburger after the merge.
- Keep drawer items (including Dashboard) as the way to leave the current page.
- Accessible name: the title button is `aria-expanded` for the drawer.

## 2. Clock

- The `GMT` label is **orange** (`--warning-orange`).
- Settings expose a clock preference: **GMT (UTC)** vs **local time**, labelled `GMT±X` from the browser offset.
- Persist the preference (Pinia + localStorage). The navbar clock reads it.

## 3. Prices toolbar

- Delete the `⟳ last-updated` timestamp in the market bar.
- `type-chips` and `sort-wrap` sit **on one row**, not stacked.
- Type chips (`Stocks`, `Crypto`, `Forex / Fiat`, …) are **tri-state**, not radio:
  - click 1 → **include**
  - click 2 → **exclude**
  - click 3 → **neutral**
- Filter logic: if any type is included, show only included types; always hide excluded types; all-neutral shows everything.
- Drop the redundant `All` chip (neutral-on-all replaces it).
- Add a **direction** control that flips the list top-to-bottom vs bottom-to-top.
- **Raised (include / active sort):** lighter inner highlight, darker outer drop shadow (volume).
- **Pressed (exclude):** inverted — darker inset, lighter outer (button pushed in).
- Neutral chips stay flatter.

## 4. Asset cards (`DisplayAsset`)

- **Bug:** directional color must follow the live % move, not `psychology_profile.market_sentiment` and not the living-UI dominant-class green glow. Down = red, up = green.
- Merge `.widget-asset` and `.da-row`. One card surface; no nested padded row.
- Surface more of the asset record in the identity cluster (symbol, name, category, cap, liquidity/vol) without extra chrome.
- **Logo:** larger, tight to the left edge. White plate behind dark logos (Apple etc.).
- **Sparkline:** full-bleed background of the card, almost the full width.
- Sparkline **timeframe** is labelled in small type (default **24h**).
- Color the path **relative to the starting price** (24h ago): segments above the open stay green, segments below degrade to red.
- Overlay **dots** for the user’s entries, exits, and strategy touches on that path.
- **Price + %** sit at the **right**, at the end of the chart.
- Tighten vertical padding of the page, the market bar, and the gap between cards.

## 5. Gates

- `npm test` (or equivalent) stays green. Add coverage for tri-state include/exclude/neutral.
- Exercise `/prices`: include crypto only, exclude stocks, reverse order, confirm a down-day card is red, confirm the title opens the menu, confirm STRATEGY is gone, confirm the clock label is orange.
