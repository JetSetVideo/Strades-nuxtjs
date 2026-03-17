# Components Data Usage Analysis & Visual Mapping

This document maps exactly which data keys from `Data.md` flow into which Vue components, and specifically how they drive the visual aspects (form, size, color, animation) of the living UI.

## 1. Global & System Components

### App/DynamicThemeController.vue (Headless)
- **Role**: Sits at the root of the app (`app.vue`), subscribes to global macro data, and injects CSS custom properties into the `:root` pseudo-class.
- **Data Source**: `stores/macro.ts` (`global/macro_state.json`)
- **Mapping**:
  - `global_volatility_index` -> `--app-animation-speed` (e.g., `0.3s` to `1.5s`)
  - `geopolitical_stress` -> `--app-lighting-hue` (shifts `oklch` base values)
  - `dominant_asset_class` -> `--app-border-radius` (e.g., `crypto = 2px`, `fiat = 16px`)

## 2. Navigation: The Living Icons (Micro-Dashboards)

Found in `components/Navigation/Icons/`. These are not static SVGs, but reactive Vue/Canvas components.

### Navigation/Icons/WalletIcon.vue
- **Role**: Replaces the static wallet SVG.
- **Data Source**: `stores/wallet.ts` -> `allocation_pie` (fiat, crypto, stocks, commodities %)
- **Visual Mapping**: Renders a tiny D3 pie chart inside the 24x24px icon space. Visibly shifts as capital automatically flows between asset classes.

### Navigation/Icons/PricesIcon.vue
- **Data Source**: `stores/macro.ts` -> `global_volatility_index`
- **Visual Mapping**: The icon physically vibrates or pulses. The frequency of the pulse is exactly mathematically tied to the volatility index.

### Navigation/Icons/NewsGlobeIcon.vue
- **Data Source**: `stores/prefetch.ts` -> `social/posts.json` (latest breaking `geographic_origin`)
- **Visual Mapping**: The SVG globe smoothly rotates its coordinates to face the geographic origin of the most recent highly-weighted news alert.

## 3. Wallet & 100% Allocation Components

### Wallet/AllocationSlider.vue
- **Role**: The core interactive component allowing users to set their opinions on the 100% portfolio pie.
- **Data Source**: `stores/wallet.ts`
- **Interaction**: Squeezing the slider for 'Crypto' dynamically forces the 'Fiat' and 'Stocks' sliders to shrink, enforcing `Total = 100%` mathematically. Color saturation indicates profit/loss in that specific sector.

### Wallet/FlowVisualizer.vue
- **Data Source**: `stores/wallet.ts` -> `flow_velocity`
- **Visual Mapping**: A background layer behind the wallet cards. Uses animated particles flowing between the asset class "zones" on the screen. Speed is driven by `flow_velocity`.

## 4. Strategy Creator (Nodes & Code)

### Builder/NodeCanvas.vue
- **Role**: The WebWorker/Canvas API driven infinite grid where users build their financial codes.
- **Data Source**: `stores/builder.ts` (`core/strategies.json`)
- **Visual Mapping**:
  - Nodes with low `confidence_score` have their opacity reduced to `0.4`.
  - The `execution_frequency` variable drives a scale transform (`scale(1.05)`) causing the node to visibly "beat" like a heart when it triggers a trade in the 100% allocation engine.

### Builder/Nodes/AvatarNode.vue
- **Data Source**: `core/users.json` -> `avatar.personality_matrix`
- **Visual Mapping**: The shape of the node morphs based on the Avatar's risk profile (sharp hexagon for aggressive, soft circle for conservative).

## 5. Market Intelligence & Social

### Corporate/NetworkGraph.vue
- **Data Source**: `core/companies.json`
- **Visual Mapping**:
  - Link thickness bound to `supply_chain_health`.
  - Node pulse speed bound to `fluctuation_velocity`.
  - Color of factory sub-nodes bound to `factories[n].status`.

### Social/ArticlePost.vue
- **Data Source**: `social/posts.json`
- **Visual Mapping**:
  - Background `oklch` tint bound to `political_leaning` (-1.0 to 1.0).
  - The `controversy_index` drives a CSS shake animation on the comment counter icon if the debate is highly polarized.
  - Renders the `embedded_allocation` tiny pie chart directly inside the post text flow.