<script setup>
import { ref } from 'vue';
import { useNewsStore } from "@/stores/newsStore.ts";

definePageMeta({
  title: 'News',
  description: 'News and events',
  layout: 'news',
})

const newsStore = useNewsStore();
const selectedCategoryName = ref(newsStore.news.categories[0]?.name); // Default to the first category
</script>
<template>
<div class="NewsPage">
    <h4>News Page</h4>
</div>
<div class="news-alt-options">
    <h3>Calendar</h3>
    <h4>UpComing events</h4>
</div>
<WidgetFilter />

<div class="NewsBoard">
    <div class="Tabs">
        <div v-for="category in newsStore.news.categories" :key="category.name" class="Tab" :class="{active: category.name === selectedCategoryName}" @click="selectedCategoryName = category.name">
            {{ category.name }}
        </div>
    </div>
    <div v-if="selectedCategoryName" class="news">
        <div v-for="article in newsStore.news.categories.find(category => category.name === selectedCategoryName).articles" :key="article.id" class="article">
            <WidgetNews :article="article" />
        </div>
    </div>
<div class="selection-ranking">
    <div class="selection-ranking-item">
        <p>Popular</p>
    </div>
</div>
</div>
</template>
<style scoped>
.NewsPage{
    width: 100%;
    height: 100%;
    background-color: rgb(33, 33, 33);
}
.news {
    flex: 1;
    background-color: rgb(121, 121, 121);
    margin: 0.6rem;
    padding: 0.3rem;
    border: 1px solid #ccc;
}
.news-alt-options{
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-direction: column;
}
.article {
    color: #ffffff;
    background-color: #111111;
    margin: 1rem;
    padding: 0.5rem;
    border: 0.1rem solid #979797;
}
.selection-ranking{
    display: flex;
    /* width: 430px; */
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
}
.selection-ranking-item{
    display: flex;
    /* width: 426px;
    height: 103px; */
    padding: 2px 10px;
    justify-content: center;
    align-items: center;
    gap: 3px;
    color: #888;
    font-variant-numeric: lining-nums tabular-nums;
    font-feature-settings: 'clig' off, 'liga' off;
    font-family: "Open Sans";
    font-size: 14px;
    font-style: normal;
    font-weight: 400;
    line-height: 138%; /* 19.32px */
    letter-spacing: 0.1px;
}
.title {
    font-size: 1.1rem;
    font-weight: bold;
}
.Tabs {
    display: flex;
    margin-bottom: 1rem;
}
.Tab {
    padding: 0.5rem;
    cursor: pointer;
    border: 1px solid #ccc;
    margin-right: 0.5rem;
}
.Tab.active {
    background-color: #ddd;
}
</style>

