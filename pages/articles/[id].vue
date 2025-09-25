<script setup>
import { ref } from 'vue';
import { useRoute } from 'vue-router';
import newsData from '@/data/news.json'; // Assuming the JSON data is imported directly for simplicity

const route = useRoute();
const articleId = route.params.id;

const article = ref(null);
// Dummy example: Fetch the company's name based on companyId.
// Replace this with your actual logic to fetch company data.
// const companyName = ref('');
// const company = assetsStore.assets.categories.flatMap(category => category.companies).find(c => c.id === companyId);
// if (company) {
// companyName.value = company.name;
// }

// Find the article by ID across all categories
for (const category of newsData.categories) {
    const foundArticle = category.articles.find(a => a.id === articleId);
    if (foundArticle) {
        article.value = foundArticle;
        break;
    }
}
const imageUrl = "https://img.freepik.com/free-photo/3d-rendering-cute-girl-with-glasses-working-her-laptop_1057-45909.jpg?t=st=1716381309~exp=1716384909~hmac=9c99dd039cad41bbd7f9c701e338644c6467b8e24b469c7fa1b5dcfe34d30f78&w=1380";
</script>

<template>
<div class="article-container">
    <div class="tags-list-container">
        <div class="tag-item">
            <span>Test tag</span>
        </div>
        <!-- <div class="tag-item" v-for="tag in article.tags">
            <span>{{ tag }}</span>
        </div> -->
    </div>
    <div class="article-source-info">
        <div class="article-source-info-item">
            <div class="article-source-info-item-text">
                <p>Publish by: </p>
            </div>
            <div class="article-source-info-item-icon">
                <img :src=imageUrl alt="source-icon" width="16" height="16" />
            </div>
            <div class="article-source-info-item-data">
                <span>publisher</span>
            </div>
        </div>
        <div class="article-source-info-item">
            <div class="article-source-info-item-text">
                <p>Posted/Updated: </p>
            </div>
            <div class="article-source-info-item-data">
                <span>3 hours ago</span>
            </div>
        </div>
        <div class="article-source-info-item">
            <div class="article-source-info-item-text">
                <p>Source: </p>
            </div>
            <div class="article-source-info-item-data">
                <span>News'source</span>
            </div>
        </div>
    </div>
    <div class="assets-list-container">
        <div class="assets-list-container-item">
            <div class="assets-list-container-item-title">
                <span>Asset 1</span>
            </div>
            <div class="assets-list-container-item-logo">
                <img :src="imageUrl" alt="asset-logo" width="16" height="16" />
            </div>
        </div>
    </div>
</div>
    <div v-if="article">      
        <div class="article-title">
            <h1>{{ article.title }}</h1>
        <img :src="imageUrl" alt="article logo" width="120" height="120" />
      </div>
      <div class="article-content">
        <p>{{ article.content }}</p>
      </div>
    <WidgetSentiment />
    </div>
    <div v-else>
        <p>Article not found.</p>
    </div>
</template>

<style scoped>
.article-source-info {
    display: flex;
    padding: 3px;
    justify-content: center;
    align-items: center;
    gap: 16px;
    align-self: stretch;
    border-radius: 5px;
    background-color: rgba(33, 33, 33, 1);
    box-shadow: 0px 4px 4px 0px rgba(0, 0, 0, 0.25) inset;
}
.article-source-info-item{
    display: flex;
    padding: 1px;
    justify-content: center;
    align-items: center;
    gap: 4px;
}
.article-source-info-item-text {
    color: #FFF;
    text-align: center;
    font-family: "Open Sans";
    font-size: 8px;
    font-style: italic;
    font-weight: 400;
    line-height: normal;
}
.article-source-info-item-icon {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 12px;
    height: 12px;
    border-radius: 12px;
    background: url(imageUrl) lightgray 50% / cover no-repeat;
}
.article-source-info-item-data {
    color: #FFF;
    text-align: center;
    font-family: "Open Sans";
    font-size: 8px;
    font-style: italic;
    font-weight: 400;
    line-height: normal;
}
.assets-list-container {
    display: flex;
    padding: 1px 10px;
    align-items: center;
    gap: 10px;
    align-self: stretch;
    border-radius: 6px;
    background: rgba(34, 34, 34, 0.50);
    box-shadow: 0px -3px 4px 0px rgba(0, 0, 0, 0.25) inset, 0px 3px 4px 0px rgba(0, 0, 0, 0.25) inset;
}
.assets-list-container-item {
    display: flex;
    padding: 1px;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    background: rgba(34, 34, 34, 0.50);
    box-shadow: 0px 0.5px 3px 0px rgba(255, 255, 255, 0.20) inset, 0px 0.5px 3px 0px rgba(0, 0, 0, 0.20);
}
.assets-list-container-item-title {
    display: flex;
    justify-content: center;
    align-items: center;
    color: #FFF;
    text-align: center;
    font-family: "Open Sans";
    font-size: 10px;
    font-style: italic;
    font-weight: 600;
    line-height: normal;
}
.assets-list-container-item-logo {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 2px;
    padding: 1.151px;
    flex-direction: column;
    border-radius: 3px 0px;
    background: rgba(34, 34, 34, 0.50);
    box-shadow: 0px 1px 3px 0px rgba(0, 0, 0, 0.20) inset, 0px 1px 3px 0px rgba(255, 255, 255, 0.20);
}
.assets-list-container-item-logo img {
    width: 16px;
    height: 16px;
    border-radius: 20px;
    background: url(imageUrl) lightgray 50% / cover no-repeat;
}
.container-assetwidgets {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1rem;
}
.tags-list-container {
    display: flex;
    padding: 0.3rem 0.5rem;
    justify-content: center;
    align-items: center;
    gap: 0.5rem;
    border-radius: 0px 4px;
    background: rgba(34, 34, 34, 0.50);
    box-shadow: 0px 3px 3px 0px rgba(0, 0, 0, 0.25) inset, 0px 1.5px 8px 0px rgba(255, 255, 255, 0.20);
}
.tag-item {
    color: #FFF;
    text-align: center;
    font-family: "Open Sans";
    font-size: 10px;
    font-style: italic;
    font-weight: 400;
    line-height: normal;
    background-color: #b63535;
    padding: 4px 8px;
    border-radius: 4px;
    display: flex;
    justify-content: center;
    align-items: center;
}
</style>

