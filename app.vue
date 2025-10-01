<script setup lang="ts">
import { onMounted, onBeforeUnmount } from 'vue'
import { useAssetsStore } from '~/stores/assetsStore'
import { useAssetEventsStore } from '~/stores/assets'
import type { PriceUpdate, Activity, NewsItem } from '#imports'

useHead({
  titleTemplate: (titleChunk) => {
    return titleChunk ? `${titleChunk} - Strades` : 'Strades';
  },
  meta: [
    { name: 'description', content: 'Strades Social Trading Platform' },
    { property: 'og:image', content: 'https://example.com/cover.jpg' },
    { property: 'og:image:alt', content: 'Strades' },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:site', content: '@strades' },
    { name: 'twitter:creator', content: '@strades' },
  ],
  link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.ico' }],
});

const { $socket } = useNuxtApp()
const assetsStore = useAssetsStore()
const assetEventsStore = useAssetEventsStore()

onMounted(() => {
  $socket.connect()
  
  $socket.on('price_update', (data: PriceUpdate) => {
    assetEventsStore.handlePriceUpdate(data)
  })
  
  $socket.on('social_activity', (activity: Activity) => {
    assetEventsStore.addActivity(activity)
  })
  
  $socket.on('news_update', (news: NewsItem) => {
    assetEventsStore.addNews(news)
  })
})

onBeforeUnmount(() => {
  $socket.disconnect()
})
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>

<style>
@font-face {
  font-family: Ethnocentric;
  src: url("@/assets/fonts/ethnocentric-rg.otf") format("opentype");
}

@font-face {
  font-family: Poppin;
  src: url("@/assets/fonts/Poppins-Regular.ttf");
}

@font-face {
  font-family: Kanit;
  src: url("@/assets/fonts/Kanit-Regular.ttf");
}

@font-face {
  font-family: MediumFont;
  src: url("@/assets/fonts/Medium.ttf");
}

@font-face {
  font-family: SemiBoldItalic;
  src: url("@/assets/fonts/SemiBoldItalic.ttf");
}

.stroke-shadow {
  box-shadow: rgba(0, 0, 0, 0.17) 0px -23px 25px 0px inset,
    rgba(0, 0, 0, 0.15) 0px -36px 30px 0px inset,
    rgba(0, 0, 0, 0.1) 0px -79px 40px 0px inset, rgba(0, 0, 0, 0.06) 0px 2px 1px,
    rgba(0, 0, 0, 0.09) 0px 4px 2px, rgba(0, 0, 0, 0.09) 0px 8px 4px,
    rgba(0, 0, 0, 0.09) 0px 16px 8px, rgba(0, 0, 0, 0.09) 0px 32px 16px;
}

.uni-border {
  box-shadow: rgba(0, 0, 0, 0.02) 0px 0px 1px, rgba(0, 0, 0, 0.02) 0px 4px 8px,
    rgba(0, 0, 0, 0.02) 0px 16px 24px, rgba(0, 0, 0, 0.02) 0px 24px 32px;
  border-width: 1px;
  border-style: solid;
  border-color: rgba(255, 255, 255, 0.19);
}

.profit-border {
  box-shadow: rgba(0, 0, 0, 0.02) 0px 0px 1px, rgba(0, 0, 0, 0.02) 0px 4px 8px,
    rgba(0, 0, 0, 0.02) 0px 16px 24px, rgba(0, 0, 0, 0.02) 0px 24px 32px;
  border-width: 1px;
  border-style: solid;
  border-color: rgba(49, 208, 170, 0.5);
}

.loss-border {
  box-shadow: rgba(0, 0, 0, 0.02) 0px 0px 1px, rgba(0, 0, 0, 0.02) 0px 4px 8px,
    rgba(0, 0, 0, 0.02) 0px 16px 24px, rgba(0, 0, 0, 0.02) 0px 24px 32px;
  border-width: 1px;
  border-style: solid;
  border-color: rgba(237, 75, 158, 0.5);
}

::-webkit-scrollbar {
  width: 15px;
}

/* Track */
::-webkit-scrollbar-track {
  background: #3e3e42;
}

/* Handle */
::-webkit-scrollbar-thumb {
  border-radius: 10px;
  background: #555;
}

/* Handle on hover */
::-webkit-scrollbar-thumb:hover {
  background: #5f5f5f;
}
</style>
