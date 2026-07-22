# Design & User Experience Guidelines

This document is the designer's contract with the codebase. It describes how the user journeys through Strades and how **every data point — primary or secondary — physically manifests** in form, size, color, or animation. If a piece of data exists in `Data.md`, it must visibly influence the UI somewhere.

---

## 1. The User Journey: A Living Financial Organism

### 1.1 Opening the App (Global Glance)
The user should understand the state of their finances and the world **without clicking anything**:
- Background lighting (`oklch` hue + shadow angle) communicates market sentiment (cool/bright for bull, warm/dim for bear).
- Top navigation icons are animated micro-dashboards, each streaming its own slice of state.
- The dominant asset class already drives the global border-radius and padding density via `App/DynamicThemeController.vue`.

### 1.2 First Run: Profile & Avatar Bootstrap
On first login, the app has no behavioral history. The avatar starts as a **cold-start prior** (population-average personality matrix). As the user reads, scrolls, dwells, simulates trades and adjusts sliders, the avatar's personality matrix converges toward the user's true habits. This convergence is visualized on `pages/profile/index.vue` as a "training progress" curve.

### 1.3 Returning User: The Hub
Returning users land on `pages/prices.vue` — the market hub. From here they can:
- See their own wallet allocation pulsing in the nav icon.
- Spot at a glance which friends are active (presence dots on the chat icon).
- Notice a spike in geopolitical stress through the warm shift in ambient lighting.

---

## 2. The Living Navigation Icons (Micro-Dashboards)

Every menu icon is a live component. These are not static SVGs.

| Icon | Data source | Visual behavior |
|------|-------------|-----------------|
| **Prices** | `macro.global_volatility_index` | Pulse frequency = `1 / (0.5 + volatility)` Hz. Color swings green/red with daily delta. |
| **News (globe)** | Latest weighted post's `geographic_origin` | Smooth 3D rotation to face the coordinates. A small "pulse ring" emanates when a new high-weight post arrives. |
| **Wallet** | `allocation.allocationPie` | Tiny D3 pie chart inside the 24×24 icon. Sectors visibly grow/shrink as the strategy code rebalances. |
| **Chat** | `chat.unread[].emotional_urgency` | Badge count + pulse speed. Urgency ≥ 0.7 → sharp fast pulse; ≤ 0.3 → slow breath. |
| **Strategy orbit** | Max `execution_frequency` across active strategies | Two nodes orbit the icon. Orbit period = `4s - 3.5s × execution_frequency`. |
| **Avatar (profile)** | `agents.personal.training_state.loss_ema` | A subtle ring around the avatar icon fills as training loss decreases. |

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
- **Hover intent** — hovering a nav icon > 200 ms triggers the prefetch store. If prediction confidence exceeds 65%, the next page's JSON is already in Pinia before the click.
- **Progressive disclosure** — dense pages (risk, monitor) render KPI strip first, then charts, then tables, so the user sees value within 200 ms even on slow connections.

---

## 9. Accessibility & Readability

- Living animations respect `prefers-reduced-motion` — when set, all pulse/shake/orbit animations become static.
- Color-coded leaning / sentiment always paired with a text label or icon (never color alone).
- The 100% pie always exposes numeric percentages for screen readers.
