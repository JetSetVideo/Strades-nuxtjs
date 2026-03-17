# Granular Actionable Backlog

This backlog outlines the step-by-step technical execution plan to realize the "Living Financial Organism" vision, following the top-to-bottom architecture.

## Phase 1: The Core Data & State Engine (Top Level)
- [x] **1.1 Mock Global State Engine**: Update `data/global/macro_state.json` with volatility, sentiment, and stress keys.
- [x] **1.2 Pinia Global Stores**: Scaffold `stores/macro.ts`, `stores/wallet.ts`, and `stores/currency.ts` to fetch and hold the global data inheritance tree.
- [x] **1.3 Dynamic Theme Controller (Headless)**: Build `App/DynamicThemeController.vue`. Link `macro.ts` data to CSS custom properties (`--app-animation-speed`, `--app-lighting-hue`) attached to the root document.

## Phase 2: The Living Navigation (Micro-Dashboards)
- [x] **2.1 Wallet Allocation Pie Icon**: Replace the static wallet icon in `Navigation/Top.vue` with `Navigation/Icons/WalletIcon.vue`. Use D3 to render the 100% allocation data directly into the 24px SVG space.
- [x] **2.2 Fluctuating Prices Icon**: Build `PricesIcon.vue`. Map the `global_volatility_index` to a CSS `@keyframes` pulse animation duration.
- [x] **2.3 Rotating News Globe Icon**: Build `NewsGlobeIcon.vue`. Map the latest news `geographic_origin` coordinates to an SVG 3D rotation transform.

## Phase 3: The 100% Allocation UI
- [x] **3.1 Proportional Allocation Slider**: Build `Wallet/AllocationSlider.vue`. Ensure that dragging one asset class slider mathematically shrinks the others so the sum is always exactly 100%.
- [x] **3.2 Flow Visualizer Background**: Build `Wallet/FlowVisualizer.vue` using Canvas. Spawn particles moving between wallet cards, setting the particle velocity equal to the `flow_velocity` state.

## Phase 4: Strategy Creator & Node Physics
- [x] **4.1 Canvas Engine Foundation**: Implement `Builder/NodeCanvas.vue` using SVG for rendering and WebWorkers for d3-force simulation.
- [x] **4.2 Data-Driven Node Forms**: Implement logic in `AvatarNode.vue` where the CSS `border-radius` and `scale` are reactively bound to the user's `personality_matrix.risk` score.
- [x] **4.3 Node Confidence Opacity**: Bind the `confidence_score` JSON key to the node's CSS `opacity`.
- [x] **4.4 Node Execution Heartbeat**: Add a CSS scale pulse animation bound to the `execution_frequency` key.

## Phase 5: Market Intelligence & Corporate Links
- [x] **5.1 Dynamic Network Graph**: Build `Corporate/NetworkGraph.vue`. Map `supply_chain_health` to SVG `<line>` stroke-width and `fluctuation_velocity` to node pulse speed.
- [x] **5.2 Asset Liquidity Glow**: In `Widget/DisplayAsset.vue`, map `liquidity_depth` to a CSS `box-shadow` to simulate spatial depth and volume.

## Phase 6: Social Platform & Sentiments
- [x] **6.1 Political Leaning Backgrounds**: In `Social/ArticlePost.vue`, translate the `political_leaning` (-1.0 to 1.0) into a subtle `oklch` background tint.
- [x] **6.2 Controversy Animations**: Bind the `controversy_index` of a post to a CSS shake/vibration keyframe on the comment counter icon.
- [x] **6.3 Embedded Allocation Opinions**: Allow `ArticlePost.vue` to parse and render a mini 100% allocation pie chart directly inline in the text flow.

## Phase 7: Predictive UX Optimization
- [x] **7.1 Skeleton Forms**: Update all loading states to check the user's `dominant_asset_class` preference to determine if the skeleton loader should have sharp or rounded edges.
- [x] **7.2 Hover Intent Pre-fetching**: Implement `stores/prefetch.ts`. Add `@mouseenter` hooks to Top Navigation icons that trigger data fetching if hovered for >200ms.