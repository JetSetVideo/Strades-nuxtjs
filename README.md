# Strades

## The Vision: A Living Financial Organism
Strades is not just a dashboard; it is a continuously breathing, data-driven financial ecosystem. The application acts as a central portal for trading all types of assets using custom AI models and node-based strategies. 

At its core, Strades is built around the philosophy of **perpetual financial fluctuations**. The user is not just holding static assets; they are continuously betting their wallet as a **100% allocation metric**. Money flows automatically between fiat, crypto, commodities, and stocks based on the user's opinions, strategies, and AI Avatar's code.

Every piece of data, whether primary (price) or secondary (market volatility, social sentiment, geopolitical stress), physically manifests in the UI. The interface morphs—changing form, size, color, and animation speed—to reflect the state of the market and the user's portfolio. Even the navigation menu icons act as micro-dashboards, giving immediate visual feedback before a page is even opened.

## The 4 Distinct Pillars

1. **Market & Corporate Intelligence**: Watch prices, assets, and deep corporate data. Maps the complex, living web between companies, employees, factories, suppliers, clients, and competitors.
2. **Social Platform**: An opinion and news engine where users post articles, alerts, and market opinions. It tracks sentiment to influence the broader market perception within the app.
3. **Wallet & Strategy Creator (The 100% Allocation Engine)**: A wallet system that mathematically enforces a 100% allocation across all asset classes (Fiat, Crypto, Stocks, Commodities). Includes a node-based strategy creator utilizing predefined variables, data sources, and Swarm Intelligence to automate the continuous flow of capital. 
4. **Messaging Application**: A robust, secure messaging app where users communicate, share live strategies, and form trading communities.

### Core Paradigms

- **100% Perpetual Allocation**: Capital is never truly "idle". Holding fiat is an active strategy. Users design node trees that automatically rebalance their 100% portfolio pie chart in response to real-time fluctuations and their stated "opinions" on macroeconomic events.
- **Living Navigation & Micro-Dashboards**: The application eliminates the need to dig for basic state information. If global prices fluctuate, the 'Prices' menu icon visibly pulses or trends red/green. If a major news event hits, the 'News' globe icon rotates to highlight the geographic origin. The 'Wallet' icon is a live mini-pie-chart of the current 100% allocation.
- **User AI Avatars (Swarm Intelligence)**: Every user cultivates an AI Avatar tailored to their trading style, reading habits, political leanings, and activity hours. These avatars can be plugged into the node-based strategy creator by other users to simulate "Swarm Intelligence."
- **Data-Driven UI Metamorphosis**: Secondary data heavily influences the aspect of components. High volatility increases animation speeds and reduces border-radii (sharper edges). Positive sentiment shifts the lighting engine and base oklch colors. Every node and branch in the app's DOM tree inherits and reacts to this data.

## Methodical Top-to-Bottom Architecture

Strades is designed methodically to ensure performant, non-redundant data inheritance:
- **Loading & State**: Data is fetched once globally and inherited downwards. Pinia stores act as the single source of truth to avoid over-calling APIs or redundant JSON parsing.
- **Predictive Pre-fetching**: The app analyzes the user's journey (e.g., hovering over the Wallet icon) to predict and cache the next needed data payloads, ensuring zero-latency transitions.

## Development Guidelines

Adhere to the rigorous standards detailed in the accompanying documentation. Every data point must be visually represented somewhere, if not numerically, then through a component's form, scale, color, or animation.

### Referenced Documentation
- **[Data.md](./Data.md)**: Exhaustive data schema, detailing macro-indicators, allocation rules, and visual state mappings. *(Start here to understand the data backbone)*
- **[Structure.md](./Structure.md)**: The data inheritance tree, Pinia state management, WebSocket batching, and performance optimizations.
- **[Design.md](./Design.md)**: The designer's perspective on the user journey, living UI rules, and how secondary data maps to visual aspects.
- **[Components.md](./Components.md)**: Mapping of specific data keys to component props, detailing the living menu icons.
- **[CodingAgent.md](./CodingAgent.md)**: AI agent logic for handling the 100% allocation rule and predictive user behavior modeling.
- **[Todo.md](./Todo.md)**: Granular, actionable execution plan.

## Technical Stack
- **Framework**: Nuxt.js 4 (SSR, Static Generation)
- **Runtime**: Node.js 22.x
- **Language**: TypeScript
- **Frontend**: Vue.js with Composition API (`v-memo`, Provide/Inject for inheritance)
- **State Management**: Pinia (Global single-source-of-truth)
- **Data Visualization**: D3.js & Canvas API (for high-performance node tracking and living icons)
- **Real-Time**: WebSocket for live data streaming and state broadcasting
- **Build Tool**: Vite
