# Design & User Experience Guidelines

This document explains the designer's perspective on how the user interacts with Strades. It dictates how data, time, and space interact to form a living, breathing UI where every data point visibly influences the aspect (form, size, color, animation) of the application.

## The User Journey: A Living Financial Organism

### 1. Opening the App (Global Glance)
When the user opens Strades, they shouldn't need to click anything to understand the state of their finances and the world. 
- The background depth and lighting (`oklch` shifts) immediately communicate market sentiment (bright/cool for bull markets, dim/warm for bear markets).
- The **Top Navigation Menu Icons** are not static; they are animated micro-dashboards providing immediate feedback.

### 2. The Living Navigation Icons (Micro-Dashboards)
The menu icons reflect the perpetual financial fluctuations and the state of the pages they link to:
- **Prices Icon**: Acts as a mini-sparkline or ticker. If global volatility is high, the icon vibrates or pulses. Colors trend red or green based on the daily delta.
- **News Icon**: A globe that actively rotates to point towards the geographic origin of the latest breaking news or highest geopolitical stress zone.
- **Wallet Icon**: A live, miniature pie-chart representing the user's exact 100% allocation across fiat, crypto, stocks, and commodities. As the strategy code rebalances the wallet, this icon visibly morphs.
- **Messages Icon**: Pulses based on the `emotional_urgency` of unread messages. High urgency = faster, sharper pulsing.
- **Creator (Strategy) Icon**: Nodes orbit the icon. The speed of the orbit reflects the `execution_frequency` of the user's active strategies.

### 3. The 100% Allocation Paradigm (Space & Interaction)
The concept of betting the wallet as a full percentage dominates the UX.
- **Interaction**: Sliders and drag-and-drop mechanics are used instead of text inputs for capital allocation. Increasing the Crypto allocation visually squeezes the Fiat, Stocks, and Commodities allocations, enforcing the 100% limit in real-time.
- **Space**: The screen real estate dedicated to an asset class in the Wallet view is proportional to its percentage in the portfolio. A 80% Crypto allocation means crypto UI cards dominate the screen layout visually.

## Mapping Secondary Data to Visual Aspects

Every piece of secondary data translates to a CSS custom property (variable) that influences the component's geometry.

### Form (Border Radius, Sharpness, Compactness)
- **User Risk Tolerance**: Conservative users get softer, rounded UI elements (e.g., `--base-radius: 16px`). Aggressive, high-frequency traders get sharp, highly compact interfaces (`--base-radius: 0px`, reduced padding) to fit more data on screen.
- **Asset Dominance**: If Crypto dominates the 100% allocation, the entire app adopts a more "cyber/sharp" motif. If Fiat dominates, it adopts a "traditional banking/soft" motif.

### Size (Scale, DOM Footprint)
- **Market Cap / Liquidity**: In lists and heatmaps, asset cards scale slightly based on their relative liquidity depth. Highly liquid assets have a larger click target and a subtle spatial glow.
- **Confidence Scores**: Inside the Strategy Creator, nodes with a low `confidence_score` shrink and become translucent, allowing the user to visually identify weak links in their logic tree.

### Color (Oklch, Hues, Lighting)
- **Geopolitical Stress / Sentiment**: Affects the global background lighting. A high stress index shifts the environmental shadows to a warmer, tense hue.
- **Political Leaning (News)**: Article cards subtly tint their background `oklch` value based on the NLP-derived political leaning of the text, allowing users to gauge bias at a glance.
- **Profit/Loss (PnL)**: Naturally uses green/red, but the *saturation* of the color correlates with the *percentage magnitude* of the gain/loss.

### Animation (Speed, Frequency, Rhythm)
- **Fluctuation Velocity**: The rate of price change directly drives CSS `--animation-duration`. High volatility means the UI breathes, pulses, and transitions rapidly. Low volatility results in slow, calm transitions.
- **Flow Velocity**: The speed at which capital automatically flows between asset classes (driven by the user's strategy code) is visualized as animated border-trails or particle flows connecting the UI components on the Wallet page.

## UX Loading & Predictive Rendering
- **No Spinners**: Avoid generic loading spinners. Use skeleton layouts that instantly inherit the user's specific geometric forms (sharp vs rounded).
- **Hover Predictions**: Hovering over a Living Icon for >200ms begins pre-fetching the target page's JSON data, ensuring that when the click occurs, the spatial transition is immediate and seamless.