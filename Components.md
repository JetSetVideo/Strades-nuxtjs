# Components Data Usage Analysis

This document shows which data sources each component uses and their corresponding keys in Data.md.

## Asset.vue

**Props (Data received from parent):**
- `content`
- `imgUri`

## Asset/Heatmap.vue

**Props (Data received from parent):**
- `companyId`

**Store Access (Data Sources):**
- `assets`
  - **Data Files:** core/assets.json
  - **core/assets.json Keys:** [n].category, [n].created_at, [n].currency...

**Data Functions/Composables:**
- `useAssetsStore`

## Asset/Relation.vue

**Props (Data received from parent):**
- `companyId`

**Store Access (Data Sources):**
- `assets`
  - **Data Files:** core/assets.json
  - **core/assets.json Keys:** [n].category, [n].created_at, [n].currency...

**Data Functions/Composables:**
- `useAssetsStore`

## Button/Avatar.vue

**Store Access (Data Sources):**
- `users`
  - **Data Files:** core/users.json, relationships/user_assets.json
  - **core/users.json Keys:** [n].account_balance, [n].achievements, [n].achievements[n].description...
  - **relationships/user_assets.json Keys:** [n].asset_id, [n].average_purchase_price, [n].created_at...

**Data Functions/Composables:**
- `useUsersStore`

## Card/Asset.vue

**Props (Data received from parent):**
- `name`
- `type`
- `required`

## Card/Friend.vue

**Props (Data received from parent):**
- `friend`
- `type`
- `required`

## Card/Strategy.vue

**Props (Data received from parent):**
- `strategy`
- `type`
- `required`

## Card/StrategyGeneralInformations.vue

**Props (Data received from parent):**
- `strategy`
- `type`
- `required`

## Carousel.vue

**Props (Data received from parent):**
- `strategies`
- `type`
- `required`

## Chart/BarChart.vue

**Props (Data received from parent):**
- `index`

## Chart/CandleChart.vue

**Props (Data received from parent):**
- `isLine`

**Store Access (Data Sources):**
- `bitcoin`
  - **Data Files:** Bitcoin.json
  - **Bitcoin.json Keys:** [n].close, [n].date, [n].high...

**Data Functions/Composables:**
- `useBitcoinStore`

## Comparator.vue

**Props (Data received from parent):**
- `strategies`
- `type`
- `required`
- `validator`

## DataSource.vue

**Props (Data received from parent):**
- `content`
- `imgUri`

## Navigation/Analyse.vue

**Props (Data received from parent):**
- `disabled`
- `type`
- `default`

## Navigation/Creator.vue

**Props (Data received from parent):**
- `selectedStrategies`
- `type`
- `required`

## ProfitCard.vue

**Props (Data received from parent):**
- `title`
- `profit`
- `duration`
- `type`
- `index`

## Selector/Assets.vue

**Props (Data received from parent):**
- `assets`
- `type`
- `required`

## Selector/Conditions.vue

**Props (Data received from parent):**
- `modelValue`
- `type`
- `default`

## Selector/Users.vue

**Data Functions/Composables:**
- `useStrategies`

## Test.vue

**Store Access (Data Sources):**
- `bitcoin`
  - **Data Files:** Bitcoin.json
  - **Bitcoin.json Keys:** [n].close, [n].date, [n].high...

**Data Functions/Composables:**
- `useBitcoinStore`

## Transactions/History.vue

**Props (Data received from parent):**
- `strategies`
- `type`
- `required`

## Treemap.vue

**Props (Data received from parent):**
- `data`
- `type`
- `required`

## Wallet/OverallStratstats.vue

**Props (Data received from parent):**
- `selectedCurrency`
- `type`
- `required`

## Wallet/Portfolio.vue

**Store Access (Data Sources):**
- `wallets`
  - **Data Files:** core/wallets.json
  - **core/wallets.json Keys:** [n].assets, [n].assets[n].allocation_percentage, [n].assets[n].amount...

**Data Functions/Composables:**
- `useWalletsStore`

## Wallet/SelectStrats.vue

**Props (Data received from parent):**
- `strategies`
- `type`
- `required`

## Widget/Asset.vue

**Props (Data received from parent):**
- `company`
- `crypto`

## Widget/Discussion.vue

**Props (Data received from parent):**
- `discussion`
- `type`
- `required`

## Widget/DisplayAsset.vue

**Props (Data received from parent):**
- `assetName`
- `tagName`
- `nominalPrice`
- `percentagePrice`
- `profileIcon`
- `dailyChart`

## Widget/news.vue

**Props (Data received from parent):**
- `article`
- `type`
- `required`

