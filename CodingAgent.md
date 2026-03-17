# Coding Agent & AI Implementation Schema

This document details the Machine Learning pipelines, the 100% Allocation Enforcer, and the Predictive Pre-fetching engines that power Strades.

## 1. The 100% Allocation Mathematical Enforcer

The core philosophy of the application is that capital is never idle; it is a 100% pie chart constantly shifting based on the user's opinions and strategy code.

### Logic Implementation (`stores/wallet.ts`)
- **Constraint Solver**: When an AI Avatar node or a user action dictates an increase in Crypto allocation by +10%, the Enforcer algorithm must automatically determine where that 10% is withdrawn from (Fiat, Stocks, or Commodities).
- **Proportional Reduction**: By default, reductions are taken proportionally across the other classes based on user-defined risk hierarchies, unless strictly specified by a node in the Strategy Creator.

## 2. Predictive Pre-fetching Engine

To achieve a "zero-latency, living UI", the application uses a lightweight Markov Chain model running in a WebWorker to predict the user's next click.

### Implementation (`stores/prefetch.ts`)
- **Input Features**: Mouse coordinates, hover duration on the Living Icons, current time of day, and the user's historical `behavioral_history` (e.g., "User always checks Prices after reading a News alert").
- **Action**: If probability of clicking the 'Wallet' icon exceeds 65% (triggered by hovering for >200ms), the system silently dispatches the Fetch API calls for `core/wallets.json` and loads the data into the Pinia store. When the click occurs, the spatial transition is instant.

## 3. The Opinion Engine & Avatar ML Pipeline

The Swarm Intelligence Avatar acts as a proxy for the user's "Opinion" on perpetual financial fluctuations.

### Feature Engineering (Tracking to Tensors)
- The tracking payload (`tracking/user_interactions.json`) captures every nuanced interaction: the time spent reading an article with a specific `political_leaning`, the manual adjustment of the `AllocationSlider`, and the exact market state during those actions.
- These vectors are compressed via PCA into the `avatar.personality_matrix` (Risk, Aggression, Reaction Speed).

### Reinforcement Learning (RL) for Financial Code
- **Reward Function**: The AI is trained using the user's historical PnL as the reward. 
- **Output**: The Avatar outputs an Opinion Vector, e.g., `[Fiat: 20%, Crypto: 50%, Stocks: 30%, Commodities: 0%]`.
- **Execution**: When dropped into the `Builder/NodeCanvas.vue` by another user, this Opinion Vector acts as a live data source, overriding the host user's allocation if given sufficient weight.

## 4. Real-time Rendering Performance (D3 & Vue)

To prevent the dynamic forms, colors, and sizes from crashing the browser:
- **Throttling**: The `fluctuation_velocity` data stream from WebSockets is throttled using `requestAnimationFrame`. CSS variable updates are batched.
- **Off-Main-Thread Physics**: The forces for the `Corporate/NetworkGraph.vue` and the Strategy node layout must be computed in a WebWorker and passed back as an array of exact X/Y coordinates to the Vue template.

## 5. Development Pipeline Notes
- All machine learning scripts simulating the Avatar generation (for development mock data) should output strictly to `data/core/users.json` within the `avatar.ml_features` block to ensure the frontend can parse it predictably.