<script setup lang="ts">
interface SharedDataItem {
  id: string
  type: string
  title?: string
  asset?: string
  timestamp: string
  [key: string]: any
}

defineProps<{ sharedData: SharedDataItem }>()

const TYPE_ICONS: Record<string, string> = {
  analysis: '📊',
  news: '📰',
  research: '🔬',
  article: '📄',
  insight: '💡',
  strategy: '📈'
}

const ASSET_ICON_MAP: Record<string, string> = {
  BTC: 'btc.svg', bitcoin: 'btc.svg',
  ETH: 'eth.png', ethereum: 'eth.png',
  AAPL: 'apple.png', GOOGL: 'google.png',
  MSFT: 'msft.png', XRP: 'xrp.png',
  TSLA: 'tesla.png', NVDA: 'nvidia.png',
  USD: 'average.png'
}

function getTypeIcon(type: string) {
  return TYPE_ICONS[type] ?? '📄'
}

function getAssetIcon(asset: string) {
  const iconFile = ASSET_ICON_MAP[asset] || ASSET_ICON_MAP[asset.toUpperCase()] || 'average.png'
  return `/logos/${iconFile}`
}

function handleAssetIconError(event: Event) {
  const img = event.target as HTMLImageElement
  img.style.display = 'none'
  const parent = img.parentNode as HTMLElement | null
  if (!parent) return
  let placeholder = parent.querySelector('.asset-placeholder')
  if (!placeholder) {
    placeholder = document.createElement('div')
    placeholder.className = 'asset-placeholder'
    parent.appendChild(placeholder)
  }
}

function formatTimestamp(timestamp: string) {
  const date = new Date(timestamp);
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInHours = diffInMs / (1000 * 60 * 60);

  if (diffInHours < 24) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (diffInHours < 168) {
    return date.toLocaleDateString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
  } else {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
}
</script>

<template>
  <div class="shared-data-card">
    <div class="card-header">
      <div class="type-indicator">
        <span class="type-icon">{{ getTypeIcon(sharedData.type) }}</span>
        <span class="type-label">{{ sharedData.type }}</span>
      </div>
      <div class="engagement-stats">
        <span class="stat">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
          </svg>
          {{ sharedData.engagement.likes }}
        </span>
        <span class="stat">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M21.99 4c0-1.1-.89-2-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4-.01-18zM18 14H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
          </svg>
          {{ sharedData.engagement.comments }}
        </span>
        <span class="stat">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z"/>
          </svg>
          {{ sharedData.engagement.shares }}
        </span>
      </div>
    </div>

    <div class="card-content">
      <h3 class="title">{{ sharedData.title }}</h3>
      <p class="description">{{ sharedData.description }}</p>

      <div class="meta-info">
        <div class="source-info">
          <span class="source">Source: {{ sharedData.source }}</span>
          <span class="timestamp">{{ formatTimestamp(sharedData.sharedAt) }}</span>
        </div>

        <div class="shared-by">
          <span class="shared-by-label">Shared by:</span>
          <span class="shared-by-name">{{ sharedData.sharedBy }}</span>
        </div>
      </div>
    </div>

    <div class="card-footer">
      <div class="related-assets">
        <div
          v-for="asset in sharedData.relatedAssets.slice(0, 4)"
          :key="asset"
          class="asset-item"
        >
          <div class="asset-icon-container">
            <img
              :src="getAssetIcon(asset)"
              :alt="asset"
              class="asset-icon"
              @error="handleAssetIconError"
            >
          </div>
          <span class="asset-symbol">{{ asset }}</span>
        </div>
        <div v-if="sharedData.relatedAssets.length > 4" class="asset-more">
          +{{ sharedData.relatedAssets.length - 4 }}
        </div>
      </div>

      <div class="tags">
        <span
          v-for="tag in sharedData.tags.slice(0, 3)"
          :key="tag"
          class="tag"
        >
          {{ tag }}
        </span>
        <span v-if="sharedData.tags.length > 3" class="tag-more">
          +{{ sharedData.tags.length - 3 }}
        </span>
      </div>
    </div>

    <div class="card-actions">
      <button class="action-btn view-btn">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
        </svg>
        View
      </button>
      <button class="action-btn discuss-btn">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M21.99 4c0-1.1-.89-2-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4-.01-18zM18 14H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
        </svg>
        Discuss
      </button>
    </div>
  </div>
</template>

<style scoped>
.shared-data-card {
  background: var(--card-bg);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
  transition: var(--transition-normal);
  position: relative;
  overflow: hidden;
}

.shared-data-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-accent);
  border-color: var(--border-accent);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-md);
}

.type-indicator {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.type-icon {
  font-size: 1.2rem;
}

.type-label {
  font-size: 0.8rem;
  color: var(--text-gray);
  text-transform: capitalize;
  font-family: var(--font-family-secondary);
}

.engagement-stats {
  display: flex;
  gap: var(--spacing-md);
}

.stat {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-size: 0.8rem;
  color: var(--text-gray);
  font-family: var(--font-family-secondary);
}

.card-content {
  margin-bottom: var(--spacing-lg);
}

.title {
  color: var(--text-white);
  font-size: 1.1rem;
  margin: 0 0 var(--spacing-sm) 0;
  font-family: var(--font-family-primary);
  line-height: 1.4;
}

.description {
  color: var(--text-gray);
  font-size: 0.9rem;
  margin: 0 0 var(--spacing-md) 0;
  line-height: 1.5;
  font-family: var(--font-family-secondary);
}

.meta-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.8rem;
  color: var(--text-gray);
  font-family: var(--font-family-secondary);
}

.source-info {
  display: flex;
  gap: var(--spacing-sm);
}

.shared-by {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.shared-by-label {
  opacity: 0.7;
}

.card-footer {
  border-top: 1px solid var(--border-primary);
  padding-top: var(--spacing-md);
  margin-bottom: var(--spacing-md);
}

.related-assets {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-sm);
}

.asset-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  background: var(--bg-secondary);
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-sm);
  font-size: 0.8rem;
  font-family: var(--font-family-secondary);
  border: 1px solid var(--border-primary);
}

.asset-icon-container {
  position: relative;
  width: 14px;
  height: 14px;
}

.asset-icon {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background-color: rgba(128, 128, 128, 0.5);
}

.asset-placeholder {
  position: absolute;
  top: 0;
  left: 0;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(128, 128, 128, 0.8), rgba(160, 160, 160, 0.8));
  box-shadow:
    inset 0 1px 2px rgba(0, 0, 0, 0.5),
    0 1px 1px rgba(255, 255, 255, 0.1);
}

.asset-symbol {
  color: var(--text-white);
  font-weight: 500;
}

.asset-more {
  background: var(--bg-secondary);
  color: var(--text-gray);
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-sm);
  font-size: 0.8rem;
  font-family: var(--font-family-secondary);
  border: 1px solid var(--border-primary);
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
}

.tag {
  background: var(--primary-gradient);
  color: var(--secondary-darker);
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-sm);
  font-size: 0.75rem;
  font-family: var(--font-family-secondary);
  font-weight: 500;
}

.tag-more {
  background: var(--bg-secondary);
  color: var(--text-gray);
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-sm);
  font-size: 0.75rem;
  font-family: var(--font-family-secondary);
  border: 1px solid var(--border-primary);
}

.card-actions {
  display: flex;
  gap: var(--spacing-sm);
  border-top: 1px solid var(--border-primary);
  padding-top: var(--spacing-md);
}

.action-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  background: var(--bg-secondary);
  color: var(--text-white);
  font-size: 0.9rem;
  font-family: var(--font-family-secondary);
  cursor: pointer;
  transition: var(--transition-normal);
}

.action-btn:hover {
  background: var(--bg-tertiary);
  border-color: var(--border-accent);
  transform: translateY(-1px);
}

.view-btn:hover {
  background: var(--primary-gradient);
  color: var(--secondary-darker);
  border-color: var(--primary-green);
}

/* Responsive Design */
@media (max-width: 768px) {
  .shared-data-card {
    padding: var(--spacing-md);
  }

  .meta-info {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--spacing-xs);
  }

  .engagement-stats {
    gap: var(--spacing-sm);
  }

  .card-actions {
    flex-direction: column;
  }

  .action-btn {
    padding: var(--spacing-md);
  }
}

@media (max-width: 480px) {
  .title {
    font-size: 1rem;
  }

  .description {
    font-size: 0.85rem;
  }

  .related-assets {
    justify-content: center;
  }

  .tags {
    justify-content: center;
  }
}
</style>