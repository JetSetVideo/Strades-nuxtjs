<script setup lang="ts">
definePageMeta({ layout: 'default' })

const { user, isAuthenticated } = useAuth()
const { portfolio, loading: portfolioLoading, error: portfolioError, refresh } = usePortfolio()
const demoCookie = useCookie<string | null>('strades_demo')

// Redirect to auth if not logged in (unless demo mode)
if (!isAuthenticated.value && demoCookie.value !== '1') {
  await navigateTo('/auth')
}

// Fetch portfolio on mount
onMounted(() => {
  refresh()
})

// ── Derived helpers ────────────────────────────────────────────────────────

const initials = computed(() => {
  const u = user.value
  if (!u) return '?'
  if (u.first_name || u.last_name) {
    return `${u.first_name?.[0] ?? ''}${u.last_name?.[0] ?? ''}`.toUpperCase()
  }
  return (u.username?.[0] ?? u.email?.[0] ?? '?').toUpperCase()
})

const joinedDate = computed(() => {
  if (!user.value?.created_at) return '—'
  return new Date(user.value.created_at).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
})

const totalPnl = computed(() => {
  if (!portfolio.value) return 0
  return portfolio.value.holdings.reduce((sum, h) => sum + (h.unrealized_pnl ?? 0), 0)
})

const totalPnlPct = computed(() => {
  const invested = portfolio.value?.total_invested ?? 0
  if (invested === 0) return 0
  return (totalPnl.value / invested) * 100
})

const formatCurrency = (value: number, currency = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value)

const formatPct = (value: number) =>
  `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`

const roleBadgeClass = computed(() => {
  switch (user.value?.role) {
    case 'admin': return 'badge badge--admin'
    case 'premium': return 'badge badge--premium'
    default: return 'badge badge--user'
  }
})
</script>

<template>
  <div class="profile-page">
    <!-- Header -->
    <div class="page-header">
      <h1 class="page-title">Profile</h1>
      <span class="live-indicator">
        <span class="live-dot" aria-hidden="true"></span>
        Live data from backend
      </span>
    </div>

    <!-- Loading skeleton -->
    <div v-if="portfolioLoading && !portfolio" class="skeleton-wrapper" aria-busy="true" aria-label="Loading profile">
      <div class="skeleton skeleton--wide"></div>
      <div class="skeleton-row">
        <div class="skeleton skeleton--card" v-for="i in 4" :key="i"></div>
      </div>
      <div class="skeleton skeleton--table"></div>
    </div>

    <template v-else>
      <!-- User info card -->
      <section class="user-card" aria-label="User information">
        <div class="avatar" aria-hidden="true">
          <img
            v-if="user?.avatar_url"
            :src="user.avatar_url"
            :alt="`${user.full_name} avatar`"
            class="avatar-img"
          />
          <span v-else class="avatar-initials">{{ initials }}</span>
        </div>
        <div class="user-details">
          <div class="user-name-row">
            <h2 class="user-name">{{ user?.full_name || user?.display_name || user?.username || '—' }}</h2>
            <span :class="roleBadgeClass">{{ user?.role }}</span>
          </div>
          <p class="user-email">{{ user?.email }}</p>
          <p class="user-meta">
            <span v-if="user?.username">@{{ user.username }}</span>
            <span class="meta-divider" aria-hidden="true">·</span>
            <span>Joined {{ joinedDate }}</span>
            <template v-if="user?.auth_provider">
              <span class="meta-divider" aria-hidden="true">·</span>
              <span>{{ user.auth_provider === 'google' ? 'Google account' : 'Email account' }}</span>
            </template>
          </p>
          <p v-if="user?.bio" class="user-bio">{{ user.bio }}</p>
        </div>
      </section>

      <!-- Portfolio error -->
      <div v-if="portfolioError" class="error-banner" role="alert">
        <span>{{ portfolioError }}</span>
        <button class="retry-btn" @click="refresh">Retry</button>
      </div>

      <!-- Portfolio summary cards -->
      <section v-if="portfolio" class="summary-section" aria-label="Portfolio summary">
        <div class="summary-grid">
          <!-- Total value -->
          <article class="summary-card">
            <span class="card-label">Total Portfolio Value</span>
            <span class="card-value card-value--primary">
              {{ formatCurrency(portfolio.total_value, portfolio.currency) }}
            </span>
            <span class="card-sub">Cash + Investments</span>
          </article>

          <!-- Cash balance -->
          <article class="summary-card">
            <span class="card-label">Cash Balance</span>
            <span class="card-value">
              {{ formatCurrency(portfolio.cash_balance, portfolio.currency) }}
            </span>
            <span class="card-sub">Available to invest</span>
          </article>

          <!-- Unrealized P&L -->
          <article class="summary-card">
            <span class="card-label">Unrealized P&L</span>
            <span
              class="card-value"
              :class="totalPnl >= 0 ? 'card-value--positive' : 'card-value--negative'"
            >
              {{ formatCurrency(totalPnl, portfolio.currency) }}
            </span>
            <span
              class="card-sub"
              :class="totalPnlPct >= 0 ? 'text-positive' : 'text-negative'"
            >
              {{ formatPct(totalPnlPct) }}
            </span>
          </article>

          <!-- Holdings count -->
          <article class="summary-card">
            <span class="card-label">Holdings</span>
            <span class="card-value card-value--primary">
              {{ portfolio.holdings.length }}
            </span>
            <span class="card-sub">Active positions</span>
          </article>
        </div>
      </section>

      <!-- Holdings table -->
      <section v-if="portfolio && portfolio.holdings.length > 0" class="holdings-section" aria-label="Holdings">
        <h3 class="section-title">Holdings</h3>
        <div class="table-wrapper" role="region" aria-label="Holdings table" tabindex="0">
          <table class="holdings-table">
            <thead>
              <tr>
                <th scope="col">Asset</th>
                <th scope="col">Symbol</th>
                <th scope="col" class="text-right">Quantity</th>
                <th scope="col" class="text-right">Avg Buy Price</th>
                <th scope="col" class="text-right">Current Price</th>
                <th scope="col" class="text-right">Current Value</th>
                <th scope="col" class="text-right">P&amp;L</th>
                <th scope="col" class="text-right">P&amp;L %</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="holding in portfolio.holdings" :key="holding.asset.id">
                <td class="asset-name-cell">
                  <img
                    v-if="holding.asset.icon_url"
                    :src="holding.asset.icon_url"
                    :alt="holding.asset.name"
                    class="asset-icon"
                    width="20"
                    height="20"
                  />
                  <span class="asset-icon-placeholder" v-else aria-hidden="true">
                    {{ holding.asset.symbol[0] }}
                  </span>
                  <span>{{ holding.asset.name }}</span>
                </td>
                <td class="symbol-cell">{{ holding.asset.symbol }}</td>
                <td class="text-right">{{ holding.quantity }}</td>
                <td class="text-right">{{ formatCurrency(holding.average_buy_price) }}</td>
                <td class="text-right">{{ formatCurrency(holding.asset.current_price) }}</td>
                <td class="text-right">{{ formatCurrency(holding.current_value) }}</td>
                <td
                  class="text-right"
                  :class="holding.unrealized_pnl >= 0 ? 'text-positive' : 'text-negative'"
                >
                  {{ formatCurrency(holding.unrealized_pnl) }}
                </td>
                <td
                  class="text-right"
                  :class="holding.unrealized_pnl_pct >= 0 ? 'text-positive' : 'text-negative'"
                >
                  {{ formatPct(holding.unrealized_pnl_pct) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- Empty state -->
      <section
        v-else-if="portfolio && portfolio.holdings.length === 0"
        class="empty-state"
        aria-label="No holdings"
      >
        <p class="empty-state-text">No holdings yet. Start investing to see your portfolio here.</p>
      </section>
    </template>
  </div>
</template>

<style scoped>
/* ── Page layout ─────────────────────────────────────────────────────────── */
.profile-page {
  max-width: 1100px;
  margin: 0 auto;
  padding: var(--spacing-xl) var(--spacing-lg);
  color: var(--text-white);
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-xl);
}

.page-title {
  font-size: 1.75rem;
  font-weight: 700;
  margin: 0;
  background: var(--primary-gradient);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.live-indicator {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.75rem;
  color: var(--text-gray);
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  border-radius: 20px;
  padding: 4px 12px;
}

.live-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--success-green);
  animation: pulse-dot 2s ease-in-out infinite;
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

/* ── User card ───────────────────────────────────────────────────────────── */
.user-card {
  display: flex;
  gap: var(--spacing-xl);
  align-items: flex-start;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-xl);
  padding: 28px 32px;
  margin-bottom: var(--spacing-xl);
}

.avatar {
  flex-shrink: 0;
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: var(--bg-secondary);
  border: 2px solid var(--border-primary);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-initials {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--primary-green);
}

.user-details {
  flex: 1;
  min-width: 0;
}

.user-name-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  flex-wrap: wrap;
  margin-bottom: 4px;
}

.user-name {
  font-size: 1.35rem;
  font-weight: 700;
  margin: 0;
  color: var(--text-white);
}

.badge {
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  padding: 2px 9px;
  border-radius: 20px;
}

.badge--user {
  background: rgba(0, 170, 255, 0.15);
  color: var(--primary-blue);
  border: 1px solid rgba(0, 170, 255, 0.3);
}

.badge--premium {
  background: rgba(0, 255, 136, 0.12);
  color: var(--primary-green);
  border: 1px solid rgba(0, 255, 136, 0.3);
}

.badge--admin {
  background: rgba(255, 165, 0, 0.12);
  color: var(--warning-orange);
  border: 1px solid rgba(255, 165, 0, 0.3);
}

.user-email {
  font-size: 0.875rem;
  color: var(--text-light-gray);
  margin: 0 0 4px;
}

.user-meta {
  font-size: 0.8rem;
  color: var(--text-gray);
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  margin: 0 0 8px;
}

.meta-divider {
  color: var(--border-secondary);
}

.user-bio {
  font-size: 0.85rem;
  color: var(--text-light-gray);
  margin: 0;
  line-height: 1.5;
}

/* ── Error banner ────────────────────────────────────────────────────────── */
.error-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-md);
  background: rgba(255, 68, 68, 0.08);
  border: 1px solid rgba(255, 68, 68, 0.3);
  border-radius: var(--radius-md);
  padding: 12px 16px;
  font-size: 0.875rem;
  color: var(--error-red);
  margin-bottom: var(--spacing-xl);
}

.retry-btn {
  background: none;
  border: 1px solid var(--error-red);
  border-radius: var(--radius-sm);
  color: var(--error-red);
  font-size: 0.8rem;
  padding: 4px 12px;
  cursor: pointer;
  transition: background var(--transition-fast);
  flex-shrink: 0;
}

.retry-btn:hover {
  background: rgba(255, 68, 68, 0.12);
}

/* ── Summary cards ───────────────────────────────────────────────────────── */
.summary-section {
  margin-bottom: var(--spacing-xl);
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--spacing-md);
}

.summary-card {
  background: var(--bg-tertiary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-lg);
  padding: 20px 22px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}

.summary-card:hover {
  border-color: var(--border-secondary);
  box-shadow: 0 4px 16px var(--shadow-primary);
}

.card-label {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-gray);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.card-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-white);
  line-height: 1;
}

.card-value--primary {
  background: var(--primary-gradient);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.card-value--positive {
  color: var(--success-green);
}

.card-value--negative {
  color: var(--error-red);
}

.card-sub {
  font-size: 0.775rem;
  color: var(--text-gray);
}

.text-positive {
  color: var(--success-green);
}

.text-negative {
  color: var(--error-red);
}

/* ── Holdings table ──────────────────────────────────────────────────────── */
.holdings-section {
  margin-bottom: var(--spacing-xl);
}

.section-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-white);
  margin: 0 0 var(--spacing-md);
}

.table-wrapper {
  overflow-x: auto;
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-lg);
  background: var(--bg-tertiary);
}

.holdings-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}

.holdings-table thead {
  background: var(--bg-secondary);
}

.holdings-table th {
  padding: 12px 16px;
  text-align: left;
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-gray);
  white-space: nowrap;
  border-bottom: 1px solid var(--border-primary);
}

.holdings-table td {
  padding: 13px 16px;
  border-bottom: 1px solid var(--border-primary);
  color: var(--text-light-gray);
  white-space: nowrap;
}

.holdings-table tbody tr:last-child td {
  border-bottom: none;
}

.holdings-table tbody tr:hover td {
  background: rgba(255, 255, 255, 0.02);
}

.text-right {
  text-align: right;
}

.asset-name-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-white);
  font-weight: 500;
}

.asset-icon {
  border-radius: 50%;
  flex-shrink: 0;
}

.asset-icon-placeholder {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--bg-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.65rem;
  font-weight: 700;
  color: var(--primary-green);
  flex-shrink: 0;
}

.symbol-cell {
  font-family: var(--font-family-secondary, monospace);
  color: var(--text-gray);
  font-size: 0.8rem;
}

/* ── Empty state ─────────────────────────────────────────────────────────── */
.empty-state {
  text-align: center;
  padding: 48px 20px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-lg);
}

.empty-state-text {
  color: var(--text-gray);
  font-size: 0.9rem;
}

/* ── Skeleton loader ─────────────────────────────────────────────────────── */
.skeleton-wrapper {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.skeleton {
  background: linear-gradient(90deg, var(--bg-secondary) 25%, var(--bg-tertiary) 50%, var(--bg-secondary) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.4s infinite;
  border-radius: var(--radius-lg);
}

.skeleton--wide {
  height: 110px;
  width: 100%;
}

.skeleton-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: var(--spacing-md);
}

.skeleton--card {
  height: 100px;
}

.skeleton--table {
  height: 220px;
  width: 100%;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* ── Responsive ──────────────────────────────────────────────────────────── */
@media (max-width: 600px) {
  .user-card {
    flex-direction: column;
    padding: 20px;
  }

  .page-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .card-value {
    font-size: 1.25rem;
  }
}
</style>
