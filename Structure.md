# Application Structure and Architecture

Refer to [README.md](./README.md) for project overview, development mode, and technical stack. This document focuses on architectural patterns, factorization principles, and file organization.

## Base Architectural Concepts

### Component-Based Architecture
Strades employs a component-based architecture using Vue.js, organized into hierarchical layers:

- **Atomic Components**: Fundamental, reusable elements (e.g., buttons, icons).
- **Molecular Components**: Composite elements combining atoms (e.g., user cards, navigation bars).
- **Organismic Components**: Complex structures like layouts and pages.

### Reactive State Management
Utilizes Pinia for centralized state management, ensuring reactive data flow across components without prop drilling.

### Composables for Logic Extraction
Leverages Vue Composition API composables (`use*` functions) to encapsulate and reuse reactive logic, promoting separation of concerns.

### Server-Side Rendering (SSR) and Static Generation
Built on Nuxt 4's SSR capabilities for improved SEO, performance, and initial load times. Static generation used for public pages.

## User Experience Divisions
The application is designed for multi-device adaptability with customizable themes (light/dark) and internationalization (default: English). UX is segmented into four core sections:

- **Data Visualization**: Interactive charts and graphs for financial assets using D3.js.
- **Wallet Management**: Portfolio tracking, allocation, and transaction history.
- **Strategy Simulation**: Creation, testing, and visualization of trading strategies.
- **Social Hub**: Community interactions, discussions, and collaborative content.

### Page Structure
- Home page (`index.vue`)
- Assets page (`assets/`)
- Strategies page (`strategies.vue`)
- Wallet page (`wallet.vue`)


## Factorization Principles

Building on base architectural concepts, factorization ensures modularity, reusability, and maintainability.

### 1. Component Granularity
Decompose complex components into smaller, focused Single File Components (SFCs) aligned with atomic design principles:

- **Atomic Components**: Minimal, reusable elements (e.g., `<BaseButton>`, `<AppIcon>`).
- **Molecular Components**: Aggregations of atoms (e.g., `<UserCard>`, `<NavigationBar>`).
- **Organismic Components**: High-level structures combining molecules (e.g., dashboards, modals).
- **Layouts/Pages**: Top-level view structures.

### 2. Logic Extraction via Composables
Isolate reactive logic into composables (functions prefixed with `use*`), stored in `composables/`. This promotes separation of concerns and testability.

- Example: `useAuth()` for authentication logic, `useStrategies()` for strategy management.
- Benefits: Reusability across components, cleaner SFC code, independent testing.

### 3. Reactive State Management
Centralize global state in Pinia stores (`stores/`) to avoid prop drilling and ensure reactive updates.

- Use stores for shared state like user sessions, global configurations, or cached data.
- Integrate with SSR for server-side state hydration.

### 4. API and Data Layer Isolation
Abstract data fetching into services (`services/`) or server-side API routes (`server/api/`).

- Enables swapping data sources (e.g., from mock JSON to real databases) without component changes.
- Implement error handling and caching at this layer.

### 5. Code Organization and Naming Conventions
Adhere to Nuxt 4 directory structure and consistent naming:

- **Directories**: `pages/`, `components/`, `layouts/`, `stores/`, `composables/`, `server/`, `plugins/`, `types/`.
- **Naming**: PascalCase for components (e.g., `UserProfile.vue`), camelCase for composables (e.g., `useFetchData.ts`), kebab-case for file names if needed.
- **File Extensions**: `.vue` for components, `.ts` for TypeScript files.
- **Imports**: Use absolute paths or aliases (e.g., `~/components/`) for clarity.

## Professional Data Structure

The application uses a database-like structure in the `data/` directory to simulate future backend integration:

### Core Entities
- **Assets**: Cryptocurrencies (BTC, ETH, ADA), fiat currencies (USD, EUR, CNY), and stocks (AAPL, TSLA, AMZN)
- **Users**: Comprehensive profiles with trading preferences, risk tolerance, and performance metrics
- **Strategies**: Automated and manual trading strategies with detailed performance tracking
- **Wallets**: Portfolio management with asset allocations and transaction history

### Relationships & Analytics
- **Asset Relationships**: Proximity levels, dependencies, and correlations between assets
- **User-Asset Links**: Holdings, watchlists, favorites, and performance tracking
- **Strategy-Asset Allocations**: Entry/exit rules and performance contributions
- **User Interactions**: Comprehensive behavior tracking for AI training
- **Component Usage**: Performance monitoring and optimization insights
- **Chat System**: Direct messaging between users with conversation threading

### Data Flow
1. **Static Data**: JSON files in `data/` serve as the initial data source
2. **Pinia Stores**: Centralized state management with TypeScript interfaces
3. **Relationships**: Intermediary tables link entities for complex queries
4. **Tracking**: User behavior data feeds into analytics and AI systems
5. **Future Migration**: Structure designed for seamless transition to actual database

# Files structure of the project:

assets/ - Unified directory for all processed assets (images, icons, fonts) following Nuxt 4 best practices.
- avatars/ - User avatar images.
  - Ellipse5.png - User avatar 5.
  - Ellipse6.png - User avatar 6.
- backgrounds/ - Background images and UI elements.
  - Ace_of_spades.svg.png - Card game asset.
  - DailyPriceChart.png - Price chart placeholder.
  - Frame1171275146.png - UI frame element.
  - infographic-vector-background-5-polygonal-260nw-1384619417.jpg.webp - Infographic background.
  - modern-world-map-background_1035-7605.jpg.avif - World map background.
- fonts/ - Custom font files.
  - ethnocentric-rg.otf - Ethnocentric regular font.
  - Kanit-Regular.ttf - Kanit regular font.
  - Medium.ttf - Medium weight font.
  - Poppins-Regular.ttf - Poppins regular font.
  - SemiBoldItalic.ttf - Semi-bold italic font.
- icons/ - Application icons and UI elements.
  - add-circle-outline_icon.svg - Add icon.
  - analytics-outline_icon.svg - Analytics icon.
  - barcode-outline_icon.svg - Barcode icon.
  - bookmark-outline_icon.svg - Bookmark icon.
  - calendar-outline_icon.svg - Calendar icon.
  - caret-up-circle-outline_icon.svg - Caret up icon.
  - contract-outline_icon.svg - Contract icon.
  - earth-outline_Icon.svg - Earth icon.
  - filter_icon.svg - Filter icon.
  - github-mark-white.png - GitHub logo.
  - icon_Chat.png - Chat icon.
  - icon_help-circle.png - Help icon.
  - icon_News.png - News icon.
  - icon_Prices.png - Prices icon.
  - icon_Strategies.png - Strategies icon.
  - link-outline_icon.svg - Link icon.
  - Market_Icon.svg - Market icon.
  - notifications-circle-outline_icon.svg - Notifications icon.
  - search-circle-outline_icon.svg - Search icon.
  - share-social-outline_icon.svg - Share icon.
  - StradeLogoPrototype_icon.svg - App logo prototype.
  - Wallet.png - Wallet icon.
- logos/ - Company and application logos.
  - logo_Bitcoin_612x612.jpg - Bitcoin logo.
  - Logo_Black.png - Black app logo.
  - Logo_Color.png - Colored app logo.
  - logo_Ethereum.jpg - Ethereum logo.
  - logo_Tesla.png - Tesla logo.
  - Tesla-black-logo-bgtransparent-png.png - Transparent Tesla logo.
components/ - Directory for Vue components used throughout the application.
- APISynchronisations.vue - Component for handling API synchronizations.
- Asset/ - Subdirectory for asset-related components.
  - Heatmap.vue - Heatmap visualization for assets.
  - Map.vue - Map view for assets.
  - Relation.vue - Component showing asset relations.
- Asset.vue - Main asset component.
- AssetsCategoriesSelection.vue - Component for selecting asset categories.
- BlockEditor.vue - Editor for blocks in strategies.
- Builder/ - Subdirectory for strategy builder components.
  - Action.vue - Component for defining actions in strategies.
  - Condition.vue - Component for defining conditions in strategies.
- Button/ - Subdirectory for various button components.
  - Uparrow.vue - Button with up arrow icon.
  - Downarrow.vue - Button with down arrow icon.
  - Options.vue - Options button component.
  - Send.vue - Send button component.
  - Transfer.vue - Transfer button component.
  - Sidebar.vue - Sidebar toggle button.
  - Shop.vue - Shop button component.
  - Share.vue - Share button component.
  - Settings.vue - Settings button component.
  - Quest.vue - Quest button component.
  - Post.vue - Post button component.
  - Notification.vue - Notification button component.
  - Modify.vue - Modify button component.
  - Leaderboard.vue - Leaderboard button component.
  - Help.vue - Help button component.
  - Delete.vue - Delete button component.
  - Database.vue - Database button component.
  - Bookmark.vue - Bookmark button component.
  - Avatar.vue - Avatar button component.
- Calendar.vue - Calendar component.
- CapitalDistribution.vue - Component showing capital distribution.
- Card/ - Subdirectory for card-style components.
  - Asset.vue - Card for assets.
  - Datasource.vue - Card for data sources.
  - Friend.vue - Card for friends.
  - Strategy.vue - Card for strategies.
  - StrategyGeneralInformations.vue - Card for strategy general info.
- Carousel.vue - Carousel slider component.
- Chart/ - Subdirectory for chart components.
  - BarChart.vue - Bar chart component.
  - CandleChart.vue - Candlestick chart component.
- Chart.vue - General chart component.
- ChartAnalysis.vue - Component for chart analysis.
- Company.vue - Company information component.
- CompanyPage.vue - Full page for company details.
- Comparator.vue - Component for comparing items.
- ConnectionTest.vue - Component for testing connections.
- DataSource.vue - Data source management component.
- DateRangePicker.vue - Date range selection component.
- Filter.vue - Single filter component.
- Filters.vue - Multiple filters component.
- FinancialChart.vue - Financial data chart.
- GlobalCategories.vue - Global categories selector.
- Heatmap.vue - General heatmap component.
- InformationsPage.vue - Page for general information.
- InvestmentDashboard.vue - Dashboard for investments.
- ListOfStrategies.vue - List view of strategies.
- NavBar.vue - Navigation bar component.
- NavBarCircle.vue - Circular navigation bar.
- Navigation/ - Subdirectory for navigation components.
  - Analyse.vue - Analysis navigation.
  - Bar.vue - Navigation bar.
  - Creator.vue - Creator navigation.
  - Top/ - Subdirectory for top navigation components.
    - Wallet.vue - Wallet navigation item.
    - Strategies.vue - Strategies navigation item.
    - Prices.vue - Prices navigation item.
    - News.vue - News navigation item.
    - Messages.vue - Messages navigation item.
  - Top.vue - Top navigation component.
- PercentageWallet.vue - Wallet percentage display.
- Prediction.vue - Single prediction component.
- Predictions.vue - List of predictions.
- Profil.vue - Profile component.
- ProfitCard.vue - Card showing profits.
- Radar.vue - Radar chart component.
- Screener/ - Subdirectory for screener components.
  - ScreenerToolbar.vue - Toolbar for the screener.
  - ScreenerStatus.vue - Status display for the screener.
  - ScreenerHeader.vue - Header for the screener.
- Search.vue - Search component.
- SearchBar.vue - Search bar input.
- Selector/ - Subdirectory for selector components.
  - Assets.vue - Assets selector.
  - Asset.vue - Single asset selector.
  - Users.vue - Users selector.
  - Datasources.vue - Data sources selector.
  - Conditions.vue - Conditions selector.
  - Entry.vue - Entry selector.
- Strategies.vue - Strategies overview.
- Strategy.vue - Single strategy component.
- StrategyCreator.vue - Strategy creation tool.
- StrategyVisualizer.vue - Strategy visualization.
- Structuration.vue - Structuration component.
- Test.vue - Test component.
- Timer.vue - Timer component.
- TradesHistory.vue - History of trades.
- Transactions/ - Subdirectory for transactions components.
  - History.vue - Transactions history component.
  - Next.vue - Next transactions component.
- Transactions.vue - Transactions list.
- Transfer.vue - Transfer component.
- Treemap.vue - Treemap visualization.
- Wallet/ - Subdirectory for wallet components.
  - Portfolio.vue - Portfolio view in wallet.
  - SelectStrats.vue - Strategy selector in wallet.
  - OverallStratstats.vue - Overall strategy stats in wallet.
  - Evolution.vue - Evolution chart in wallet.
  - PositionTracker.vue - Position tracker in wallet.
  - EvolutionAllocation.vue - Allocation evolution in wallet.
  - CapitalCounter.vue - Capital counter in wallet.
  - AssetsDistribution.vue - Assets distribution in wallet.
- Widget/ - Subdirectory for widget components.
  - Asset.vue - Asset widget.
  - news.vue - News widget.
  - Sentiment.vue - Sentiment analysis widget.
  - Experience.vue - Experience widget.
  - Toolbar.vue - Toolbar widget.
  - Filter.vue - Filter widget.
  - DisplayAsset.vue - Asset display widget.
  - Discussion.vue - Discussion widget.
  - Comparaison.vue - Comparison widget.
  - Chart.vue - Chart widget.
  - Accounting.vue - Accounting widget.
composables/ - Directory for composable functions.
- useAuth.ts - Composable for authentication logic.
- useStrategies.ts - Composable for strategies management.
data/ - Directory for static data files mimicking future database structure.
- core/ - Core entity tables.
  - assets.json - Comprehensive asset data (crypto, forex, stocks) with financial information.
  - users.json - User profiles with trading preferences and statistics.
  - strategies.json - Trading strategies with performance metrics and conditions.
  - wallets.json - User wallet portfolios with asset allocations and transactions.
- relationships/ - Intermediary tables linking core entities.
  - asset_relationships.json - Relationships between assets (similar, dependent, competitor).
  - user_assets.json - User-asset relationships with holdings and performance.
  - strategy_assets.json - Strategy-asset allocations with entry/exit rules.
- tracking/ - User interaction and analytics data.
  - user_interactions.json - Detailed user behavior tracking.
  - component_usage.json - Component performance and usage analytics.
  - analytics.json - Business metrics and KPIs.
- chat/ - Messaging and communication data.
  - conversations.json - Chat conversations between users.
  - messages.json - Individual messages with reactions and attachments.
- prices/ - Historical price data for assets (CSV format).
  - BTC-USD.csv - Bitcoin price history.
  - ETH-USD.csv - Ethereum price history.
  - AAPL.csv - Apple stock price history.
  - EUR-USD.csv - Euro currency price history.
layouts/ - Directory for layout templates.
- candle.vue - Layout for candle charts.
- creator.vue - Layout for creator pages.
- default.vue - Default application layout.
- messages.vue - Layout for messages.
- news.vue - Layout for news.
- prices.vue - Layout for prices.
- strategies.vue - Layout for strategies.
- wallet.vue - Layout for wallet.
middleware/ - Directory for middleware functions.
- auth.global.ts - Global authentication middleware.
- logKeeper.global.ts - Global log keeper middleware.
pages/ - Directory for page components.
- about.vue - About page.
- apis.vue - APIs page.
- articles/ - Subdirectory for articles.
  - [id].vue - Dynamic article page by ID.
  - index.vue - Articles index page.
- assets/ - Subdirectory for assets pages.
  - [id].vue - Dynamic asset page by ID.
  - index.vue - Assets index page.
- auth.vue - Authentication page.
- CandleChart.vue - Candlestick chart page.
- chat.vue - Chat page.
- components.vue - Page for showcasing components.
- contact.vue - Contact page.
- creator.vue - Creator page.
- Discussions/ - Subdirectory for discussions.
  - [id].vue - Dynamic discussion page by ID.
- help.vue - Help page.
- historic.vue - Historic data page.
- index.vue - Home page.
- leaderboard.vue - Leaderboard page.
- news.vue - News page.
- notifications.vue - Notifications page.
- prices.vue - Prices page.
- profile/ - Subdirectory for profile.
  - index.vue - Profile index page.
  - [id].vue - Dynamic profile page by ID.
- quest.vue - Quest page.
- result.vue - Result page.
- settings.vue - Settings page.
- Shop.vue - Shop page.
- strategies.vue - Strategies page.
- strategy/ - Subdirectory for strategy.
  - index.vue - Strategy index page.
- summarizer/ - Subdirectory for summarizer.
  - [id].vue - Dynamic summarizer page by ID.
- test.vue - Test page.
- testest.vue - Another test page.
- wallet.vue - Wallet page.
plugins/ - Directory for Nuxt plugins.
- api.ts - API plugin.
- error-handler.ts - Error handling plugin.
public/ - Directory for public static files served directly.
- favicon.ico - Favicon icon.
- logos/ - Subdirectory for logos.
  - xrp.png - XRP logo.
  - wikipedia.png - Wikipedia logo.
  - wbd.png - WBD logo.
  - ubs.png - UBS logo.
  - tesla.png - Tesla logo.
  - t.png - T logo.
  - shop.png - Shopify logo.
  - nvidia.png - NVIDIA logo.
  - numbermention.png - Number mention logo.
  - nsrgy.png - NSRGY logo.
  - msft.png - Microsoft logo.
  - logi.jpg - Logitech logo.
  - intel.png - Intel logo.
  - google.png - Google logo.
  - github.png - GitHub logo.
  - f.png - F logo.
  - eth.png - Ethereum logo.
  - btc.svg - Bitcoin logo SVG.
  - average.png - Average logo.
  - apple.png - Apple logo.
  - amazon.png - Amazon logo.
  - aal.png - AAL logo.
  - ADA.png - ADA logo.
  - 1.png - Generic logo 1.
server/ - Directory for server-side code.
- api/ - Subdirectory for API routes.
  - postgresql.get.ts - GET endpoint for PostgreSQL data.
  - postgre.ts - PostgreSQL related API.
  - data.get.ts - GET endpoint for general data.
- plugins/ - Directory for server plugins (currently empty).
- tsconfig.json - TypeScript configuration for server.
services/ - Directory for service modules.
- social.ts - Social features service.
src/ - Source directory, possibly for additional assets.
- assets/ - Subdirectory for SVG and PNG assets.
  - share-social-outline_icon.svg - Share social outline icon.
  - search-circle-outline_icon.svg - Search circle outline icon.
  - notifications-circle-outline_icon.svg - Notifications circle outline icon.
  - link-outline_icon.svg - Link outline icon.
  - filter_icon.svg - Filter icon.
  - earth-outline_Icon.svg - Earth outline icon.
  - contract-outline_icon.svg - Contract outline icon.
  - caret-up-circle-outline_icon.svg - Caret up circle outline icon.
  - calendar-outline_icon.svg - Calendar outline icon.
  - bookmark-outline_icon.svg - Bookmark outline icon.
  - barcode-outline_icon.svg - Barcode outline icon.
  - analytics-outline_icon.svg - Analytics outline icon.
  - add-circle-outline_icon.svg - Add circle outline icon.
  - StradeLogoPrototype_icon.svg - Strade logo prototype icon.
  - Market_Icon.svg - Market icon.
  - Logo_Black.png - Black logo PNG.
static/ - Directory for truly static files served directly (no build processing).
- a.csv - Large dataset file.
- BTC-USD.csv - Bitcoin USD price data (legacy location).
stores/ - Directory for Pinia stores managing application state.
- assets.ts - Comprehensive assets store with relationships and price data.
- users.ts - User management store with profiles and asset relationships.
- strategies.ts - Strategy management store with performance tracking.
- wallets.ts - Portfolio and wallet management store.
- chat.ts - Messaging and conversation management store.
- tracking.ts - User interaction and analytics tracking store.
tsconfig.json - TypeScript configuration file.
types/ - Directory for type definitions.
- index.d.ts - TypeScript declaration file.
- index.ts - TypeScript types index.
app.vue - Root Vue component for the application.