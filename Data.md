# Data Structure & Inheritance Schema

This document details the exhaustive data points driving the Strades ecosystem. **Rule:** Every data point listed here MUST influence the application visually—either as raw numbers, text, or as a secondary modifier affecting a component's form, color, size, or animation speed.

## Global State (Top of the Inheritance Tree)

Data that is fetched once and provided to all descending branches to avoid over-calling.

### global/macro_state.json
*Influences the overall application theme, animation speeds, and lighting engine.*

| Key | Description | Visual Mapping |
|-----|-------------|----------------|
| `global_volatility_index` | 0.0 to 1.0 representing market chaos. | Animation speed of background elements and menu icons. Higher = faster. |
| `geopolitical_stress` | 0.0 to 1.0 representing global tension. | Global CSS `oklch` hue shift (e.g., shifts towards warmer/redder hues). |
| `market_sentiment` | -1.0 (Bear) to 1.0 (Bull). | Determines default lighting source angle and shadow depths. |
| `dominant_asset_class` | 'fiat', 'crypto', 'stocks', 'commodities'. | Subtly influences border-radius (e.g., Crypto = sharp/0px, Fiat = rounded/12px). |

## 1. Market & Corporate Intelligence

### core/companies.json
*Used by Network Graphs, Heatmaps, and the 'Prices' Icon.*

| Key | Description | Visual Mapping |
|-----|-------------|----------------|
| `[n].id`, `[n].name`, `[n].market_cap` | Core identity. | Text and primary sizing in Treemaps. |
| `[n].fluctuation_velocity` | Rate of price change per minute. | Pulsing speed of the company's node in the Network Graph. |
| `[n].supply_chain_health` | 0.0 to 1.0 based on supplier data. | Opacity/thickness of the D3 link connecting company to suppliers. |
| `[n].employees` | Array of key personnel. | Node size modifiers in the structural graph. |
| `[n].factories[n].status` | 'active', 'reduced', 'offline'. | Color coding of factory nodes (Green, Yellow, Red). |

### core/assets.json
*Every asset the user can allocate towards.*

| Key | Description | Visual Mapping |
|-----|-------------|----------------|
| `[n].id`, `[n].category`, `[n].symbol` | Core identity. | Standard text/icon display. |
| `[n].nominal_price_usd` | Base reference. | Converted via Currency Store to user's base currency. |
| `[n].liquidity_depth` | Available market liquidity. | Glow radius around the asset icon. High liquidity = large, soft glow. |

## 2. Wallet & Strategy (The 100% Allocation Engine)

### core/wallets.json
*Strictly enforces the 100% allocation paradigm. Capital automatically flows based on strategy nodes.*

| Key | Description | Visual Mapping |
|-----|-------------|----------------|
| `user_id` | Owner. | - |
| `base_currency` | 'USD', 'BTC', etc. | Applies FX rates to all displayed values globally. |
| `allocation_pie` | Object mapping exact percentages. | **Renders directly in the 'Wallet' Top Nav Menu Icon.** |
| `allocation_pie.fiat` | % allocated to fiat. | Size of the fiat sector in pie charts/icons. |
| `allocation_pie.crypto` | % allocated to crypto. | Size of the crypto sector. |
| `allocation_pie.stocks` | % allocated to stocks. | Size of the stocks sector. |
| `allocation_pie.commodities` | % allocated to commodities. | Size of the commodities sector. |
| `flow_velocity` | Rate at which capital is shifting between classes. | Speed of the animated borders on the Wallet page. |
| `subwallets[n].strategy_id` | Linked automated node strategy. | - |

### core/strategies.json (Node Trees)
*The user's code for perpetual financial fluctuations.*

| Key | Description | Visual Mapping |
|-----|-------------|----------------|
| `[n].nodes[n].type` | 'condition', 'action', 'avatar', 'opinion'. | Shape of the node (Square, Circle, Hexagon). |
| `[n].nodes[n].confidence_score` | AI/Avatar confidence in the node's output. | Opacity of the node. Low confidence = transparent/ghosted. |
| `[n].nodes[n].execution_frequency` | How often the node triggers a trade. | "Heartbeat" pulse animation on the canvas. |
| `[n].edges[n].capital_flow` | Volume of capital passing through the connection. | Stroke width of the D3 connection line. |

## 3. Social Platform & Opinions

### social/posts.json
*Tracks human opinions on perpetual fluctuations.*

| Key | Description | Visual Mapping |
|-----|-------------|----------------|
| `[n].content`, `[n].author_id` | Core payload. | Text and Avatar UI. |
| `[n].geographic_origin` | Coordinates of the news/event. | **Causes the 'News' globe menu icon to rotate to these coordinates.** |
| `[n].political_leaning` | -1.0 to 1.0 (Left to Right). | Subtle background tint of the article card (e.g., Blue to Red). |
| `[n].controversy_index` | Ratio of positive to negative comments. | Shake/vibration effect on the comment counter icon. |
| `[n].embedded_allocation` | The user's shared 100% allocation opinion. | Mini inline slider/pie-chart attached to the post. |

## 4. User AI Avatars & Tracking

### core/users.json
*Data that models the user to create Swarm Intelligence nodes.*

| Key | Description | Visual Mapping |
|-----|-------------|----------------|
| `avatar.personality_matrix.risk` | 0.0 to 1.0 (Conservative to Aggressive). | Overall UI compactness. High risk = dense, compact UI. Low risk = spacious, padded UI. |
| `avatar.trading_style` | Categorical style. | Influences the generated Avatar profile image/3D model aspect. |
| `behavioral_history.eye_tracking_heat` | (Simulated) where user spends time looking. | Pre-loads data for highly viewed areas before a click occurs. |

## 5. Messaging Application

### chat/conversations.json
*The state of community and direct communications.*

| Key | Description | Visual Mapping |
|-----|-------------|----------------|
| `[n].unread_count` | Number of unseen messages. | Standard badge. |
| `[n].emotional_urgency` | NLP derived urgency of unread messages. | **Color intensity and pulsing of the 'Messages' Top Nav Menu Icon.** |
| `[n].attached_fluctuations` | Highlighted assets discussed in chat. | Inline ticker tapes within the message thread. |