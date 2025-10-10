# Data Structure Documentation

This document contains all the keys found in JSON files within the `/data` directory and identifies which Vue components consume each data source.

## Component Data Usage Summary

### Core Stores
- **Strategies Store**: Used by Database.vue, OverallStratstats.vue, Strategy.vue, Strategies.vue
- **Wallets Store**: Used by Calendar.vue
- **Users Store**: Used by Database.vue, user profile components
- **Chat Store**: Used by Database.vue, messaging components
- **Assets Store**: Used by Asset/Heatmap.vue, Asset/Relation.vue
- **Bitcoin Store**: Used by Chart/CandleChart.vue

### Direct File Access (Needs Migration)
- **shared_data.json**: Used by Database.vue for shared articles
- **user_assets.json**: Used by wallet and portfolio components

## Root Data Files

### Friends.json

| Key | Description |
|-----|-------------|
| `[n].id` | |
| `[n].image` | |
| `[n].messages` | |
| `[n].messages[n].id` | |
| `[n].messages[n].senderId` | |
| `[n].messages[n].text` | |
| `[n].messages[n].timestamp` | |
| `[n].name` | |
| `[n].online` | |
| `[n].username` | |
| `[n].value` | |
| `[n].value-evolution-percent` | |

### Messages.json

| Key | Description |
|-----|-------------|
| `1` | |
| `1.attachments` | |
| `1.deleted` | |
| `1.from` | |
| `1.id` | |
| `1.message` | |
| `1.meta` | |
| `1.meta.type` | |
| `1.modified` | |
| `1.parent` | |
| `1.reactions` | |
| `1.read` | |
| `1.timestamp` | |
| `1.to` | |
| `2` | |
| `2.attachments` | |
| `2.deleted` | |
| `2.from` | |
| `2.id` | |
| `2.message` | |
| `2.meta` | |
| `2.meta.type` | |
| `2.modified` | |
| `2.parent` | |
| `2.reactions` | |
| `2.read` | |
| `2.timestamp` | |
| `2.to` | |
| `3` | |
| `3.attachments` | |
| `3.deleted` | |
| `3.from` | |
| `3.id` | |
| `3.message` | |
| `3.meta` | |
| `3.meta.type` | |
| `3.modified` | |
| `3.parent` | |
| `3.reactions` | |
| `3.read` | |
| `3.timestamp` | |
| `3.to` | |

### Wallet.json

| Key | Description |
|-----|-------------|
| `wallets` | |
| `wallets[n].address` | |
| `wallets[n].createdAt` | |
| `wallets[n].email` | |
| `wallets[n].id` | |
| `wallets[n].name` | |
| `wallets[n].portfolios` | |
| `wallets[n].portfolios[n].name` | |
| `wallets[n].portfolios[n].transactionHistory` | |
| `wallets[n].portfolios[n].transactionHistory[n].amount` | |
| `wallets[n].portfolios[n].transactionHistory[n].asset` | |
| `wallets[n].portfolios[n].transactionHistory[n].date` | |
| `wallets[n].portfolios[n].transactionHistory[n].priceAtTransaction` | |
| `wallets[n].portfolios[n].transactionHistory[n].type` | |
| `wallets[n].updatedAt` | |

### Users.json

| Key | Description |
|-----|-------------|
| `avatar` | |
| `balance` | |
| `balance.BTC` | |
| `balance.ETH` | |
| `balance.USD` | |
| `bio` | |
| `birthday` | |
| `email` | |
| `friendlist` | |
| `id` | |
| `name` | |
| `notifications` | |
| `password` | |
| `preferences` | |
| `preferences.currency` | |
| `preferences.theme` | |
| `psychologyType` | |
| `role` | |
| `sentiment` | |
| `settings` | |
| `settings.notifications` | |
| `tradeHistory` | |
| `transactions` | |
| `username` | |
| `watchlist` | |

### news.json

| Key | Description |
|-----|-------------|
| `categories` | |
| `categories[n].articles` | |
| `categories[n].articles[n].author` | |
| `categories[n].articles[n].category` | |
| `categories[n].articles[n].content` | |
| `categories[n].articles[n].data_affiliated` | |
| `categories[n].articles[n].id` | |
| `categories[n].articles[n].imageUrl` | |
| `categories[n].articles[n].publishing_date` | |
| `categories[n].articles[n].source` | |
| `categories[n].articles[n].tags` | |
| `categories[n].articles[n].title` | |
| `categories[n].name` | |
| `name` | |

### Datasources.json

| Key | Description |
|-----|-------------|
| `[n].description` | |
| `[n].id` | |
| `[n].image_url` | |
| `[n].name` | |

### Bitcoin.json
**Components using this data**: Chart/CandleChart.vue (candlestick price visualization)

| Key | Description |
|-----|-------------|
| `[n].close` | |
| `[n].date` | |
| `[n].high` | |
| `[n].low` | |
| `[n].open` | |
| `[n].openInt` | |
| `[n].volume` | |

### assets.json
**Components using this data**: Asset/Heatmap.vue (heatmap visualization), Asset/Relation.vue (relationship trees)

| Key | Description |
|-----|-------------|
| `categories` | |
| `categories[n].companies` | |
| `categories[n].companies[n].ceo` | |
| `categories[n].companies[n].description` | |
| `categories[n].companies[n].founders` | |
| `categories[n].companies[n].headquarter` | |
| `categories[n].companies[n].heatmap` | |
| `categories[n].companies[n].heatmap.children` | |
| `categories[n].companies[n].heatmap.children[n].children` | |
| `categories[n].companies[n].heatmap.children[n].children[n].category` | |
| `categories[n].companies[n].heatmap.children[n].children[n].name` | |
| `categories[n].companies[n].heatmap.children[n].children[n].value` | |
| `categories[n].companies[n].heatmap.children[n].name` | |
| `categories[n].companies[n].heatmap.name` | |
| `categories[n].companies[n].id` | |
| `categories[n].companies[n].market_cap_usd` | |
| `categories[n].companies[n].name` | |
| `categories[n].companies[n].profileIcon` | |
| `categories[n].companies[n].relation` | |
| `categories[n].companies[n].relation.children` | |
| `categories[n].companies[n].relation.children[n].children` | |
| `categories[n].companies[n].relation.children[n].children[n].level` | |
| `categories[n].companies[n].relation.children[n].children[n].name` | |
| `categories[n].companies[n].relation.children[n].children[n].type` | |
| `categories[n].companies[n].relation.children[n].children[n].value` | |
| `categories[n].companies[n].relation.children[n].level` | |
| `categories[n].companies[n].relation.children[n].name` | |
| `categories[n].companies[n].relation.children[n].type` | |
| `categories[n].companies[n].relation.children[n].value` | |
| `categories[n].companies[n].relation.level` | |
| `categories[n].companies[n].relation.name` | |
| `categories[n].companies[n].relation.type` | |
| `categories[n].companies[n].relation.value` | |
| `categories[n].companies[n].sector` | |
| `categories[n].companies[n].stock_price_usd` | |
| `categories[n].companies[n].symbol` | |
| `categories[n].companies[n].tags` | |
| `categories[n].companies[n].website` | |
| `categories[n].companies[n].yearOfCreation` | |
| `categories[n].name` | |
| `name` | |

### Discussions.json

| Key | Description |
|-----|-------------|
| `[n].id` | |
| `[n].lastMessage` | |
| `[n].lastMessage.text` | |
| `[n].lastMessage.timestamp` | |
| `[n].members` | |
| `[n].members[n].avatar` | |
| `[n].members[n].id` | |
| `[n].members[n].username` | |
| `[n].name` | |
| `[n].unreadCount` | |

### Strategy.json

| Key | Description |
|-----|-------------|
| `Avatars` | |
| `Complexity Rating` | |
| `Conditions` | |
| `Quantity` | |
| `Risk rating` | |
| `Stoploss` | |
| `Takeprofit` | |
| `Technical Indicators` | |
| `Trend` | |
| `asset` | |
| `data-source` | |
| `frequence` | |
| `period` | |
| `resistance` | |
| `statement` | |
| `support` | |

### Contacts.json

| Key | Description |
|-----|-------------|
| `[n].avatar` | |
| `[n].id` | |
| `[n].lastMessage` | |
| `[n].lastSeen` | |
| `[n].list_trades` | |
| `[n].name` | |
| `[n].status` | |
| `[n].username` | |
| `[n].wallet` | |

## chat

### conversations.json
**Components using this data**: Database.vue (discussion context filtering), chat and messaging components

| Key | Description |
|-----|-------------|
| `[n].created_at` | |
| `[n].created_by` | |
| `[n].description` | |
| `[n].id` | |
| `[n].is_active` | |
| `[n].last_message_at` | |
| `[n].message_count` | |
| `[n].metadata` | |
| `[n].metadata.meeting_scheduled` | |
| `[n].metadata.shared_strategies` | |
| `[n].metadata.topic` | |
| `[n].participants` | |
| `[n].title` | |
| `[n].type` | |
| `[n].unread_count_user_001` | |
| `[n].unread_count_user_002` | |

### messages.json
**Components using this data**: Database.vue (message threading), chat and messaging components

| Key | Description |
|-----|-------------|
| `[n].attachments` | |
| `[n].content` | |
| `[n].conversation_id` | |
| `[n].edited_at` | |
| `[n].id` | |
| `[n].is_edited` | |
| `[n].is_read` | |
| `[n].message_type` | |
| `[n].metadata` | |
| `[n].metadata.character_count` | |
| `[n].metadata.hashtags` | |
| `[n].metadata.mentions` | |
| `[n].reactions` | |
| `[n].reactions[n].reaction` | |
| `[n].reactions[n].timestamp` | |
| `[n].reactions[n].user_id` | |
| `[n].recipient_ids` | |
| `[n].reply_to` | |
| `[n].sender_id` | |
| `[n].timestamp` | |

## core

### users.json
**Components using this data**: Database.vue (user filtering and display), various profile and user management components

| Key | Description |
|-----|-------------|
| `[n].account_balance` | |
| `[n].achievements` | |
| `[n].achievements[n].description` | |
| `[n].achievements[n].icon` | |
| `[n].achievements[n].id` | |
| `[n].achievements[n].name` | |
| `[n].achievements[n].unlocked_date` | |
| `[n].active_strategies_count` | |
| `[n].avatar_url` | |
| `[n].bio` | |
| `[n].city` | |
| `[n].country` | |
| `[n].created_at` | |
| `[n].date_of_birth` | |
| `[n].email` | |
| `[n].first_name` | |
| `[n].friends_count` | |
| `[n].id` | |
| `[n].investment_goals` | |
| `[n].is_active` | |
| `[n].is_verified` | |
| `[n].joined_date` | |
| `[n].language` | |
| `[n].last_login` | |
| `[n].last_name` | |
| `[n].notification_preferences` | |
| `[n].notification_preferences.email` | |
| `[n].notification_preferences.price_alerts` | |
| `[n].notification_preferences.push` | |
| `[n].notification_preferences.sms` | |
| `[n].notification_preferences.trade_alerts` | |
| `[n].preferred_assets` | |
| `[n].privacy_settings` | |
| `[n].privacy_settings.portfolio_visibility` | |
| `[n].privacy_settings.profile_visibility` | |
| `[n].privacy_settings.trading_history_visibility` | |
| `[n].risk_tolerance` | |
| `[n].timezone` | |
| `[n].total_invested` | |
| `[n].total_portfolio_value` | |
| `[n].total_returns` | |
| `[n].total_trades` | |
| `[n].trading_experience` | |
| `[n].two_factor_enabled` | |
| `[n].updated_at` | |
| `[n].username` | |
| `[n].win_rate` | |

### strategies.json
**Components using this data**: Database.vue (shared strategies panel), OverallStratstats.vue (performance calculations), Strategy.vue (individual strategy display), Strategies.vue (strategy listings)

| Key | Description |
|-----|-------------|
| `[n].average_trade_duration` | |
| `[n].backtest_period` | |
| `[n].backtest_period.end` | |
| `[n].backtest_period.start` | |
| `[n].category` | |
| `[n].comments_count` | |
| `[n].created_at` | |
| `[n].creator_id` | |
| `[n].current_capital` | |
| `[n].description` | |
| `[n].entry_conditions` | |
| `[n].entry_conditions[n].indicator` | |
| `[n].entry_conditions[n].operator` | |
| `[n].entry_conditions[n].timeframe` | |
| `[n].entry_conditions[n].value` | |
| `[n].exit_conditions` | |
| `[n].exit_conditions[n].indicator` | |
| `[n].exit_conditions[n].operator` | |
| `[n].exit_conditions[n].timeframe` | |
| `[n].exit_conditions[n].value` | |
| `[n].followers_count` | |
| `[n].id` | |
| `[n].indicators` | |
| `[n].initial_capital` | |
| `[n].is_premium` | |
| `[n].is_public` | |
| `[n].last_run` | |
| `[n].likes_count` | |
| `[n].max_drawdown` | |
| `[n].name` | |
| `[n].performance_metrics` | |
| `[n].performance_metrics.alpha` | |
| `[n].performance_metrics.annual_return` | |
| `[n].performance_metrics.beta` | |
| `[n].performance_metrics.volatility` | |
| `[n].price` | |
| `[n].risk_level` | |
| `[n].sharpe_ratio` | |
| `[n].status` | |
| `[n].successful_trades` | |
| `[n].tags` | |
| `[n].target_assets` | |
| `[n].total_return` | |
| `[n].total_return_percentage` | |
| `[n].total_trades` | |
| `[n].type` | |
| `[n].updated_at` | |
| `[n].win_rate` | |

### assets.json

| Key | Description |
|-----|-------------|
| `[n].category` | |
| `[n].created_at` | |
| `[n].currency` | |
| `[n].current_price` | |
| `[n].depends_on` | |
| `[n].description` | |
| `[n].icon_url` | |
| `[n].id` | |
| `[n].industry` | |
| `[n].launch_date` | |
| `[n].location` | |
| `[n].market_cap` | |
| `[n].name` | |
| `[n].proximity_level` | |
| `[n].similar_assets` | |
| `[n].symbol` | |
| `[n].tags` | |
| `[n].type` | |
| `[n].updated_at` | |
| `[n].website` | |

### wallets.json
**Components using this data**: Calendar.vue (transaction history for calendar visualization)

| Key | Description |
|-----|-------------|
| `[n].assets` | |
| `[n].assets[n].allocation_percentage` | |
| `[n].assets[n].amount` | |
| `[n].assets[n].asset_id` | |
| `[n].assets[n].average_price` | |
| `[n].assets[n].current_price` | |
| `[n].assets[n].current_value` | |
| `[n].assets[n].return_amount` | |
| `[n].assets[n].return_percentage` | |
| `[n].assets[n].symbol` | |
| `[n].available_balance` | |
| `[n].created_at` | |
| `[n].currency` | |
| `[n].daily_change` | |
| `[n].daily_change_percentage` | |
| `[n].description` | |
| `[n].id` | |
| `[n].invested_amount` | |
| `[n].is_active` | |
| `[n].is_default` | |
| `[n].name` | |
| `[n].performance_history` | |
| `[n].performance_history.1d` | |
| `[n].performance_history.1d.change` | |
| `[n].performance_history.1d.change_percentage` | |
| `[n].performance_history.1y` | |
| `[n].performance_history.1y.change` | |
| `[n].performance_history.1y.change_percentage` | |
| `[n].performance_history.30d` | |
| `[n].performance_history.30d.change` | |
| `[n].performance_history.30d.change_percentage` | |
| `[n].performance_history.7d` | |
| `[n].performance_history.7d.change` | |
| `[n].performance_history.7d.change_percentage` | |
| `[n].performance_history.90d` | |
| `[n].performance_history.90d.change` | |
| `[n].performance_history.90d.change_percentage` | |
| `[n].total_return` | |
| `[n].total_return_percentage` | |
| `[n].total_value` | |
| `[n].transactions` | |
| `[n].transactions[n].amount` | |
| `[n].transactions[n].asset_id` | |
| `[n].transactions[n].asset_symbol` | |
| `[n].transactions[n].fee` | |
| `[n].transactions[n].id` | |
| `[n].transactions[n].price` | |
| `[n].transactions[n].status` | |
| `[n].transactions[n].timestamp` | |
| `[n].transactions[n].total_value` | |
| `[n].transactions[n].type` | |
| `[n].type` | |
| `[n].updated_at` | |
| `[n].user_id` | |

## relationships

### user_assets.json

| Key | Description |
|-----|-------------|
| `[n].asset_id` | |
| `[n].average_purchase_price` | |
| `[n].created_at` | |
| `[n].current_value` | |
| `[n].first_purchase_date` | |
| `[n].id` | |
| `[n].is_favorite` | |
| `[n].is_watchlisted` | |
| `[n].last_transaction_date` | |
| `[n].notes` | |
| `[n].quantity` | |
| `[n].relationship_type` | |
| `[n].return_percentage` | |
| `[n].total_invested` | |
| `[n].total_return` | |
| `[n].updated_at` | |
| `[n].user_id` | |

### strategy_assets.json

| Key | Description |
|-----|-------------|
| `[n].allocation_percentage` | |
| `[n].asset_id` | |
| `[n].created_at` | |
| `[n].entry_rules` | |
| `[n].entry_rules[n].condition` | |
| `[n].entry_rules[n].indicator` | |
| `[n].entry_rules[n].timeframe` | |
| `[n].entry_rules[n].value` | |
| `[n].exit_rules` | |
| `[n].exit_rules[n].condition` | |
| `[n].exit_rules[n].indicator` | |
| `[n].exit_rules[n].timeframe` | |
| `[n].exit_rules[n].value` | |
| `[n].id` | |
| `[n].is_active` | |
| `[n].max_position_size` | |
| `[n].performance_contribution` | |
| `[n].stop_loss_percentage` | |
| `[n].strategy_id` | |
| `[n].take_profit_percentage` | |
| `[n].updated_at` | |
| `[n].weight` | |

### asset_relationships.json

| Key | Description |
|-----|-------------|
| `[n].asset_id` | |
| `[n].correlation_coefficient` | |
| `[n].created_at` | |
| `[n].description` | |
| `[n].id` | |
| `[n].related_asset_id` | |
| `[n].relationship_type` | |
| `[n].strength` | |
| `[n].updated_at` | |

## tracking

### component_usage.json

| Key | Description |
|-----|-------------|
| `[n].action` | |
| `[n].component_name` | |
| `[n].component_type` | |
| `[n].id` | |
| `[n].interaction_count` | |
| `[n].metadata` | |
| `[n].metadata.cache_hit` | |
| `[n].metadata.component_version` | |
| `[n].metadata.data_loaded` | |
| `[n].page` | |
| `[n].props` | |
| `[n].props.compact` | |
| `[n].props.show_actions` | |
| `[n].props.strategy_id` | |
| `[n].render_time_ms` | |
| `[n].session_id` | |
| `[n].timestamp` | |
| `[n].user_id` | |

### analytics.json

| Key | Description |
|-----|-------------|
| `[n].calculated_at` | |
| `[n].change_percentage` | |
| `[n].date` | |
| `[n].id` | |
| `[n].metadata` | |
| `[n].metadata.device_type` | |
| `[n].metadata.platform` | |
| `[n].metadata.region` | |
| `[n].metric_name` | |
| `[n].metric_type` | |
| `[n].previous_value` | |
| `[n].value` | |

### user_interactions.json

| Key | Description |
|-----|-------------|
| `[n].action` | |
| `[n].component` | |
| `[n].context` | |
| `[n].context.sort_by` | |
| `[n].context.strategy_filter` | |
| `[n].duration_ms` | |
| `[n].event_type` | |
| `[n].id` | |
| `[n].metadata` | |
| `[n].metadata.page_load_time` | |
| `[n].metadata.referrer` | |
| `[n].metadata.user_agent` | |
| `[n].metadata.viewport` | |
| `[n].session_id` | |
| `[n].target` | |
| `[n].timestamp` | |
| `[n].user_id` | |

