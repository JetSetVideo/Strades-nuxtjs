# Application Structure & Data Inheritance

This document defines the highly optimized, methodical top-to-bottom architecture of Strades. To support a living UI reflecting perpetual financial fluctuations and the 100% wallet allocation system, data flow must be strictly controlled to avoid over-calling, unnecessary re-renders, and memory bloat.

## The Inheritance Tree: Top-to-Bottom Data Flow

Data flows strictly downwards. We use Pinia stores as the single source of truth, hydrated via WebSockets, and distributed to the component tree via Vue's `Provide/Inject` and Pinia getters.

1. **Global App Layout (`app.vue`)**
   - Initializes WebSocket connection.
   - Fetches `global/macro_state.json` (Volatility, Sentiment).
   - *Provides* this macro state to the entire app. No component should fetch macro data independently.

2. **Top Navigation (`components/Navigation/Top.vue`)**
   - Subscribes to specific Pinia getters for its Living Icons.
   - Example: Fetches the `allocation_pie` from the Wallet Store to render the live pie-chart in the Wallet icon.

3. **Page Level (e.g., `pages/wallet.vue`)**
   - Checks if required data (e.g., user subwallets) is already cached in Pinia. If not, requests it.
   - Listens to the `flow_velocity` state to determine the animation speeds of page-level components.

4. **Component Level (e.g., `components/Wallet/Portfolio.vue`)**
   - Purely reactive. Computes visual styles (forms, colors) based on the inherited macro state and specific prop data.
   - Utilizes `v-memo` to prevent re-rendering unless the underlying data hash changes.

## State Management (Pinia Stores)

Stores are divided methodically to handle specific domains without cross-contamination.

### 1. `stores/macro.ts`
- **Role**: Manages `global_volatility_index`, `market_sentiment`, `geopolitical_stress`.
- **Optimization**: Throttles UI updates to max 30fps to prevent CPU spiking during high volatility.

### 2. `stores/wallet.ts`
- **Role**: The 100% Allocation Engine. Enforces that `fiat + crypto + stocks + commodities = 100%`.
- **Logic**: When a strategy node shifts capital, this store mathematically balances the pie and updates the `allocation_pie` object.

### 3. `stores/currency.ts`
- **Role**: The Base Currency transformer.
- **Optimization**: Instead of recalculating thousands of prices on every tick, it maintains a single FX multiplier map. Components use a fast global mixin `formatPrice(value, assetCurrency)` which references this map.

### 4. `stores/prefetch.ts` (Predictive Engine)
- **Role**: Analyzes user mouse movements and historical behavior to silently cache data.
- **Example**: If the user hovers over the 'News' icon, this store pre-fetches `social/posts.json` before the click occurs.

## Data Loading, Time, and Space Optimization

### WebSocket Batching
- Real-time price and state updates are inherently noisy. The backend must batch updates into 100ms chunks.
- The frontend processes these chunks, applying Vue's `requestAnimationFrame` to ensure smooth visual transitions of the component shapes and colors without blocking the main thread.

### Managing D3.js and Canvas Spaces
- For the `Corporate/NetworkGraph.vue` and `Builder/NodeCanvas.vue`:
  - **SVG rendering** is used for < 500 nodes (allows easy CSS styling and interaction).
  - Automatically swaps to **Canvas API rendering** if nodes exceed 500 (conserves DOM memory space). WebWorkers handle the physics simulations (d3-force) off the main thread.

### Skeleton Loaders & Spatial Memory
- When data is fetching, UI space is reserved using skeleton loaders that mimic the *predicted* shape of the data. 
- If a user's risk profile dictates a "compact UI" (per `Design.md`), the skeleton loader must also be compact. It inherits the user's design preferences instantly from local storage.

## Factorization & Modularity

- **UI Modifiers as Composables**: Instead of writing complex CSS bindings in every component, use composables like `const { dynamicStyles } = useLivingUI(assetData, macroState)`. This returns an object of CSS variables (`{ '--border-radius': '4px', '--animation-speed': '0.8s' }`) that is bound to the component's root `div`.
- **Living Icons**: Icons are no longer static SVGs. They are tiny Vue components wrapping Canvas or SVG elements that subscribe to specific data streams (e.g., `components/Navigation/Icons/GlobeIcon.vue` subscribes to the latest news coordinates).