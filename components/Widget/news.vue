<script setup>
defineProps({
    article: {
        type: Object,
        required: true,
    },
});
</script>

<template>
<div class="widget-news">
    <div class="arrow-buttons">
        <ButtonUparrow />
        <ButtonDownarrow />
    </div>
    <div class="news-cards">
        <NuxtLink :to="`/articles/${article.id}`" class="link-full-width">
        <div class="news-card-content" :style="{ backgroundImage: `url(${article.imageUrl})` }">
            <div class="news-card-text">
                <h3 class="news-title">{{ article.title }}</h3>
                <p class="news-description">{{ article.content }}</p>
                <div class="news-informations">
                    <p class="news-date">{{ article.publishing_date }}</p>
                    <p class="news-author">{{ article.author }}</p>
                    <p class="news-source">{{ article.source }}</p>
                </div>
            </div>
        </div>
        </NuxtLink>
    </div>
</div>
</template>

<style scoped>
.widget-news {
    display: flex;
    background-color: #1a1a1a;
    position: relative;
    margin: 0.3rem 0.1rem;
    width: 100%;
    padding: 10px;
}

.arrow-buttons {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
    box-shadow: -5px 0px 10px 0px rgba(0, 0, 0, 0.5), inset 5px 0px 10px 0px rgba(255, 255, 255, 0.5);
    margin-left: 10px;
}

.news-cards {
    display: flex;
    width: 100%;
    padding: 10px 0;
}


.news-card {
    flex: 1;
    width: 100%;
    cursor: pointer;
    border-radius: 10px;
    overflow: hidden;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
    background-color: #333;
    color: #fff;
    position: relative;
}

.news-card-content {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    width: 100%;
    height: 100%;
    background-size: cover;
    background-position: center;
    padding: 10px;
    text-align: center;
    position: relative;
}

.news-card-text {
    background: rgba(0, 0, 0, 0.5);
    padding: 1px;
    border-radius: 10px;
    /* position: absolute; */
    bottom: 0;
    width: 100%;
}

.news-title {
    font-size: 1.5rem;
    font-weight: bold;
    margin: 0;
}

.news-description {
    font-size: 1rem;
    margin: 5px 0;
}

.news-informations {
    font-size: 0.8rem;
    font-style: italic;
    margin-top: 5px;
}

.news-date,
.news-author,
.news-source {
    margin: 1px;
}
</style>

