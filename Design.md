## News Intelligence Workspace

### Layout hierarchy
- The news page is a two-layer workspace: a sticky command/filter surface above a primary result stream, with a contextual rail on wide screens.
- Use the depth tokens from `assets/css/variables.css` consistently:
  - page canvas: `--surface-sunken`
  - toolbar and rails: `--surface-base`
  - focal story cards: `--surface-raised`
  - dialogs/import/compose: `--surface-overlay`
- Shadows must follow the same hierarchy: `--shadow-depth-1` for passive rail rows, `--shadow-depth-2` for sticky/filter surfaces, `--shadow-depth-3` for modal overlays.

### Story card language
- Political leaning remains a subtle tint, never a heavy opaque wash.
- Economic stance, sentiment, provenance, geography, assets, and prediction context must each have a textual label. Color is reinforcement, never the only cue.
- Allocation bars use the canonical mapping:
  - fiat: blue
  - crypto: amber
  - stocks: blue-family
  - commodities: gold
- The judgment control shows **analyzed leaning** and **user judgment** as separate concepts.

### Filter UX
- Filters must be dense, fast, and reversible: clear-all, chip removal, result counts, and deterministic URL state.
- Mobile behavior collapses the secondary rail but does not hide command actions for import or writing.
- Saved and History are first-class views, not ad hoc badges.

### Motion and accessibility
- `prefers-reduced-motion` must suppress persistent movement, shimmer, and repeat animations.
- Dialogs restore focus to the invoking control.
- Buttons for save/share/comment/judge must be functional controls with labels and pressed states; no decorative counters.
# Design & User Experience Guidelines

This document is the designer's contract with the codebase. It describes how the user journeys through Strades and how **every data point — primary or secondary — physically manifests** in form, size, color, or animation. If a piece of data exists in `Data.md`, it must visibly influence the UI somewhere.

---

## 1. The User Journey: A Living Financial Organism

### 1.1 Opening the App (Global Glance)
The user should understand the state of their finances and the world **without clicking anything**:
- Background lighting (`oklch` hue + shadow angle) communicates market sentiment (cool/bright for bull, warm/dim for bear).
- Bottom navigation icons are live micro-dashboards, each drawing its own panel's slice of state.
- The dominant asset class already drives the global border-radius and padding density via `App/DynamicThemeController.vue`.

### 1.2 First Run: Profile & Avatar Bootstrap
On first login, the app has no behavioral history. The avatar starts as a **cold-start prior** (population-average personality matrix). As the user reads, scrolls, dwells, simulates trades and adjusts sliders, the avatar's personality matrix converges toward the user's true habits. This convergence is visualized on `pages/profile/index.vue` as a "training progress" curve.

### 1.3 Returning User: The Hub
Returning users land on `pages/prices.vue` — the market hub. From here they can:
- See their total balance and its split across wallets and asset types in the Wallet nav icon.
- See their unread messages as a count on the chat icon.
- Notice a spike in geopolitical stress through the warm shift in ambient lighting.

---

## 2. The Living Navigation Icons (Micro-Dashboards)

The five icons of the bottom bar (`components/Navigation/Bar.vue`) are live components, not static SVGs. Each reads the same store field its page shows at the top, through `composables/useNavPanels.ts`; the icons in `components/Navigation/Icons/` only draw what they are given, and the maths lives in `utils/navIcons.ts` (unit-tested).

| Icon | Data source | Visual behavior |
|------|-------------|-----------------|
| **Prices** (`PricesIcon.vue`) | `assets.liveMarket.history` (blended from live assets' hourly returns when the tree has no aggregate) | Sparkline of today's market from 00:00 GMT to now on a fixed 24 h axis, so the line also tells the time of day. Green up / red down via `--app-color-up/down`, blue when flat or unknown. Value line: signed % since 00:00 GMT (hours aligned on the quote fetch time). |
| **News (globe)** (`NewsGlobeIcon.vue`) | `news.items[].readByUser` + the shared 30 s clock | Dot-matrix Earth turned so the meridian where it is noon now faces the viewer, marked by a red vertical line (12:00 GMT → Greenwich). A blue dot sits on the rim while news is unread (pinging only when News is selected). Value line: `N new` / `all read`. |
| **Wallet** (`WalletIcon.vue`) | `wallet.wallets` | Outer ring: each wallet's share of the total (amber, pink, teal, yellow, lime). Inner ring: asset types across all wallets (asset-class colours, cash grey). Value line: total balance, the same TOTAL BALANCE the wallet switcher prints. |
| **Lab** (`LabSphereIcon.vue`) | `strategies[]` (agents only if no book is loaded) | Small CSS 3-D globe; each strategy is a dot. Colour = run state (green running, orange paused, red stopped), latitude = risk, longitude = return, size = activity (√trades). The rim and the value line use the same counts as the strategies desk. Turns only while Lab is selected. The agent globe remains the Globe mode of the bench on `/agents`. |
| **Chat** (`ChatBadgeIcon.vue`) | `chat.conversations` (the user's own) + `chat.getEmotionalUrgency` | Speech bubble with a red dot holding the unread count (`99+` past 99), the same per-user counts /chat shows; it throbs when Chat is selected and urgency > 0.7. Value line: `unread` / `no new`. |

The bar has no profile/avatar icon; the `loss_ema` training ring is drawn on `Agent/AvatarCard.vue`.

**Selected tab.** One style for all five: the icon grows (scale 1.2) without leaving the bar, a 2 px accent bar lights at the top of the tab, the label turns white and bold, a halo in the panel's accent fades in, and the icon switches to its own zoomed `active` drawing (taller Prices plot with a "now" ping, closer globe, thicker Wallet rings, faster Lab spin with breathing dots, Chat typing dots when unread). A tab stays selected on its detail routes (longest matching prefix).

**Sizes.** 32 px under 380 px wide, 36 px on phones (and on the server render), 38 px from 768 px, 40 px from 1600 px.

**Time and refresh.** One shared 30 s clock moves the globe and the end of the Prices curve; live quotes are re-pulled every 5 min while the tab is visible, unless something fetched them in the last 4.5 min. Neither runs on the server.

**SSR.** Until the bar mounts, icons get `ready = false` and draw a static placeholder with an empty value line, so server and client markup match.

**Motion.** Transform and opacity only. Loops run only on the selected tab (unread ping, Lab spin, urgent throb, typing dots). `prefers-reduced-motion` turns every transition and animation in the bar off.

---

## 3. The 100% Allocation Paradigm (Space & Interaction)

The closed-pie constraint dominates the wallet UX.

- **Sliders squeeze, never add.** Dragging Crypto from 25% → 40% automatically shrinks the other three proportionally. The user sees the pie deform in real time.
- **Screen real estate mirrors allocation.** If Crypto is 70% of the pie, crypto UI cards occupy ~70% of the wallet viewport. The layout *is* the allocation.
- **Ghost overlay for advisory mode.** When the user plugs external avatars in "advisory" mode, their swarm opinion renders as a translucent ghost pie on top of the user's own pie — a direct visual comparison.

---

## 4. Paper Trading Visual Language

Simulated ("paper") trades must be visually distinct from real ones at a glance.

- **Color**: paper trades use the accent color at 60% saturation; real trades use full saturation.
- **Badge**: every paper position carries a `P` chip in the top-right corner.
- **Historical log**: the paper-trading ledger (`pages/historic.vue`) uses a dotted left-border to distinguish simulated rows.
- **Switching modes**: a prominent toggle in the wallet header switches between *Live* and *Paper* views. The background subtly shifts hue (cool tint for paper) so the user never forgets which mode they are in.

---

## 5. Article Cards & Opinion Visualization

Articles are the raw material for opinion profiling. Their visual design must surface the NLP metadata at a glance.

- **Political leaning tint** — background shifts subtly red (right) ↔ blue (left). The tint is intentionally faint (~5% opacity) so it informs without biasing the read.
- **Economic leaning** — a small horizontal axis under the title shows dove ↔ hawk position.
- **Controversy shake** — comment count icon vibrates when `controversy_index > 0.6`. The shake frequency scales with the index.
- **Embedded allocation mini-pie** — a 12px tall horizontal stacked bar directly inside the post flow shows the author's 100% pie. Hovering expands it to a full donut.
- **Topic chip** — colored by asset class (crypto amber, stocks blue, forex orange, commodities gold, macro gray).

---

## 6. Avatar & Swarm Visual Language

### Avatar cards
- Shape encodes personality: aggressive avatars get hexagonal frames (`border-radius: 0`), conservative get circles (`border-radius: 50%`).
- Confidence is opacity: an avatar with `confidence_score = 0.4` renders at 40% opacity.
- Training state is a thin progress ring around the avatar image.

### Swarm plugs (Creator page)
- Each plugged avatar renders as a small chip with a weighted slider.
- Dragging the slider updates the swarm vector preview bar **live**, showing the user exactly how much each avatar pulls the pie.
- The preview bar animates with a spring transition so the user feels the "weight" of each plug.

---

## 7. Mapping Secondary Data to Visual Aspects

Every piece of secondary data translates to a CSS custom property bound by `useLivingUI`.

### Form (border radius, compactness)
| Data | Mapping |
|------|---------|
| `user.personality_matrix.risk` | `< 0.4` → `--base-radius: 16px`; `> 0.7` → `--base-radius: 2px` |
| `macro.dominant_asset_class` | `crypto` → sharp motif, `fiat` → soft/rounded motif |
| `strategy.confidence_score` | Node opacity = `0.4 + 0.6 × score` |

### Size (scale, DOM footprint)
| Data | Mapping |
|------|---------|
| `asset.liquidity_depth` | Card scale 0.95 ↔ 1.05; glow radius 0 ↔ 24px |
| `post.weight` | Font size 0.9rem ↔ 1.05rem |
| `strategy.trades_total` | Row height in leaderboard 48px ↔ 64px |

### Color (oklch, hue, lighting)
| Data | Mapping |
|------|---------|
| `macro.geopolitical_stress` | `--app-lighting-hue` shifts 220° (calm blue) → 20° (tense amber) |
| `post.political_leaning` | Article card background tint (blue ↔ red) |
| `post.economic_leaning` | Small dove↔hawk axis under title |
| `wallet.daily_change_percentage` | Green/red saturation proportional to magnitude |
| `paper_trade.is_paper` | Accent at 60% saturation vs. 100% for real |

### Animation (speed, rhythm)
| Data | Mapping |
|------|---------|
| `macro.global_volatility_index` | `--app-animation-speed` 0.3s ↔ 1.5s |
| `wallet.flow_velocity` | Particle flow speed on the wallet page |
| `strategy.execution_frequency` | Node heartbeat `scale(1.05)` pulse |
| `chat.emotional_urgency` | Chat badge pulse frequency |
| `agent.training_state.loss_ema` | Avatar ring fill speed |

---

## 8. UX Loading & Predictive Rendering

- **No generic spinners.** Skeleton layouts inherit the user's geometric preferences (sharp vs. rounded, compact vs. spacious) from `userPreferences` before data arrives.
- **Hover intent** — hovering a nav icon > 200 ms triggers the prefetch store. If prediction confidence exceeds 65%, the next page's JSON is already in Pinia before the click. Not wired in the bottom bar today: hovering a tab in `Navigation/Bar.vue` only plays a hover sound.
- **First paint** — wallet totals, macro lighting, and living-UI padding come from the same catalog on the server and the client. Browser-only journals (paper ledger, appearance, news bookmarks) fill in after mount.
- **Progressive disclosure** — dense pages (risk, monitor) render KPI strip first, then charts, then tables, so the user sees value within 200 ms even on slow connections.

---

## 9. Accessibility & Readability

- Living animations respect `prefers-reduced-motion` — when set, all pulse/shake/orbit animations become static.
- Color-coded leaning / sentiment always paired with a text label or icon (never color alone).
- The 100% pie always exposes numeric percentages for screen readers.

---

## 10. Menu, profile, and bounded tokens

Strades is a social desk. People build avatars together, and those avatars train on the trades and attention of the people who own them.

### Menu (`components/Navigation/DrawerMenu.vue`)
The old sheet was one long list. Discover held eleven equal rows, Profile and Monitor shared an icon, Calendar and Data shared another, hints were written and never shown, and Support sat below a 754px laptop viewport.

The sheet is now four groups, each with a one-line job:

| Group | Job | Destinations |
| --- | --- | --- |
| You | Identity and the feeds that train you | Profile, Settings, Notifications, Connections |
| Together | Avatars built with other people | Avatars, Arena, Quests |
| Desk | The book | Leaderboard, Data, Calendar, Deals, History, Monitor, Risk, Shop |
| Support | How the desk works | Help, About, Contact |

The header names the current page. Each row keeps a hint. On a phone (under 640px) the hint and the group blurb hide so a thumb can reach Support. Width is `clamp(16rem, 32vw, 22rem)` and never covers the last 2.75rem, so the dimmed backdrop stays a close target. The header sticks while the list scrolls.

Routes were not deleted. Connections is the same `/apis` page. History is `/historic`. The public profile at `/profile/:id` stays separate from the signed-in desk at `/profile`.

### Profile
`/profile` must call `useCurrentUser()` during setup. Calling it inside a computed throws, Vue drops the page, and `<main>` stays an empty comment. The desk strip under the name is derived, not raw:

- value = clamp(portfolio or seed value, 0, 1e9)
- win = clamp(win rate, 0, 100)
- coverage = live avatars / all avatars
- edge = ahead when win ≥ 55, even from 45, otherwise behind

### Wallet
The top bar on Wallet no longer has a Trade button. That button only opened Prices, which the bottom bar already does.

### Tokens
Layout, spacing, radius, nav height, drawer width, and font scale each publish a min and a max. Preferred size sits in `clamp(min, preferred, max)`. Phone, tablet, laptop, and large screens read the same variables.

### Screen notes
- Phone: one column, menu hints hidden, drawer leaves a close strip.
- Tablet: same sheet, hints on, gutter grows with the viewport.
- Laptop: sheet about a third of the width, profile desk strip on one line.
- Large: gutter and card padding stop at their max so the canvas does not stretch into empty bands.
