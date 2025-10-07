<script setup>
import { ref, computed, onMounted } from "vue";
import { useRoute } from "vue-router";
import { navigateTo } from "#app";
import { useAssetsStore } from "@/stores/assets";

const route = useRoute();
const assetId = route.params.id;

const assetsStore = useAssetsStore();
const asset = ref(null);
const relatedAssets = ref([]);
const loading = ref(true);

const tagColors = {
  technology: "rgba(0, 121, 191, 0.8)",
  automotive: "rgba(255, 0, 0, 0.8)",
  retail: "rgba(255, 165, 0, 0.8)",
  crypto: "rgba(138, 43, 226, 0.8)",
  forex: "rgba(0, 255, 0, 0.8)",
  finance: "rgba(0, 255, 0, 0.8)",
  default: "rgba(128, 128, 128, 0.8)"
};

const getTagColor = (tag) => {
  return tagColors[tag.toLowerCase()] || tagColors.default;
};

const formatCurrency = (value, currency = 'USD') => {
  if (value === null || value === undefined) return 'N/A';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
};

const formatMarketCap = (value) => {
  if (!value) return 'N/A';
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  return formatCurrency(value);
};

const getRiskColor = (tolerance) => {
  const colors = {
    very_low: 'var(--success-green)',
    low: 'var(--primary-green)',
    medium: 'var(--warning-orange)',
    high: 'var(--error-red)',
    very_high: '#ff0000'
  };
  return colors[tolerance] || 'var(--text-gray)';
};

const getSentimentColor = (sentiment) => {
  const colors = {
    bullish: 'var(--success-green)',
    neutral: 'var(--warning-orange)',
    bearish: 'var(--error-red)'
  };
  return colors[sentiment] || 'var(--text-gray)';
};

const getAssetIcon = (assetType) => {
  const icons = {
    stock: '/logos/logo_Color.png',
    cryptocurrency: '/logos/logo_Bitcoin_612x612.jpg',
    fiat_currency: '/icons/icon_Prices.png'
  };
  return icons[assetType] || '/logos/logo_Color.png';
};

const navigateToAsset = (id) => {
  navigateTo(`/assets/${id}`);
};

// Load asset data
onMounted(async () => {
  try {
    loading.value = true;

    // Initialize the assets store
    await assetsStore.initializeStore();

    // Find the specific asset by ID or symbol
    const foundAsset = assetsStore.getAssetById(assetId) ||
                      assetsStore.getAssetBySymbol(assetId);

    if (foundAsset) {
      asset.value = foundAsset;

      // Find related assets based on similar_assets and depends_on relationships
      const relatedIds = new Set([
        ...(foundAsset.similar_assets || []),
        ...(foundAsset.depends_on || [])
      ]);

      // Also check reverse relationships
      const reverseRelated = assetsStore.assets.filter(a =>
        a.similar_assets?.includes(foundAsset.symbol) ||
        a.depends_on?.includes(foundAsset.symbol)
      );

      reverseRelated.forEach(a => relatedIds.add(a.id));

      // Get related assets, excluding the current asset
      relatedAssets.value = assetsStore.assets
        .filter(a => relatedIds.has(a.id) && a.id !== foundAsset.id)
        .slice(0, 6);
    }
  } catch (error) {
    console.error('Failed to load asset data:', error);
  } finally {
    loading.value = false;
  }
});

// Computed properties
const tabs = computed(() => [
  {
    label: "Overview",
    key: "overview",
    icon: "📊"
  },
  {
    label: "Financials",
    key: "financials",
    icon: "💰"
  },
  {
    label: "Relationships",
    key: "relationships",
    icon: "🔗"
  },
  {
    label: "Events",
    key: "events",
    icon: "📅"
  },
  {
    label: "Psychology",
    key: "psychology",
    icon: "🧠"
  }
]);

const riskToleranceLabel = computed(() => {
  const labels = {
    very_low: 'Very Low Risk',
    low: 'Low Risk',
    medium: 'Medium Risk',
    high: 'High Risk',
    very_high: 'Very High Risk'
  };
  return labels[asset.value?.psychology_profile?.risk_tolerance] || 'Unknown';
});

const sentimentLabel = computed(() => {
  const labels = {
    bullish: 'Bullish',
    neutral: 'Neutral',
    bearish: 'Bearish'
  };
  return labels[asset.value?.psychology_profile?.market_sentiment] || 'Unknown';
});

const activeTab = ref('overview');

const getRiskPercentage = (tolerance) => {
  const percentages = {
    very_low: '20%',
    low: '40%',
    medium: '60%',
    high: '80%',
    very_high: '100%'
  };
  return percentages[tolerance] || '50%';
};

const getRiskProfileDescription = (tolerance) => {
  const descriptions = {
    very_low: 'conservative investors seeking stability',
    low: 'cautious investors with moderate risk appetite',
    medium: 'balanced investors comfortable with some volatility',
    high: 'aggressive investors seeking higher returns',
    very_high: 'speculative investors willing to accept extreme volatility'
  };
  return descriptions[tolerance] || 'investors with moderate risk tolerance';
};

const getSentimentDescription = (sentiment) => {
  const descriptions = {
    bullish: 'strong buying pressure and positive market expectations',
    neutral: 'balanced market conditions with no clear directional bias',
    bearish: 'selling pressure and negative market expectations'
  };
  return descriptions[sentiment] || 'mixed market sentiment';
};

const getVolatilityDescription = (volatilityIndex) => {
  if (!volatilityIndex) return 'unknown';
  if (volatilityIndex < 0.3) return 'low volatility with stable price movements';
  if (volatilityIndex < 0.6) return 'moderate volatility with occasional price swings';
  return 'high volatility with frequent significant price movements';
};
</script>

<template>
  <div class="asset-detail-page">
    <!-- Loading State -->
    <div v-if="loading" class="loading-state">
      <div class="loading-spinner"></div>
      <p>Loading asset information...</p>
    </div>

    <!-- Asset Not Found -->
    <div v-else-if="!asset" class="not-found">
      <div class="not-found-content">
        <h1>Asset Not Found</h1>
        <p>The asset with ID "{{ assetId }}" could not be found.</p>
        <button @click="navigateTo('/assets')" class="back-btn">
          ← Back to Assets
        </button>
      </div>
    </div>

    <!-- Main Asset Detail -->
    <div v-else class="asset-content">
      <!-- Header Section -->
      <div class="asset-header">
        <div class="asset-main-info">
          <div class="asset-logo-section">
            <img
              :src="asset?.icon_url || getAssetIcon(asset?.type)"
              :alt="`${asset?.name} logo`"
              class="asset-logo"
            />
            <div class="asset-type-badge" :style="{ backgroundColor: getTagColor(asset?.category) }">
              {{ asset?.category }}
            </div>
          </div>

          <div class="asset-basic-info">
            <h1 class="asset-name">{{ asset?.name }}</h1>
            <div class="asset-symbol">{{ asset?.symbol }}</div>
            <div class="asset-description">{{ asset?.description }}</div>

            <div class="asset-tags">
              <span
                v-for="tag in asset?.tags || []"
                :key="tag"
                class="tag"
                :style="{ backgroundColor: getTagColor(tag.replace('#', '')) }"
              >
                {{ tag }}
              </span>
            </div>
          </div>
        </div>

        <div class="asset-price-section">
          <div class="current-price">
            <span class="price-value">{{ formatCurrency(asset?.current_price, asset?.currency) }}</span>
            <span class="price-currency">{{ asset?.currency }}</span>
          </div>

          <div class="market-cap">
            <span class="label">Market Cap</span>
            <span class="value">{{ formatMarketCap(asset?.market_cap) }}</span>
          </div>

          <div v-if="asset?.stock_price_usd" class="stock-price">
            <span class="label">Stock Price</span>
            <span class="value">{{ formatCurrency(asset?.stock_price_usd) }}</span>
          </div>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <div class="asset-tabs">
        <div class="tabs-container">
          <button
            v-for="tab in tabs"
            :key="tab.key"
            @click="activeTab = tab.key"
            :class="['tab-btn', { active: activeTab === tab.key }]"
          >
            <span class="tab-icon">{{ tab.icon }}</span>
            <span class="tab-label">{{ tab.label }}</span>
          </button>
        </div>
      </div>

      <!-- Tab Content -->
      <div class="tab-content">
        <!-- Overview Tab -->
        <div v-if="activeTab === 'overview'" class="overview-content">
          <div class="overview-grid">
            <div class="overview-card">
              <h3>Company Information</h3>
              <div class="info-grid">
                <div class="info-item">
                  <span class="label">CEO</span>
                  <span class="value">{{ asset?.ceo || 'N/A' }}</span>
                </div>
                <div class="info-item">
                  <span class="label">Headquarter</span>
                  <span class="value">{{ asset?.headquarter || asset?.location }}</span>
                </div>
                <div class="info-item">
                  <span class="label">Founded</span>
                  <span class="value">{{ asset?.yearOfCreation || asset?.launch_date?.split('-')[0] }}</span>
                </div>
                <div class="info-item">
                  <span class="label">Industry</span>
                  <span class="value">{{ asset?.industry }}</span>
                </div>
                <div v-if="asset?.founders" class="info-item">
                  <span class="label">Founders</span>
                  <span class="value">{{ Array.isArray(asset?.founders) ? asset?.founders.join(', ') : asset?.founders }}</span>
                </div>
                <div v-if="asset?.website" class="info-item">
                  <span class="label">Website</span>
                  <a :href="asset?.website" target="_blank" class="value link">{{ asset?.website }}</a>
                </div>
              </div>
            </div>

            <div class="overview-card">
              <h3>Risk Profile</h3>
              <div class="risk-indicators">
                <div class="risk-item">
                  <span class="label">Risk Tolerance</span>
                  <span class="value" :style="{ color: getRiskColor(asset?.psychology_profile?.risk_tolerance) }">
                    {{ riskToleranceLabel }}
                  </span>
                </div>
                <div class="risk-item">
                  <span class="label">Market Sentiment</span>
                  <span class="value" :style="{ color: getSentimentColor(asset?.psychology_profile?.market_sentiment) }">
                    {{ sentimentLabel }}
                  </span>
                </div>
                <div class="risk-item">
                  <span class="label">Investor Confidence</span>
                  <span class="value">{{ asset?.psychology_profile?.investor_confidence ? (asset.psychology_profile.investor_confidence * 100).toFixed(1) + '%' : 'N/A' }}</span>
                </div>
                <div class="risk-item">
                  <span class="label">Volatility Index</span>
                  <span class="value">{{ asset?.psychology_profile?.volatility_index ? (asset.psychology_profile.volatility_index * 100).toFixed(1) + '%' : 'N/A' }}</span>
                </div>
              </div>
            </div>

            <div class="overview-card">
              <h3>Quick Stats</h3>
              <div class="stats-grid">
                <div class="stat-item">
                  <span class="stat-value">{{ asset?.proximity_level || 'N/A' }}</span>
                  <span class="stat-label">Proximity Level</span>
                </div>
                <div class="stat-item">
                  <span class="stat-value">{{ asset?.similar_assets?.length || 0 }}</span>
                  <span class="stat-label">Similar Assets</span>
                </div>
                <div class="stat-item">
                  <span class="stat-value">{{ asset?.depends_on?.length || 0 }}</span>
                  <span class="stat-label">Dependencies</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Financials Tab -->
        <div v-if="activeTab === 'financials'" class="financials-content">
          <div class="financials-grid">
            <div class="financial-card">
              <h3>Key Financial Metrics</h3>
              <div class="financial-metrics">
                <div class="metric-item">
                  <span class="metric-label">Market Cap</span>
                  <span class="metric-value">{{ formatMarketCap(asset?.market_cap) }}</span>
                </div>
                <div class="metric-item">
                  <span class="metric-label">Current Price</span>
                  <span class="metric-value">{{ formatCurrency(asset?.current_price, asset?.currency) }}</span>
                </div>
                <div v-if="asset?.stock_price_usd" class="metric-item">
                  <span class="metric-label">Stock Price</span>
                  <span class="metric-value">{{ formatCurrency(asset?.stock_price_usd) }}</span>
                </div>
                <div class="metric-item">
                  <span class="metric-label">Currency</span>
                  <span class="metric-value">{{ asset?.currency }}</span>
                </div>
              </div>
            </div>

            <div class="financial-card">
              <h3>Performance Indicators</h3>
              <div class="performance-indicators">
                <div class="indicator-item">
                  <span class="indicator-label">24h Change</span>
                  <span class="indicator-value positive">+2.45%</span>
                </div>
                <div class="indicator-item">
                  <span class="indicator-label">7d Change</span>
                  <span class="indicator-value positive">+8.32%</span>
                </div>
                <div class="indicator-item">
                  <span class="indicator-label">30d Change</span>
                  <span class="indicator-value negative">-1.15%</span>
                </div>
                <div class="indicator-item">
                  <span class="indicator-label">1y Change</span>
                  <span class="indicator-value positive">+45.67%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Relationships Tab -->
        <div v-if="activeTab === 'relationships'" class="relationships-content">
          <div class="relationships-grid">
            <div class="relationship-card">
              <h3>Related Assets</h3>
              <div class="related-assets">
                <div
                  v-for="relatedAsset in relatedAssets"
                  :key="relatedAsset.id"
                  @click="navigateToAsset(relatedAsset.id)"
                  class="related-asset-item"
                >
                  <img
                    :src="relatedAsset.icon_url || getAssetIcon(relatedAsset.type)"
                    :alt="relatedAsset.name"
                    class="related-asset-icon"
                  />
                  <div class="related-asset-info">
                    <span class="related-asset-name">{{ relatedAsset.name }}</span>
                    <span class="related-asset-symbol">{{ relatedAsset.symbol }}</span>
                  </div>
                  <span class="related-asset-price">{{ formatCurrency(relatedAsset.current_price) }}</span>
                </div>
              </div>
            </div>

            <div class="relationship-card">
              <h3>Dependencies & Relationships</h3>
              <div class="dependency-info">
                <div v-if="asset?.similar_assets?.length" class="dependency-section">
                  <h4>Similar Assets</h4>
                  <div class="dependency-tags">
                    <span v-for="similar in asset.similar_assets" :key="similar" class="dependency-tag">
                      {{ similar }}
                    </span>
                  </div>
                </div>

                <div v-if="asset?.depends_on?.length" class="dependency-section">
                  <h4>Depends On</h4>
                  <div class="dependency-tags">
                    <span v-for="dep in asset.depends_on" :key="dep" class="dependency-tag">
                      {{ dep }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Events Tab -->
        <div v-if="activeTab === 'events'" class="events-content">
          <div class="events-list">
            <div v-if="asset?.calendar_events?.length" class="events-container">
              <h3>Upcoming Events</h3>
              <div class="event-items">
                <div
                  v-for="event in asset.calendar_events"
                  :key="event.date"
                  class="event-item"
                >
                  <div class="event-date">
                    <span class="date">{{ new Date(event.date).toLocaleDateString() }}</span>
                  </div>
                  <div class="event-details">
                    <h4 class="event-title">{{ event.event }}</h4>
                    <span class="event-type" :class="event.type">{{ event.type.replace('_', ' ') }}</span>
                  </div>
                </div>
              </div>
            </div>

            <div v-else class="no-events">
              <h3>No Upcoming Events</h3>
              <p>No scheduled events found for this asset.</p>
            </div>
          </div>
        </div>

        <!-- Psychology Tab -->
        <div v-if="activeTab === 'psychology'" class="psychology-content">
          <div class="psychology-grid">
            <div class="psychology-card">
              <h3>Market Psychology Analysis</h3>
              <div class="psychology-metrics">
                <div class="psychology-item">
                  <span class="psychology-label">Risk Tolerance</span>
                  <div class="psychology-bar">
                    <div
                      class="psychology-fill"
                      :style="{
                        width: getRiskPercentage(asset?.psychology_profile?.risk_tolerance),
                        backgroundColor: getRiskColor(asset?.psychology_profile?.risk_tolerance)
                      }"
                    ></div>
                  </div>
                  <span class="psychology-value">{{ riskToleranceLabel }}</span>
                </div>

                <div class="psychology-item">
                  <span class="psychology-label">Investor Confidence</span>
                  <div class="psychology-bar">
                    <div
                      class="psychology-fill"
                      :style="{ width: (asset?.psychology_profile?.investor_confidence || 0) * 100 + '%' }"
                    ></div>
                  </div>
                  <span class="psychology-value">{{ asset?.psychology_profile?.investor_confidence ? (asset.psychology_profile.investor_confidence * 100).toFixed(1) + '%' : 'N/A' }}</span>
                </div>

                <div class="psychology-item">
                  <span class="psychology-label">Market Sentiment</span>
                  <span
                    class="sentiment-badge"
                    :style="{ backgroundColor: getSentimentColor(asset?.psychology_profile?.market_sentiment) }"
                  >
                    {{ sentimentLabel }}
                  </span>
                </div>

                <div class="psychology-item">
                  <span class="psychology-label">Volatility Index</span>
                  <div class="psychology-bar">
                    <div
                      class="psychology-fill"
                      :style="{ width: (asset?.psychology_profile?.volatility_index || 0) * 100 + '%', backgroundColor: 'var(--error-red)' }"
                    ></div>
                  </div>
                  <span class="psychology-value">{{ asset?.psychology_profile?.volatility_index ? (asset.psychology_profile.volatility_index * 100).toFixed(1) + '%' : 'N/A' }}</span>
                </div>
              </div>
            </div>

            <div class="psychology-card">
              <h3>Trading Behavior Insights</h3>
              <div class="insights-content">
                <div class="insight-item">
                  <span class="insight-icon">🎯</span>
                  <div class="insight-text">
                    <strong>Risk Profile:</strong> This asset exhibits {{ riskToleranceLabel.toLowerCase() }} characteristics,
                    making it suitable for {{ getRiskProfileDescription(asset.psychology_profile?.risk_tolerance) }}.
                  </div>
                </div>

                <div class="insight-item">
                  <span class="insight-icon">📈</span>
                  <div class="insight-text">
                    <strong>Market Sentiment:</strong> Current market sentiment is {{ sentimentLabel.toLowerCase() }},
                    indicating {{ getSentimentDescription(asset.psychology_profile?.market_sentiment) }}.
                  </div>
                </div>

                <div class="insight-item">
                  <span class="insight-icon">⚡</span>
                  <div class="insight-text">
                    <strong>Volatility:</strong> The asset shows {{ getVolatilityDescription(asset.psychology_profile?.volatility_index) }}
                    volatility characteristics.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.asset-detail-page {
  min-height: 100vh;
  background: var(--bg-primary);
  color: var(--text-white);
  padding: var(--spacing-lg);
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-xxl);
  color: var(--text-gray);
}

.loading-spinner {
  width: 50px;
  height: 50px;
  border: 4px solid var(--border-primary);
  border-top: 4px solid var(--primary-green);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: var(--spacing-lg);
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.not-found {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 60vh;
}

.not-found-content {
  text-align: center;
  background: var(--card-bg);
  padding: var(--spacing-xl);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-primary);
  box-shadow: var(--shadow-primary);
}

.not-found-content h1 {
  color: var(--error-red);
  margin-bottom: var(--spacing-md);
  font-family: var(--font-family-primary);
}

.not-found-content p {
  color: var(--text-gray);
  margin-bottom: var(--spacing-lg);
  font-family: var(--font-family-secondary);
}

.back-btn {
  background: var(--primary-gradient);
  color: var(--secondary-darker);
  border: none;
  padding: var(--spacing-sm) var(--spacing-lg);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-weight: 600;
  font-family: var(--font-family-secondary);
  transition: var(--transition-normal);
}

.back-btn:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-accent);
}

/* Asset Header */
.asset-header {
  background: var(--card-bg);
  border-radius: var(--radius-lg);
  padding: var(--spacing-xl);
  margin-bottom: var(--spacing-xl);
  border: 1px solid var(--border-primary);
  box-shadow: var(--shadow-primary);
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--spacing-xl);
}

.asset-main-info {
  flex: 1;
  display: flex;
  gap: var(--spacing-lg);
}

.asset-logo-section {
  position: relative;
}

.asset-logo {
  width: 100px;
  height: 100px;
  border-radius: var(--radius-lg);
  object-fit: cover;
  border: 3px solid var(--border-secondary);
}

.asset-type-badge {
  position: absolute;
  top: -10px;
  right: -10px;
  background: var(--primary-green);
  color: var(--secondary-darker);
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-xl);
  font-size: 0.75rem;
  font-weight: bold;
  font-family: var(--font-family-secondary);
  border: 2px solid var(--secondary-dark);
}

.asset-basic-info {
  flex: 1;
}

.asset-name {
  font-size: 2.5rem;
  font-weight: bold;
  background: var(--primary-gradient);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin: 0 0 var(--spacing-sm) 0;
  font-family: var(--font-family-primary);
}

.asset-symbol {
  font-size: 1.2rem;
  color: var(--primary-green);
  font-weight: 600;
  margin-bottom: var(--spacing-sm);
  font-family: var(--font-family-secondary);
}

.asset-description {
  color: var(--text-gray);
  font-size: 1rem;
  line-height: 1.6;
  margin-bottom: var(--spacing-lg);
  font-family: var(--font-family-secondary);
}

.asset-tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
}

.tag {
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-md);
  font-size: 0.8rem;
  font-weight: 500;
  font-family: var(--font-family-secondary);
  color: var(--text-white);
  border: 1px solid transparent;
}

.asset-price-section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  min-width: 250px;
}

.current-price {
  text-align: center;
  padding: var(--spacing-lg);
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-secondary);
}

.price-value {
  font-size: 2rem;
  font-weight: bold;
  color: var(--success-green);
  font-family: var(--font-family-primary);
  display: block;
  margin-bottom: var(--spacing-xs);
}

.price-currency {
  font-size: 1rem;
  color: var(--text-gray);
  font-family: var(--font-family-secondary);
}

.market-cap,
.stock-price {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-md);
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-secondary);
}

.label {
  font-size: 0.9rem;
  color: var(--text-gray);
  font-family: var(--font-family-secondary);
}

.value {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-white);
  font-family: var(--font-family-primary);
}

/* Tabs */
.asset-tabs {
  margin-bottom: var(--spacing-xl);
}

.tabs-container {
  display: flex;
  gap: var(--spacing-sm);
  border-bottom: 1px solid var(--border-primary);
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-md) var(--spacing-lg);
  background: var(--bg-secondary);
  border: 1px solid var(--border-secondary);
  border-bottom: none;
  border-radius: var(--radius-md) var(--radius-md) 0 0;
  cursor: pointer;
  transition: var(--transition-normal);
  font-family: var(--font-family-secondary);
  font-weight: 500;
}

.tab-btn:hover {
  background: var(--bg-tertiary);
  border-color: var(--border-accent);
}

.tab-btn.active {
  background: var(--primary-gradient);
  color: var(--secondary-darker);
  border-color: var(--primary-green);
}

.tab-icon {
  font-size: 1.2rem;
}

.tab-label {
  font-size: 0.9rem;
}

/* Tab Content */
.tab-content {
  background: var(--card-bg);
  border-radius: var(--radius-lg);
  padding: var(--spacing-xl);
  border: 1px solid var(--border-primary);
  box-shadow: var(--shadow-primary);
}

/* Overview Tab */
.overview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: var(--spacing-xl);
}

.overview-card {
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  padding: var(--spacing-lg);
  border: 1px solid var(--border-primary);
}

.overview-card h3 {
  color: var(--primary-green);
  margin: 0 0 var(--spacing-lg) 0;
  font-family: var(--font-family-primary);
  font-size: 1.3rem;
}

.info-grid {
  display: grid;
  gap: var(--spacing-md);
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-sm) 0;
  border-bottom: 1px solid var(--border-primary);
}

.info-item:last-child {
  border-bottom: none;
}

.label {
  color: var(--text-gray);
  font-family: var(--font-family-secondary);
  font-size: 0.9rem;
}

.value {
  color: var(--text-white);
  font-family: var(--font-family-primary);
  font-weight: 500;
}

.value.link {
  color: var(--primary-blue);
  text-decoration: none;
  transition: var(--transition-normal);
}

.value.link:hover {
  text-decoration: underline;
}

/* Risk Indicators */
.risk-indicators {
  display: grid;
  gap: var(--spacing-md);
}

.risk-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-sm);
  background: var(--bg-tertiary);
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-primary);
}

/* Stats Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--spacing-md);
}

.stat-item {
  text-align: center;
  padding: var(--spacing-md);
  background: var(--bg-tertiary);
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-primary);
}

.stat-value {
  font-size: 1.5rem;
  font-weight: bold;
  color: var(--primary-green);
  display: block;
  margin-bottom: var(--spacing-xs);
  font-family: var(--font-family-primary);
}

.stat-label {
  font-size: 0.8rem;
  color: var(--text-gray);
  font-family: var(--font-family-secondary);
}

/* Financials Tab */
.financials-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: var(--spacing-xl);
}

.financial-card {
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  padding: var(--spacing-lg);
  border: 1px solid var(--border-primary);
}

.financial-card h3 {
  color: var(--primary-green);
  margin: 0 0 var(--spacing-lg) 0;
  font-family: var(--font-family-primary);
  font-size: 1.3rem;
}

.financial-metrics {
  display: grid;
  gap: var(--spacing-md);
}

.metric-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-md);
  background: var(--bg-tertiary);
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-primary);
}

.metric-label {
  color: var(--text-gray);
  font-family: var(--font-family-secondary);
  font-size: 0.9rem;
}

.metric-value {
  color: var(--text-white);
  font-family: var(--font-family-primary);
  font-weight: 600;
  font-size: 1rem;
}

/* Performance Indicators */
.performance-indicators {
  display: grid;
  gap: var(--spacing-md);
}

.indicator-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-md);
  background: var(--bg-tertiary);
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-primary);
}

.indicator-label {
  color: var(--text-gray);
  font-family: var(--font-family-secondary);
  font-size: 0.9rem;
}

.indicator-value {
  font-family: var(--font-family-primary);
  font-weight: 600;
  font-size: 1rem;
}

.indicator-value.positive {
  color: var(--success-green);
}

.indicator-value.negative {
  color: var(--error-red);
}

/* Relationships Tab */
.relationships-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: var(--spacing-xl);
}

.relationship-card {
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  padding: var(--spacing-lg);
  border: 1px solid var(--border-primary);
}

.relationship-card h3 {
  color: var(--primary-green);
  margin: 0 0 var(--spacing-lg) 0;
  font-family: var(--font-family-primary);
  font-size: 1.3rem;
}

.related-assets {
  display: grid;
  gap: var(--spacing-md);
}

.related-asset-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  background: var(--bg-tertiary);
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-primary);
  cursor: pointer;
  transition: var(--transition-normal);
}

.related-asset-item:hover {
  transform: translateY(-2px);
  border-color: var(--border-accent);
  box-shadow: var(--shadow-accent);
}

.related-asset-icon {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-sm);
  object-fit: cover;
  border: 1px solid var(--border-secondary);
}

.related-asset-info {
  flex: 1;
}

.related-asset-name {
  display: block;
  font-weight: 600;
  color: var(--text-white);
  font-family: var(--font-family-primary);
  font-size: 1rem;
  margin-bottom: var(--spacing-xs);
}

.related-asset-symbol {
  display: block;
  color: var(--primary-green);
  font-family: var(--font-family-secondary);
  font-size: 0.8rem;
}

.related-asset-price {
  font-weight: 600;
  color: var(--text-white);
  font-family: var(--font-family-primary);
  font-size: 0.9rem;
}

.dependency-info {
  display: grid;
  gap: var(--spacing-lg);
}

.dependency-section h4 {
  color: var(--primary-blue);
  margin: 0 0 var(--spacing-md) 0;
  font-family: var(--font-family-primary);
  font-size: 1rem;
}

.dependency-tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
}

.dependency-tag {
  padding: var(--spacing-xs) var(--spacing-sm);
  background: var(--bg-tertiary);
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-primary);
  color: var(--text-white);
  font-family: var(--font-family-secondary);
  font-size: 0.8rem;
}

/* Events Tab */
.events-list {
  max-width: 800px;
}

.events-container h3 {
  color: var(--primary-green);
  margin: 0 0 var(--spacing-lg) 0;
  font-family: var(--font-family-primary);
  font-size: 1.3rem;
}

.event-items {
  display: grid;
  gap: var(--spacing-md);
}

.event-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-lg);
  padding: var(--spacing-lg);
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-primary);
}

.event-date {
  min-width: 120px;
}

.date {
  color: var(--primary-blue);
  font-weight: 600;
  font-family: var(--font-family-secondary);
  font-size: 0.9rem;
}

.event-details {
  flex: 1;
}

.event-title {
  color: var(--text-white);
  margin: 0 0 var(--spacing-sm) 0;
  font-family: var(--font-family-primary);
  font-size: 1.1rem;
}

.event-type {
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-sm);
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: capitalize;
  font-family: var(--font-family-secondary);
}

.event-type.earnings {
  background: var(--success-green);
  color: var(--secondary-darker);
}

.event-type.product_launch {
  background: var(--primary-blue);
  color: var(--text-white);
}

.event-type.conference {
  background: var(--warning-orange);
  color: var(--text-white);
}

.event-type.regulatory_event {
  background: var(--error-red);
  color: var(--text-white);
}

.no-events {
  text-align: center;
  padding: var(--spacing-xxl);
  color: var(--text-gray);
}

.no-events h3 {
  color: var(--text-white);
  margin-bottom: var(--spacing-md);
  font-family: var(--font-family-primary);
}

/* Psychology Tab */
.psychology-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: var(--spacing-xl);
}

.psychology-card {
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  padding: var(--spacing-lg);
  border: 1px solid var(--border-primary);
}

.psychology-card h3 {
  color: var(--primary-green);
  margin: 0 0 var(--spacing-lg) 0;
  font-family: var(--font-family-primary);
  font-size: 1.3rem;
}

.psychology-metrics {
  display: grid;
  gap: var(--spacing-lg);
}

.psychology-item {
  display: grid;
  grid-template-columns: 1fr 2fr auto;
  gap: var(--spacing-md);
  align-items: center;
  padding: var(--spacing-md);
  background: var(--bg-tertiary);
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-primary);
}

.psychology-label {
  color: var(--text-gray);
  font-family: var(--font-family-secondary);
  font-size: 0.9rem;
  font-weight: 500;
}

.psychology-bar {
  height: 8px;
  background: var(--bg-primary);
  border-radius: var(--radius-sm);
  overflow: hidden;
  border: 1px solid var(--border-primary);
}

.psychology-fill {
  height: 100%;
  border-radius: var(--radius-sm);
  transition: var(--transition-slow);
}

.psychology-value {
  color: var(--text-white);
  font-family: var(--font-family-primary);
  font-weight: 600;
  font-size: 0.9rem;
  text-align: right;
}

.sentiment-badge {
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-sm);
  color: var(--text-white);
  font-size: 0.8rem;
  font-weight: 500;
  font-family: var(--font-family-secondary);
}

.insights-content {
  display: grid;
  gap: var(--spacing-lg);
}

.insight-item {
  display: flex;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  background: var(--bg-tertiary);
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-primary);
}

.insight-icon {
  font-size: 1.5rem;
  flex-shrink: 0;
}

.insight-text {
  color: var(--text-gray);
  font-family: var(--font-family-secondary);
  line-height: 1.6;
}

.insight-text strong {
  color: var(--text-white);
}

/* Responsive Design */
@media (max-width: 1024px) {
  .asset-header {
    flex-direction: column;
    gap: var(--spacing-lg);
  }

  .asset-price-section {
    min-width: auto;
    width: 100%;
  }

  .overview-grid,
  .financials-grid,
  .relationships-grid,
  .psychology-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .asset-detail-page {
    padding: var(--spacing-md);
  }

  .asset-header {
    padding: var(--spacing-lg);
  }

  .asset-name {
    font-size: 2rem;
  }

  .tabs-container {
    flex-wrap: wrap;
  }

  .tab-btn {
    padding: var(--spacing-sm) var(--spacing-md);
    font-size: 0.85rem;
  }

  .tab-content {
    padding: var(--spacing-lg);
  }

  .event-item {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--spacing-md);
  }

  .related-asset-item {
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: var(--spacing-sm);
  }
}

@media (max-width: 480px) {
  .asset-main-info {
    flex-direction: column;
    text-align: center;
  }

  .asset-tags {
    justify-content: center;
  }

  .stats-grid {
    grid-template-columns: 1fr;
  }

  .psychology-item {
    grid-template-columns: 1fr;
    text-align: center;
    gap: var(--spacing-sm);
  }

  .insight-item {
    flex-direction: column;
    text-align: center;
    gap: var(--spacing-sm);
  }
}
</style>
